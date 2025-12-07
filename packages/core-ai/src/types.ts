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
} from '@sdd-bundle-editor/shared-types';

// Import types locally for use in this file
import type {
  ProposedChange,
  ConversationState,
} from '@sdd-bundle-editor/shared-types';

export type ProviderKind = 'cli' | 'http';

export interface AIProviderConfig {
  id: string;
  kind: ProviderKind;
  command?: string;
  args?: string[];
  endpoint?: string;
  apiKeyEnv?: string;
}

export interface BundleSchemaSnapshot {
  // For now, carry through bundleTypeDefinition and leave room for doc schemas.
  bundleTypeDefinition: unknown;
}

export interface BundleSnapshot {
  bundle: Bundle;
}

export type AIMode = 'generate-bundle' | 'refine-bundle' | 'fix-errors';

export interface AIRequest {
  mode: AIMode;
  bundleType: string;
  schema: BundleSchemaSnapshot;
  bundle?: BundleSnapshot;
  domainMarkdown: string;
  diagnostics?: unknown[];
  instructions?: string;
}

export interface AIResponse {
  updatedBundle?: BundleSnapshot;
  notes?: string[];
}

export interface AIProvider {
  id: string;
  kind: ProviderKind;
  run(request: AIRequest): Promise<AIResponse>;
}

// Import additional types for local use in this file
import type {
  ConversationStatus,
  ConversationMessage,
  DecisionOption,
  AgentDecision,
  AgentBackendConfig,
} from '@sdd-bundle-editor/shared-types';

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
