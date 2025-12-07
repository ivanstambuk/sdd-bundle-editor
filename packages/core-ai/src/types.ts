import type { Bundle } from '@sdd-bundle-editor/core-model';

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
