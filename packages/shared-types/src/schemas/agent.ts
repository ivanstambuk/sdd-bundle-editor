/**
 * TypeBox schemas for agent API endpoints.
 * These provide runtime validation and OpenAPI generation.
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// Common Schemas
// ============================================================================

export const EntityRefSchema = Type.Object({
    type: Type.String({ description: 'Entity type (e.g., "Requirement")' }),
    id: Type.String({ description: 'Entity ID (e.g., "REQ-001")' }),
});
export type EntityRef = Static<typeof EntityRefSchema>;

export const ProposedChangeSchema = Type.Object({
    entityId: Type.String({ description: 'Entity ID' }),
    entityType: Type.String({ description: 'Entity type' }),
    fieldPath: Type.String({ description: 'Dot-notation path to the field' }),
    originalValue: Type.Unknown({ description: 'Original value before change' }),
    newValue: Type.Unknown({ description: 'New value after change' }),
    rationale: Type.Optional(Type.String({ description: 'Reason for the change' })),
});
export type ProposedChangeT = Static<typeof ProposedChangeSchema>;

export const ConversationMessageSchema = Type.Object({
    id: Type.String(),
    role: Type.Union([
        Type.Literal('user'),
        Type.Literal('agent'),
        Type.Literal('system')
    ]),
    content: Type.String(),
    timestamp: Type.Number(),
});
export type ConversationMessageT = Static<typeof ConversationMessageSchema>;

export const ConversationStatusSchema = Type.Union([
    Type.Literal('idle'),
    Type.Literal('active'),
    Type.Literal('pending_changes'),
    Type.Literal('linting'),
    Type.Literal('committed'),
    Type.Literal('error'),
]);
export type ConversationStatusT = Static<typeof ConversationStatusSchema>;

export const DecisionOptionSchema = Type.Object({
    id: Type.String(),
    label: Type.String(),
    description: Type.Optional(Type.String()),
    pros: Type.Optional(Type.Array(Type.String())),
    cons: Type.Optional(Type.Array(Type.String())),
});

export const AgentDecisionSchema = Type.Object({
    id: Type.String(),
    question: Type.String(),
    options: Type.Array(DecisionOptionSchema),
    status: Type.Union([Type.Literal('open'), Type.Literal('resolved')]),
    context: Type.Optional(Type.String()),
});

export const ConversationStateSchema = Type.Object({
    status: ConversationStatusSchema,
    messages: Type.Array(ConversationMessageSchema),
    pendingChanges: Type.Optional(Type.Array(ProposedChangeSchema)),
    activeDecision: Type.Optional(AgentDecisionSchema),
    lastError: Type.Optional(Type.String()),
});
export type ConversationStateT = Static<typeof ConversationStateSchema>;

// ============================================================================
// Request Schemas
// ============================================================================

export const AgentStartRequestSchema = Type.Object({
    bundleDir: Type.String({ description: 'Path to bundle directory' }),
    focusedEntity: Type.Optional(EntityRefSchema),
    readOnly: Type.Optional(Type.Boolean({ default: false })),
});
export type AgentStartRequest = Static<typeof AgentStartRequestSchema>;

export const AgentMessageRequestSchema = Type.Object({
    bundleDir: Type.String({ description: 'Path to bundle directory' }),
    message: Type.String({ minLength: 1, description: 'User message' }),
    model: Type.Optional(Type.String({ description: 'Model to use' })),
    reasoningEffort: Type.Optional(Type.String({ description: 'Reasoning effort level' })),
});
export type AgentMessageRequest = Static<typeof AgentMessageRequestSchema>;

export const AgentAcceptRequestSchema = Type.Object({
    bundleDir: Type.Optional(Type.String()),
    changes: Type.Optional(Type.Array(ProposedChangeSchema)),
});
export type AgentAcceptRequest = Static<typeof AgentAcceptRequestSchema>;

export const AgentAbortRequestSchema = Type.Object({
    bundleDir: Type.Optional(Type.String()),
});
export type AgentAbortRequest = Static<typeof AgentAbortRequestSchema>;

export const AgentRollbackRequestSchema = Type.Object({
    bundleDir: Type.String({ description: 'Path to bundle directory' }),
});
export type AgentRollbackRequest = Static<typeof AgentRollbackRequestSchema>;

export const AgentResetRequestSchema = Type.Object({});
export type AgentResetRequest = Static<typeof AgentResetRequestSchema>;

export const AgentDecisionRequestSchema = Type.Object({
    decisionId: Type.String({ description: 'ID of the decision to resolve' }),
    optionId: Type.String({ description: 'ID of the selected option' }),
});
export type AgentDecisionRequest = Static<typeof AgentDecisionRequestSchema>;

export const AgentConfigRequestSchema = Type.Object({
    type: Type.Union([
        Type.Literal('mock'),
        Type.Literal('cli'),
        Type.Literal('http'),
        Type.Literal('mcp'),
        Type.Literal('vscode'),
    ], { description: 'Backend type' }),
    model: Type.Optional(Type.String({ description: 'Model name' })),
    reasoningEffort: Type.Optional(Type.String({ description: 'Reasoning effort level' })),
    reasoningSummary: Type.Optional(Type.String({ description: 'Reasoning summary verbosity' })),
    options: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type AgentConfigRequest = Static<typeof AgentConfigRequestSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const AgentStatusResponseSchema = Type.Object({
    state: ConversationStateSchema,
    config: Type.Optional(AgentConfigRequestSchema),
});
export type AgentStatusResponseT = Static<typeof AgentStatusResponseSchema>;

export const AgentAcceptResponseSchema = Type.Object({
    success: Type.Boolean(),
    commitMessage: Type.Optional(Type.String()),
    state: ConversationStateSchema,
});
export type AgentAcceptResponse = Static<typeof AgentAcceptResponseSchema>;

export const AgentRollbackResponseSchema = Type.Object({
    state: ConversationStateSchema,
    message: Type.Optional(Type.String()),
});
export type AgentRollbackResponse = Static<typeof AgentRollbackResponseSchema>;

export const AgentHealthResponseSchema = Type.Object({
    conversationStatus: Type.String(),
    hasPendingChanges: Type.Boolean(),
    git: Type.Object({
        isRepo: Type.Boolean(),
        branch: Type.Optional(Type.String()),
        isClean: Type.Optional(Type.Boolean()),
    }),
    canAcceptChanges: Type.Boolean(),
});
export type AgentHealthResponse = Static<typeof AgentHealthResponseSchema>;

// ============================================================================
// Error Schema
// ============================================================================

export const ErrorResponseSchema = Type.Object({
    error: Type.String({ description: 'Error message' }),
    code: Type.Optional(Type.String({ description: 'Error code' })),
    details: Type.Optional(Type.Unknown({ description: 'Additional error details' })),
});
export type ErrorResponse = Static<typeof ErrorResponseSchema>;
