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

export interface UiEntityTypeConfig {
  entityType: string;
  idField?: string;
  schemaPath?: string;
  directory?: string;
  filePattern?: string;
  role?: string;
  /** Optional color for this entity type (CSS color value, e.g. '#bb9af7' or 'hsl(270, 60%, 70%)') */
  color?: string;
}

export interface UiRelationConfig {
  name: string;
  fromEntity: string;
  fromField: string;
  toEntity: string;
  multiplicity?: 'one' | 'many';
}

export interface UiBundleTypeDefinition {
  bundleType?: string;
  version?: string;
  entities?: UiEntityTypeConfig[];
  relations?: UiRelationConfig[];
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
