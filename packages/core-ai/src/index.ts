import type { Bundle } from '@sdd-bundle-editor/core-model';
import {
  type AIProvider,
  type AIProviderConfig,
  type AIRequest,
  type AIResponse,
  type BundleSchemaSnapshot,
  type BundleSnapshot,
} from './types';

export * from './types';

export function createNoopProvider(config?: Partial<AIProviderConfig>): AIProvider {
  return {
    id: config?.id ?? 'noop',
    kind: 'cli',
    async run(request: AIRequest): Promise<AIResponse> {
      if (request.mode === 'generate-bundle') {
        return {
          updatedBundle: request.bundle,
          notes: ['No-op AI provider: generate-bundle not implemented.'],
        };
      }
      return {
        updatedBundle: request.bundle,
        notes: ['No-op AI provider: refine/fix-errors not implemented.'],
      };
    },
  };
}

export function buildBundleSchemaSnapshot(bundle: Bundle): BundleSchemaSnapshot {
  return {
    bundleTypeDefinition: bundle.bundleTypeDefinition ?? null,
  };
}

export function buildBundleSnapshot(bundle: Bundle): BundleSnapshot {
  return { bundle };
}

export async function generateBundle(
  provider: AIProvider,
  request: Omit<AIRequest, 'mode'>,
): Promise<AIResponse> {
  return provider.run({ ...request, mode: 'generate-bundle' });
}

export async function refineBundle(
  provider: AIProvider,
  request: Omit<AIRequest, 'mode'>,
): Promise<AIResponse> {
  return provider.run({ ...request, mode: 'refine-bundle' });
}

export async function fixErrors(
  provider: AIProvider,
  request: Omit<AIRequest, 'mode'>,
): Promise<AIResponse> {
  return provider.run({ ...request, mode: 'fix-errors' });
}

export * from './backends/BaseAgentBackend';
export * from './backends/CliAgentBackend';
export * from './backends/OpenAiAgentBackend';
export * from './backends/MockAgentBackend';
export * from './test-utils';

import { CliAgentBackend } from './backends/CliAgentBackend';
import { OpenAiAgentBackend } from './backends/OpenAiAgentBackend';
import { MockAgentBackend } from './backends/MockAgentBackend';
import { AgentBackend, AgentBackendConfig } from './types';

export function createAgentBackend(config: AgentBackendConfig): AgentBackend {
  switch (config.type) {
    case 'cli':
      return new CliAgentBackend();
    case 'http': // using http for openai-compatible for now logic
      return new OpenAiAgentBackend();
    case 'mock':
      return new MockAgentBackend();
    default:
      throw new Error(`Unknown agent backend type: ${config.type}`);
  }
}
