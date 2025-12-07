import { FastifyInstance } from 'fastify';
import { assertCleanNonMainBranch } from '@sdd-bundle-editor/git-utils';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { AgentService } from '../services/agent/AgentService';

async function resolveBundleDir(queryDir?: string): Promise<string> {
    const baseDir = queryDir ? path.resolve(queryDir) : process.cwd();
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
            const body = (request.body as { bundleDir?: string }) || {};
            const bundleDir = await resolveBundleDir(body.bundleDir);

            // Git check deferred to accept (write) time
            const state = await getBackend().startConversation({
                bundleDir,
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
            const bundleDir = await resolveBundleDir(); // Resolves to CWD by default if no arg
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

            const state = await getBackend().applyChanges(changes);
            return reply.send({ state });
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
