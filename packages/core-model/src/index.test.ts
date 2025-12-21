import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { loadBundleWithSchemaValidation } from './index';

/**
 * Get the path to the sample bundle.
 * Uses SDD_SAMPLE_BUNDLE_PATH environment variable if set, otherwise defaults to the external bundle location.
 */
function getSampleBundlePath(): string {
  return process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';
}

describe('core-model basic wiring', () => {
  it('loads and validates the basic sample bundle without errors', async () => {
    const bundleDir = getSampleBundlePath();
    const { diagnostics, bundle } = await loadBundleWithSchemaValidation(bundleDir);

    const errorDiagnostics = diagnostics.filter((d) => d.severity === 'error');
    expect(errorDiagnostics).toHaveLength(0);

    // Basic sanity checks on entities and ref graph.
    const features = bundle.entities.get('Feature');
    const requirements = bundle.entities.get('Requirement');
    const tasks = bundle.entities.get('Task');

    expect(features?.size).toBe(3);
    expect(requirements?.size).toBe(4);
    expect(tasks?.size).toBe(3);

    // We expect edges based on the current bundle-type.json relations:
    // - Feature -> ADR (governedByAdrIds)
    // - Task -> Feature (belongsToFeatureIds)
    // - Task -> Requirement (fulfillsRequirementIds)
    const edges = bundle.refGraph.edges;
    expect(edges.some((e) => e.fromEntityType === 'Feature' && e.toEntityType === 'ADR')).toBe(
      true,
    );
    expect(edges.some((e) => e.fromEntityType === 'Task' && e.toEntityType === 'Requirement')).toBe(
      true,
    );
  });
});
