import { describe, it, expect } from 'vitest';
import { runLintRules } from './index';
import { LintConfig } from './types';

describe('required-field rule', () => {
    it('reports missing required field', () => {
        const bundle = {
            entities: new Map<any, any>([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', title: 'Test' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-kind-required': {
                    type: 'required-field',
                    targetEntities: ['Requirement'],
                    field: 'kind',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toBe('req-kind-required');
        expect(diagnostics[0].field).toBe('kind');
        expect(diagnostics[0].severity).toBe('error');
    });

    it('passes when required field is present', () => {
        const bundle = {
            entities: new Map<any, any>([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', title: 'Test', kind: 'functional' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-kind-required': {
                    type: 'required-field',
                    targetEntities: ['Requirement'],
                    field: 'kind',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });

    it('reports empty string as missing', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', kind: '  ' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-kind-required': {
                    type: 'required-field',
                    targetEntities: ['Requirement'],
                    field: 'kind',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
    });

    it('uses custom message when provided', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-kind-required': {
                    type: 'required-field',
                    targetEntities: ['Requirement'],
                    field: 'kind',
                    severity: 'error',
                    message: 'Custom error message for kind field',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics[0].message).toBe('Custom error message for kind field');
    });
});

describe('required-field-when-field-equals rule', () => {
    it('reports missing conditional fields when the trigger field matches', () => {
        const bundle = {
            entities: new Map([
                ['TestVector', new Map([
                    ['VEC-001', {
                        id: 'VEC-001',
                        entityType: 'TestVector',
                        data: {
                            id: 'VEC-001',
                            validationContext: { selectedKeyStrategyId: 'KEY-https-jwks' },
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'remote-vectors-require-fixtures': {
                    type: 'required-field-when-field-equals',
                    targetEntities: ['TestVector'],
                    whenField: 'validationContext.selectedKeyStrategyId',
                    whenEqualsAny: ['KEY-https-jwks'],
                    field: 'requiresFixtureIds',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toBe('remote-vectors-require-fixtures');
        expect(diagnostics[0].field).toBe('requiresFixtureIds');
    });

    it('passes when the conditional field is present', () => {
        const bundle = {
            entities: new Map([
                ['TestVector', new Map([
                    ['VEC-001', {
                        id: 'VEC-001',
                        entityType: 'TestVector',
                        data: {
                            id: 'VEC-001',
                            validationContext: { selectedKeyStrategyId: 'KEY-https-jwks' },
                            requiresFixtureIds: ['MOCK-remote-jwks-cold-rs256'],
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'remote-vectors-require-fixtures': {
                    type: 'required-field-when-field-equals',
                    targetEntities: ['TestVector'],
                    whenField: 'validationContext.selectedKeyStrategyId',
                    whenEqualsAny: ['KEY-https-jwks'],
                    field: 'requiresFixtureIds',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });
});

describe('enum-value rule', () => {
    it('reports invalid enum value', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', kind: 'invalid' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-kind-enum': {
                    type: 'enum-value',
                    targetEntities: ['Requirement'],
                    field: 'kind',
                    allowedValues: ['functional', 'non_functional', 'constraint'],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain('invalid');
        expect(diagnostics[0].message).toContain('functional, non_functional, constraint');
    });

    it('passes when enum value is valid', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', kind: 'functional' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-kind-enum': {
                    type: 'enum-value',
                    targetEntities: ['Requirement'],
                    field: 'kind',
                    allowedValues: ['functional', 'non_functional', 'constraint'],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });

    it('ignores undefined values (let required-field handle that)', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-kind-enum': {
                    type: 'enum-value',
                    targetEntities: ['Requirement'],
                    field: 'kind',
                    allowedValues: ['functional', 'non_functional', 'constraint'],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });
});

describe('quality-check rule', () => {
    it('warns on long description (atomic check)', () => {
        const longDesc = 'A'.repeat(600);
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', description: longDesc } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { atomic: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics.some(d => d.code === 'req-quality.atomic')).toBe(true);
        expect(diagnostics[0].message).toContain('500 characters');
    });

    it('passes atomic check for short description', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', description: 'Short description' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { atomic: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });

    it('warns on missing traceability (traceable check)', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', realizesFeatureIds: [] } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { traceable: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics.some(d => d.code === 'req-quality.traceable')).toBe(true);
    });

    it('passes traceable check when realizesFeatureIds present', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', realizesFeatureIds: ['FEAT-001'] } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { traceable: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });

    it('passes traceable check when legacy featureIds present (backward compatibility)', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', featureIds: ['FEAT-001'] } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { traceable: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });

    it('warns on missing required fields (complete check)', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', title: 'Test' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { complete: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        // Should warn for description, kind, category (title is present)
        expect(diagnostics.filter(d => d.code === 'req-quality.complete')).toHaveLength(3);
    });

    it('warns on non-verifiable requirements (verifiable check)', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001' } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { verifiable: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics.some(d => d.code === 'req-quality.verifiable')).toBe(true);
    });

    it('passes verifiable check when acceptanceCriteria present', () => {
        const bundle = {
            entities: new Map([
                ['Requirement', new Map([
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', acceptanceCriteria: ['Test passes'] } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'req-quality': {
                    type: 'quality-check',
                    targetEntities: ['Requirement'],
                    checks: { verifiable: true },
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(0);
    });
});

describe('no-empty-array rule', () => {
    it('reports arrays that are present but empty', () => {
        const bundle = {
            entities: new Map([
                ['TokenProfile', new Map([
                    ['PROF-test', { id: 'PROF-test', entityType: 'TokenProfile', data: { id: 'PROF-test', optionalHeaderIds: [] } }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'no-empty-optional-headers': {
                    type: 'no-empty-array',
                    targetEntities: ['TokenProfile'],
                    fields: ['optionalHeaderIds'],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].field).toBe('optionalHeaderIds');
    });
});

describe('forbid-values-when-field-includes rule', () => {
    it('reports forbidden combinations', () => {
        const bundle = {
            entities: new Map([
                ['TokenProfile', new Map([
                    ['PROF-test', {
                        id: 'PROF-test',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-test',
                            usesKeyStrategyIds: ['KEY-https-jwks'],
                            allowsAlgorithmIds: ['ALG-HS256', 'ALG-RS256'],
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'remote-profiles-no-hs256': {
                    type: 'forbid-values-when-field-includes',
                    targetEntities: ['TokenProfile'],
                    whenField: 'usesKeyStrategyIds',
                    whenIncludesAny: ['KEY-https-jwks'],
                    forbidField: 'allowsAlgorithmIds',
                    forbidValues: ['ALG-HS256'],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].field).toBe('allowsAlgorithmIds');
    });
});

describe('suite-vector-profile-match rule', () => {
    it('reports suites that include vectors for the wrong profile family', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['ConformanceSuite', new Map([
                    ['SUITE-test', {
                        id: 'SUITE-test',
                        entityType: 'ConformanceSuite',
                        data: {
                            id: 'SUITE-test',
                            targetsClassIds: ['CLASS-core'],
                            containsVectorIds: ['VEC-oidc'],
                        },
                    }],
                ])],
                ['ConformanceClass', new Map([
                    ['CLASS-core', {
                        id: 'CLASS-core',
                        entityType: 'ConformanceClass',
                        data: {
                            id: 'CLASS-core',
                            targetsProfileIds: ['PROF-JWT-CORE'],
                        },
                    }],
                ])],
                ['TestVector', new Map([
                    ['VEC-oidc', {
                        id: 'VEC-oidc',
                        entityType: 'TestVector',
                        data: {
                            id: 'VEC-oidc',
                            invocationProfileId: 'PROF-JWT-OIDC-DISCOVERY',
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'suite-profile-vector-match': {
                    type: 'suite-vector-profile-match',
                    suiteEntity: 'ConformanceSuite',
                    classEntity: 'ConformanceClass',
                    classField: 'targetsClassIds',
                    classProfileField: 'targetsProfileIds',
                    vectorField: 'containsVectorIds',
                    vectorProfileField: 'invocationProfileId',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].entityId).toBe('SUITE-test');
    });
});

describe('vector-profile-context-consistency rule', () => {
    it('reports mismatched profile fields and invalid key strategy selection', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['TestVector', new Map([
                    ['VEC-test', {
                        id: 'VEC-test',
                        entityType: 'TestVector',
                        data: {
                            id: 'VEC-test',
                            invocationProfileId: 'PROF-core',
                            expectedEvaluatedProfileId: 'PROF-remote',
                            validationContext: {
                                selectedKeyStrategyId: 'KEY-remote',
                            },
                        },
                    }],
                ])],
                ['TokenProfile', new Map([
                    ['PROF-core', {
                        id: 'PROF-core',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-core',
                            usesKeyStrategyIds: ['KEY-static'],
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'vector-profile-context-consistency': {
                    type: 'vector-profile-context-consistency',
                    vectorEntity: 'TestVector',
                    profileEntity: 'TokenProfile',
                    invocationProfileField: 'invocationProfileId',
                    evaluatedProfileField: 'expectedEvaluatedProfileId',
                    selectedKeyStrategyField: 'validationContext.selectedKeyStrategyId',
                    profileKeyStrategyField: 'usesKeyStrategyIds',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(2);
        expect(diagnostics.map((d) => d.field).sort()).toEqual([
            'expectedEvaluatedProfileId',
            'validationContext.selectedKeyStrategyId',
        ]);
    });
});

describe('vector-step-graph-consistency rule', () => {
    it('reports impossible rule and error expectations for a terminal step', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['TestVector', new Map([
                    ['VEC-test', {
                        id: 'VEC-test',
                        entityType: 'TestVector',
                        data: {
                            id: 'VEC-test',
                            expectedTerminalStepId: 'STEP-2',
                            expectedFailedRuleId: 'RULE-STEP-3',
                            expectedPrimaryErrorCodeId: 'ERR-STEP-3',
                        },
                    }],
                ])],
                ['ValidationStep', new Map([
                    ['STEP-2', {
                        id: 'STEP-2',
                        entityType: 'ValidationStep',
                        data: {
                            id: 'STEP-2',
                            executesRuleIds: ['RULE-STEP-2'],
                            producesErrorCodeIds: ['ERR-STEP-2'],
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'vector-step-graph-consistency': {
                    type: 'vector-step-graph-consistency',
                    vectorEntity: 'TestVector',
                    stepEntity: 'ValidationStep',
                    terminalStepField: 'expectedTerminalStepId',
                    failedRuleField: 'expectedFailedRuleId',
                    primaryErrorField: 'expectedPrimaryErrorCodeId',
                    stepRuleField: 'executesRuleIds',
                    stepErrorField: 'producesErrorCodeIds',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(2);
        expect(diagnostics.map((d) => d.field).sort()).toEqual([
            'expectedFailedRuleId',
            'expectedPrimaryErrorCodeId',
        ]);
    });
});

describe('profile-step-order-consistency rule', () => {
    it('reports profiles whose pipeline steps are out of execution order', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['TokenProfile', new Map([
                    ['PROF-test', {
                        id: 'PROF-test',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-test',
                            definesPipelineStepIds: ['STEP-2', 'STEP-1'],
                        },
                    }],
                ])],
                ['ValidationStep', new Map([
                    ['STEP-1', {
                        id: 'STEP-1',
                        entityType: 'ValidationStep',
                        data: { id: 'STEP-1', executionOrder: 1 },
                    }],
                    ['STEP-2', {
                        id: 'STEP-2',
                        entityType: 'ValidationStep',
                        data: { id: 'STEP-2', executionOrder: 2 },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'profile-step-order-consistency': {
                    type: 'profile-step-order-consistency',
                    profileEntity: 'TokenProfile',
                    stepEntity: 'ValidationStep',
                    profileStepField: 'definesPipelineStepIds',
                    stepOrderField: 'executionOrder',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].field).toBe('definesPipelineStepIds');
    });
});

describe('allowed-values-when-field-equals rule', () => {
    it('reports discriminator/value mismatches', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['KeyStrategy', new Map([
                    ['KEY-test', {
                        id: 'KEY-test',
                        entityType: 'KeyStrategy',
                        data: {
                            id: 'KEY-test',
                            strategyType: 'STATIC',
                            cacheBehavior: 'HTTP-CACHE',
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'static-strategy-cache-behavior': {
                    type: 'allowed-values-when-field-equals',
                    targetEntities: ['KeyStrategy'],
                    whenField: 'strategyType',
                    whenEqualsAny: ['STATIC'],
                    field: 'cacheBehavior',
                    allowedValues: ['NO-CACHE'],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].field).toBe('cacheBehavior');
    });
});

describe('suite-vector-operation-match rule', () => {
    it('reports suites that include vectors for operations outside their targeted classes', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['ConformanceSuite', new Map([
                    ['SUITE-test', {
                        id: 'SUITE-test',
                        entityType: 'ConformanceSuite',
                        data: {
                            id: 'SUITE-test',
                            targetsClassIds: ['CLASS-core'],
                            containsVectorIds: ['VEC-diagnostic'],
                        },
                    }],
                ])],
                ['ConformanceClass', new Map([
                    ['CLASS-core', {
                        id: 'CLASS-core',
                        entityType: 'ConformanceClass',
                        data: {
                            id: 'CLASS-core',
                            requiresOperationIds: ['OP-validate-jwt'],
                        },
                    }],
                ])],
                ['TestVector', new Map([
                    ['VEC-diagnostic', {
                        id: 'VEC-diagnostic',
                        entityType: 'TestVector',
                        data: {
                            id: 'VEC-diagnostic',
                            invokesOperationId: 'OP-extract-claims',
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'suite-vector-operation-match': {
                    type: 'suite-vector-operation-match',
                    suiteEntity: 'ConformanceSuite',
                    classEntity: 'ConformanceClass',
                    classField: 'targetsClassIds',
                    classOperationField: 'requiresOperationIds',
                    vectorField: 'containsVectorIds',
                    vectorOperationField: 'invokesOperationId',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].entityId).toBe('SUITE-test');
    });
});

describe('profile-operation-contract-match rule', () => {
    it('reports profiles that drift from the authoritative operation contract', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['TokenProfile', new Map([
                    ['PROF-test', {
                        id: 'PROF-test',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-test',
                            acceptsPolicyId: 'STRUCT-runtime-policy',
                            acceptsContextId: 'STRUCT-validation-context',
                            returnsModelId: 'STRUCT-validation-result',
                        },
                    }],
                ])],
                ['Operation', new Map([
                    ['OP-validate-jwt', {
                        id: 'OP-validate-jwt',
                        entityType: 'Operation',
                        data: {
                            id: 'OP-validate-jwt',
                            acceptsStructureIds: ['STRUCT-validation-request'],
                            producesDataStructureIds: ['STRUCT-other-result'],
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'profile-operation-contract-match': {
                    type: 'profile-operation-contract-match',
                    profileEntity: 'TokenProfile',
                    operationEntity: 'Operation',
                    operationId: 'OP-validate-jwt',
                    operationAcceptsField: 'acceptsStructureIds',
                    operationProducesField: 'producesDataStructureIds',
                    profilePolicyField: 'acceptsPolicyId',
                    profileContextField: 'acceptsContextId',
                    profileResultField: 'returnsModelId',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(3);
        expect(diagnostics.map((d) => d.field).sort()).toEqual([
            'acceptsContextId',
            'acceptsPolicyId',
            'returnsModelId',
        ]);
    });
});

describe('profile-inheritance-field-modes rule', () => {
    it('reports additive child profiles that violate declared field modes', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['TokenProfile', new Map([
                    ['PROF-parent', {
                        id: 'PROF-parent',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-parent',
                            unsupportedFormatIds: ['FMT-a'],
                            usesKeyStrategyIds: ['KEY-a'],
                            requiresHeaderIds: ['HDR-a'],
                            optionalHeaderIds: ['HDR-opt-a', 'HDR-opt-b'],
                            requiresClaimIds: ['CLAIM-a'],
                            optionalClaimIds: ['CLAIM-opt-a', 'CLAIM-opt-b'],
                            allowsAlgorithmIds: ['ALG-a', 'ALG-b'],
                            definesPipelineStepIds: ['STEP-1'],
                            implementsReferenceIds: ['REF-a'],
                        },
                    }],
                    ['PROF-child', {
                        id: 'PROF-child',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-child',
                            inheritsProfileIds: ['PROF-parent'],
                            inheritanceMode: 'additive',
                            inheritanceFieldModes: {
                                unsupportedFormatIds: 'inherit',
                                usesKeyStrategyIds: 'extend',
                                requiresHeaderIds: 'inherit',
                                optionalHeaderIds: 'inherit',
                                requiresClaimIds: 'inherit',
                                optionalClaimIds: 'narrow',
                                allowsAlgorithmIds: 'narrow',
                                definesPipelineStepIds: 'inherit',
                                implementsReferenceIds: 'extend',
                            },
                            unsupportedFormatIds: ['FMT-a'],
                            usesKeyStrategyIds: ['KEY-a'],
                            optionalClaimIds: ['CLAIM-opt-a', 'CLAIM-opt-b'],
                            allowsAlgorithmIds: ['ALG-a', 'ALG-z'],
                            implementsReferenceIds: ['REF-a'],
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'profile-inheritance-field-modes': {
                    type: 'profile-inheritance-field-modes',
                    profileEntity: 'TokenProfile',
                    parentField: 'inheritsProfileIds',
                    inheritanceModeField: 'inheritanceMode',
                    fieldModesField: 'inheritanceFieldModes',
                    trackedFields: [
                        'unsupportedFormatIds',
                        'usesKeyStrategyIds',
                        'requiresHeaderIds',
                        'optionalHeaderIds',
                        'requiresClaimIds',
                        'optionalClaimIds',
                        'allowsAlgorithmIds',
                        'definesPipelineStepIds',
                        'implementsReferenceIds',
                    ],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics.length).toBeGreaterThanOrEqual(5);
        expect(diagnostics.some((d) => d.field === 'unsupportedFormatIds')).toBe(true);
        expect(diagnostics.some((d) => d.field === 'usesKeyStrategyIds')).toBe(true);
        expect(diagnostics.some((d) => d.field === 'optionalClaimIds')).toBe(true);
        expect(diagnostics.some((d) => d.field === 'allowsAlgorithmIds')).toBe(true);
        expect(diagnostics.some((d) => d.field === 'implementsReferenceIds')).toBe(true);
    });
});

describe('profile-effective-forbid-values-when-field-includes rule', () => {
    it('reports inherited strategy and algorithm contradictions from effective profile state', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['TokenProfile', new Map([
                    ['PROF-parent', {
                        id: 'PROF-parent',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-parent',
                            usesKeyStrategyIds: ['KEY-static-jwks'],
                            allowsAlgorithmIds: ['ALG-HS256', 'ALG-RS256'],
                        },
                    }],
                    ['PROF-child', {
                        id: 'PROF-child',
                        entityType: 'TokenProfile',
                        data: {
                            id: 'PROF-child',
                            inheritsProfileIds: ['PROF-parent'],
                            inheritanceMode: 'additive',
                            inheritanceFieldModes: {
                                usesKeyStrategyIds: 'extend',
                                allowsAlgorithmIds: 'inherit',
                            },
                            usesKeyStrategyIds: ['KEY-https-jwks'],
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const config: LintConfig = {
            rules: {
                'effective-remote-profiles-no-hs256': {
                    type: 'profile-effective-forbid-values-when-field-includes',
                    profileEntity: 'TokenProfile',
                    parentField: 'inheritsProfileIds',
                    inheritanceModeField: 'inheritanceMode',
                    fieldModesField: 'inheritanceFieldModes',
                    whenField: 'usesKeyStrategyIds',
                    whenIncludesAny: ['KEY-https-jwks', 'KEY-oidc-discovery'],
                    forbidField: 'allowsAlgorithmIds',
                    forbidValues: ['ALG-HS256'],
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].code).toBe('effective-remote-profiles-no-hs256');
        expect(diagnostics[0].entityId).toBe('PROF-child');
        expect(diagnostics[0].field).toBe('allowsAlgorithmIds');
    });
});

describe('shape-equals rule', () => {
    it('compares schema fragments against authoritative entity shapes', () => {
        const bundle: any = {
            entities: new Map<any, any>([
                ['DataStructure', new Map([
                    ['STRUCT-runtime-policy', {
                        id: 'STRUCT-runtime-policy',
                        entityType: 'DataStructure',
                        data: {
                            id: 'STRUCT-runtime-policy',
                            schemaDefinition: {
                                type: 'object',
                                properties: {
                                    foo: { type: 'string' },
                                },
                            },
                        },
                    }],
                ])],
            ]),
            idRegistry: new Map(),
            refGraph: { edges: [] },
        };

        const rawSchemas = new Map<string, any>([
            ['TestVector', {
                properties: {
                    runtimePolicy: {
                        type: 'object',
                        properties: {
                            foo: { type: 'number' },
                        },
                    },
                },
            }],
        ]);

        const config: LintConfig = {
            rules: {
                'test-vector-runtime-policy-shape': {
                    type: 'shape-equals',
                    leftSource: 'schema',
                    leftEntityType: 'TestVector',
                    leftPath: 'properties.runtimePolicy',
                    rightSource: 'entity',
                    rightEntityType: 'DataStructure',
                    rightEntityId: 'STRUCT-runtime-policy',
                    rightPath: 'schemaDefinition',
                    severity: 'error',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config, rawSchemas);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].field).toBe('properties.runtimePolicy');
    });
});
