import { FastifyInstance } from 'fastify';
import { assertCleanNonMainBranch, getGitStatus } from '@sdd-bundle-editor/git-utils';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AgentService } from '../services/agent/AgentService';
import {
    AgentStartRequestSchema,
    AgentMessageRequestSchema,
    AgentStatusResponseSchema,
    AgentRollbackRequestSchema,
    AgentRollbackResponseSchema,
    AgentHealthResponseSchema,
    AgentDecisionRequestSchema,
    AgentConfigRequestSchema,
    ErrorResponseSchema,
} from '@sdd-bundle-editor/shared-types';

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

    fastify.post('/agent/start', {
        schema: {
            tags: ['agent'],
            description: 'Start a new agent conversation',
            body: AgentStartRequestSchema,
            response: {
                200: AgentStatusResponseSchema,
                400: ErrorResponseSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const body = request.body as { bundleDir?: string; readOnly?: boolean };
            const bundleDir = await resolveBundleDir(body.bundleDir);

            // Load bundle to provide context to agent
            const { loadBundleWithSchemaValidation } = await import('@sdd-bundle-editor/core-model');
            const { bundle } = await loadBundleWithSchemaValidation(bundleDir);

            // Git check deferred to accept (write) time
            const state = await getBackend().startConversation({
                bundleDir,
                bundle: { bundle },
                readOnly: body.readOnly ?? true,
            });
            return reply.send({ state });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });

    fastify.post('/agent/message', async (request, reply) => {
        try {
            const body = (request.body as { message: string, bundleDir?: string, model?: string, reasoningEffort?: string }) || {};
            if (!body.message) {
                return reply.status(400).send({ error: 'Message content required' });
            }

            // If model params are provided, update the config (but don't recreate backend)
            if (body.model || body.reasoningEffort) {
                const agentService = AgentService.getInstance();
                const currentConfig = agentService.getConfig();
                // Update config in-place without recreating backend
                if (body.model) {
                    currentConfig.model = body.model;
                }
                if (body.reasoningEffort) {
                    currentConfig.reasoningEffort = body.reasoningEffort as any;
                }
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

    // Health endpoint for mid-conversation monitoring
    // Returns conversation state + Git status for detecting dirty state
    fastify.get('/agent/health', async (request, reply) => {
        try {
            const query = request.query as { bundleDir?: string };
            const state = await getBackend().getStatus();

            let gitStatus: { isRepo: boolean; branch?: string; isClean?: boolean } = { isRepo: false };
            if (query.bundleDir) {
                gitStatus = await getGitStatus(query.bundleDir);
            }

            const hasPendingChanges = (state.pendingChanges?.length ?? 0) > 0;

            return reply.send({
                conversationStatus: state.status,
                hasPendingChanges,
                git: {
                    isRepo: gitStatus.isRepo,
                    branch: gitStatus.branch,
                    isClean: gitStatus.isClean,
                },
                canAcceptChanges: state.status === 'active' && hasPendingChanges && gitStatus.isClean === true,
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: (err as Error).message });
        }
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
            if (process.env.TEST_MODE !== 'true') {
                await assertCleanNonMainBranch(bundleDir);
            }

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
            const { loadBundleWithSchemaValidation, saveEntity, applyChangesToBundle } = await import('@sdd-bundle-editor/core-model');
            const { commitChanges } = await import('@sdd-bundle-editor/git-utils');
            const { execFile } = await import('node:child_process');
            const util = await import('node:util');
            const execFileAsync = util.promisify(execFile);

            const { bundle } = await loadBundleWithSchemaValidation(bundleDir);

            // 2. Apply changes to in-memory bundle using the service
            const result = applyChangesToBundle(bundle, bundleDir, changes);

            if (!result.success) {
                return reply.status(400).send({
                    error: `Failed to apply changes: ${result.errors?.join(', ') ?? 'Unknown error'}`
                });
            }

            const modifiedFiles = new Set(result.modifiedFiles);

            // 3. Create directories for new entity files and write entities to disk
            for (const entityKey of result.modifiedEntities) {
                const [entityType, entityId] = entityKey.split(':');
                const entityMap = bundle.entities.get(entityType);
                const entity = entityMap?.get(entityId);
                if (entity) {
                    // Ensure directory exists for new entities
                    const entityDir = path.dirname(entity.filePath);
                    await fs.mkdir(entityDir, { recursive: true });

                    await saveEntity(entity);
                }
            }

            if (modifiedFiles.size === 0) {
                return reply.status(400).send({ error: 'No files were modified by the proposed changes.' });
            }

            // 4. Validate changes
            const { bundle: updatedBundle, diagnostics } = await loadBundleWithSchemaValidation(bundleDir);
            const hasErrors = diagnostics.some(d => d.severity === 'error');

            if (hasErrors) {
                // Revert changes - handle new files vs existing files differently
                const filesToRevert = Array.from(modifiedFiles);

                // Check which files are tracked by git (existing) vs untracked (new)
                const { stdout: gitStatusOutput } = await execFileAsync('git', ['status', '--porcelain', '--', ...filesToRevert], { cwd: bundleDir });
                const statusLines = gitStatusOutput.toString().trim().split('\n').filter(l => l);

                const untrackedFiles: string[] = [];
                const trackedFiles: string[] = [];

                for (const line of statusLines) {
                    const status = line.substring(0, 2);
                    const filePath = line.substring(3);
                    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(bundleDir, filePath);

                    if (status.includes('?')) {
                        // Untracked (new) file - needs to be deleted
                        untrackedFiles.push(absolutePath);
                    } else {
                        // Modified tracked file - can use git checkout
                        trackedFiles.push(absolutePath);
                    }
                }

                // Delete untracked new files
                for (const file of untrackedFiles) {
                    try {
                        await fs.unlink(file);
                    } catch (e) {
                        fastify.log.warn(`Failed to delete untracked file ${file}: ${(e as Error).message}`);
                    }
                }

                // Revert tracked files with git checkout
                if (trackedFiles.length > 0) {
                    try {
                        await execFileAsync('git', ['checkout', '--', ...trackedFiles], { cwd: bundleDir });
                    } catch (e) {
                        fastify.log.warn(`Failed to revert some files: ${(e as Error).message}`);
                    }
                }

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
            const state = await getBackend().applyChanges(changes, { bundle: updatedBundle });

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

    fastify.post('/agent/abort', async (request, reply) => {
        try {
            const body = (request.body as { bundleDir?: string }) || {};

            // If there are pending changes and a bundleDir, revert any uncommitted files
            const currentStatus = await getBackend().getStatus();
            let revertedFiles: string[] = [];

            if (body.bundleDir && currentStatus.pendingChanges && currentStatus.pendingChanges.length > 0) {
                const { execFile } = await import('node:child_process');
                const util = await import('node:util');
                const execFileAsync = util.promisify(execFile);

                try {
                    // Get list of modified files in working tree
                    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: body.bundleDir });
                    const modifiedFiles = stdout.toString().trim().split('\n')
                        .filter(line => line.trim())
                        .map(line => line.substring(3)); // Remove status prefix (e.g., " M ")

                    if (modifiedFiles.length > 0) {
                        await execFileAsync('git', ['checkout', '--', ...modifiedFiles], { cwd: body.bundleDir });
                        revertedFiles = modifiedFiles;
                    }
                } catch (gitErr) {
                    fastify.log.warn(`Failed to revert files during abort: ${(gitErr as Error).message}`);
                    // Continue with abort even if revert fails
                }
            }

            const state = await getBackend().abortConversation();
            return reply.send({
                state,
                revertedFiles,
                message: revertedFiles.length > 0
                    ? `Aborted conversation and reverted ${revertedFiles.length} file(s).`
                    : 'Aborted conversation.'
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });

    // Reset endpoint for testing: clears all agent state memory
    fastify.post('/agent/reset', async (_request, reply) => {
        try {
            await AgentService.getInstance().reset();
            return reply.send({ success: true, message: 'Agent state reset.' });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: (err as Error).message });
        }
    });

    // Rollback endpoint: reverts file changes but keeps conversation active (unlike abort)
    // This allows users to retry or iterate after a failed apply attempt
    fastify.post('/agent/rollback', async (request, reply) => {
        try {
            const body = (request.body as { bundleDir?: string }) || {};
            let revertedFiles: string[] = [];

            if (body.bundleDir) {
                const { execFile } = await import('node:child_process');
                const util = await import('node:util');
                const execFileAsync = util.promisify(execFile);

                try {
                    // Get list of modified files in working tree
                    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: body.bundleDir });
                    const modifiedFiles = stdout.toString().trim().split('\n')
                        .filter(line => line.trim())
                        .map(line => line.substring(3)); // Remove status prefix (e.g., " M ")

                    if (modifiedFiles.length > 0) {
                        await execFileAsync('git', ['checkout', '--', ...modifiedFiles], { cwd: body.bundleDir });
                        revertedFiles = modifiedFiles;
                    }
                } catch (gitErr) {
                    fastify.log.warn(`Failed to revert files during rollback: ${(gitErr as Error).message}`);
                }
            }

            // Clear pending changes but keep conversation active
            const state = await getBackend().clearPendingChanges();

            return reply.send({
                state,
                revertedFiles,
                message: revertedFiles.length > 0
                    ? `Rolled back ${revertedFiles.length} file(s). Conversation is still active.`
                    : 'No files to roll back. Conversation is still active.'
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: (err as Error).message });
        }
    });
}
