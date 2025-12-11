/**
 * Unit tests for useAgentState hook.
 * 
 * These tests document expected state transitions and behaviors,
 * particularly for startNewChat() which transitions to 'active' (not 'idle').
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { useAgentState } from './useAgentState';
import { agentApi } from '../api';

// Mock the agentApi module
vi.mock('../api', () => ({
    agentApi: {
        getHealth: vi.fn(),
        getStatus: vi.fn(),
        reset: vi.fn(),
        start: vi.fn(),
        sendMessage: vi.fn(),
        accept: vi.fn(),
        rollback: vi.fn(),
        abort: vi.fn(),
        resolveDecision: vi.fn(),
    },
}));

const mockAgentApi = agentApi as { [K in keyof typeof agentApi]: Mock };

describe('useAgentState', () => {
    const defaultOptions = {
        bundleDir: '/test/bundle',
        onBundleReload: vi.fn(),
        onError: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementations
        mockAgentApi.getStatus.mockResolvedValue({
            state: { status: 'idle', messages: [] },
            config: { type: 'mock' },
        });
    });

    describe('startNewChat', () => {
        it('should transition from active to active (NOT idle) when starting new chat', async () => {
            // Simulate current active state
            mockAgentApi.getStatus.mockResolvedValue({
                state: {
                    status: 'active',
                    messages: [
                        { id: '1', role: 'system', content: 'Hello', timestamp: Date.now() }
                    ]
                },
                config: { type: 'mock' },
            });

            // Mock reset and start
            mockAgentApi.reset.mockResolvedValue({ success: true });
            mockAgentApi.start.mockResolvedValue({
                state: {
                    status: 'active', // NOTE: Result is 'active', not 'idle'
                    messages: [
                        { id: '2', role: 'system', content: 'New conversation', timestamp: Date.now() }
                    ],
                },
            });

            const { result } = renderHook(() => useAgentState(defaultOptions));

            // Wait for initial status fetch
            await waitFor(() => {
                expect(mockAgentApi.getStatus).toHaveBeenCalled();
            });

            // Call startNewChat
            let startResult: boolean = false;
            await act(async () => {
                startResult = await result.current.startNewChat(true);
            });

            // Verify behavior
            expect(startResult).toBe(true);
            expect(mockAgentApi.reset).toHaveBeenCalled();
            expect(mockAgentApi.start).toHaveBeenCalled();

            // CRITICAL: Status should be 'active' (new conversation started)
            expect(result.current.conversation.status).toBe('active');

            // Messages should be fresh (only the new system message)
            expect(result.current.conversation.messages).toHaveLength(1);
            expect(result.current.conversation.messages[0].content).toBe('New conversation');
        });

        it('should call rollback before reset when pending changes exist', async () => {
            // Simulate state with pending changes
            mockAgentApi.getStatus.mockResolvedValue({
                state: {
                    status: 'pending_changes',
                    messages: [],
                    pendingChanges: [
                        { entityId: 'TEST-001', entityType: 'Feature', fieldPath: 'name', newValue: 'Test' }
                    ],
                },
                config: { type: 'mock' },
            });

            // Mock the window.confirm
            const originalConfirm = window.confirm;
            window.confirm = vi.fn(() => true) as typeof window.confirm;

            mockAgentApi.rollback.mockResolvedValue({ state: { status: 'active', messages: [] } });
            mockAgentApi.reset.mockResolvedValue({ success: true });
            mockAgentApi.start.mockResolvedValue({
                state: { status: 'active', messages: [] },
            });

            const { result } = renderHook(() => useAgentState(defaultOptions));

            await waitFor(() => {
                expect(result.current.conversation.pendingChanges).toBeDefined();
            });

            await act(async () => {
                await result.current.startNewChat(true);
            });

            // Verify rollback was called first when pending changes exist
            expect(window.confirm).toHaveBeenCalled();
            expect(mockAgentApi.rollback).toHaveBeenCalled();
            expect(mockAgentApi.reset).toHaveBeenCalled();
            expect(mockAgentApi.start).toHaveBeenCalled();

            // Cleanup
            window.confirm = originalConfirm;
        });

        it('should return false and not proceed when user cancels confirmation', async () => {
            // Simulate state with pending changes
            mockAgentApi.getStatus.mockResolvedValue({
                state: {
                    status: 'pending_changes',
                    messages: [],
                    pendingChanges: [
                        { entityId: 'TEST-001', entityType: 'Feature', fieldPath: 'name', newValue: 'Test' }
                    ],
                },
                config: { type: 'mock' },
            });

            // User cancels the confirmation
            const originalConfirm = window.confirm;
            window.confirm = vi.fn(() => false) as typeof window.confirm;

            const { result } = renderHook(() => useAgentState(defaultOptions));

            await waitFor(() => {
                expect(result.current.conversation.pendingChanges).toBeDefined();
            });

            let startResult: boolean = true;
            await act(async () => {
                startResult = await result.current.startNewChat(true);
            });

            // Should return false and NOT call reset/start
            expect(startResult).toBe(false);
            expect(mockAgentApi.rollback).not.toHaveBeenCalled();
            expect(mockAgentApi.reset).not.toHaveBeenCalled();
            expect(mockAgentApi.start).not.toHaveBeenCalled();

            // Cleanup
            window.confirm = originalConfirm;
        });
    });

    describe('startConversation', () => {
        it('should transition from idle to active', async () => {
            mockAgentApi.start.mockResolvedValue({
                state: { status: 'active', messages: [] },
            });

            const { result } = renderHook(() => useAgentState(defaultOptions));

            await act(async () => {
                await result.current.startConversation(true);
            });

            expect(result.current.conversation.status).toBe('active');
        });
    });

    describe('abortConversation', () => {
        it('should transition to idle', async () => {
            mockAgentApi.abort.mockResolvedValue({
                state: { status: 'idle', messages: [] },
            });

            const { result } = renderHook(() => useAgentState(defaultOptions));

            await act(async () => {
                await result.current.abortConversation();
            });

            expect(result.current.conversation.status).toBe('idle');
        });
    });
});
