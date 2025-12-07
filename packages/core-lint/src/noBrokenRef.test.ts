import { describe, it, expect } from 'vitest';
import { runLintRules } from './index';
import type { LintConfig } from './types';

function makeBundleWithBrokenRef() {
  const entities = new Map();
  const tasks = new Map();
  tasks.set('TASK-001', {
    id: 'TASK-001',
    entityType: 'Task',
    data: {
      id: 'TASK-001',
      title: 'Task with broken ref',
      requirementIds: ['REQ-404'],
    },
    filePath: 'bundle/tasks/TASK-001.yaml',
  });
  entities.set('Task', tasks);

  return {
    manifest: {
      apiVersion: 'sdd.v1',
      kind: 'Bundle',
      metadata: { name: 'broken-ref-bundle', bundleType: 'sdd-core' },
      spec: {
        bundleTypeDefinition: 'schemas/bundle-type.sdd-core.json',
        schemas: { documents: {} },
        layout: { documents: {} },
      },
    },
    bundleTypeDefinition: undefined,
    entities,
    idRegistry: new Map(), // no REQ-404 entry, so ref is broken
    refGraph: {
      edges: [
        {
          fromEntityType: 'Task',
          fromId: 'TASK-001',
          fromField: 'requirementIds',
          toEntityType: 'Requirement',
          toId: 'REQ-404',
        },
      ],
    },
  };
}

describe('no-broken-ref lint rule', () => {
  it('emits diagnostics for broken references', () => {
    const bundle = makeBundleWithBrokenRef();
    const config: LintConfig = {
      rules: {
        noBrokenRefs: {
          type: 'no-broken-ref',
        },
      },
    };

    const diagnostics = runLintRules(bundle, config);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].code).toBe('noBrokenRefs');
    expect(diagnostics[0].entityType).toBe('Task');
    expect(diagnostics[0].entityId).toBe('TASK-001');
  });
});
