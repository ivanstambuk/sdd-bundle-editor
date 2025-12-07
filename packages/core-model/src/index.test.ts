import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { loadBundleWithSchemaValidation } from './index';

describe('core-model basic wiring', () => {
  it('loads and validates the basic sample bundle without errors', async () => {
    const bundleDir = path.resolve(__dirname, '../../../examples/basic-bundle');
    const { diagnostics, bundle } = await loadBundleWithSchemaValidation(bundleDir);

    const errorDiagnostics = diagnostics.filter((d) => d.severity === 'error');
    expect(errorDiagnostics).toHaveLength(0);

    // Basic sanity checks on entities and ref graph.
    const features = bundle.entities.get('Feature');
    const requirements = bundle.entities.get('Requirement');
    const tasks = bundle.entities.get('Task');

    expect(features?.size).toBe(1);
    expect(requirements?.size).toBe(1);
    expect(tasks?.size).toBe(1);

    // We expect at least one edge from Requirement -> Feature and Task -> Requirement.
    const edges = bundle.refGraph.edges;
    expect(edges.some((e) => e.fromEntityType === 'Requirement' && e.toEntityType === 'Feature')).toBe(
      true,
    );
    expect(edges.some((e) => e.fromEntityType === 'Task' && e.toEntityType === 'Requirement')).toBe(
      true,
    );
  });
});
