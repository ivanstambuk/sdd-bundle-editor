/**
 * Unit tests for CliAgentBackend.
 * Tests initialization, state management, and basic operations.
 * 
 * Note: Actual CLI spawning is tested via E2E tests.
 * These tests focus on the backend's state machine behavior.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CliAgentBackend } from './CliAgentBackend';

describe('CliAgentBackend', () => {
    let backend: CliAgentBackend;

    beforeEach(() => {
        backend = new CliAgentBackend();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialize', () => {
        it('should store config and set idle status', async () => {
            await backend.initialize({
                type: 'cli',
                model: 'gpt-5.1',
                options: { command: 'codex' },
            });

            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
            expect(status.messages).toEqual([]);
        });

        it('should accept config without options', async () => {
            await backend.initialize({
                type: 'cli',
            });

            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
        });

        it('should accept config with model and reasoning settings', async () => {
            await backend.initialize({
                type: 'cli',
                model: 'gpt-5.1',
                reasoningEffort: 'high',
                reasoningSummary: 'auto',
            });

            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
        });
    });

    describe('abortConversation', () => {
        it('should reset state to idle', async () => {
            await backend.initialize({ type: 'cli' });

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
            await backend.initialize({ type: 'cli' });

            const state = await backend.clearPendingChanges();

            expect(state.pendingChanges).toBeUndefined();
        });
    });

    describe('getStatus', () => {
        it('should return current state', async () => {
            await backend.initialize({ type: 'cli' });

            const status = await backend.getStatus();

            expect(status).toHaveProperty('status');
            expect(status).toHaveProperty('messages');
        });

        it('should return idle status by default', async () => {
            const status = await backend.getStatus();

            expect(status.status).toBe('idle');
        });
    });

    describe('applyChanges', () => {
        it('should clear pending changes', async () => {
            await backend.initialize({ type: 'cli' });

            const changes = [{
                entityType: 'Requirement',
                entityId: 'REQ-001',
                fieldPath: 'title',
                originalValue: 'Old',
                newValue: 'New',
            }];

            const state = await backend.applyChanges(changes);

            expect(state.pendingChanges).toBeUndefined();
        });
    });

    describe('resolveDecision', () => {
        it('should return current state', async () => {
            await backend.initialize({ type: 'cli' });

            const state = await backend.resolveDecision('dec-1', 'opt-a');

            expect(state).toBeDefined();
            expect(state).toHaveProperty('status');
        });
    });
});
