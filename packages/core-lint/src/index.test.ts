import { describe, it, expect } from 'vitest';
import { runLintRules } from './index';
import type { LintConfig } from './types';

function makeBundle() {
  const entities = new Map<string, Map<string, any>>();
  const requirements = new Map<string, any>();
  requirements.set('REQ-001', {
    id: 'REQ-001',
    entityType: 'Requirement',
    data: { id: 'REQ-001', title: 'bad title', featureIds: [] },
    filePath: 'bundle/requirements/REQ-001.yaml',
  });
  entities.set('Requirement', requirements);

  return {
    manifest: {
      apiVersion: 'sdd.v1',
      kind: 'Bundle',
      metadata: { name: 'test', bundleType: 'sdd-core' },
      spec: {
        bundleTypeDefinition: 'schemas/bundle-type.sdd-core.json',
        schemas: { documents: {} },
        layout: { documents: {} },
      },
    },
    bundleTypeDefinition: undefined,
    entities,
    idRegistry: new Map(),
    refGraph: { edges: [] },
  };
}

describe('core-lint rules', () => {
  it('runs regex and has-link rules', () => {
    const bundle = makeBundle();
    const config: LintConfig = {
      rules: {
        titleCapitalization: {
          type: 'regex',
          targetEntities: ['Requirement'],
          field: 'title',
          pattern: '^[A-Z].+',
        },
        requirementMustHaveFeature: {
          type: 'has-link',
          fromEntity: 'Requirement',
          viaField: 'featureIds',
          minLinks: 1,
        },
      },
    };

    const diagnostics = runLintRules(bundle, config);
    const codes = diagnostics.map((d) => d.code).sort();
    expect(codes).toEqual(['requirementMustHaveFeature', 'titleCapitalization']);
  });
});
