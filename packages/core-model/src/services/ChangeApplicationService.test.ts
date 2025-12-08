import { describe, it, expect } from 'vitest';
import { applyChangesToBundle, ApplyChangesResult } from './ChangeApplicationService';
import { Bundle, Entity, ProposedChange } from '../types';

function createTestBundle(entities: Entity[]): Bundle {
    const entitiesMap = new Map<string, Map<string, Entity>>();
    const idRegistry = new Map<string, { entityType: string; id: string; filePath: string }>();

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

    // Include a realistic manifest with layout configuration
    const manifest = {
        apiVersion: 'sdd.v1',
        kind: 'Bundle',
        metadata: { name: 'test-bundle', bundleType: 'test' },
        spec: {
            bundleTypeDefinition: 'schemas/bundle-type.json',
            schemas: { documents: {} },
            layout: {
                documents: {
                    Feature: { dir: 'bundle/features', filePattern: '{id}.yaml' },
                    Requirement: { dir: 'bundle/requirements', filePattern: '{id}.yaml' },
                    Profile: { dir: 'bundle/profiles', filePattern: '{id}.yaml' },
                }
            }
        }
    };

    return {
        manifest: manifest as any,
        entities: entitiesMap,
        idRegistry,
        refGraph: { edges: [] },
    };
}

describe('ChangeApplicationService', () => {
    describe('applyChangesToBundle', () => {
        it('should successfully apply a single change', () => {
            const entity: Entity = {
                id: 'FEAT-001',
                entityType: 'Feature',
                data: { id: 'FEAT-001', title: 'Original Title', status: 'draft' },
                filePath: '/bundle/features/feat-001.yaml',
            };
            const bundle = createTestBundle([entity]);

            const changes: ProposedChange[] = [
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-001',
                    fieldPath: 'title',
                    originalValue: 'Original Title',
                    newValue: 'Updated Title',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(true);
            expect(result.modifiedFiles).toEqual(['/bundle/features/feat-001.yaml']);
            expect(result.modifiedEntities).toEqual(['Feature:FEAT-001']);
            expect(result.errors).toBeUndefined();
            expect(entity.data.title).toBe('Updated Title');
        });

        it('should successfully apply multiple changes to different entities', () => {
            const feature: Entity = {
                id: 'FEAT-001',
                entityType: 'Feature',
                data: { id: 'FEAT-001', title: 'Feature', status: 'draft' },
                filePath: '/bundle/features/feat-001.yaml',
            };
            const requirement: Entity = {
                id: 'REQ-001',
                entityType: 'Requirement',
                data: { id: 'REQ-001', description: 'Requirement', priority: 'low' },
                filePath: '/bundle/requirements/req-001.yaml',
            };
            const bundle = createTestBundle([feature, requirement]);

            const changes: ProposedChange[] = [
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-001',
                    fieldPath: 'status',
                    originalValue: 'draft',
                    newValue: 'active',
                },
                {
                    entityType: 'Requirement',
                    entityId: 'REQ-001',
                    fieldPath: 'priority',
                    originalValue: 'low',
                    newValue: 'high',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(true);
            expect(result.modifiedFiles).toHaveLength(2);
            expect(result.modifiedEntities).toContain('Feature:FEAT-001');
            expect(result.modifiedEntities).toContain('Requirement:REQ-001');
            expect(feature.data.status).toBe('active');
            expect(requirement.data.priority).toBe('high');
        });

        it('should deduplicate files when multiple changes target the same entity', () => {
            const entity: Entity = {
                id: 'FEAT-001',
                entityType: 'Feature',
                data: { id: 'FEAT-001', title: 'Title', status: 'draft' },
                filePath: '/bundle/features/feat-001.yaml',
            };
            const bundle = createTestBundle([entity]);

            const changes: ProposedChange[] = [
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-001',
                    fieldPath: 'title',
                    originalValue: 'Title',
                    newValue: 'New Title',
                },
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-001',
                    fieldPath: 'status',
                    originalValue: 'draft',
                    newValue: 'active',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(true);
            expect(result.modifiedFiles).toEqual(['/bundle/features/feat-001.yaml']);
            expect(result.modifiedEntities).toEqual(['Feature:FEAT-001']);
        });

        it('should return error for missing entity type', () => {
            const bundle = createTestBundle([]);

            const changes: ProposedChange[] = [
                {
                    entityType: 'NonExistent',
                    entityId: 'NE-001',
                    fieldPath: 'title',
                    originalValue: 'Old',
                    newValue: 'New',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors![0]).toContain('NonExistent');
        });

        it('should return error for missing entity ID', () => {
            const entity: Entity = {
                id: 'FEAT-001',
                entityType: 'Feature',
                data: { id: 'FEAT-001', title: 'Title' },
                filePath: '/bundle/features/feat-001.yaml',
            };
            const bundle = createTestBundle([entity]);

            const changes: ProposedChange[] = [
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-999', // Does not exist
                    fieldPath: 'title',
                    originalValue: 'Old',
                    newValue: 'New',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors![0]).toContain('FEAT-999');
        });

        it('should handle empty changes array', () => {
            const bundle = createTestBundle([]);

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", []);

            expect(result.success).toBe(true);
            expect(result.modifiedFiles).toEqual([]);
            expect(result.modifiedEntities).toEqual([]);
            expect(result.errors).toBeUndefined();
        });

        // NEW: Test for entity creation
        it('should create a new entity when originalValue is null', () => {
            const bundle = createTestBundle([]); // Empty bundle

            const changes: ProposedChange[] = [
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-002',
                    fieldPath: 'title',
                    originalValue: null,
                    newValue: 'New Feature Title',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(true);
            expect(result.modifiedEntities).toContain('Feature:FEAT-002');

            // Verify entity was created
            const createdEntity = bundle.entities.get('Feature')?.get('FEAT-002');
            expect(createdEntity).toBeDefined();
            expect(createdEntity!.data.title).toBe('New Feature Title');
        });

        // NEW: Test for the bug - multiple field changes for same new entity
        it('should consolidate multiple field changes when creating a new entity (bug fix)', () => {
            const bundle = createTestBundle([]); // Empty bundle

            // LLM often sends multiple changes for a new entity, all with originalValue null
            const changes: ProposedChange[] = [
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-003',
                    fieldPath: 'id',
                    originalValue: null,
                    newValue: 'FEAT-003',
                },
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-003',
                    fieldPath: 'title',
                    originalValue: null,
                    newValue: 'My New Feature',
                },
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-003',
                    fieldPath: 'description',
                    originalValue: null,
                    newValue: 'Description for the new feature',
                },
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-003',
                    fieldPath: 'status',
                    originalValue: null,
                    newValue: 'draft',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(true);
            expect(result.errors).toBeUndefined();

            // Should only create ONE entity, not fail with "already exists"
            expect(result.modifiedEntities).toEqual(['Feature:FEAT-003']);

            // Verify all fields were applied
            const createdEntity = bundle.entities.get('Feature')?.get('FEAT-003');
            expect(createdEntity).toBeDefined();
            expect(createdEntity!.data.id).toBe('FEAT-003');
            expect(createdEntity!.data.title).toBe('My New Feature');
            expect(createdEntity!.data.description).toBe('Description for the new feature');
            expect(createdEntity!.data.status).toBe('draft');
        });

        it('should handle nested field paths when creating a new entity', () => {
            const bundle = createTestBundle([]);

            const changes: ProposedChange[] = [
                {
                    entityType: 'Profile',
                    entityId: 'PROFILE-001',
                    fieldPath: 'metadata.name',
                    originalValue: null,
                    newValue: 'Test Profile',
                },
                {
                    entityType: 'Profile',
                    entityId: 'PROFILE-001',
                    fieldPath: 'metadata.version',
                    originalValue: null,
                    newValue: '1.0.0',
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(true);

            const createdEntity = bundle.entities.get('Profile')?.get('PROFILE-001');
            expect(createdEntity).toBeDefined();
            expect((createdEntity!.data as any).metadata.name).toBe('Test Profile');
            expect((createdEntity!.data as any).metadata.version).toBe('1.0.0');
        });

        // NEW: Test for when agent proposes entire entity object with fieldPath "data"
        it('should create entity when fieldPath is "data" (entire entity object)', () => {
            const bundle = createTestBundle([]);

            // DeepSeek often proposes the entire entity data as a single change with fieldPath: "data"
            const changes: ProposedChange[] = [
                {
                    entityType: 'Feature',
                    entityId: 'FEAT-004',
                    fieldPath: 'data',
                    originalValue: null,
                    newValue: {
                        id: 'FEAT-004',
                        title: 'Complete Feature',
                        description: 'A feature proposed as a whole object',
                        status: 'draft',
                        tags: ['test', 'complete']
                    },
                },
            ];

            const result = applyChangesToBundle(bundle, "/fake/bundle/dir", changes);

            expect(result.success).toBe(true);
            expect(result.errors).toBeUndefined();
            expect(result.modifiedEntities).toEqual(['Feature:FEAT-004']);

            const createdEntity = bundle.entities.get('Feature')?.get('FEAT-004');
            expect(createdEntity).toBeDefined();
            // The data should be the entity itself, NOT wrapped under a "data" property
            expect(createdEntity!.data.id).toBe('FEAT-004');
            expect(createdEntity!.data.title).toBe('Complete Feature');
            expect(createdEntity!.data.description).toBe('A feature proposed as a whole object');
            expect(createdEntity!.data.status).toBe('draft');
            expect(createdEntity!.data.tags).toEqual(['test', 'complete']);
        });
    });
});
