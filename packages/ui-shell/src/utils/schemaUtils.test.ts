/**
 * Tests for schemaUtils - relationship extraction from schemas.
 */
import { describe, it, expect } from 'vitest';
import { extractRelationsFromSchemas, getFieldDisplayName, camelCaseToTitleCase, type SchemaRelation } from './schemaUtils';

describe('extractRelationsFromSchemas', () => {
    it('should return empty array for undefined schemas', () => {
        expect(extractRelationsFromSchemas(undefined)).toEqual([]);
    });

    it('should return empty array for empty schemas', () => {
        expect(extractRelationsFromSchemas({})).toEqual([]);
    });

    it('should extract single reference from property-level x-sdd-refTargets', () => {
        const schemas = {
            Constraint: {
                properties: {
                    derivedFromPolicyId: {
                        type: 'string',
                        title: 'derived from',
                        'x-sdd-refTargets': ['Policy'],
                    },
                },
            },
        };

        const relations = extractRelationsFromSchemas(schemas);
        expect(relations).toHaveLength(1);
        expect(relations[0]).toMatchObject({
            fromEntity: 'Constraint',
            fromField: 'derivedFromPolicyId',
            toEntity: 'Policy',
            displayName: 'derived from',
            isMany: false,
        });
    });

    it('should extract array references from items-level x-sdd-refTargets', () => {
        const schemas = {
            ADR: {
                properties: {
                    relatedFeatureIds: {
                        type: 'array',
                        title: 'relates to',
                        items: {
                            type: 'string',
                            'x-sdd-refTargets': ['Feature'],
                        },
                    },
                },
            },
        };

        const relations = extractRelationsFromSchemas(schemas);
        expect(relations).toHaveLength(1);
        expect(relations[0]).toMatchObject({
            fromEntity: 'ADR',
            fromField: 'relatedFeatureIds',
            toEntity: 'Feature',
            displayName: 'relates to',
            isMany: true,
        });
    });

    it('should set isMany=true for array types with direct refTargets', () => {
        const schemas = {
            Component: {
                properties: {
                    dependsOn: {
                        type: 'array',
                        'x-sdd-refTargets': ['Component'],
                        items: { type: 'string' },
                    },
                },
            },
        };

        const relations = extractRelationsFromSchemas(schemas);
        expect(relations).toHaveLength(1);
        expect(relations[0].isMany).toBe(true);
    });

    it('should extract display name from items.title when property.title is missing', () => {
        const schemas = {
            Feature: {
                properties: {
                    governedByAdrIds: {
                        type: 'array',
                        items: {
                            type: 'string',
                            title: 'governed by',
                            'x-sdd-refTargets': ['ADR'],
                        },
                    },
                },
            },
        };

        const relations = extractRelationsFromSchemas(schemas);
        expect(relations).toHaveLength(1);
        expect(relations[0].displayName).toBe('governed by');
    });

    it('should fallback to camelCaseToTitleCase when no title is provided', () => {
        const schemas = {
            Test: {
                properties: {
                    someReferenceId: {
                        type: 'string',
                        'x-sdd-refTargets': ['Target'],
                    },
                },
            },
        };

        const relations = extractRelationsFromSchemas(schemas);
        expect(relations).toHaveLength(1);
        expect(relations[0].displayName).toBe('Some Reference');
    });

    it('should create multiple relations for multi-target refTargets', () => {
        const schemas = {
            Risk: {
                properties: {
                    affectsEntityId: {
                        type: 'string',
                        title: 'affects',
                        'x-sdd-refTargets': ['Feature', 'Requirement'],
                    },
                },
            },
        };

        const relations = extractRelationsFromSchemas(schemas);
        expect(relations).toHaveLength(2);
        expect(relations.map(r => r.toEntity)).toEqual(['Feature', 'Requirement']);
    });

    it('should extract relations from multiple entity schemas', () => {
        const schemas = {
            A: {
                properties: {
                    refB: { type: 'string', 'x-sdd-refTargets': ['B'] },
                },
            },
            B: {
                properties: {
                    refA: { type: 'string', 'x-sdd-refTargets': ['A'] },
                },
            },
        };

        const relations = extractRelationsFromSchemas(schemas);
        expect(relations).toHaveLength(2);
    });
});

describe('camelCaseToTitleCase', () => {
    it('should convert camelCase to Title Case', () => {
        expect(camelCaseToTitleCase('governedByAdrIds')).toBe('Governed By ADR');
        expect(camelCaseToTitleCase('realizesFeatureIds')).toBe('Realizes Feature');
        expect(camelCaseToTitleCase('supersedes')).toBe('Supersedes');
    });

    it('should strip trailing Id/Ids', () => {
        expect(camelCaseToTitleCase('componentId')).toBe('Component');
        expect(camelCaseToTitleCase('featureIds')).toBe('Feature');
    });

    it('should fix common abbreviations', () => {
        expect(camelCaseToTitleCase('governedByAdr')).toBe('Governed By ADR');
        expect(camelCaseToTitleCase('apiUrl')).toBe('API URL');
    });
});

describe('getFieldDisplayName', () => {
    it('should return title from schema if available', () => {
        const schemas = {
            Entity: {
                properties: {
                    myField: { title: 'My Custom Title' },
                },
            },
        };

        expect(getFieldDisplayName(schemas, 'Entity', 'myField')).toBe('My Custom Title');
    });

    it('should fallback to camelCaseToTitleCase if no title', () => {
        const schemas = {
            Entity: {
                properties: {
                    myField: { type: 'string' },
                },
            },
        };

        expect(getFieldDisplayName(schemas, 'Entity', 'myField')).toBe('My Field');
    });

    it('should handle missing schema gracefully', () => {
        expect(getFieldDisplayName({}, 'MissingEntity', 'someField')).toBe('Some Field');
        expect(getFieldDisplayName(undefined, 'Entity', 'someField')).toBe('Some Field');
    });
});
