/**
 * Unit tests for MockAgentBackend.
 * Tests the configurable mock behavior for testing scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockAgentBackend } from './MockAgentBackend';

describe('MockAgentBackend', () => {
    let backend: MockAgentBackend;

    beforeEach(async () => {
        backend = new MockAgentBackend({ responseDelay: 0 }); // Disable delay for tests
        await backend.initialize({ type: 'mock' });
    });

    describe('initialization', () => {
        it('should initialize with default options', async () => {
            const defaultBackend = new MockAgentBackend();
            await defaultBackend.initialize({ type: 'mock' });
            const status = await defaultBackend.getStatus();
            expect(status.status).toBe('idle');
        });

        it('should accept custom options', async () => {
            const customBackend = new MockAgentBackend({
                responseDelay: 500,
                changeKeywords: ['custom'],
            });
            expect(customBackend).toBeDefined();
        });
    });

    describe('startConversation', () => {
        it('should start with active status', async () => {
            const state = await backend.startConversation({ bundleDir: '/test' });
            expect(state.status).toBe('active');
        });

        it('should include system and agent welcome messages', async () => {
            const state = await backend.startConversation({ bundleDir: '/test' });
            expect(state.messages.length).toBeGreaterThanOrEqual(2);
            expect(state.messages[0].role).toBe('system');
            expect(state.messages[1].role).toBe('agent');
            expect(state.messages[1].content).toContain('Hello');
        });
    });

    describe('sendMessage', () => {
        beforeEach(async () => {
            await backend.startConversation({ bundleDir: '/test' });
        });

        it('should add user message to history', async () => {
            const state = await backend.sendMessage('test message');
            const userMessages = state.messages.filter(m => m.role === 'user');
            expect(userMessages).toHaveLength(1);
            expect(userMessages[0].content).toBe('test message');
        });

        it('should add agent response', async () => {
            const initialMessageCount = (await backend.getStatus()).messages.length;
            await backend.sendMessage('test');
            const state = await backend.getStatus();
            // Should have user message + agent response
            expect(state.messages.length).toBe(initialMessageCount + 2);
        });

        it('should trigger change proposal on "change" keyword', async () => {
            const state = await backend.sendMessage('Please make a change');
            expect(state.status).toBe('pending_changes');
            expect(state.pendingChanges).toBeDefined();
            expect(state.pendingChanges!.length).toBeGreaterThan(0);
        });

        it('should trigger change proposal on "update" keyword', async () => {
            const state = await backend.sendMessage('Update the title');
            expect(state.status).toBe('pending_changes');
        });

        it('should trigger decision on "decide" keyword', async () => {
            const state = await backend.sendMessage('Please decide');
            expect(state.activeDecision).toBeDefined();
            expect(state.activeDecision!.options.length).toBeGreaterThan(0);
        });

        it('should return normal response for other messages', async () => {
            const state = await backend.sendMessage('Hello there');
            expect(state.status).toBe('active');
            expect(state.pendingChanges).toBeUndefined();
        });
    });

    describe('applyChanges', () => {
        beforeEach(async () => {
            await backend.startConversation({ bundleDir: '/test' });
        });

        it('should clear pending changes after apply', async () => {
            await backend.sendMessage('make a change');
            const changes = (await backend.getStatus()).pendingChanges!;

            const state = await backend.applyChanges(changes);
            expect(state.pendingChanges).toBeUndefined();
            expect(state.status).toBe('active');
        });

        it('should add confirmation message', async () => {
            await backend.sendMessage('make a change');
            const changes = (await backend.getStatus()).pendingChanges!;
            const messageCountBefore = (await backend.getStatus()).messages.length;

            await backend.applyChanges(changes);
            const state = await backend.getStatus();
            expect(state.messages.length).toBe(messageCountBefore + 1);
            expect(state.messages[state.messages.length - 1].content).toContain('applied');
        });
    });

    describe('resolveDecision', () => {
        beforeEach(async () => {
            await backend.startConversation({ bundleDir: '/test' });
        });

        it('should clear active decision', async () => {
            await backend.sendMessage('decide now');
            const decision = (await backend.getStatus()).activeDecision!;

            const state = await backend.resolveDecision(decision.id, decision.options[0].id);
            expect(state.activeDecision).toBeUndefined();
        });

        it('should add confirmation message', async () => {
            await backend.sendMessage('decide now');
            const decision = (await backend.getStatus()).activeDecision!;
            const messageCountBefore = (await backend.getStatus()).messages.length;

            await backend.resolveDecision(decision.id, decision.options[0].id);
            const state = await backend.getStatus();
            expect(state.messages.length).toBe(messageCountBefore + 1);
            expect(state.messages[state.messages.length - 1].content).toContain('Decision recorded');
        });
    });

    describe('custom generators', () => {
        it('should use custom response generator', async () => {
            const customBackend = new MockAgentBackend({
                responseDelay: 0,
                responseGenerator: () => 'Custom response!',
            });
            await customBackend.initialize({ type: 'mock' });
            await customBackend.startConversation({ bundleDir: '/test' });

            const state = await customBackend.sendMessage('anything');
            const lastMessage = state.messages[state.messages.length - 1];
            expect(lastMessage.content).toBe('Custom response!');
        });

        it('should use custom change generator', async () => {
            const customBackend = new MockAgentBackend({
                responseDelay: 0,
                changeGenerator: () => [{
                    entityId: 'CUSTOM-001',
                    entityType: 'Custom',
                    fieldPath: 'custom',
                    originalValue: 'a',
                    newValue: 'b',
                }],
            });
            await customBackend.initialize({ type: 'mock' });
            await customBackend.startConversation({ bundleDir: '/test' });

            const state = await customBackend.sendMessage('change something');
            expect(state.pendingChanges![0].entityId).toBe('CUSTOM-001');
        });
    });
});
