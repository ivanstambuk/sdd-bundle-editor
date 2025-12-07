import { FastifyInstance } from 'fastify';
import { assertCleanNonMainBranch } from '@sdd-bundle-editor/git-utils';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AgentService } from '../services/agent/AgentService';

async function resolveBundleDir(queryDir?: string): Promise<string> {
    if (!queryDir) {
        throw new Error('bundleDir parameter is required for agent operations.');
    }
    const baseDir = path.resolve(queryDir);
    const manifestPath = path.join(baseDir, 'sdd-bundle.yaml');
    try {
        await fs.access(manifestPath);
        return baseDir;
    } catch {
        throw new Error(`sdd-bundle.yaml not found in ${baseDir}`);
    }
}

export async function agentRoutes(fastify: FastifyInstance) {
    // Helper to get current backend (it handles reconfiguration)
    const getBackend = () => AgentService.getInstance().getBackend();

    fastify.post('/agent/start', async (request, reply) => {
        try {
            const body = (request.body as { bundleDir?: string; readOnly?: boolean }) || {};
            const bundleDir = await resolveBundleDir(body.bundleDir);

            // Git check deferred to accept (write) time
            const state = await getBackend().startConversation({
                bundleDir,
                readOnly: body.readOnly ?? true, // Default to read-only for safety
                // We'll populate other context fields (bundle, diagnostics) later as needed
            });
            return reply.send({ state });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });

    fastify.post('/agent/message', async (request, reply) => {
        try {
            const body = (request.body as { message: string, bundleDir?: string }) || {};
            if (!body.message) {
                return reply.status(400).send({ error: 'Message content required' });
            }

            const state = await getBackend().sendMessage(body.message);
            return reply.send({ state });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });

    fastify.get('/agent/status', async (_request, reply) => {
        const state = await getBackend().getStatus();
        const config = AgentService.getInstance().getConfig();
        return reply.send({ state, config });
    });

    fastify.post('/agent/config', async (request, reply) => {
        try {
            const config = (request.body as any);
            if (!config || !config.type) {
                return reply.status(400).send({ error: 'Invalid configuration' });
            }
            await AgentService.getInstance().saveConfig(config);
            // Update reference to new backend
            // Note: In a real app we might want to handle concurrent requests better, 
            // but for this single-user tool it's fine.
            return reply.send({ success: true });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });

    fastify.post('/agent/accept', async (request, reply) => {
        try {
            const body = (request.body as { changes?: any[] }) || {};
            // Ensure git is clean before applying changes
            const query = request.query as { bundleDir?: string };
            const bundleDir = await resolveBundleDir(query.bundleDir); // Resolves to CWD by default if no arg
            await assertCleanNonMainBranch(bundleDir);

            let changes = body.changes || [];

            if (changes.length === 0) {
                // If no changes provided, try to apply all pending changes from state
                const currentStatus = await getBackend().getStatus();
                if (currentStatus.pendingChanges && currentStatus.pendingChanges.length > 0) {
                    changes = currentStatus.pendingChanges;
                } else {
                    return reply.status(400).send({ error: 'No pending changes to apply' });
                }
            }

            // 1. Load current bundle
            const { loadBundleWithSchemaValidation, saveEntity, applyChange } = await import('@sdd-bundle-editor/core-model');
            const { commitChanges } = await import('@sdd-bundle-editor/git-utils');
            const { execFile } = await import('node:child_process');
            const util = await import('node:util');
            const execFileAsync = util.promisify(execFile);

            const { bundle } = await loadBundleWithSchemaValidation(bundleDir);

            // 2. Apply changes to in-memory bundle and track modified files
            const modifiedFiles = new Set<string>();
            const modifiedEntities = new Set<string>();

            for (const change of changes) {
                try {
                    applyChange(bundle, change);
                    const entityMap = bundle.entities.get(change.entityType);
                    const entity = entityMap?.get(change.entityId);
                    if (entity && entity.filePath) {
                        modifiedFiles.add(entity.filePath);
                        modifiedEntities.add(`${change.entityType}:${change.entityId}`);
                        // 3. Write modified entity to disk
                        await saveEntity(entity);
                    }
                } catch (err) {
                    // If application fails in-memory, we should probably stop and revert?
                    // Since we haven't committed, and we track files, we can revert.
                    const message = err instanceof Error ? err.message : String(err);
                    return reply.status(400).send({ error: `Failed to apply change: ${message}` });
                }
            }

            if (modifiedFiles.size === 0) {
                return reply.status(400).send({ error: 'No files were modified by the proposed changes.' });
            }

            // 4. Validate changes
            const { diagnostics } = await loadBundleWithSchemaValidation(bundleDir);
            const hasErrors = diagnostics.some(d => d.severity === 'error');

            if (hasErrors) {
                // Revert changes
                const filesToRevert = Array.from(modifiedFiles);
                await execFileAsync('git', ['checkout', '--', ...filesToRevert], { cwd: bundleDir });

                return reply.status(400).send({
                    error: 'Validation failed after applying changes. Changes have been reverted.',
                    diagnostics
                });
            }

            // 5. Commit changes
            const filesToCommit = Array.from(modifiedFiles);
            // We use relative paths for git commit generally, or absolute? 
            // git-utils commitChanges runs in cwd, so relative is best?
            // saveEntity uses absolute paths. 
            // Let's pass absolute paths to commitChanges, git usually handles it or we make relative.
            // git-utils implementation: `args.push(...files)`.
            // If we are in the repo root, absolute paths *might* work but safer to make relative.
            const relativeFiles = filesToCommit.map(f => path.relative(bundleDir, f));

            await commitChanges(bundleDir, 'Applied changes via Agent', relativeFiles);

            // 6. Notify backend
            const state = await getBackend().applyChanges(changes);

            return reply.send({ state, commited: true });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });

    fastify.post('/agent/decision', async (request, reply) => {
        try {
            const body = (request.body as { decisionId: string, optionId: string }) || {};
            if (!body.decisionId || !body.optionId) {
                return reply.status(400).send({ error: 'decisionId and optionId required' });
            }

            const state = await getBackend().resolveDecision(body.decisionId, body.optionId);
            return reply.send({ state });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });

    fastify.post('/agent/abort', async (_request, reply) => {
        const state = await getBackend().abortConversation();
        return reply.send({ state });
    });
}
