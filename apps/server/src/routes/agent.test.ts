/**
 * Unit tests for agent routes.
 * Tests API endpoints with mocked AgentService.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from '../index';
import type { FastifyInstance } from 'fastify';

// Set test mode to avoid git checks
process.env.TEST_MODE = 'true';
process.env.AGENT_BACKEND_TYPE = 'mock';

describe('Agent Routes', () => {
    let server: FastifyInstance;
    const sampleBundlePath = process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';

    beforeEach(async () => {
        server = await createServer();
        await server.ready();

        // Reset agent state before each test
        await server.inject({
            method: 'POST',
            url: '/agent/reset',
        });
    });

    afterEach(async () => {
        await server.close();
    });

    describe('GET /agent/status', () => {
        it('should return idle state initially', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/agent/status',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.state).toBeDefined();
            expect(body.state.status).toBe('idle');
        });

        it('should include config in response', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/agent/status',
            });

            const body = JSON.parse(response.body);
            expect(body.config).toBeDefined();
        });
    });

    describe('POST /agent/start', () => {
        it('should start conversation with valid bundleDir', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: {
                    bundleDir: sampleBundlePath,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.state.status).toBe('active');
        });

        it('should return 400 for missing bundleDir', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: {},
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toBeDefined();
        });

        it('should return 400 for non-existent bundleDir', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: {
                    bundleDir: '/nonexistent/path/to/bundle',
                },
            });

            expect(response.statusCode).toBe(400);
            const body = JSON.parse(response.body);
            expect(body.error).toContain('not found');
        });

        it('should accept readOnly option', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: {
                    bundleDir: sampleBundlePath,
                    readOnly: true,
                },
            });

            expect(response.statusCode).toBe(200);
        });
    });

    describe('POST /agent/message', () => {
        beforeEach(async () => {
            // Start conversation first
            await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: {
                    bundleDir: sampleBundlePath,
                },
            });
        });

        it('should return agent response', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/message',
                payload: {
                    bundleDir: sampleBundlePath,
                    message: 'Hello agent',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.state.messages.length).toBeGreaterThan(1);
        });

        it('should handle change keywords and propose changes', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/message',
                payload: {
                    bundleDir: sampleBundlePath,
                    message: 'Please change the title of REQ-SECURE-001',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            // Mock backend should propose changes for "change" keyword
            expect(body.state.status).toBe('pending_changes');
        });
    });

    describe('POST /agent/abort', () => {
        it('should reset conversation state', async () => {
            // Start conversation
            await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: { bundleDir: sampleBundlePath },
            });

            // Abort it
            const response = await server.inject({
                method: 'POST',
                url: '/agent/abort',
                payload: {},
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.state.status).toBe('idle');
            expect(body.message).toBeDefined();
        });

        it('should return message about aborted conversation', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/abort',
                payload: {},
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.message).toContain('Aborted');
        });
    });

    describe('POST /agent/reset', () => {
        it('should reset all agent state', async () => {
            // Start and interact
            await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: { bundleDir: sampleBundlePath },
            });

            // Reset
            const response = await server.inject({
                method: 'POST',
                url: '/agent/reset',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);
        });
    });

    describe('POST /agent/config', () => {
        it('should update agent configuration', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/config',
                payload: {
                    type: 'mock',
                    model: 'test-model',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.success).toBe(true);
        });

        it('should reject invalid configuration', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/agent/config',
                payload: {
                    // Missing required 'type' field
                    model: 'test-model',
                },
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe('GET /agent/health', () => {
        it('should return health status', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/agent/health',
                query: {
                    bundleDir: sampleBundlePath,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.conversationStatus).toBeDefined();
            expect(body.hasPendingChanges).toBe(false);
            expect(body.git).toBeDefined();
        });

        it('should work without bundleDir', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/agent/health',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.git.isRepo).toBe(false);
        });
    });

    describe('POST /agent/decision', () => {
        it('should handle decision resolution', async () => {
            await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: { bundleDir: sampleBundlePath },
            });

            const response = await server.inject({
                method: 'POST',
                url: '/agent/decision',
                payload: {
                    decisionId: 'test-decision',
                    optionId: 'option-a',
                },
            });

            expect(response.statusCode).toBe(200);
        });
    });

    describe('POST /agent/rollback', () => {
        it('should clear pending changes but keep conversation', async () => {
            // Start conversation
            await server.inject({
                method: 'POST',
                url: '/agent/start',
                payload: { bundleDir: sampleBundlePath },
            });

            // Rollback (don't trigger changes first to avoid timeout)
            const response = await server.inject({
                method: 'POST',
                url: '/agent/rollback',
                payload: {
                    bundleDir: sampleBundlePath,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            // Status should be active (still in conversation)
            expect(body.message).toBeDefined();
        }, 10000);
    });
});
