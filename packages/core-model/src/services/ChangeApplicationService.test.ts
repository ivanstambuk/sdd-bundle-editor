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

    return {
        manifest: {} as any,
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

            const result = applyChangesToBundle(bundle, changes);

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

            const result = applyChangesToBundle(bundle, changes);

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

            const result = applyChangesToBundle(bundle, changes);

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

            const result = applyChangesToBundle(bundle, changes);

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

            const result = applyChangesToBundle(bundle, changes);

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors![0]).toContain('FEAT-999');
        });

        it('should handle empty changes array', () => {
            const bundle = createTestBundle([]);

            const result = applyChangesToBundle(bundle, []);

            expect(result.success).toBe(true);
            expect(result.modifiedFiles).toEqual([]);
            expect(result.modifiedEntities).toEqual([]);
            expect(result.errors).toBeUndefined();
        });
    });
});
