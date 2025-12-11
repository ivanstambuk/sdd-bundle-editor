/**
 * Unit tests for BaseAgentBackend abstract class.
 * Tests the shared functionality that all backends inherit.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAgentBackend } from './BaseAgentBackend';
import type { AgentContext, ConversationState, ProposedChange } from '../types';

/**
 * Concrete implementation of BaseAgentBackend for testing.
 */
class TestableBackend extends BaseAgentBackend {
    async startConversation(context: AgentContext): Promise<ConversationState> {
        this.context = context;
        this.state = { status: 'active', messages: [] };
        this.addMessage('agent', 'Conversation started');
        return this.getStatus();
    }

    async sendMessage(message: string): Promise<ConversationState> {
        this.addMessage('user', message);
        this.addMessage('agent', `Echo: ${message}`);
        return this.getStatus();
    }

    async applyChanges(changes: ProposedChange[]): Promise<ConversationState> {
        this.state.pendingChanges = undefined;
        this.setStatus('active');
        return this.getStatus();
    }

    async resolveDecision(decisionId: string, optionId: string): Promise<ConversationState> {
        return this.getStatus();
    }

    // Expose protected methods for testing
    public testAddMessage(role: 'user' | 'agent' | 'system', content: string) {
        return this.addMessage(role, content);
    }

    public testSetStatus(status: 'idle' | 'active' | 'pending_changes' | 'error') {
        this.setStatus(status);
    }

    public testSetPendingChanges(changes: ProposedChange[] | undefined) {
        this.setPendingChanges(changes);
    }

    public testSetError(message: string) {
        this.setError(message);
    }

    public testClearError() {
        this.clearError();
    }

    public testGetBundleDir() {
        return this.getBundleDir();
    }

    public testIsReadOnly() {
        return this.isReadOnly();
    }
}

describe('BaseAgentBackend', () => {
    let backend: TestableBackend;

    beforeEach(() => {
        backend = new TestableBackend();
    });

    describe('initialize', () => {
        it('should store config on initialize', async () => {
            await backend.initialize({ type: 'mock' });
            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
        });

        it('should reset state on initialize', async () => {
            await backend.startConversation({ bundleDir: '/test' });
            await backend.initialize({ type: 'mock' });
            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
            expect(status.messages).toHaveLength(0);
        });
    });

    describe('getStatus', () => {
        it('should return initial idle state', async () => {
            const status = await backend.getStatus();
            expect(status.status).toBe('idle');
            expect(status.messages).toHaveLength(0);
        });

        it('should return a copy of state (not reference)', async () => {
            const status1 = await backend.getStatus();
            const status2 = await backend.getStatus();
            expect(status1).not.toBe(status2);
        });
    });

    describe('clearPendingChanges', () => {
        it('should clear pending changes', async () => {
            backend.testSetPendingChanges([{
                entityId: 'REQ-001',
                entityType: 'Requirement',
                fieldPath: 'title',
                originalValue: 'Old',
                newValue: 'New',
            }]);

            const result = await backend.clearPendingChanges();
            expect(result.pendingChanges).toBeUndefined();
        });

        it('should reset status from pending_changes to active', async () => {
            backend.testSetPendingChanges([{
                entityId: 'REQ-001',
                entityType: 'Requirement',
                fieldPath: 'title',
                originalValue: 'Old',
                newValue: 'New',
            }]);

            const result = await backend.clearPendingChanges();
            expect(result.status).toBe('active');
        });
    });

    describe('abortConversation', () => {
        it('should reset to idle state', async () => {
            await backend.startConversation({ bundleDir: '/test' });
            const result = await backend.abortConversation();
            expect(result.status).toBe('idle');
            expect(result.messages).toHaveLength(0);
        });
    });

    describe('addMessage', () => {
        it('should add messages with timestamp and id', () => {
            const message = backend.testAddMessage('user', 'Hello');
            expect(message.role).toBe('user');
            expect(message.content).toBe('Hello');
            expect(message.id).toMatch(/^user-\d+$/);
            expect(typeof message.timestamp).toBe('number');
        });

        it('should add messages to state', async () => {
            backend.testAddMessage('user', 'Message 1');
            backend.testAddMessage('agent', 'Message 2');

            const status = await backend.getStatus();
            expect(status.messages).toHaveLength(2);
            expect(status.messages[0].content).toBe('Message 1');
            expect(status.messages[1].content).toBe('Message 2');
        });
    });

    describe('setStatus', () => {
        it('should update status', async () => {
            backend.testSetStatus('active');
            let status = await backend.getStatus();
            expect(status.status).toBe('active');

            backend.testSetStatus('error');
            status = await backend.getStatus();
            expect(status.status).toBe('error');
        });
    });

    describe('setPendingChanges', () => {
        it('should set pending changes and update status', async () => {
            const changes: ProposedChange[] = [{
                entityId: 'REQ-001',
                entityType: 'Requirement',
                fieldPath: 'title',
                originalValue: 'Old',
                newValue: 'New',
            }];

            backend.testSetPendingChanges(changes);
            const status = await backend.getStatus();

            expect(status.pendingChanges).toHaveLength(1);
            expect(status.status).toBe('pending_changes');
        });

        it('should not change status when setting undefined', async () => {
            backend.testSetStatus('active');
            backend.testSetPendingChanges(undefined);

            const status = await backend.getStatus();
            expect(status.status).toBe('active');
        });
    });

    describe('error handling', () => {
        it('should set error message and status', async () => {
            backend.testSetError('Something went wrong');
            const status = await backend.getStatus();

            expect(status.lastError).toBe('Something went wrong');
            expect(status.status).toBe('error');
        });

        it('should clear error', async () => {
            backend.testSetError('Error');
            backend.testClearError();

            const status = await backend.getStatus();
            expect(status.lastError).toBeUndefined();
            expect(status.status).toBe('active');
        });
    });

    describe('context helpers', () => {
        it('should return cwd when no bundle dir', () => {
            expect(backend.testGetBundleDir()).toBe(process.cwd());
        });

        it('should return bundle dir from context', async () => {
            await backend.startConversation({ bundleDir: '/custom/path' });
            expect(backend.testGetBundleDir()).toBe('/custom/path');
        });

        it('should return false for readOnly by default', () => {
            expect(backend.testIsReadOnly()).toBe(false);
        });

        it('should return readOnly from context', async () => {
            await backend.startConversation({ bundleDir: '/test', readOnly: true });
            expect(backend.testIsReadOnly()).toBe(true);
        });
    });
});
