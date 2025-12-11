/**
 * Agent API client for agent/conversation-related operations.
 * Provides typed methods for managing agent conversations.
 */

import type { ConversationState, ProposedChange } from '@sdd-bundle-editor/shared-types';
import { fetchJson } from './fetchUtils';

export interface AgentStatusResponse {
    state: ConversationState;
    config?: unknown;
}

export interface AgentHealth {
    conversationStatus: string;
    hasPendingChanges: boolean;
    git: {
        isRepo: boolean;
        branch?: string;
        isClean?: boolean;
    };
    canAcceptChanges: boolean;
}

export interface AcceptResponse {
    state: ConversationState;
    success?: boolean;
    commitMessage?: string;
}

export interface RollbackResponse {
    state: ConversationState;
    message?: string;
}

export interface EntityRef {
    type: string;
    id: string;
}

export interface StartOptions {
    bundleDir: string;
    focusedEntity?: EntityRef;
    readOnly?: boolean;
}

export interface SendMessageOptions {
    bundleDir: string;
    message: string;
    model?: string;
    reasoningEffort?: string;
}

/**
 * Agent API client with typed methods.
 */
export const agentApi = {
    /**
     * Get current agent status and conversation state.
     */
    async getStatus(): Promise<AgentStatusResponse> {
        return fetchJson<AgentStatusResponse>('/agent/status');
    },

    /**
     * Get agent health including git status.
     */
    async getHealth(bundleDir: string): Promise<AgentHealth> {
        return fetchJson<AgentHealth>(
            `/agent/health?bundleDir=${encodeURIComponent(bundleDir)}`
        );
    },

    /**
     * Start a new agent conversation.
     */
    async start(options: StartOptions): Promise<AgentStatusResponse> {
        return fetchJson<AgentStatusResponse>('/agent/start', {
            method: 'POST',
            body: JSON.stringify({
                bundleDir: options.bundleDir,
                focusedEntity: options.focusedEntity,
                readOnly: options.readOnly,
            }),
        });
    },

    /**
     * Send a message to the agent.
     */
    async sendMessage(options: SendMessageOptions): Promise<AgentStatusResponse> {
        return fetchJson<AgentStatusResponse>('/agent/message', {
            method: 'POST',
            body: JSON.stringify({
                bundleDir: options.bundleDir,
                message: options.message,
                model: options.model,
                reasoningEffort: options.reasoningEffort,
            }),
        });
    },

    /**
     * Accept pending changes from the agent.
     */
    async accept(bundleDir: string, changes: ProposedChange[]): Promise<AcceptResponse> {
        return fetchJson<AcceptResponse>(
            `/agent/accept?bundleDir=${encodeURIComponent(bundleDir)}`,
            {
                method: 'POST',
                body: JSON.stringify({ changes }),
            }
        );
    },

    /**
     * Rollback uncommitted changes but keep conversation active.
     */
    async rollback(bundleDir: string): Promise<RollbackResponse> {
        return fetchJson<RollbackResponse>('/agent/rollback', {
            method: 'POST',
            body: JSON.stringify({ bundleDir }),
        });
    },

    /**
     * Abort the current conversation entirely.
     */
    async abort(bundleDir?: string): Promise<AgentStatusResponse> {
        return fetchJson<AgentStatusResponse>('/agent/abort', {
            method: 'POST',
            body: JSON.stringify({ bundleDir }),
        });
    },

    /**
     * Reset agent state (clear conversation, keep config).
     */
    async reset(): Promise<{ success: boolean }> {
        return fetchJson<{ success: boolean }>('/agent/reset', {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    /**
     * Resolve a decision presented by the agent.
     */
    async resolveDecision(decisionId: string, optionId: string): Promise<AgentStatusResponse> {
        return fetchJson<AgentStatusResponse>('/agent/decision', {
            method: 'POST',
            body: JSON.stringify({ decisionId, optionId }),
        });
    },
};
