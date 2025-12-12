/**
 * Reusable test fixtures for core-model tests.
 */

import { Bundle, Entity, RefGraph, BundleTypeEntityConfig, BundleTypeRelationConfig, IdRegistryEntry } from './types';

/**
 * Create a mock entity with sensible defaults.
 */
export function createMockEntity(overrides?: Partial<Entity>): Entity {
    return {
        id: 'TEST-001',
        entityType: 'Requirement',
        data: {
            title: 'Test Requirement',
            description: 'A test requirement for unit testing',
        },
        filePath: '/test/requirements/TEST-001.yaml',
        ...overrides,
    };
}

/**
 * Create a mock bundle with configurable entities.
 */
export function createMockBundle(options?: {
    entities?: Entity[];
    relations?: BundleTypeRelationConfig[];
}): Bundle {
    const entitiesMap = new Map<string, Map<string, Entity>>();
    const idRegistry = new Map<string, IdRegistryEntry>();

    // Default entities if none provided
    const entities = options?.entities ?? [
        createMockEntity({ id: 'REQ-001', entityType: 'Requirement' }),
        createMockEntity({ id: 'REQ-002', entityType: 'Requirement' }),
    ];

    // Group entities by type
    for (const entity of entities) {
        if (!entitiesMap.has(entity.entityType)) {
            entitiesMap.set(entity.entityType, new Map());
        }
        entitiesMap.get(entity.entityType)!.set(entity.id, entity);
        idRegistry.set(entity.id, {
            entityType: entity.entityType,
            id: entity.id,
            filePath: entity.filePath,
        });
    }

    const refGraph: RefGraph = { edges: [] };

    // Derive entity type definitions from entities
    const entityTypes = new Set(entities.map(e => e.entityType));
    const entityDefs: BundleTypeEntityConfig[] = Array.from(entityTypes).map(type => ({
        entityType: type,
        idField: 'id',
        schemaPath: `schemas/${type.toLowerCase()}.json`,
        directory: type.toLowerCase() + 's',
        filePattern: '*.yaml',
    }));

    return {
        manifest: {
            apiVersion: 'sdd.bundle/v1',
            kind: 'Bundle',
            metadata: {
                name: 'test-bundle',
                bundleType: 'sdd-test',
            },
            spec: {
                bundleTypeDefinition: 'bundle-type.json',
                schemas: {
                    documents: Object.fromEntries(
                        Array.from(entityTypes).map(type => [type, `schemas/${type.toLowerCase()}.json`])
                    ),
                },
                layout: {
                    documents: Object.fromEntries(
                        Array.from(entityTypes).map(type => [
                            type,
                            { dir: type.toLowerCase() + 's', filePattern: '*.yaml' }
                        ])
                    ),
                },
            },
        },
        bundleTypeDefinition: {
            bundleType: 'sdd-test',
            version: '1.0.0',
            entities: entityDefs,
            relations: options?.relations ?? [],
        },
        entities: entitiesMap,
        idRegistry,
        refGraph,
    };
}

/**
 * Create a mock diagnostic.
 */
export function createMockDiagnostic(
    severity: 'error' | 'warning' = 'error',
    overrides?: Partial<{
        code: string;
        message: string;
        entityType: string;
        entityId: string;
        path: string;
    }>
) {
    return {
        severity,
        code: overrides?.code ?? 'test-error',
        message: overrides?.message ?? 'Test diagnostic message',
        entityType: overrides?.entityType ?? 'Requirement',
        entityId: overrides?.entityId ?? 'REQ-001',
        path: overrides?.path ?? '/test/requirements/REQ-001.yaml',
    };
}

/**
 * Create a mock proposed change.
 */
export function createMockChange(overrides?: Partial<{
    entityType: string;
    entityId: string;
    fieldPath: string;
    originalValue: unknown;
    newValue: unknown;
    rationale: string;
}>) {
    return {
        entityType: overrides?.entityType ?? 'Requirement',
        entityId: overrides?.entityId ?? 'REQ-001',
        fieldPath: overrides?.fieldPath ?? 'title',
        originalValue: overrides?.originalValue ?? 'Original Title',
        newValue: overrides?.newValue ?? 'Updated Title',
        rationale: overrides?.rationale ?? 'Test change',
    };
}
