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

export interface AgentBackendConfig {
    type: 'vscode' | 'cli' | 'http' | 'mcp' | 'mock';
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
