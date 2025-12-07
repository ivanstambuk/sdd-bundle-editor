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

export interface UiBundleSnapshot {
  manifest: unknown;
  bundleTypeDefinition?: unknown;
  entities: Record<string, UiEntity[]>;
  refGraph: {
    edges: UiRefEdge[];
  };
  schemas?: Record<string, unknown>;
}

export interface UiAIResponse {
  notes?: string[];
  updatedBundle?: UiBundleSnapshot;
}
