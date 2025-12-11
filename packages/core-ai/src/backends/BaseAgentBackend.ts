/**
 * Base class for agent backends.
 * Provides common state management and utility methods.
 */

import {
    AgentBackend,
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
    ConversationMessage,
    ConversationStatus,
} from '../types';

/**
 * Abstract base class for agent backend implementations.
 * Provides shared state management, message handling, and utility methods.
 */
export abstract class BaseAgentBackend implements AgentBackend {
    protected config: AgentBackendConfig | null = null;
    protected context: AgentContext | null = null;
    protected state: ConversationState = {
        status: 'idle',
        messages: []
    };

    /**
     * Initialize the backend with configuration.
     * Subclasses should call super.initialize() and then perform their own setup.
     */
    async initialize(config: AgentBackendConfig): Promise<void> {
        this.config = config;
        this.state = { status: 'idle', messages: [] };
    }

    /**
     * Get current conversation state.
     */
    async getStatus(): Promise<ConversationState> {
        return { ...this.state };
    }

    /**
     * Clear pending changes but keep conversation active.
     */
    async clearPendingChanges(): Promise<ConversationState> {
        this.state.pendingChanges = undefined;
        if (this.state.status === 'pending_changes' || this.state.status === 'linting') {
            this.state.status = 'active';
        }
        return this.getStatus();
    }

    /**
     * Abort the conversation and reset to idle state.
     */
    async abortConversation(): Promise<ConversationState> {
        this.state = { status: 'idle', messages: [] };
        this.context = null;
        return this.getStatus();
    }

    // =========================================================================
    // Protected utility methods for subclasses
    // =========================================================================

    /**
     * Add a message to the conversation.
     */
    protected addMessage(role: 'user' | 'agent' | 'system', content: string): ConversationMessage {
        const message: ConversationMessage = {
            id: `${role}-${Date.now()}`,
            role,
            content,
            timestamp: Date.now(),
        };
        this.state.messages.push(message);
        return message;
    }

    /**
     * Set the conversation status.
     */
    protected setStatus(status: ConversationStatus): void {
        this.state.status = status;
    }

    /**
     * Set pending changes and update status accordingly.
     */
    protected setPendingChanges(changes: ProposedChange[] | undefined): void {
        this.state.pendingChanges = changes;
        if (changes && changes.length > 0) {
            this.state.status = 'pending_changes';
        }
    }

    /**
     * Set the last error message.
     */
    protected setError(errorMessage: string): void {
        this.state.lastError = errorMessage;
        this.state.status = 'error';
    }

    /**
     * Clear the last error.
     */
    protected clearError(): void {
        this.state.lastError = undefined;
        if (this.state.status === 'error') {
            this.state.status = 'active';
        }
    }

    /**
     * Get the bundle directory from context.
     */
    protected getBundleDir(): string {
        return this.context?.bundleDir || process.cwd();
    }

    /**
     * Check if the session is in read-only mode.
     */
    protected isReadOnly(): boolean {
        return this.context?.readOnly ?? false;
    }

    // =========================================================================
    // Abstract methods that subclasses must implement
    // =========================================================================

    abstract startConversation(context: AgentContext): Promise<ConversationState>;
    abstract sendMessage(message: string): Promise<ConversationState>;
    abstract applyChanges(changes: ProposedChange[], updatedBundle?: unknown): Promise<ConversationState>;
    abstract resolveDecision(decisionId: string, optionId: string): Promise<ConversationState>;
}
