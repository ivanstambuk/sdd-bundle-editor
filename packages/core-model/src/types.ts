export type EntityType = string;
export type EntityId = string;

export interface BundleManifest {
  apiVersion: string;
  kind: 'Bundle';
  metadata: {
    name: string;
    bundleType: string;
    schemaVersion?: string;
    [key: string]: unknown;
  };
  spec: {
    bundleTypeDefinition: string;
    schemas: {
      documents: Record<EntityType, string>;
    };
    layout: {
      documents: Record<
        EntityType,
        {
          dir: string;
          filePattern: string;
        }
      >;
    };
    domainKnowledge?: {
      path: string;
    };
    lintConfig?: {
      path: string;
    };
  };
}

export interface Entity {
  id: EntityId;
  entityType: EntityType;
  data: Record<string, unknown>;
  filePath: string;
}

export interface IdRegistryEntry {
  entityType: EntityType;
  id: EntityId;
  filePath: string;
}

export type IdRegistry = Map<EntityId, IdRegistryEntry>;

export interface RefEdge {
  fromEntityType: EntityType;
  fromId: EntityId;
  fromField: string;
  toId: EntityId;
  toEntityType: EntityType;
}

export interface RefGraph {
  edges: RefEdge[];
}

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  entityId?: EntityId;
  entityType?: EntityType;
  filePath?: string;
  path?: string;
  // 'schema' for JSON Schema validation, 'lint' for lint rules, 'gate' for higher-level gates.
  source?: 'schema' | 'lint' | 'gate';
  code?: string;
}

export interface Bundle {
  manifest: BundleManifest;
  bundleTypeDefinition?: BundleTypeDefinition;
  entities: Map<EntityType, Map<EntityId, Entity>>;
  idRegistry: IdRegistry;
  refGraph: RefGraph;
  domainMarkdown?: string;
}

export interface BundleTypeEntityConfig {
  entityType: EntityType;
  idField: string;
  schemaPath: string;
  directory: string;
  filePattern: string;
  role?: string;
}

export interface BundleTypeRelationConfig {
  name: string;
  fromEntity: EntityType;
  fromField: string;
  toEntity: EntityType;
  multiplicity: 'one' | 'many';
}

export interface BundleTypeDefinition {
  bundleType: string;
  version: string;
  entities: BundleTypeEntityConfig[];
  relations?: BundleTypeRelationConfig[];
}

export interface ProposedChange {
  entityId: EntityId;
  entityType: EntityType;
  fieldPath: string;
  originalValue: unknown;
  newValue: unknown;
  rationale?: string;
}
