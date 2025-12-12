/**
 * Unit tests for OpenAiAgentBackend.
 * Tests initialization, state management, and error handling.
 * 
 * Note: Actual API calls are tested via E2E tests.
 * These tests focus on the backend's state machine behavior.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAiAgentBackend } from './OpenAiAgentBackend';

describe('OpenAiAgentBackend', () => {
    let backend: OpenAiAgentBackend;

    const validConfig = {
        type: 'http' as const,
        model: 'deepseek-chat',
        options: {
            apiKey: 'test-api-key',
            baseURL: 'https://api.deepseek.com',
        },
    };

    beforeEach(() => {
        backend = new OpenAiAgentBackend();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
        // Clean up env vars
        delete process.env.DEEPSEEK_API_KEY;
        delete process.env.AGENT_HTTP_API_KEY;
    });

    describe('initialize', () => {
        it('should store config and set idle status', async () => {
            await backend.initialize(validConfig);

            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
            expect(status.messages).toEqual([]);
        });

        it('should throw error when API key is missing', async () => {
            await expect(
                backend.initialize({
                    type: 'http',
                    model: 'deepseek-chat',
                })
            ).rejects.toThrow('API Key required');
        });

        it('should accept DEEPSEEK_API_KEY from environment', async () => {
            process.env.DEEPSEEK_API_KEY = 'env-api-key';

            await backend.initialize({
                type: 'http',
                model: 'deepseek-chat',
            });

            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
        });

        it('should accept AGENT_HTTP_API_KEY from environment', async () => {
            process.env.AGENT_HTTP_API_KEY = 'env-api-key';

            await backend.initialize({
                type: 'http',
                model: 'deepseek-chat',
            });

            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
        });
    });

    describe('startConversation', () => {
        beforeEach(async () => {
            await backend.initialize(validConfig);
        });

        it('should set active status', async () => {
            const state = await backend.startConversation({
                bundleDir: '/test/bundle',
            });

            expect(state.status).toBe('active');
        });

        it('should clear any previous messages', async () => {
            const state = await backend.startConversation({
                bundleDir: '/test/bundle',
            });

            expect(state.messages).toEqual([]);
        });

        it('should handle focused entity in context', async () => {
            const state = await backend.startConversation({
                bundleDir: '/test/bundle',
                focusedEntity: { type: 'Requirement', id: 'REQ-001' },
            });

            expect(state.status).toBe('active');
        });

        it('should handle readOnly mode', async () => {
            const state = await backend.startConversation({
                bundleDir: '/test/bundle',
                readOnly: true,
            });

            expect(state.status).toBe('active');
        });
    });

    describe('applyChanges', () => {
        beforeEach(async () => {
            await backend.initialize(validConfig);
            await backend.startConversation({ bundleDir: '/test' });
        });

        it('should clear pending changes and set active status', async () => {
            const changes = [{
                entityType: 'Requirement',
                entityId: 'REQ-001',
                fieldPath: 'title',
                originalValue: 'Old',
                newValue: 'New',
            }];

            const state = await backend.applyChanges(changes);

            expect(state.pendingChanges).toBeUndefined();
            expect(state.status).toBe('active');
        });

        it('should add system message about applied changes', async () => {
            const changes = [{
                entityType: 'Requirement',
                entityId: 'REQ-001',
                fieldPath: 'title',
                originalValue: 'Old',
                newValue: 'New',
            }];

            const state = await backend.applyChanges(changes);

            const systemMessages = state.messages.filter(m => m.role === 'system');
            expect(systemMessages.length).toBeGreaterThan(0);
            expect(systemMessages[0].content).toContain('Changes have been successfully applied');
        });
    });

    describe('abortConversation', () => {
        it('should reset to idle state from active', async () => {
            await backend.initialize(validConfig);
            await backend.startConversation({ bundleDir: '/test' });

            const state = await backend.abortConversation();

            expect(state.status).toBe('idle');
            expect(state.messages).toEqual([]);
        });

        it('should work even if not initialized', async () => {
            const state = await backend.abortConversation();

            expect(state.status).toBe('idle');
        });
    });

    describe('clearPendingChanges', () => {
        it('should clear pending changes', async () => {
            await backend.initialize(validConfig);
            await backend.startConversation({ bundleDir: '/test' });

            const state = await backend.clearPendingChanges();

            expect(state.pendingChanges).toBeUndefined();
        });
    });

    describe('resolveDecision', () => {
        it('should return current state (no-op for HTTP backend)', async () => {
            await backend.initialize(validConfig);
            await backend.startConversation({ bundleDir: '/test' });

            const state = await backend.resolveDecision('dec-1', 'opt-a');

            expect(state).toBeDefined();
            expect(state.status).toBe('active');
        });
    });

    describe('getStatus', () => {
        it('should return idle status before initialization', async () => {
            const status = await backend.getStatus();

            expect(status.status).toBe('idle');
        });

        it('should return active status after starting conversation', async () => {
            await backend.initialize(validConfig);
            await backend.startConversation({ bundleDir: '/test' });

            const status = await backend.getStatus();

            expect(status.status).toBe('active');
        });
    });
});
