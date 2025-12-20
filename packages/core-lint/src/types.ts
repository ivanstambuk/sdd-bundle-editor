export type LintSeverity = 'error' | 'warning';

export interface LintRuleBase {
  type: 'regex' | 'has-link' | 'coverage' | 'no-broken-ref' | 'ref-type-mismatch' | 'required-field' | 'enum-value' | 'quality-check' | 'descriptive-id' | 'redundant-bidirectional-link';
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

/** Validates that a required field is present and non-empty */
export interface RequiredFieldRule extends LintRuleBase {
  type: 'required-field';
  targetEntities: string[];
  field: string;
  message?: string; // Custom error message
}

/** Validates that a field value is one of allowed enum values */
export interface EnumValueRule extends LintRuleBase {
  type: 'enum-value';
  targetEntities: string[];
  field: string;
  allowedValues: string[];
  message?: string;
}

/** Requirement-specific quality attribute checks */
export interface QualityCheckRule extends LintRuleBase {
  type: 'quality-check';
  targetEntities: string[]; // Usually ['Requirement']
  checks: {
    atomic?: boolean;      // Warn if description too long or has multiple verbs
    traceable?: boolean;   // Warn if covered_by_scenarios/realizesFeatureIds empty (supports legacy featureIds)
    complete?: boolean;    // Warn if required fields missing
    verifiable?: boolean;  // Warn if no acceptanceCriteria AND no realizesFeatureIds (supports legacy featureIds)
  };
}

/**
 * Enforces descriptive entity IDs over pure numeric ones.
 * Pattern: PREFIX-descriptive-part (e.g., FEAT-user-auth, REQ-password-min-length)
 * Warns on: PREFIX-NNN (e.g., FEAT-001, REQ-42)
 */
export interface DescriptiveIdRule extends LintRuleBase {
  type: 'descriptive-id';
  targetEntities?: string[]; // If omitted, applies to all entity types
}

/**
 * Detects redundant bidirectional links where both A→B and B→A exist.
 * If A already links to B, there's no need for B to link back to A.
 * The reverse link is just redundant information that adds maintenance burden.
 */
export interface RedundantBidirectionalLinkRule extends LintRuleBase {
  type: 'redundant-bidirectional-link';
}

export type LintRule = RegexRule | HasLinkRule | CoverageRule | NoBrokenRefRule | RefTypeMismatchRule | RequiredFieldRule | EnumValueRule | QualityCheckRule | DescriptiveIdRule | RedundantBidirectionalLinkRule;

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
