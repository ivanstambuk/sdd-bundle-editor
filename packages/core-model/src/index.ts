import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  Bundle,
  BundleManifest,
  BundleTypeDefinition,
  Diagnostic,
  Entity,
  EntityId,
  EntityType,
  IdRegistry,
  RefEdge,
  RefGraph,
} from './types';
import {
  CompiledSchemaSet,
  DocumentSchemaConfig,
  SchemaDiagnostic,
  loadSchemas,
  validateEntity as validateEntityWithSchema,
} from '@sdd-bundle-editor/core-schema';
import { loadLintConfig, runLintRules } from '@sdd-bundle-editor/core-lint';

export async function loadManifest(manifestPath: string): Promise<BundleManifest> {
  const raw = await fs.readFile(manifestPath, 'utf8');
  const manifest = parseYaml(raw) as unknown;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid manifest: expected YAML object');
  }
  return manifest as BundleManifest;
}

async function loadBundleTypeDefinition(
  bundleDir: string,
  manifest: BundleManifest,
): Promise<BundleTypeDefinition> {
  const defPath = path.join(bundleDir, manifest.spec.bundleTypeDefinition);
  const raw = await fs.readFile(defPath, 'utf8');
  const json = JSON.parse(raw) as BundleTypeDefinition;
  return json;
}

async function discoverEntities(
  bundleDir: string,
  bundleTypeDef: BundleTypeDefinition,
): Promise<{ entities: Map<EntityType, Map<EntityId, Entity>>; idRegistry: IdRegistry; diagnostics: Diagnostic[] }> {
  const entities = new Map<EntityType, Map<EntityId, Entity>>();
  const idRegistry: IdRegistry = new Map();
  const diagnostics: Diagnostic[] = [];

  for (const entityConfig of bundleTypeDef.entities) {
    const typeEntities = new Map<EntityId, Entity>();
    entities.set(entityConfig.entityType, typeEntities);

    const dirPath = path.join(bundleDir, entityConfig.directory);
    let files: string[] = [];
    try {
      files = await fs.readdir(dirPath);
    } catch (err) {
      diagnostics.push({
        severity: 'error',
        message: `Failed to read directory for entity type "${entityConfig.entityType}": ${String(
          err,
        )}`,
        entityType: entityConfig.entityType,
        filePath: dirPath,
      });
      continue;
    }

    for (const filename of files) {
      if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) {
        continue;
      }
      const filePath = path.join(dirPath, filename);
      let data: unknown;
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        data = parseYaml(raw) as unknown;
      } catch (err) {
        diagnostics.push({
          severity: 'error',
          message: `Failed to parse YAML for "${filePath}": ${String(err)}`,
          entityType: entityConfig.entityType,
          filePath,
        });
        continue;
      }

      if (!data || typeof data !== 'object') {
        diagnostics.push({
          severity: 'error',
          message: `YAML document in "${filePath}" is not an object`,
          entityType: entityConfig.entityType,
          filePath,
        });
        continue;
      }

      const record = data as Record<string, unknown>;
      const idValue = record[entityConfig.idField];
      if (typeof idValue !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: `Missing or non-string id field "${entityConfig.idField}" in "${filePath}"`,
          entityType: entityConfig.entityType,
          filePath,
        });
        continue;
      }

      const id = idValue as EntityId;
      const entity: Entity = {
        id,
        entityType: entityConfig.entityType,
        data: record,
        filePath,
      };

      if (idRegistry.has(id)) {
        diagnostics.push({
          severity: 'error',
          message: `Duplicate entity id "${id}"`,
          entityId: id,
          entityType: entityConfig.entityType,
          filePath,
        });
        continue;
      }

      typeEntities.set(id, entity);
      idRegistry.set(id, {
        entityType: entityConfig.entityType,
        id,
        filePath,
      });
    }
  }

  return { entities, idRegistry, diagnostics };
}

export async function loadBundle(
  bundleDir: string,
): Promise<{ bundle: Bundle; diagnostics: Diagnostic[] }> {
  const manifestPath = path.join(bundleDir, 'sdd-bundle.yaml');
  const diagnostics: Diagnostic[] = [];

  let manifest: BundleManifest;
  try {
    manifest = await loadManifest(manifestPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      severity: 'error',
      message: `Failed to load manifest: ${message}`,
      filePath: manifestPath,
      source: 'gate',
      code: 'gate.manifest.load',
    });
    throw err;
  }

  let bundleTypeDefinition: BundleTypeDefinition | undefined;
  try {
    bundleTypeDefinition = await loadBundleTypeDefinition(bundleDir, manifest);
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      message: `Failed to load bundle-type definition: ${String(err)}`,
      filePath: path.join(bundleDir, manifest.spec.bundleTypeDefinition),
      source: 'gate',
      code: 'gate.bundleType.load',
    });
  }

  let entities = new Map<EntityType, Map<EntityId, Entity>>();
  let idRegistry: IdRegistry = new Map();
  if (bundleTypeDefinition) {
    const discovered = await discoverEntities(bundleDir, bundleTypeDefinition);
    entities = discovered.entities;
    idRegistry = discovered.idRegistry;
    diagnostics.push(...discovered.diagnostics);
  }

  const refGraph: RefGraph = bundleTypeDefinition
    ? buildRefGraph({
      manifest,
      bundleTypeDefinition,
      entities,
      idRegistry,
      refGraph: { edges: [] },
    })
    : { edges: [] };

  // Load domain knowledge markdown if specified
  let domainMarkdown: string | undefined;
  const domainKnowledgePath = manifest.spec.domainKnowledge?.path;
  if (domainKnowledgePath) {
    try {
      const fullPath = path.join(bundleDir, domainKnowledgePath);
      domainMarkdown = await fs.readFile(fullPath, 'utf8');
    } catch (err) {
      diagnostics.push({
        severity: 'warning',
        message: `Failed to load domain knowledge file: ${String(err)}`,
        filePath: path.join(bundleDir, domainKnowledgePath),
        source: 'gate',
        code: 'gate.domainKnowledge.load',
      });
    }
  }

  const bundle: Bundle = {
    manifest,
    bundleTypeDefinition,
    entities,
    idRegistry,
    refGraph,
    domainMarkdown,
  };

  return { bundle, diagnostics };
}

export function buildRefGraph(bundle: Bundle): RefGraph {
  const edges: RefEdge[] = [];

  const bundleTypeDefinition = bundle.bundleTypeDefinition;
  if (!bundleTypeDefinition || !bundleTypeDefinition.relations) {
    return { edges };
  }

  for (const relation of bundleTypeDefinition.relations) {
    const fromEntities = bundle.entities.get(relation.fromEntity);
    if (!fromEntities) {
      continue;
    }

    for (const entity of fromEntities.values()) {
      const raw = (entity.data as Record<string, unknown>)[relation.fromField];
      const refIds: string[] = [];

      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item === 'string' && item.trim().length > 0) {
            refIds.push(item);
          }
        }
      } else if (typeof raw === 'string' && raw.trim().length > 0) {
        refIds.push(raw);
      }

      for (const toId of refIds) {
        const target = bundle.idRegistry.get(toId);
        const toEntityType = target?.entityType ?? relation.toEntity;

        edges.push({
          fromEntityType: relation.fromEntity,
          fromId: entity.id,
          fromField: relation.fromField,
          toEntityType,
          toId,
        });
      }
    }
  }

  return { edges };
}

export async function compileDocumentSchemas(bundleDir: string, manifest: BundleManifest): Promise<CompiledSchemaSet> {
  const config: DocumentSchemaConfig = {
    bundleDir,
    schemas: manifest.spec.schemas.documents,
  };
  return loadSchemas(config);
}

export function validateEntityWithSchemas(
  compiled: CompiledSchemaSet,
  entity: Entity,
): SchemaDiagnostic[] {
  return validateEntityWithSchema(compiled, {
    entityType: entity.entityType,
    entity: entity.data,
  });
}

export async function loadBundleWithSchemaValidation(
  bundleDir: string,
): Promise<{ bundle: Bundle; diagnostics: Diagnostic[] }> {
  const { bundle, diagnostics } = await loadBundle(bundleDir);

  // Load raw schemas for x-refTargets extraction
  const rawSchemas = new Map<string, Record<string, unknown>>();
  for (const [entityType, relPath] of Object.entries(bundle.manifest.spec.schemas.documents)) {
    try {
      const schemaPath = path.join(bundleDir, relPath);
      const raw = await fs.readFile(schemaPath, 'utf8');
      rawSchemas.set(entityType, JSON.parse(raw));
    } catch {
      // Schema loading errors are handled elsewhere
    }
  }

  let compiled: CompiledSchemaSet | undefined;
  try {
    compiled = await compileDocumentSchemas(bundleDir, bundle.manifest);
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      message: `Failed to compile JSON Schemas: ${String(err)}`,
    });
  }

  if (compiled) {
    for (const [entityType, byId] of bundle.entities.entries()) {
      // Skip schema validation for the Bundle manifest itself as it's handled separately
      if (entityType === 'Bundle') continue;

      for (const entity of byId.values()) {
        const schemaDiagnostics = validateEntityWithSchemas(compiled, entity);
        for (const sd of schemaDiagnostics) {
          diagnostics.push({
            severity: sd.severity,
            message: sd.message,
            entityId: entity.id,
            entityType,
            filePath: entity.filePath,
            path: sd.path,
            source: sd.source,
            code: sd.code,
          });
        }
      }
    }
  }

  // Validate x-refTargets constraints
  const refTargetDiagnostics = validateRefTargets(bundle, rawSchemas);
  diagnostics.push(...refTargetDiagnostics);

  // Built-in broken reference detection (no lint config required)
  // Detects when entities reference IDs that don't exist in the bundle
  for (const edge of bundle.refGraph.edges) {
    const target = bundle.idRegistry.get(edge.toId);
    if (!target) {
      diagnostics.push({
        severity: 'error',
        message: `Broken reference: ${edge.fromEntityType} "${edge.fromId}" references non-existent ${edge.toEntityType} "${edge.toId}" via "${edge.fromField}"`,
        entityId: edge.fromId,
        entityType: edge.fromEntityType,
        path: `/${edge.fromField}`,
        source: 'schema',
        code: 'broken-ref',
      });
    }
  }

  // Orphan detection: entities with no relationships (warning)
  // These entities may be incomplete or disconnected from the spec
  const entitiesInRefs = new Set<string>();
  for (const edge of bundle.refGraph.edges) {
    entitiesInRefs.add(edge.fromId);
    entitiesInRefs.add(edge.toId);
  }
  for (const [type, entities] of bundle.entities) {
    // Skip Bundle meta-entity
    if (type === 'Bundle') continue;
    for (const [id, entity] of entities) {
      if (!entitiesInRefs.has(id)) {
        diagnostics.push({
          severity: 'warning',
          message: `Orphan entity: ${type} "${id}" has no relationships (neither references nor is referenced by other entities)`,
          entityId: id,
          entityType: type,
          filePath: entity.filePath,
          source: 'schema',
          code: 'orphan-entity',
        });
      }
    }
  }

  // Required relationship enforcement (from bundle-type definition)
  // Multiplicity "one" means max 1 value. Combined with JSON Schema "required", it means exactly 1.
  if (bundle.bundleTypeDefinition?.relations) {
    for (const relation of bundle.bundleTypeDefinition.relations) {
      // Only check "one" multiplicity (max 1 value)
      if (relation.multiplicity !== 'one') continue;

      const fromEntities = bundle.entities.get(relation.fromEntity);
      if (!fromEntities) continue;

      // Check if this field is required in the JSON Schema
      const schema = rawSchemas.get(relation.fromEntity);
      const requiredFields = schema?.required as string[] | undefined;
      const isSchemaRequired = requiredFields?.includes(relation.fromField) ?? false;

      for (const [id, entity] of fromEntities) {
        const fieldValue = (entity.data as Record<string, unknown>)[relation.fromField];

        // Check if the field exists and has exactly one non-empty value
        let refCount = 0;
        if (typeof fieldValue === 'string' && fieldValue.trim().length > 0) {
          refCount = 1;
        } else if (Array.isArray(fieldValue)) {
          refCount = fieldValue.filter(v => typeof v === 'string' && v.trim().length > 0).length;
        }

        // Error: Too many values for "one" multiplicity
        if (refCount > 1) {
          diagnostics.push({
            severity: 'error',
            message: `Multiplicity violation: ${relation.fromEntity} "${id}" has ${refCount} values in "${relation.fromField}" but relation "${relation.name}" allows at most one`,
            entityId: id,
            entityType: relation.fromEntity,
            path: `/${relation.fromField}`,
            source: 'schema',
            code: 'multiplicity-too-many',
          });
        }

        // Warning: Missing required ref (only if JSON Schema marks it as required)
        if (refCount === 0 && isSchemaRequired) {
          diagnostics.push({
            severity: 'warning',
            message: `Missing required relationship: ${relation.fromEntity} "${id}" should have a "${relation.toEntity}" reference via "${relation.fromField}" (relation: ${relation.name})`,
            entityId: id,
            entityType: relation.fromEntity,
            path: `/${relation.fromField}`,
            source: 'schema',
            code: 'missing-required-ref',
          });
        }
      }
    }
  }

  // Load and run lint rules, if configured.
  const lintConfigPath = bundle.manifest.spec.lintConfig?.path;
  const lintConfig = await loadLintConfig(bundleDir, lintConfigPath);
  const lintDiagnostics = runLintRules(bundle, lintConfig);
  for (const ld of lintDiagnostics) {
    diagnostics.push({
      severity: ld.severity,
      message: ld.message,
      entityId: ld.entityId,
      entityType: ld.entityType,
      path: ld.field,
      source: ld.source,
      code: ld.code,
    });
  }

  return { bundle, diagnostics };
}

/**
 * Validates that sdd-ref fields only reference entity types allowed by x-refTargets.
 */
function validateRefTargets(
  bundle: Bundle,
  rawSchemas: Map<string, Record<string, unknown>>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const edge of bundle.refGraph.edges) {
    // Get the schema for the source entity type
    const schema = rawSchemas.get(edge.fromEntityType);
    if (!schema) continue;

    // Find the x-refTargets for the field
    const allowedTargets = extractRefTargets(schema, edge.fromField);
    if (!allowedTargets || allowedTargets.length === 0) continue;

    // Get the actual target entity type from the idRegistry
    const target = bundle.idRegistry.get(edge.toId);
    if (!target) continue; // Broken ref - handled by no-broken-ref rule

    // Check if the actual target type is in the allowed list
    if (!allowedTargets.includes(target.entityType)) {
      diagnostics.push({
        severity: 'error',
        message: `Reference "${edge.toId}" from ${edge.fromEntityType} "${edge.fromId}" via "${edge.fromField}" points to ${target.entityType}, but x-refTargets only allows: ${allowedTargets.join(', ')}`,
        entityId: edge.fromId,
        entityType: edge.fromEntityType,
        path: `/${edge.fromField}`,
        source: 'schema',
        code: 'ref-type-mismatch',
      });
    }
  }

  return diagnostics;
}

/**
 * Extracts x-refTargets from a schema for a given field.
 * Handles both direct properties and array items.
 */
function extractRefTargets(schema: Record<string, unknown>, fieldName: string): string[] | null {
  const properties = schema.properties as Record<string, unknown> | undefined;
  if (!properties) return null;

  const fieldSchema = properties[fieldName] as Record<string, unknown> | undefined;
  if (!fieldSchema) return null;

  // Direct field with x-refTargets
  if (Array.isArray(fieldSchema['x-refTargets'])) {
    return fieldSchema['x-refTargets'] as string[];
  }

  // Array field with items containing x-refTargets
  const items = fieldSchema.items as Record<string, unknown> | undefined;
  if (items && Array.isArray(items['x-refTargets'])) {
    return items['x-refTargets'] as string[];
  }

  return null;
}

export type {
  Bundle,
  BundleManifest,
  BundleTypeDefinition,
  Diagnostic,
  Entity,
  EntityId,
  EntityType,
  IdRegistry,
  RefEdge,
  RefGraph,
} from './types';

export * from './write';
export type { ProposedChange } from './types';
export { applyChangesToBundle, type ApplyChangesResult } from './services/ChangeApplicationService';

// Test utilities (exported for use in tests in other packages)
export * from './test-fixtures';
