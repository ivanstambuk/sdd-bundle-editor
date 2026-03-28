import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseYaml } from 'yaml';
import {
  type AllowedValuesWhenFieldEqualsRule,
  type CoverageRule,
  type DescriptiveIdRule,
  type EnumValueRule,
  type ForbidValuesWhenFieldIncludesRule,
  type HasLinkRule,
  type LintConfig,
  type LintDiagnostic,
  type LintRule,
  type NoEmptyArrayRule,
  type ProfileInheritanceFieldModesRule,
  type ProfileEffectiveForbidValuesWhenFieldIncludesRule,
  type ProfileStepOrderConsistencyRule,
  type QualityCheckRule,
  type RedundantBidirectionalLinkRule,
  type RegexRule,
  type RequiredFieldRule,
  type RequiredFieldWhenFieldEqualsRule,
  type ShapeEqualsRule,
  type ProfileOperationContractMatchRule,
  type SuiteVectorProfileMatchRule,
  type SuiteVectorOperationMatchRule,
  type VectorProfileContextConsistencyRule,
  type VectorStepGraphConsistencyRule,
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

function getFieldValue(data: Record<string, unknown>, fieldPath: string): unknown {
  const segments = fieldPath.split('.');
  let current: unknown = data;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function hasOwnField(data: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, field);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value];
  }
  return [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isMissingRequiredValue(value: unknown): boolean {
  return value === undefined || value === null ||
    (typeof value === 'string' && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0);
}

function createEffectiveProfileFieldResolver(
  profiles: Map<string, LintEntity>,
  parentField: string,
  inheritanceModeField: string,
  fieldModesField: string,
) {
  const effectiveFieldCache = new Map<string, string[]>();

  const getEffectiveProfileField = (profileId: string, field: string, stack: Set<string> = new Set()): string[] => {
    const cacheKey = `${profileId}:${field}`;
    const cached = effectiveFieldCache.get(cacheKey);
    if (cached) return cached;

    const profile = profiles.get(profileId);
    if (!profile) return [];
    if (stack.has(cacheKey)) {
      return asStringArray(getFieldValue(profile.data, field));
    }

    stack.add(cacheKey);
    const parentIds = asStringArray(getFieldValue(profile.data, parentField));
    const inheritanceMode = getFieldValue(profile.data, inheritanceModeField);
    if (parentIds.length !== 1 || inheritanceMode !== 'additive') {
      const directValues = asStringArray(getFieldValue(profile.data, field));
      effectiveFieldCache.set(cacheKey, directValues);
      stack.delete(cacheKey);
      return directValues;
    }

    const parentEffective = getEffectiveProfileField(parentIds[0], field, stack);
    const fieldModes = getFieldValue(profile.data, fieldModesField);
    const mode = fieldModes && typeof fieldModes === 'object' && !Array.isArray(fieldModes)
      ? (fieldModes as Record<string, unknown>)[field]
      : undefined;
    const childValues = asStringArray(getFieldValue(profile.data, field));

    let effectiveValues = childValues;
    if (mode === 'inherit') {
      effectiveValues = parentEffective;
    } else if (mode === 'extend') {
      effectiveValues = unique([...parentEffective, ...childValues]);
    } else if (mode === 'narrow') {
      effectiveValues = childValues;
    } else if (mode === 'replace') {
      effectiveValues = childValues;
    }

    effectiveFieldCache.set(cacheKey, effectiveValues);
    stack.delete(cacheKey);
    return effectiveValues;
  };

  return getEffectiveProfileField;
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
      const value = getFieldValue(entity.data, rule.field);
      if (isMissingRequiredValue(value)) {
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

function runRequiredFieldWhenFieldEqualsRule(
  bundle: LintBundle,
  ruleName: string,
  rule: RequiredFieldWhenFieldEqualsRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      const whenValue = getFieldValue(entity.data, rule.whenField);
      if (!includesAnyValue(whenValue, rule.whenEqualsAny)) {
        continue;
      }

      const value = getFieldValue(entity.data, rule.field);
      if (!isMissingRequiredValue(value)) {
        continue;
      }

      diagnostics.push({
        code: ruleName,
        message: rule.message ?? `Required field "${rule.field}" is missing or empty on ${entityType} "${entity.id}" when "${rule.whenField}" is ${rule.whenEqualsAny.join(', ')}.`,
        severity: ruleSeverity(rule),
        entityType,
        entityId: entity.id,
        field: rule.field,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runNoEmptyArrayRule(bundle: LintBundle, ruleName: string, rule: NoEmptyArrayRule): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      for (const field of rule.fields) {
        const value = (entity.data as Record<string, unknown>)[field];
        if (Array.isArray(value) && value.length === 0) {
          diagnostics.push({
            code: ruleName,
            message: `Field "${field}" on ${entityType} "${entity.id}" is present but empty. Omit it or provide at least one value.`,
            severity: ruleSeverity(rule),
            entityType,
            entityId: entity.id,
            field,
            source: 'lint',
          });
        }
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

/**
 * Detects redundant bidirectional links where A→B and B→A both exist.
 * 
 * When two entities reference each other, only one direction is needed.
 * The reverse link is redundant and adds maintenance burden.
 * 
 * Example: If Requirement REQ-001 has `realizesFeatureIds: [FEAT-001]`
 * and Feature FEAT-001 has `requirementIds: [REQ-001]`, then one of those
 * links is redundant. The recommendation is to keep the forward link from
 * the "child" to the "parent" (REQ→FEAT) and remove the backlink.
 */
function runRedundantBidirectionalLinkRule(
  bundle: LintBundle,
  ruleName: string,
  rule: RedundantBidirectionalLinkRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  // Build a map of all edges: key = "fromId|toId", value = edge info
  // Normalized key ensures we can detect A→B and B→A as the same pair
  type EdgeInfo = { fromEntityType: string; fromId: string; fromField: string; toEntityType: string; toId: string };
  const forwardEdges = new Map<string, EdgeInfo>();
  const reportedPairs = new Set<string>();

  // First pass: collect all edges indexed by their directed key
  for (const edge of bundle.refGraph.edges) {
    const key = `${edge.fromId}|${edge.toId}`;
    forwardEdges.set(key, edge);
  }

  // Second pass: check for reverse edges
  for (const edge of bundle.refGraph.edges) {
    const reverseKey = `${edge.toId}|${edge.fromId}`;
    const reverseEdge = forwardEdges.get(reverseKey);

    if (reverseEdge) {
      // Create a normalized pair key to avoid duplicate reports
      const pairKey = [edge.fromId, edge.toId].sort().join('|');

      if (!reportedPairs.has(pairKey)) {
        reportedPairs.add(pairKey);

        // Report on the "backlink" - typically from the higher entity to the lower
        // Heuristic: the entity with shorter ID or alphabetically first is likely the "parent"
        const isCurrentTheBacklink = edge.fromId > edge.toId;
        const redundantEdge = isCurrentTheBacklink ? edge : reverseEdge;

        diagnostics.push({
          code: ruleName,
          message: `Redundant bidirectional link: ${redundantEdge.fromEntityType} "${redundantEdge.fromId}" links to ${redundantEdge.toEntityType} "${redundantEdge.toId}" via "${redundantEdge.fromField}", but "${redundantEdge.toId}" already links back. Consider removing one direction.`,
          severity: rule.severity ?? 'warning',
          entityType: redundantEdge.fromEntityType,
          entityId: redundantEdge.fromId,
          field: redundantEdge.fromField,
          source: 'lint',
        });
      }
    }
  }

  return diagnostics;
}

function includesAnyValue(value: unknown, wanted: string[]): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'string' && wanted.includes(item));
  }
  return typeof value === 'string' && wanted.includes(value);
}

function valuesAllAllowed(value: unknown, allowedValues: string[]): boolean {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string' && allowedValues.includes(item));
  }
  return typeof value === 'string' && allowedValues.includes(value);
}

function runForbidValuesWhenFieldIncludesRule(
  bundle: LintBundle,
  ruleName: string,
  rule: ForbidValuesWhenFieldIncludesRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      const whenValue = (entity.data as Record<string, unknown>)[rule.whenField];
      if (!includesAnyValue(whenValue, rule.whenIncludesAny)) {
        continue;
      }

      const forbidValue = (entity.data as Record<string, unknown>)[rule.forbidField];
      if (!includesAnyValue(forbidValue, rule.forbidValues)) {
        continue;
      }

      diagnostics.push({
        code: ruleName,
        message: rule.message ?? `${entityType} "${entity.id}" combines "${rule.whenField}" with forbidden value(s) in "${rule.forbidField}".`,
        severity: ruleSeverity(rule),
        entityType,
        entityId: entity.id,
        field: rule.forbidField,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runSuiteVectorProfileMatchRule(
  bundle: LintBundle,
  ruleName: string,
  rule: SuiteVectorProfileMatchRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const suites = bundle.entities.get(rule.suiteEntity);
  const classes = bundle.entities.get(rule.classEntity);
  const vectors = bundle.entities.get('TestVector');
  if (!suites || !classes || !vectors) return diagnostics;

  for (const suite of suites.values()) {
    const classIds = (suite.data[rule.classField] as unknown[]) ?? [];
    const allowedProfiles = new Set<string>();

    for (const classId of classIds) {
      if (typeof classId !== 'string') continue;
      const klass = classes.get(classId);
      if (!klass) continue;
      const profileIds = (klass.data[rule.classProfileField] as unknown[]) ?? [];
      for (const profileId of profileIds) {
        if (typeof profileId === 'string') {
          allowedProfiles.add(profileId);
        }
      }
    }

    const vectorIds = (suite.data[rule.vectorField] as unknown[]) ?? [];
    for (const vectorId of vectorIds) {
      if (typeof vectorId !== 'string') continue;
      const vector = vectors.get(vectorId);
      if (!vector) continue;
      const profileId = vector.data[rule.vectorProfileField];
      if (typeof profileId !== 'string') continue;
      if (!allowedProfiles.has(profileId)) {
        diagnostics.push({
          code: ruleName,
          message: `${rule.suiteEntity} "${suite.id}" includes TestVector "${vector.id}" for profile "${profileId}", but its targeted classes do not include that profile.`,
          severity: ruleSeverity(rule),
          entityType: rule.suiteEntity,
          entityId: suite.id,
          field: rule.vectorField,
          source: 'lint',
        });
      }
    }
  }

  return diagnostics;
}

function runVectorProfileContextConsistencyRule(
  bundle: LintBundle,
  ruleName: string,
  rule: VectorProfileContextConsistencyRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const vectors = bundle.entities.get(rule.vectorEntity);
  const profiles = bundle.entities.get(rule.profileEntity);
  if (!vectors || !profiles) return diagnostics;

  for (const vector of vectors.values()) {
    const invocationProfileId = getFieldValue(vector.data, rule.invocationProfileField);
    const evaluatedProfileId = getFieldValue(vector.data, rule.evaluatedProfileField);
    const selectedProfileId = rule.selectedProfileField
      ? getFieldValue(vector.data, rule.selectedProfileField)
      : undefined;
    const selectedKeyStrategyId = getFieldValue(vector.data, rule.selectedKeyStrategyField);

    if (typeof invocationProfileId === 'string' && typeof evaluatedProfileId === 'string' && invocationProfileId !== evaluatedProfileId) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.vectorEntity} "${vector.id}" has "${rule.evaluatedProfileField}"="${evaluatedProfileId}" but "${rule.invocationProfileField}"="${invocationProfileId}".`,
        severity: ruleSeverity(rule),
        entityType: rule.vectorEntity,
        entityId: vector.id,
        field: rule.evaluatedProfileField,
        source: 'lint',
      });
    }

    if (rule.selectedProfileField && typeof invocationProfileId === 'string' && typeof selectedProfileId === 'string' && invocationProfileId !== selectedProfileId) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.vectorEntity} "${vector.id}" has "${rule.selectedProfileField}"="${selectedProfileId}" but "${rule.invocationProfileField}"="${invocationProfileId}".`,
        severity: ruleSeverity(rule),
        entityType: rule.vectorEntity,
        entityId: vector.id,
        field: rule.selectedProfileField,
        source: 'lint',
      });
    }

    if (typeof invocationProfileId !== 'string' || typeof selectedKeyStrategyId !== 'string') {
      continue;
    }

    const profile = profiles.get(invocationProfileId);
    if (!profile) continue;
    const allowedStrategies = asStringArray(getFieldValue(profile.data, rule.profileKeyStrategyField));
    if (!allowedStrategies.includes(selectedKeyStrategyId)) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.vectorEntity} "${vector.id}" selects key strategy "${selectedKeyStrategyId}", but ${rule.profileEntity} "${profile.id}" does not allow it via "${rule.profileKeyStrategyField}".`,
        severity: ruleSeverity(rule),
        entityType: rule.vectorEntity,
        entityId: vector.id,
        field: rule.selectedKeyStrategyField,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runVectorStepGraphConsistencyRule(
  bundle: LintBundle,
  ruleName: string,
  rule: VectorStepGraphConsistencyRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const vectors = bundle.entities.get(rule.vectorEntity);
  const steps = bundle.entities.get(rule.stepEntity);
  if (!vectors || !steps) return diagnostics;

  for (const vector of vectors.values()) {
    const terminalStepId = getFieldValue(vector.data, rule.terminalStepField);
    if (typeof terminalStepId !== 'string') continue;

    const step = steps.get(terminalStepId);
    if (!step) continue;

    const stepRuleIds = asStringArray(getFieldValue(step.data, rule.stepRuleField));
    const stepErrorIds = asStringArray(getFieldValue(step.data, rule.stepErrorField));
    const failedRuleId = getFieldValue(vector.data, rule.failedRuleField);
    const primaryErrorId = getFieldValue(vector.data, rule.primaryErrorField);

    if (typeof failedRuleId === 'string' && !stepRuleIds.includes(failedRuleId)) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.vectorEntity} "${vector.id}" expects failed rule "${failedRuleId}" at "${terminalStepId}", but ${rule.stepEntity} "${terminalStepId}" does not execute that rule.`,
        severity: ruleSeverity(rule),
        entityType: rule.vectorEntity,
        entityId: vector.id,
        field: rule.failedRuleField,
        source: 'lint',
      });
    }

    if (typeof primaryErrorId === 'string' && !stepErrorIds.includes(primaryErrorId)) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.vectorEntity} "${vector.id}" expects primary error "${primaryErrorId}" at "${terminalStepId}", but ${rule.stepEntity} "${terminalStepId}" does not produce that error.`,
        severity: ruleSeverity(rule),
        entityType: rule.vectorEntity,
        entityId: vector.id,
        field: rule.primaryErrorField,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runProfileStepOrderConsistencyRule(
  bundle: LintBundle,
  ruleName: string,
  rule: ProfileStepOrderConsistencyRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const profiles = bundle.entities.get(rule.profileEntity);
  const steps = bundle.entities.get(rule.stepEntity);
  if (!profiles || !steps) return diagnostics;

  for (const profile of profiles.values()) {
    const stepIds = asStringArray(getFieldValue(profile.data, rule.profileStepField));
    const seen = new Set<string>();
    let lastOrder = -1;

    for (const stepId of stepIds) {
      if (seen.has(stepId)) {
        diagnostics.push({
          code: ruleName,
          message: `${rule.profileEntity} "${profile.id}" repeats validation step "${stepId}" in "${rule.profileStepField}".`,
          severity: ruleSeverity(rule),
          entityType: rule.profileEntity,
          entityId: profile.id,
          field: rule.profileStepField,
          source: 'lint',
        });
        continue;
      }
      seen.add(stepId);

      const step = steps.get(stepId);
      if (!step) continue;
      const order = getFieldValue(step.data, rule.stepOrderField);
      if (typeof order !== 'number') continue;
      if (order <= lastOrder) {
        diagnostics.push({
          code: ruleName,
          message: `${rule.profileEntity} "${profile.id}" lists step "${stepId}" out of order in "${rule.profileStepField}" relative to "${rule.stepOrderField}".`,
          severity: ruleSeverity(rule),
          entityType: rule.profileEntity,
          entityId: profile.id,
          field: rule.profileStepField,
          source: 'lint',
        });
        break;
      }
      lastOrder = order;
    }
  }

  return diagnostics;
}

function runAllowedValuesWhenFieldEqualsRule(
  bundle: LintBundle,
  ruleName: string,
  rule: AllowedValuesWhenFieldEqualsRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  for (const entityType of rule.targetEntities) {
    const entitiesOfType = bundle.entities.get(entityType);
    if (!entitiesOfType) continue;

    for (const entity of entitiesOfType.values()) {
      const whenValue = getFieldValue(entity.data, rule.whenField);
      if (!includesAnyValue(whenValue, rule.whenEqualsAny)) {
        continue;
      }

      const value = getFieldValue(entity.data, rule.field);
      if (value === undefined || valuesAllAllowed(value, rule.allowedValues)) {
        continue;
      }

      diagnostics.push({
        code: ruleName,
        message: rule.message ?? `${entityType} "${entity.id}" must use allowed value(s) in "${rule.field}" when "${rule.whenField}" is ${rule.whenEqualsAny.join(', ')}.`,
        severity: ruleSeverity(rule),
        entityType,
        entityId: entity.id,
        field: rule.field,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runSuiteVectorOperationMatchRule(
  bundle: LintBundle,
  ruleName: string,
  rule: SuiteVectorOperationMatchRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const suites = bundle.entities.get(rule.suiteEntity);
  const classes = bundle.entities.get(rule.classEntity);
  const vectors = bundle.entities.get('TestVector');
  if (!suites || !classes || !vectors) return diagnostics;

  for (const suite of suites.values()) {
    const classIds = asStringArray(getFieldValue(suite.data, rule.classField));
    const allowedOperations = new Set<string>();

    for (const classId of classIds) {
      const klass = classes.get(classId);
      if (!klass) continue;
      for (const operationId of asStringArray(getFieldValue(klass.data, rule.classOperationField))) {
        allowedOperations.add(operationId);
      }
    }

    for (const vectorId of asStringArray(getFieldValue(suite.data, rule.vectorField))) {
      const vector = vectors.get(vectorId);
      if (!vector) continue;
      const operationId = getFieldValue(vector.data, rule.vectorOperationField);
      if (typeof operationId !== 'string') continue;
      if (!allowedOperations.has(operationId)) {
        diagnostics.push({
          code: ruleName,
          message: `${rule.suiteEntity} "${suite.id}" includes TestVector "${vector.id}" for operation "${operationId}", but its targeted classes do not require that operation.`,
          severity: ruleSeverity(rule),
          entityType: rule.suiteEntity,
          entityId: suite.id,
          field: rule.vectorField,
          source: 'lint',
        });
      }
    }
  }

  return diagnostics;
}

function runProfileOperationContractMatchRule(
  bundle: LintBundle,
  ruleName: string,
  rule: ProfileOperationContractMatchRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const profiles = bundle.entities.get(rule.profileEntity);
  const operations = bundle.entities.get(rule.operationEntity);
  if (!profiles || !operations) return diagnostics;

  const operation = operations.get(rule.operationId);
  if (!operation) {
    return diagnostics;
  }

  const acceptedStructureIds = asStringArray(getFieldValue(operation.data, rule.operationAcceptsField));
  const acceptedStructures = new Set(acceptedStructureIds);
  const producedStructures = new Set(asStringArray(getFieldValue(operation.data, rule.operationProducesField)));
  const dataStructures = bundle.entities.get('DataStructure');
  const composedAcceptedStructures = new Set<string>();

  for (const structureId of acceptedStructureIds) {
    const structure = dataStructures?.get(structureId);
    if (!structure) continue;
    for (const composedId of asStringArray(getFieldValue(structure.data, 'composesStructureIds'))) {
      composedAcceptedStructures.add(composedId);
    }
  }

  for (const profile of profiles.values()) {
    const policyId = getFieldValue(profile.data, rule.profilePolicyField);
    const contextId = getFieldValue(profile.data, rule.profileContextField);
    const resultId = getFieldValue(profile.data, rule.profileResultField);

    if (typeof policyId === 'string' && !acceptedStructures.has(policyId) && !composedAcceptedStructures.has(policyId)) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.profileEntity} "${profile.id}" accepts policy structure "${policyId}", but ${rule.operationEntity} "${operation.id}" does not.`,
        severity: ruleSeverity(rule),
        entityType: rule.profileEntity,
        entityId: profile.id,
        field: rule.profilePolicyField,
        source: 'lint',
      });
    }

    if (typeof contextId === 'string' && !acceptedStructures.has(contextId) && !composedAcceptedStructures.has(contextId)) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.profileEntity} "${profile.id}" accepts context structure "${contextId}", but ${rule.operationEntity} "${operation.id}" does not.`,
        severity: ruleSeverity(rule),
        entityType: rule.profileEntity,
        entityId: profile.id,
        field: rule.profileContextField,
        source: 'lint',
      });
    }

    if (typeof resultId === 'string' && !producedStructures.has(resultId)) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.profileEntity} "${profile.id}" returns structure "${resultId}", but ${rule.operationEntity} "${operation.id}" does not produce it.`,
        severity: ruleSeverity(rule),
        entityType: rule.profileEntity,
        entityId: profile.id,
        field: rule.profileResultField,
        source: 'lint',
      });
    }
  }

  return diagnostics;
}

function runProfileInheritanceFieldModesRule(
  bundle: LintBundle,
  ruleName: string,
  rule: ProfileInheritanceFieldModesRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const profiles = bundle.entities.get(rule.profileEntity);
  if (!profiles) return diagnostics;
  const getEffectiveProfileField = createEffectiveProfileFieldResolver(
    profiles,
    rule.parentField,
    rule.inheritanceModeField,
    rule.fieldModesField,
  );

  for (const profile of profiles.values()) {
    const inheritanceMode = getFieldValue(profile.data, rule.inheritanceModeField);
    const parentIds = asStringArray(getFieldValue(profile.data, rule.parentField));
    if (parentIds.length === 0 || inheritanceMode !== 'additive') {
      continue;
    }

    if (parentIds.length !== 1) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.profileEntity} "${profile.id}" declares additive inheritance from ${parentIds.length} parents. This rule requires exactly one parent to validate field modes.`,
        severity: ruleSeverity(rule),
        entityType: rule.profileEntity,
        entityId: profile.id,
        field: rule.parentField,
        source: 'lint',
      });
      continue;
    }

    const parent = profiles.get(parentIds[0]);
    if (!parent) continue;
    const fieldModes = getFieldValue(profile.data, rule.fieldModesField);
    if (!fieldModes || typeof fieldModes !== 'object' || Array.isArray(fieldModes)) {
      diagnostics.push({
        code: ruleName,
        message: `${rule.profileEntity} "${profile.id}" must declare "${rule.fieldModesField}" when using additive inheritance.`,
        severity: ruleSeverity(rule),
        entityType: rule.profileEntity,
        entityId: profile.id,
        field: rule.fieldModesField,
        source: 'lint',
      });
      continue;
    }

    const modes = fieldModes as Record<string, unknown>;
    for (const field of rule.trackedFields) {
      const mode = modes[field];
      if (mode !== 'inherit' && mode !== 'extend' && mode !== 'narrow' && mode !== 'replace') {
        diagnostics.push({
          code: ruleName,
          message: `${rule.profileEntity} "${profile.id}" must declare an inheritance mode for "${field}" in "${rule.fieldModesField}".`,
          severity: ruleSeverity(rule),
          entityType: rule.profileEntity,
          entityId: profile.id,
          field: `${rule.fieldModesField}.${field}`,
          source: 'lint',
        });
        continue;
      }

      const parentValues = getEffectiveProfileField(parent.id, field);
      const childValues = asStringArray(getFieldValue(profile.data, field));
      const childHasField = hasOwnField(profile.data, field);

      if (mode === 'inherit') {
        if (childHasField) {
          diagnostics.push({
            code: ruleName,
            message: `${rule.profileEntity} "${profile.id}" marks "${field}" as inherited, so the field should be omitted instead of restated.`,
            severity: ruleSeverity(rule),
            entityType: rule.profileEntity,
            entityId: profile.id,
            field,
            source: 'lint',
          });
        }
        continue;
      }

      if (!childHasField) {
        diagnostics.push({
          code: ruleName,
          message: `${rule.profileEntity} "${profile.id}" marks "${field}" as "${mode}", so the field must be present on the child profile.`,
          severity: ruleSeverity(rule),
          entityType: rule.profileEntity,
          entityId: profile.id,
          field,
          source: 'lint',
        });
        continue;
      }

      if (mode === 'extend') {
        const duplicatedParentValue = childValues.find((value) => parentValues.includes(value));
        if (duplicatedParentValue) {
          diagnostics.push({
            code: ruleName,
            message: `${rule.profileEntity} "${profile.id}" extends "${field}" but redundantly restates inherited value "${duplicatedParentValue}".`,
            severity: ruleSeverity(rule),
            entityType: rule.profileEntity,
            entityId: profile.id,
            field,
            source: 'lint',
          });
        }
        if (childValues.length === 0) {
          diagnostics.push({
            code: ruleName,
            message: `${rule.profileEntity} "${profile.id}" extends "${field}" but does not add any child-specific values.`,
            severity: ruleSeverity(rule),
            entityType: rule.profileEntity,
            entityId: profile.id,
            field,
            source: 'lint',
          });
        }
        continue;
      }

      if (mode === 'narrow') {
        const nonParentValue = childValues.find((value) => !parentValues.includes(value));
        if (nonParentValue) {
          diagnostics.push({
            code: ruleName,
            message: `${rule.profileEntity} "${profile.id}" narrows "${field}" but includes non-inherited value "${nonParentValue}".`,
            severity: ruleSeverity(rule),
            entityType: rule.profileEntity,
            entityId: profile.id,
            field,
            source: 'lint',
          });
        }
        if (parentValues.length > 0 && childValues.length >= parentValues.length) {
          diagnostics.push({
            code: ruleName,
            message: `${rule.profileEntity} "${profile.id}" marks "${field}" as narrowed, but the child values are not a strict subset of the parent.`,
            severity: ruleSeverity(rule),
            entityType: rule.profileEntity,
            entityId: profile.id,
            field,
            source: 'lint',
          });
        }
      }
    }
  }

  return diagnostics;
}

function runProfileEffectiveForbidValuesWhenFieldIncludesRule(
  bundle: LintBundle,
  ruleName: string,
  rule: ProfileEffectiveForbidValuesWhenFieldIncludesRule
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const profiles = bundle.entities.get(rule.profileEntity);
  if (!profiles) return diagnostics;

  const getEffectiveProfileField = createEffectiveProfileFieldResolver(
    profiles,
    rule.parentField,
    rule.inheritanceModeField,
    rule.fieldModesField,
  );

  for (const profile of profiles.values()) {
    const effectiveWhenValues = getEffectiveProfileField(profile.id, rule.whenField);
    if (!effectiveWhenValues.some((value) => rule.whenIncludesAny.includes(value))) {
      continue;
    }

    const forbiddenValue = getEffectiveProfileField(profile.id, rule.forbidField)
      .find((value) => rule.forbidValues.includes(value));
    if (!forbiddenValue) {
      continue;
    }

    diagnostics.push({
      code: ruleName,
      message: rule.message ?? `${rule.profileEntity} "${profile.id}" effectively includes forbidden value "${forbiddenValue}" in "${rule.forbidField}" when "${rule.whenField}" includes ${rule.whenIncludesAny.join(', ')}.`,
      severity: ruleSeverity(rule),
      entityType: rule.profileEntity,
      entityId: profile.id,
      field: rule.forbidField,
      source: 'lint',
    });
  }

  return diagnostics;
}

function resolveShapeSource(
  bundle: LintBundle,
  rawSchemas: Map<string, Record<string, unknown>> | undefined,
  source: 'entity' | 'schema',
  entityType: string,
  entityId: string | undefined,
  path: string,
): { value: unknown; ownerEntityType?: string; ownerEntityId?: string } | undefined {
  if (source === 'schema') {
    const schema = rawSchemas?.get(entityType);
    if (!schema) return undefined;
    return { value: getFieldValue(schema, path), ownerEntityType: entityType };
  }

  const entities = bundle.entities.get(entityType);
  if (!entities) return undefined;
  if (entityId) {
    const entity = entities.get(entityId);
    if (!entity) return undefined;
    return { value: getFieldValue(entity.data, path), ownerEntityType: entityType, ownerEntityId: entityId };
  }
  return undefined;
}

function normalizeShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeShape);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('x-sdd-')) {
      continue;
    }
    normalized[key] = normalizeShape(child);
  }
  return normalized;
}

function runShapeEqualsRule(
  bundle: LintBundle,
  rawSchemas: Map<string, Record<string, unknown>> | undefined,
  ruleName: string,
  rule: ShapeEqualsRule
): LintDiagnostic[] {
  const left = resolveShapeSource(bundle, rawSchemas, rule.leftSource, rule.leftEntityType, rule.leftEntityId, rule.leftPath);
  const right = resolveShapeSource(bundle, rawSchemas, rule.rightSource, rule.rightEntityType, rule.rightEntityId, rule.rightPath);
  if (!left || !right) return [];

  if (isDeepStrictEqual(normalizeShape(left.value), normalizeShape(right.value))) {
    return [];
  }

  return [{
    code: ruleName,
    message: rule.message ?? `Shape mismatch between ${rule.leftSource}:${rule.leftEntityType}${rule.leftEntityId ? `:${rule.leftEntityId}` : ''}.${rule.leftPath} and ${rule.rightSource}:${rule.rightEntityType}${rule.rightEntityId ? `:${rule.rightEntityId}` : ''}.${rule.rightPath}.`,
    severity: ruleSeverity(rule),
    entityType: left.ownerEntityType,
    entityId: left.ownerEntityId,
    field: rule.leftPath,
    source: 'lint',
  }];
}

export function runLintRules(
  bundle: LintBundle,
  config: LintConfig | undefined,
  rawSchemas?: Map<string, Record<string, unknown>>
): LintDiagnostic[] {
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
      case 'required-field-when-field-equals':
        diagnostics.push(...runRequiredFieldWhenFieldEqualsRule(bundle, name, rule));
        break;
      case 'no-empty-array':
        diagnostics.push(...runNoEmptyArrayRule(bundle, name, rule));
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
      case 'redundant-bidirectional-link':
        diagnostics.push(...runRedundantBidirectionalLinkRule(bundle, name, rule));
        break;
      case 'forbid-values-when-field-includes':
        diagnostics.push(...runForbidValuesWhenFieldIncludesRule(bundle, name, rule));
        break;
      case 'suite-vector-profile-match':
        diagnostics.push(...runSuiteVectorProfileMatchRule(bundle, name, rule));
        break;
      case 'vector-profile-context-consistency':
        diagnostics.push(...runVectorProfileContextConsistencyRule(bundle, name, rule));
        break;
      case 'vector-step-graph-consistency':
        diagnostics.push(...runVectorStepGraphConsistencyRule(bundle, name, rule));
        break;
      case 'profile-step-order-consistency':
        diagnostics.push(...runProfileStepOrderConsistencyRule(bundle, name, rule));
        break;
      case 'allowed-values-when-field-equals':
        diagnostics.push(...runAllowedValuesWhenFieldEqualsRule(bundle, name, rule));
        break;
      case 'suite-vector-operation-match':
        diagnostics.push(...runSuiteVectorOperationMatchRule(bundle, name, rule));
        break;
      case 'profile-operation-contract-match':
        diagnostics.push(...runProfileOperationContractMatchRule(bundle, name, rule));
        break;
      case 'profile-inheritance-field-modes':
        diagnostics.push(...runProfileInheritanceFieldModesRule(bundle, name, rule));
        break;
      case 'profile-effective-forbid-values-when-field-includes':
        diagnostics.push(...runProfileEffectiveForbidValuesWhenFieldIncludesRule(bundle, name, rule));
        break;
      case 'shape-equals':
        diagnostics.push(...runShapeEqualsRule(bundle, rawSchemas, name, rule));
        break;
      default:
        break;
    }
  }

  return diagnostics;
}
