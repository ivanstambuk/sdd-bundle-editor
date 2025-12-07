import { describe, it, expect } from 'vitest';
import type {
  Bundle,
  BundleManifest,
  BundleTypeDefinition,
  Entity,
  EntityId,
  EntityType,
  IdRegistry,
} from './types';
import { buildRefGraph } from './index';

function makeEntity(
  entityType: EntityType,
  id: EntityId,
  data: Record<string, unknown>,
  filePath: string,
): Entity {
  return { entityType, id, data, filePath };
}

describe('buildRefGraph', () => {
  it('builds edges based on bundle-type relations', () => {
    const manifest: BundleManifest = {
      apiVersion: 'sdd.v1',
      kind: 'Bundle',
      metadata: {
        name: 'test-bundle',
        bundleType: 'sdd-core',
      },
      spec: {
        bundleTypeDefinition: 'schemas/bundle-type.sdd-core.json',
        schemas: { documents: {} },
        layout: { documents: {} },
      },
    };

    const bundleTypeDefinition: BundleTypeDefinition = {
      bundleType: 'sdd-core',
      version: '1.0.0',
      entities: [
        {
          entityType: 'Task',
          idField: 'id',
          schemaPath: 'schemas/Task.schema.json',
          directory: 'bundle/tasks',
          filePattern: '{id}.yaml',
        },
        {
          entityType: 'Requirement',
          idField: 'id',
          schemaPath: 'schemas/Requirement.schema.json',
          directory: 'bundle/requirements',
          filePattern: '{id}.yaml',
        },
      ],
      relations: [
        {
          name: 'TaskImplementsRequirement',
          fromEntity: 'Task',
          fromField: 'requirementIds',
          toEntity: 'Requirement',
          multiplicity: 'many',
        },
      ],
    };

    const entities = new Map<EntityType, Map<EntityId, Entity>>();
    const tasks = new Map<EntityId, Entity>();
    tasks.set(
      'TASK-001',
      makeEntity(
        'Task',
        'TASK-001',
        {
          id: 'TASK-001',
          requirementIds: ['REQ-001', 'REQ-002'],
        },
        'bundle/tasks/TASK-001.yaml',
      ),
    );
    entities.set('Task', tasks);

    const idRegistry: IdRegistry = new Map();
    idRegistry.set('REQ-001', {
      entityType: 'Requirement',
      id: 'REQ-001',
      filePath: 'bundle/requirements/REQ-001.yaml',
    });
    idRegistry.set('REQ-002', {
      entityType: 'Requirement',
      id: 'REQ-002',
      filePath: 'bundle/requirements/REQ-002.yaml',
    });

    const bundle: Bundle = {
      manifest,
      bundleTypeDefinition,
      entities,
      idRegistry,
      refGraph: { edges: [] },
    };

    const graph = buildRefGraph(bundle);
    expect(graph.edges.length).toBe(2);
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromEntityType: 'Task',
          fromId: 'TASK-001',
          fromField: 'requirementIds',
          toEntityType: 'Requirement',
          toId: 'REQ-001',
        }),
        expect.objectContaining({
          fromEntityType: 'Task',
          fromId: 'TASK-001',
          fromField: 'requirementIds',
          toEntityType: 'Requirement',
          toId: 'REQ-002',
        }),
      ]),
    );
  });
});
