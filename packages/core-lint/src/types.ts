export type LintSeverity = 'error' | 'warning';

export interface LintRuleBase {
  type: 'regex' | 'has-link' | 'coverage' | 'no-broken-ref' | 'ref-type-mismatch' | 'required-field' | 'required-field-when-field-equals' | 'enum-value' | 'quality-check' | 'descriptive-id' | 'redundant-bidirectional-link' | 'no-empty-array' | 'forbid-values-when-field-includes' | 'suite-vector-profile-match' | 'vector-profile-context-consistency' | 'vector-step-graph-consistency' | 'profile-step-order-consistency' | 'allowed-values-when-field-equals' | 'suite-vector-operation-match' | 'profile-operation-contract-match' | 'profile-inheritance-field-modes' | 'profile-effective-forbid-values-when-field-includes' | 'shape-equals';
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

export interface RequiredFieldWhenFieldEqualsRule extends LintRuleBase {
  type: 'required-field-when-field-equals';
  targetEntities: string[];
  whenField: string;
  whenEqualsAny: string[];
  field: string;
  message?: string;
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

export interface NoEmptyArrayRule extends LintRuleBase {
  type: 'no-empty-array';
  targetEntities: string[];
  fields: string[];
}

export interface ForbidValuesWhenFieldIncludesRule extends LintRuleBase {
  type: 'forbid-values-when-field-includes';
  targetEntities: string[];
  whenField: string;
  whenIncludesAny: string[];
  forbidField: string;
  forbidValues: string[];
  message?: string;
}

export interface SuiteVectorProfileMatchRule extends LintRuleBase {
  type: 'suite-vector-profile-match';
  suiteEntity: string;
  classEntity: string;
  classField: string;
  classProfileField: string;
  vectorField: string;
  vectorProfileField: string;
}

export interface VectorProfileContextConsistencyRule extends LintRuleBase {
  type: 'vector-profile-context-consistency';
  vectorEntity: string;
  profileEntity: string;
  invocationProfileField: string;
  evaluatedProfileField: string;
  selectedProfileField?: string;
  selectedKeyStrategyField: string;
  profileKeyStrategyField: string;
}

export interface VectorStepGraphConsistencyRule extends LintRuleBase {
  type: 'vector-step-graph-consistency';
  vectorEntity: string;
  stepEntity: string;
  terminalStepField: string;
  failedRuleField: string;
  primaryErrorField: string;
  stepRuleField: string;
  stepErrorField: string;
}

export interface ProfileStepOrderConsistencyRule extends LintRuleBase {
  type: 'profile-step-order-consistency';
  profileEntity: string;
  stepEntity: string;
  profileStepField: string;
  stepOrderField: string;
}

export interface AllowedValuesWhenFieldEqualsRule extends LintRuleBase {
  type: 'allowed-values-when-field-equals';
  targetEntities: string[];
  whenField: string;
  whenEqualsAny: string[];
  field: string;
  allowedValues: string[];
  message?: string;
}

export interface SuiteVectorOperationMatchRule extends LintRuleBase {
  type: 'suite-vector-operation-match';
  suiteEntity: string;
  classEntity: string;
  classField: string;
  classOperationField: string;
  vectorField: string;
  vectorOperationField: string;
}

export interface ProfileOperationContractMatchRule extends LintRuleBase {
  type: 'profile-operation-contract-match';
  profileEntity: string;
  operationEntity: string;
  operationId: string;
  operationAcceptsField: string;
  operationProducesField: string;
  profilePolicyField: string;
  profileContextField: string;
  profileResultField: string;
}

export interface ProfileInheritanceFieldModesRule extends LintRuleBase {
  type: 'profile-inheritance-field-modes';
  profileEntity: string;
  parentField: string;
  inheritanceModeField: string;
  fieldModesField: string;
  trackedFields: string[];
}

export interface ProfileEffectiveForbidValuesWhenFieldIncludesRule extends LintRuleBase {
  type: 'profile-effective-forbid-values-when-field-includes';
  profileEntity: string;
  parentField: string;
  inheritanceModeField: string;
  fieldModesField: string;
  whenField: string;
  whenIncludesAny: string[];
  forbidField: string;
  forbidValues: string[];
  message?: string;
}

export interface ShapeEqualsRule extends LintRuleBase {
  type: 'shape-equals';
  leftSource: 'entity' | 'schema';
  leftEntityType: string;
  leftEntityId?: string;
  leftPath: string;
  rightSource: 'entity' | 'schema';
  rightEntityType: string;
  rightEntityId?: string;
  rightPath: string;
  message?: string;
}

export type LintRule = RegexRule | HasLinkRule | CoverageRule | NoBrokenRefRule | RefTypeMismatchRule | RequiredFieldRule | RequiredFieldWhenFieldEqualsRule | EnumValueRule | QualityCheckRule | DescriptiveIdRule | RedundantBidirectionalLinkRule | NoEmptyArrayRule | ForbidValuesWhenFieldIncludesRule | SuiteVectorProfileMatchRule | VectorProfileContextConsistencyRule | VectorStepGraphConsistencyRule | ProfileStepOrderConsistencyRule | AllowedValuesWhenFieldEqualsRule | SuiteVectorOperationMatchRule | ProfileOperationContractMatchRule | ProfileInheritanceFieldModesRule | ProfileEffectiveForbidValuesWhenFieldIncludesRule | ShapeEqualsRule;

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
