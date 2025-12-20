import { describe, it, expect } from 'vitest';
import { runLintRules } from './index';
import type { LintConfig } from './types';

/**
 * Creates a bundle with bidirectional links:
 * - REQ-001 → FEAT-001 (via realizesFeatureIds)
 * - FEAT-001 → REQ-001 (via requirementIds) - this is the redundant backlink
 */
function makeBundleWithBidirectionalLinks() {
    const entities = new Map();

    const requirements = new Map();
    requirements.set('REQ-001', {
        id: 'REQ-001',
        entityType: 'Requirement',
        data: {
            id: 'REQ-001',
            title: 'Password must be at least 8 characters',
            realizesFeatureIds: ['FEAT-001'],
        },
        filePath: 'bundle/requirements/REQ-001.yaml',
    });
    entities.set('Requirement', requirements);

    const features = new Map();
    features.set('FEAT-001', {
        id: 'FEAT-001',
        entityType: 'Feature',
        data: {
            id: 'FEAT-001',
            title: 'User Authentication',
            requirementIds: ['REQ-001'], // Redundant backlink!
        },
        filePath: 'bundle/features/FEAT-001.yaml',
    });
    entities.set('Feature', features);

    const idRegistry = new Map([
        ['REQ-001', { entityType: 'Requirement', id: 'REQ-001' }],
        ['FEAT-001', { entityType: 'Feature', id: 'FEAT-001' }],
    ]);

    return {
        manifest: {
            apiVersion: 'sdd.v1',
            kind: 'Bundle',
            metadata: { name: 'bidirectional-bundle', bundleType: 'sdd-core' },
            spec: {
                bundleTypeDefinition: 'schemas/bundle-type.sdd-core.json',
                schemas: { documents: {} },
                layout: { documents: {} },
            },
        },
        bundleTypeDefinition: undefined,
        entities,
        idRegistry,
        refGraph: {
            edges: [
                // Forward link: REQ → FEAT
                {
                    fromEntityType: 'Requirement',
                    fromId: 'REQ-001',
                    fromField: 'realizesFeatureIds',
                    toEntityType: 'Feature',
                    toId: 'FEAT-001',
                },
                // Backlink: FEAT → REQ (redundant!)
                {
                    fromEntityType: 'Feature',
                    fromId: 'FEAT-001',
                    fromField: 'requirementIds',
                    toEntityType: 'Requirement',
                    toId: 'REQ-001',
                },
            ],
        },
    };
}

/**
 * Creates a bundle with only one-way links (no redundancy)
 */
function makeBundleWithOneWayLinks() {
    const entities = new Map();

    const requirements = new Map();
    requirements.set('REQ-001', {
        id: 'REQ-001',
        entityType: 'Requirement',
        data: {
            id: 'REQ-001',
            title: 'Password must be at least 8 characters',
            realizesFeatureIds: ['FEAT-001'],
        },
    });
    entities.set('Requirement', requirements);

    const features = new Map();
    features.set('FEAT-001', {
        id: 'FEAT-001',
        entityType: 'Feature',
        data: {
            id: 'FEAT-001',
            title: 'User Authentication',
            // No requirementIds backlink - correctly one-directional
        },
    });
    entities.set('Feature', features);

    return {
        entities,
        idRegistry: new Map([
            ['REQ-001', { entityType: 'Requirement', id: 'REQ-001' }],
            ['FEAT-001', { entityType: 'Feature', id: 'FEAT-001' }],
        ]),
        refGraph: {
            edges: [
                // Only forward link
                {
                    fromEntityType: 'Requirement',
                    fromId: 'REQ-001',
                    fromField: 'realizesFeatureIds',
                    toEntityType: 'Feature',
                    toId: 'FEAT-001',
                },
            ],
        },
    };
}

describe('redundant-bidirectional-link lint rule', () => {
    it('detects redundant bidirectional links', () => {
        const bundle = makeBundleWithBidirectionalLinks();
        const config: LintConfig = {
            rules: {
                noRedundantBacklinks: {
                    type: 'redundant-bidirectional-link',
                    severity: 'warning',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics.length).toBe(1);
        expect(diagnostics[0].code).toBe('noRedundantBacklinks');
        expect(diagnostics[0].severity).toBe('warning');
        expect(diagnostics[0].message).toContain('Redundant bidirectional link');
        expect(diagnostics[0].message).toContain('already links back');
    });

    it('does not flag one-way links as redundant', () => {
        const bundle = makeBundleWithOneWayLinks();
        const config: LintConfig = {
            rules: {
                noRedundantBacklinks: {
                    type: 'redundant-bidirectional-link',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        expect(diagnostics.length).toBe(0);
    });

    it('only reports each bidirectional pair once', () => {
        const bundle = makeBundleWithBidirectionalLinks();
        const config: LintConfig = {
            rules: {
                noRedundantBacklinks: {
                    type: 'redundant-bidirectional-link',
                },
            },
        };

        const diagnostics = runLintRules(bundle, config);
        // Should only report once, not twice (once for each direction)
        expect(diagnostics.length).toBe(1);
    });
});
