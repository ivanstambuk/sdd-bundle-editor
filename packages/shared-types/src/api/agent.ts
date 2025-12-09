/**
 * Shared API types for agent communication between frontend and backend.
 * These types define the contract for agent-related API endpoints.
 */

// Re-export base types for entity references
export type EntityType = string;
export type EntityId = string;

// ============================================================================
// Proposed Changes
// ============================================================================

/**
 * Represents a single proposed change to an entity field.
 * Schema-agnostic: works with any entity type.
 */
export interface ProposedChange {
    entityId: EntityId;
    entityType: EntityType;
    fieldPath: string;
    originalValue: unknown;
    newValue: unknown;
    rationale?: string;
}

// ============================================================================
// Conversation Types
// ============================================================================

export type ConversationRole = 'user' | 'agent' | 'system';

export interface ConversationMessage {
    id: string;
    role: ConversationRole;
    content: string;
    timestamp: number;
}

export type ConversationStatus = 'idle' | 'active' | 'pending_changes' | 'linting' | 'committed' | 'error';

// ============================================================================
// Decision Types (for multi-step agent workflows)
// ============================================================================

export interface DecisionOption {
    id: string;
    label: string;
    description?: string;
    pros?: string[];
    cons?: string[];
}

export interface AgentDecision {
    id: string;
    question: string;
    options: DecisionOption[];
    status: 'open' | 'resolved';
    context?: string;
}

// ============================================================================
// State & Configuration
// ============================================================================

export interface ConversationState {
    status: ConversationStatus;
    messages: ConversationMessage[];
    pendingChanges?: ProposedChange[];
    activeDecision?: AgentDecision;
    lastError?: string;
}

// ============================================================================
// Model Selection Types
// ============================================================================

/**
 * Available models for Codex CLI (OpenAI).
 * Each model has different capabilities for reasoning effort.
 */
export type CodexModel =
    | 'gpt-5.1-codex-max'   // Supports xhigh reasoning
    | 'gpt-5.1-codex'       // Standard Codex
    | 'gpt-5.1'             // General GPT-5.1
    | 'gpt-5.1-codex-mini'  // Smaller, cheaper
    | 'o3'                  // Legacy reasoning
    | 'o4-mini';            // Compact reasoning

/**
 * Reasoning effort levels for Codex CLI.
 * Controls computational depth for reasoning tasks.
 * Note: 'xhigh' is only available for gpt-5.1-codex-max
 */
export type CodexReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Reasoning summary verbosity for Codex CLI.
 * Controls how much detail is shown in reasoning summaries.
 */
export type CodexReasoningSummary = 'auto' | 'concise' | 'detailed' | 'none';

/**
 * Available models for DeepSeek HTTP API.
 */
export type DeepSeekModel =
    | 'deepseek-chat'       // General conversational (faster, cheaper)
    | 'deepseek-reasoner';  // Reasoning model with CoT (more accurate, slower)

/**
 * Model configuration for different models' available options.
 * Used by UI to determine which options to show.
 */
export interface ModelCapabilities {
    supportsReasoningEffort: boolean;
    supportedReasoningEfforts: CodexReasoningEffort[];
    supportsReasoningSummary: boolean;
}

/**
 * Static map of model capabilities for UI dynamic rendering.
 */
export const CODEX_MODEL_CAPABILITIES: Record<CodexModel, ModelCapabilities> = {
    'gpt-5.1-codex-max': {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
        supportsReasoningSummary: true,
    },
    'gpt-5.1-codex': {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high'],
        supportsReasoningSummary: true,
    },
    'gpt-5.1': {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high'],
        supportsReasoningSummary: true,
    },
    'gpt-5.1-codex-mini': {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high'],
        supportsReasoningSummary: true,
    },
    'o3': {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ['low', 'medium', 'high'],
        supportsReasoningSummary: true,
    },
    'o4-mini': {
        supportsReasoningEffort: true,
        supportedReasoningEfforts: ['low', 'medium', 'high'],
        supportsReasoningSummary: true,
    },
};

export const DEEPSEEK_MODELS: DeepSeekModel[] = ['deepseek-chat', 'deepseek-reasoner'];

export interface AgentBackendConfig {
    type: 'vscode' | 'cli' | 'http' | 'mcp' | 'mock';

    // Model selection (used by both CLI and HTTP)
    model?: string;

    // CLI-specific options (for Codex)
    reasoningEffort?: CodexReasoningEffort;
    reasoningSummary?: CodexReasoningSummary;

    // Legacy options field (for backward compatibility)
    options?: Record<string, unknown>;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from GET /agent/status endpoint.
 */
export interface AgentStatusResponse {
    state: ConversationState;
    config?: AgentBackendConfig;
}
