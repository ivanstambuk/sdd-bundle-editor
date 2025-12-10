import { describe, it, expect } from 'vitest';
import { runLintRules } from './index';
import { LintConfig } from './types';

describe('required-field rule', () => {
    it('reports missing required field', () => {
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
            entities: new Map([
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
                    ['REQ-001', { id: 'REQ-001', entityType: 'Requirement', data: { id: 'REQ-001', featureIds: [] } }],
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

    it('passes traceable check when featureIds present', () => {
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
