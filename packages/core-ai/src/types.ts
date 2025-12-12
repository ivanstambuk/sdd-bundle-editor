import type { Bundle } from '@sdd-bundle-editor/core-model';

// Re-export shared types for backward compatibility
export {
  ProposedChange,
  ConversationRole,
  ConversationMessage,
  ConversationStatus,
  DecisionOption,
  AgentDecision,
  ConversationState,
  AgentBackendConfig,
  // Model configuration types
  CodexModel,
  CodexReasoningEffort,
  CodexReasoningSummary,
  DeepSeekModel,
  ModelCapabilities,
  CODEX_MODEL_CAPABILITIES,
  DEEPSEEK_MODELS,
} from '@sdd-bundle-editor/shared-types';

// Import types locally for use in this file
import type {
  ProposedChange,
  ConversationState,
  ConversationStatus,
  ConversationMessage,
  DecisionOption,
  AgentDecision,
  AgentBackendConfig,
} from '@sdd-bundle-editor/shared-types';

export interface BundleSnapshot {
  bundle: Bundle;
}

export interface AgentContext {
  bundleDir: string;
  bundle?: BundleSnapshot;
  // Use loose type for diagnostics to avoid circular deps or complex mismatched types for now
  diagnostics?: unknown[];
  focusedEntity?: {
    type: string;
    id: string;
  };
  /** 
   * When true, the agent should operate in read-only mode:
   * - Can read files and execute queries
   * - Cannot modify files or apply changes
   * For Codex CLI, this maps to --sandbox read-only vs workspace-write
   */
  readOnly?: boolean;
}

export interface AgentBackend {
  initialize(config: AgentBackendConfig): Promise<void>;
  startConversation(context: AgentContext): Promise<ConversationState>;
  sendMessage(message: string): Promise<ConversationState>;
  applyChanges(changes: ProposedChange[], updatedBundle?: BundleSnapshot): Promise<ConversationState>;
  resolveDecision(decisionId: string, optionId: string): Promise<ConversationState>;
  abortConversation(): Promise<ConversationState>;
  /** Clear pending changes but keep conversation active (for rollback/retry scenarios) */
  clearPendingChanges(): Promise<ConversationState>;
  getStatus(): Promise<ConversationState>;
}
