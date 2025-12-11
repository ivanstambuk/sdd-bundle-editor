/**
 * Custom hook for managing agent/conversation state.
 * Encapsulates all agent-related operations and health monitoring.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ConversationState, ProposedChange } from '@sdd-bundle-editor/shared-types';
import { agentApi, type AgentHealth } from '../api';
import { createLogger } from '../utils/logger';

const log = createLogger('useAgentState');

export interface UseAgentStateReturn {
    // State
    conversation: ConversationState;
    agentHealth: AgentHealth | null;
    networkError: string | null;

    // Actions
    startConversation: (readOnly?: boolean) => Promise<void>;
    sendMessage: (message: string, options?: { model?: string; reasoningEffort?: string }) => Promise<void>;
    acceptChanges: (changes: ProposedChange[]) => Promise<void>;
    rollbackChanges: () => Promise<void>;
    abortConversation: () => Promise<void>;
    startNewChat: (readOnly?: boolean) => Promise<boolean>;
    resolveDecision: (decisionId: string, optionId: string) => Promise<void>;
    refreshHealth: () => Promise<void>;
    refreshStatus: () => Promise<void>;
    resetAgent: () => Promise<void>;
    setConversation: (state: ConversationState) => void;
}

interface UseAgentStateOptions {
    bundleDir: string;
    /** Called when bundle should be reloaded after changes */
    onBundleReload?: () => Promise<void>;
    /** Called when an error occurs */
    onError?: (error: string) => void;
}

/**
 * Hook for managing agent conversation state.
 * 
 * @param options Configuration options
 * @returns Agent state and actions
 */
export function useAgentState(options: UseAgentStateOptions): UseAgentStateReturn {
    const { bundleDir, onBundleReload, onError } = options;

    const [conversation, setConversation] = useState<ConversationState>({
        status: 'idle',
        messages: []
    });
    const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);
    const [networkError, setNetworkError] = useState<string | null>(null);

    // Handle errors
    const handleError = useCallback((err: unknown) => {
        const message = (err as Error).message;
        log.error('Operation failed', err);
        onError?.(message);
    }, [onError]);

    // Refresh agent health (git status, etc.)
    const refreshHealth = useCallback(async () => {
        if (conversation.status === 'idle') return;
        try {
            const health = await agentApi.getHealth(bundleDir);
            setAgentHealth(health);
            setNetworkError(null);
        } catch (err) {
            setNetworkError((err as Error).message);
        }
    }, [conversation.status, bundleDir]);

    // Refresh agent status
    const refreshStatus = useCallback(async () => {
        try {
            const data = await agentApi.getStatus();
            setConversation(data.state);
        } catch (err) {
            log.error('Failed to fetch agent status', err);
        }
    }, []);

    // Reset agent state
    const resetAgent = useCallback(async () => {
        try {
            await agentApi.reset();
            await refreshStatus();
        } catch (err) {
            log.error('Failed to reset agent state', err);
        }
    }, [refreshStatus]);

    // Start a new conversation
    const startConversation = useCallback(async (readOnly = true) => {
        log.debug('Starting conversation', { readOnly });
        try {
            const data = await agentApi.start({ bundleDir, readOnly });
            setConversation(data.state);
        } catch (err) {
            handleError(err);
        }
    }, [bundleDir, handleError]);

    // Send a message to the agent
    const sendMessage = useCallback(async (
        message: string,
        options?: { model?: string; reasoningEffort?: string }
    ) => {
        try {
            // Optimistic update
            setConversation(prev => ({
                ...prev,
                messages: [
                    ...prev.messages,
                    { id: 'temp-' + Date.now(), role: 'user', content: message, timestamp: Date.now() }
                ]
            }));

            const data = await agentApi.sendMessage({
                bundleDir,
                message,
                model: options?.model,
                reasoningEffort: options?.reasoningEffort,
            });
            setConversation(data.state);
        } catch (err) {
            handleError(err);
        }
    }, [bundleDir, handleError]);

    // Accept pending changes
    const acceptChanges = useCallback(async (changes: ProposedChange[]) => {
        try {
            const data = await agentApi.accept(bundleDir, changes);
            setConversation(data.state);
            // Reload bundle after changes
            await onBundleReload?.();
        } catch (err) {
            handleError(err);
        }
    }, [bundleDir, handleError, onBundleReload]);

    // Rollback pending changes
    const rollbackChanges = useCallback(async () => {
        try {
            const data = await agentApi.rollback(bundleDir);
            setConversation(data.state);
            log.info('Rollback completed', { message: data.message });
            // Reload bundle after rollback
            await onBundleReload?.();
        } catch (err) {
            handleError(err);
        }
    }, [bundleDir, handleError, onBundleReload]);

    // Abort conversation entirely
    const abortConversation = useCallback(async () => {
        try {
            const data = await agentApi.abort(bundleDir);
            setConversation(data.state);
            // Reload bundle after abort
            await onBundleReload?.();
        } catch (err) {
            handleError(err);
        }
    }, [bundleDir, handleError, onBundleReload]);

    // Start a new chat (handles pending changes)
    const startNewChat = useCallback(async (readOnly = true): Promise<boolean> => {
        try {
            const hasPendingChanges = (conversation.pendingChanges?.length ?? 0) > 0;

            // Show confirmation if there are pending changes
            if (hasPendingChanges) {
                const confirmed = window.confirm(
                    'You have pending changes. Starting a new chat will discard them. Continue?'
                );
                if (!confirmed) return false;

                // Rollback pending changes first
                await agentApi.rollback(bundleDir);
            }

            // Reset agent state
            await agentApi.reset();

            // Start new conversation
            const data = await agentApi.start({ bundleDir, readOnly });
            setConversation(data.state);

            // Reload bundle
            await onBundleReload?.();

            log.info('New chat started successfully');
            return true;
        } catch (err) {
            handleError(err);
            return false;
        }
    }, [bundleDir, conversation.pendingChanges, handleError, onBundleReload]);

    // Resolve a decision
    const resolveDecision = useCallback(async (decisionId: string, optionId: string) => {
        try {
            const data = await agentApi.resolveDecision(decisionId, optionId);
            setConversation(data.state);
        } catch (err) {
            handleError(err);
        }
    }, [handleError]);

    // Poll health when conversation is active
    useEffect(() => {
        if (conversation.status !== 'idle') {
            refreshHealth();
            const interval = setInterval(refreshHealth, 5000);
            return () => clearInterval(interval);
        }
    }, [conversation.status, refreshHealth]);

    // Fetch initial status on mount
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    return {
        // State
        conversation,
        agentHealth,
        networkError,

        // Actions
        startConversation,
        sendMessage,
        acceptChanges,
        rollbackChanges,
        abortConversation,
        startNewChat,
        resolveDecision,
        refreshHealth,
        refreshStatus,
        resetAgent,
        setConversation,
    };
}
