import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  type CoverageRule,
  type DescriptiveIdRule,
  type EnumValueRule,
  type HasLinkRule,
  type LintConfig,
  type LintDiagnostic,
  type LintRule,
  type QualityCheckRule,
  type RegexRule,
  type RequiredFieldRule,
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
    // Support both YAML and JSON lint config files
    if (configRelPath.endsWith('.yaml') || configRelPath.endsWith('.yml')) {
      return parseYaml(raw) as LintConfig;
    }
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

function runRequiredFieldRule(bundle: LintBundle, ruleName: string, rule: RequiredFieldRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      const value = (entity.data as Record<string, unknown>)[rule.field];
      const isEmpty = value === undefined || value === null ||
        (typeof value === 'string' && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0);

      if (isEmpty) {
        diagnostics.push({
          code: ruleName,
          message: rule.message ?? `Required field "${rule.field}" is missing or empty on ${entityType} "${entity.id}"`,
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

function runEnumValueRule(bundle: LintBundle, ruleName: string, rule: EnumValueRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      const value = (entity.data as Record<string, unknown>)[rule.field];
      if (value !== undefined && value !== null && typeof value === 'string') {
        if (!rule.allowedValues.includes(value)) {
          diagnostics.push({
            code: ruleName,
            message: rule.message ?? `Field "${rule.field}" has invalid value "${value}". Allowed: ${rule.allowedValues.join(', ')}`,
            severity: ruleSeverity(rule),
            entityType,
            entityId: entity.id,
            field: rule.field,
            source: 'lint',
          });
        }
      }
    }
  }

  return diagnostics;
}

function runQualityCheckRule(bundle: LintBundle, ruleName: string, rule: QualityCheckRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      const data = entity.data as Record<string, unknown>;

      // Atomic check: description should be concise (< 500 chars) and focused
      if (rule.checks.atomic) {
        const desc = data.description;
        if (typeof desc === 'string' && desc.length > 500) {
          diagnostics.push({
            code: `${ruleName}.atomic`,
            message: `${entityType} "${entity.id}" may not be atomic: description exceeds 500 characters. Consider splitting into smaller requirements.`,
            severity: ruleSeverity(rule),
            entityType,
            entityId: entity.id,
            field: 'description',
            source: 'lint',
          });
        }
      }

      // Traceable check: should have realizesFeatureIds (or legacy featureIds) or covered_by_scenarios
      if (rule.checks.traceable) {
        // Support both new standardized name and legacy name for backward compatibility
        const realizesFeatureIds = data.realizesFeatureIds ?? data.featureIds;
        const scenarios = data.covered_by_scenarios;
        const hasFeatures = realizesFeatureIds && Array.isArray(realizesFeatureIds) && realizesFeatureIds.length > 0;
        const hasScenarios = scenarios && Array.isArray(scenarios) && scenarios.length > 0;
        if (!hasFeatures && !hasScenarios) {
          diagnostics.push({
            code: `${ruleName}.traceable`,
            message: `${entityType} "${entity.id}" has no traceability links (realizesFeatureIds or covered_by_scenarios is empty).`,
            severity: ruleSeverity(rule),
            entityType,
            entityId: entity.id,
            field: 'realizesFeatureIds',
            source: 'lint',
          });
        }
      }

      // Complete check: required fields should be filled
      if (rule.checks.complete) {
        const requiredFields = ['title', 'description', 'kind', 'category'];
        for (const field of requiredFields) {
          const val = data[field];
          if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
            diagnostics.push({
              code: `${ruleName}.complete`,
              message: `${entityType} "${entity.id}" is incomplete: missing "${field}" field.`,
              severity: ruleSeverity(rule),
              entityType,
              entityId: entity.id,
              field,
              source: 'lint',
            });
          }
        }
      }

      // Verifiable check: should have acceptanceCriteria OR realizesFeatureIds (or legacy featureIds)
      if (rule.checks.verifiable) {
        const criteria = data.acceptanceCriteria;
        // Support both new standardized name and legacy name for backward compatibility
        const realizesFeatureIds = data.realizesFeatureIds ?? data.featureIds;
        const hasCriteria = criteria && Array.isArray(criteria) && criteria.length > 0;
        const hasFeatures = realizesFeatureIds && Array.isArray(realizesFeatureIds) && realizesFeatureIds.length > 0;

        if (!hasCriteria && !hasFeatures) {
          diagnostics.push({
            code: `${ruleName}.verifiable`,
            message: `${entityType} "${entity.id}" may not be verifiable: no acceptanceCriteria and no linked features.`,
            severity: ruleSeverity(rule),
            entityType,
            entityId: entity.id,
            source: 'lint',
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Checks if an entity ID is purely numeric (like FEAT-001, REQ-42)
 * Pattern that triggers warning: PREFIX-N+ where N is all digits
 * OK patterns: PREFIX-word, PREFIX-word-001, PREFIX-001-word
 */
function runDescriptiveIdRule(bundle: LintBundle, ruleName: string, rule: DescriptiveIdRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  // Pattern for pure numeric suffix: PREFIX-digits only
  const pureNumericPattern = /^[A-Z]+-\d+$/;

  const entityTypes = rule.targetEntities ?? Array.from(bundle.entities.keys());

  for (const entityType of entityTypes) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      if (pureNumericPattern.test(entity.id)) {
        diagnostics.push({
          code: ruleName,
          message: `Entity ID "${entity.id}" uses numeric suffix only. Prefer descriptive IDs like "${entity.id.replace(/-\d+$/, '-' + getDescriptiveHint(entityType))}"`,
          severity: rule.severity ?? 'warning',
          entityType,
          entityId: entity.id,
          source: 'lint',
        });
      }
    }
  }

  return diagnostics;
}

function getDescriptiveHint(entityType: string): string {
  const hints: Record<string, string> = {
    Feature: 'user-auth',
    Requirement: 'password-min-length',
    Task: 'implement-login',
    Scenario: 'login-success',
    Decision: 'use-jwt',
    Component: 'auth-service',
    ADR: 'auth-strategy',
  };
  return hints[entityType] ?? 'descriptive-name';
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
      case 'required-field':
        diagnostics.push(...runRequiredFieldRule(bundle, name, rule));
        break;
      case 'enum-value':
        diagnostics.push(...runEnumValueRule(bundle, name, rule));
        break;
      case 'quality-check':
        diagnostics.push(...runQualityCheckRule(bundle, name, rule));
        break;
      case 'descriptive-id':
        diagnostics.push(...runDescriptiveIdRule(bundle, name, rule));
        break;
      default:
        break;
    }
  }

  return diagnostics;
}
