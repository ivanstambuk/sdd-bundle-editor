export type LintSeverity = 'error' | 'warning';

export interface LintRuleBase {
  type: 'regex' | 'has-link' | 'coverage' | 'no-broken-ref' | 'ref-type-mismatch';
  severity?: LintSeverity;
}

export interface RegexRule extends LintRuleBase {
  type: 'regex';
  targetEntities: string[];
  field: string;
  pattern: string;
}

export interface HasLinkRule extends LintRuleBase {
  type: 'has-link';
  fromEntity: string;
  viaField: string;
  minLinks: number;
}

export interface CoverageRule extends LintRuleBase {
  type: 'coverage';
  fromEntity: string;
  toEntity: string;
  viaField: string;
  minLinks: number;
}

export interface NoBrokenRefRule extends LintRuleBase {
  type: 'no-broken-ref';
}

/**
 * Validates that sdd-ref fields only reference entity types allowed by x-refTargets.
 * This rule requires schema information to be passed separately.
 */
export interface RefTypeMismatchRule extends LintRuleBase {
  type: 'ref-type-mismatch';
}

export type LintRule = RegexRule | HasLinkRule | CoverageRule | NoBrokenRefRule | RefTypeMismatchRule;

export interface FeatureConfig {
  enabled?: boolean;
  enforceAssignmentFor?: string[];
}

export interface LintConfig {
  features?: FeatureConfig;
  rules?: Record<string, LintRule>;
}

export interface LintDiagnostic {
  code: string;
  message: string;
  severity: LintSeverity;
  entityType?: string;
  entityId?: string;
  field?: string;
  source: 'lint';
}
