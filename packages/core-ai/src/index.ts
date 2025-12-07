import type { Bundle } from '@sdd-bundle-editor/core-model';
import {
  type AIProvider,
  type AIProviderConfig,
  type AIRequest,
  type AIResponse,
  type BundleSchemaSnapshot,
  type BundleSnapshot,
} from './types';

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

