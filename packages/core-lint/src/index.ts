import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type CoverageRule,
  type HasLinkRule,
  type LintConfig,
  type LintDiagnostic,
  type LintRule,
  type RegexRule,
} from './types';

interface LintEntity {
  id: string;
  entityType: string;
  data: Record<string, unknown>;
  filePath?: string;
}

interface LintIdRegistryEntry {
  entityType: string;
  id: string;
  filePath?: string;
}

interface LintRefEdge {
  fromEntityType: string;
  fromId: string;
  fromField: string;
  toEntityType: string;
  toId: string;
}

interface LintBundle {
  entities: Map<string, Map<string, LintEntity>>;
  idRegistry: Map<string, LintIdRegistryEntry>;
  refGraph: {
    edges: LintRefEdge[];
  };
}

export async function loadLintConfig(bundleDir: string, configRelPath?: string): Promise<LintConfig | undefined> {
  if (!configRelPath) {
    return undefined;
  }
  const fullPath = path.join(bundleDir, configRelPath);
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    // Lint config is YAML in spec, but we can start with JSON or very small YAML parser later.
    // For now, expect JSON-like content; this will evolve when we add YAML parsing dependency.
    return JSON.parse(raw) as LintConfig;
  } catch {
    return undefined;
  }
}

function ruleSeverity(rule: LintRule): 'error' | 'warning' {
  return rule.severity ?? 'error';
}

function runRegexRule(bundle: LintBundle, ruleName: string, rule: RegexRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const regex = new RegExp(rule.pattern);

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      const value = (entity.data as Record<string, unknown>)[rule.field];
      if (typeof value !== 'string') continue;
      if (!regex.test(value)) {
        diagnostics.push({
          code: ruleName,
          message: `Field "${rule.field}" on ${entityType} "${entity.id}" does not match pattern ${rule.pattern}`,
          severity: ruleSeverity(rule),
          entityType,
          entityId: entity.id,
          field: rule.field,
          source: 'lint',
        });
      }
    }
  }

  return diagnostics;
}

function runHasLinkRule(bundle: LintBundle, ruleName: string, rule: HasLinkRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const entitiesOfType = bundle.entities.get(rule.fromEntity);
  if (!entitiesOfType) return diagnostics;

  for (const entity of entitiesOfType.values()) {
    const value = (entity.data as Record<string, unknown>)[rule.viaField];
    let count = 0;
    if (Array.isArray(value)) {
      count = value.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
    } else if (typeof value === 'string' && value.trim().length > 0) {
      count = 1;
    }
    if (count < rule.minLinks) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.fromEntity} "${entity.id}" must have at least ${rule.minLinks} link(s) via "${rule.viaField}"`,
        severity: ruleSeverity(rule),
        entityType: rule.fromEntity,
        entityId: entity.id,
        field: rule.viaField,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runCoverageRule(bundle: LintBundle, ruleName: string, rule: CoverageRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const fromEntities = bundle.entities.get(rule.fromEntity);
  const toEntities = bundle.entities.get(rule.toEntity);
  if (!fromEntities || !toEntities) return diagnostics;

  const coverageCount: Map<string, number> = new Map();

  for (const entity of fromEntities.values()) {
    const value = (entity.data as Record<string, unknown>)[rule.viaField];
    const ids: string[] = [];
    if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === 'string' && v.trim().length > 0) {
          ids.push(v);
        }
      }
    } else if (typeof value === 'string' && value.trim().length > 0) {
      ids.push(value);
    }
    for (const id of ids) {
      coverageCount.set(id, (coverageCount.get(id) ?? 0) + 1);
    }
  }

  for (const toEntity of toEntities.values()) {
    const count = coverageCount.get(toEntity.id) ?? 0;
    if (count < rule.minLinks) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.toEntity} "${toEntity.id}" must be linked from at least ${rule.minLinks} "${rule.fromEntity}" via "${rule.viaField}"`,
        severity: ruleSeverity(rule),
        entityType: rule.toEntity,
        entityId: toEntity.id,
        field: rule.viaField,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runNoBrokenRefRule(bundle: LintBundle, ruleName: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const edge of bundle.refGraph.edges) {
    const target = bundle.idRegistry.get(edge.toId);
    if (!target) {
      diagnostics.push({
        code: ruleName,
        message: `Reference from ${edge.fromEntityType} "${edge.fromId}" via "${edge.fromField}" points to missing ${edge.toEntityType} "${edge.toId}"`,
        severity: 'error',
        entityType: edge.fromEntityType,
        entityId: edge.fromId,
        field: edge.fromField,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

export function runLintRules(bundle: LintBundle, config: LintConfig | undefined): LintDiagnostic[] {
  if (!config?.rules) return [];
  const diagnostics: LintDiagnostic[] = [];

  for (const [name, rule] of Object.entries(config.rules)) {
    if (!rule || typeof rule !== 'object') continue;
    switch (rule.type) {
      case 'regex':
        diagnostics.push(...runRegexRule(bundle, name, rule));
        break;
      case 'has-link':
        diagnostics.push(...runHasLinkRule(bundle, name, rule));
        break;
      case 'coverage':
        diagnostics.push(...runCoverageRule(bundle, name, rule));
        break;
      case 'no-broken-ref':
        diagnostics.push(...runNoBrokenRefRule(bundle, name));
        break;
      default:
        break;
    }
  }

  return diagnostics;
}
