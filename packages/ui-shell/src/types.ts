// Import bundle type definition types from shared-types (SINGLE SOURCE OF TRUTH)
import type {
  BundleTypeEntityConfig,
  BundleTypeRelationConfig,
  BundleTypeDefinition,
} from '@sdd-bundle-editor/shared-types';

// Re-export with Ui prefix for backward compatibility
export type UiEntityTypeConfig = BundleTypeEntityConfig;
export type UiRelationConfig = BundleTypeRelationConfig;
export type UiBundleTypeDefinition = BundleTypeDefinition;

// Also re-export the original names for direct use
export type { BundleTypeEntityConfig, BundleTypeRelationConfig, BundleTypeDefinition };

export interface UiDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  entityType?: string;
  entityId?: string;
  filePath?: string;
  path?: string;
  source?: 'schema' | 'lint' | 'gate';
  code?: string;
}

export interface UiEntity {
  id: string;
  entityType: string;
  filePath: string;
  data: Record<string, unknown>;
}

export interface UiRefEdge {
  fromEntityType: string;
  fromId: string;
  fromField: string;
  toEntityType: string;
  toId: string;
}

export interface UiBundleManifest {
  metadata?: {
    name?: string;
    bundleType?: string;
    version?: string;
    description?: string;
  };
}

export interface UiBundleSnapshot {
  manifest: UiBundleManifest;
  bundleTypeDefinition?: UiBundleTypeDefinition;
  entities: Record<string, UiEntity[]>;
  refGraph: {
    edges: UiRefEdge[];
  };
  schemas?: Record<string, unknown>;
  domainMarkdown?: string;
}

export interface UiAIResponse {
  notes?: string[];
  updatedBundle?: UiBundleSnapshot;
}
