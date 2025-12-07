import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export interface CompiledSchemaSet {
  ajv: Ajv2020;
  validators: Map<string, ValidateFunction>;
}

export interface DocumentSchemaConfig {
  bundleDir: string;
  schemas: Record<string, string>; // entityType -> relative schema path
}

export async function loadSchemas(config: DocumentSchemaConfig): Promise<CompiledSchemaSet> {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    $data: true,
  });
  addFormats(ajv);

  // Custom SDD-specific format used to mark reference ID fields.
  ajv.addFormat('sdd-ref', {
    type: 'string',
    validate: (data: unknown) => typeof data === 'string' && data.trim().length > 0,
  });

  // Allow SDD-specific extension keywords in strict mode (metadata only).
  const passthroughKeywords = ['x-refTargets', 'x-idTemplate', 'x-entityType', 'x-idScope'];
  for (const keyword of passthroughKeywords) {
    ajv.addKeyword({
      keyword,
      // These keywords are metadata; they do not affect validation.
      schemaType: ['string', 'array'],
      errors: false,
    });
  }

  const validators = new Map<string, ValidateFunction>();

  for (const [entityType, relPath] of Object.entries(config.schemas)) {
    const schemaPath = path.join(config.bundleDir, relPath);
    const raw = await fs.readFile(schemaPath, 'utf8');
    const schema = JSON.parse(raw);
    const validate = ajv.compile(schema);
    validators.set(entityType, validate);
  }

  return { ajv, validators };
}

export interface EntityValidationContext {
  entityType: string;
  entity: unknown;
}

export interface SchemaDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  entityType?: string;
  entityId?: string;
  path?: string;
  source: 'schema';
  code?: string;
}

export function validateEntity(
  compiled: CompiledSchemaSet,
  ctx: EntityValidationContext,
): SchemaDiagnostic[] {
  const validator = compiled.validators.get(ctx.entityType);
  if (!validator) {
    return [
      {
        severity: 'error',
        message: `No schema registered for entity type "${ctx.entityType}"`,
        entityType: ctx.entityType,
        source: 'schema',
        code: 'schema.missing',
      },
    ];
  }

  const valid = validator(ctx.entity);
  if (valid) {
    return [];
  }

  const diagnostics: SchemaDiagnostic[] = [];
  for (const err of validator.errors ?? []) {
    const path = err.instancePath || '/';
    const code = err.keyword || 'schema.validation';
    diagnostics.push({
      severity: 'error',
      message: `${path} ${err.message ?? 'schema validation error'}`.trim(),
      entityType: ctx.entityType,
      path,
      source: 'schema',
      code,
    });
  }
  return diagnostics;
}
