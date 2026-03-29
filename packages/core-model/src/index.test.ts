import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { loadBundleWithSchemaValidation } from './index';

/**
 * Get the path to the sample bundle.
 * Uses SDD_SAMPLE_BUNDLE_PATH environment variable if set, otherwise defaults to the external bundle location.
 */
function getSampleBundlePath(): string {
  return process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-bundle-editor/reference-bundles/sdd-sample-bundle';
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

  it('loads entities whose idField points to a nested path', async () => {
    const bundleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nested-adr-bundle-'));

    await fs.mkdir(path.join(bundleDir, 'schemas'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'adrs'), { recursive: true });

    await fs.writeFile(
      path.join(bundleDir, 'sdd-bundle.yaml'),
      `apiVersion: sdd/v1
kind: Bundle
metadata:
  name: nested-adr-test
  bundleType: nested-adr-test
spec:
  bundleTypeDefinition: bundle-type.json
  schemas:
    documents:
      ADR: schemas/ADR.schema.json
  layout:
    documents:
      ADR:
        dir: bundle/adrs
        filePattern: "{id}.yaml"
`,
      'utf8',
    );

    await fs.writeFile(
      path.join(bundleDir, 'bundle-type.json'),
      JSON.stringify(
        {
          bundleType: 'nested-adr-test',
          version: '1.0.0',
          entities: [
            {
              entityType: 'ADR',
              idField: 'adr.id',
              schemaPath: 'schemas/ADR.schema.json',
              directory: 'bundle/adrs',
              filePattern: '{id}.yaml',
            },
          ],
          relations: [],
        },
        null,
        2,
      ),
      'utf8',
    );

    await fs.writeFile(
      path.join(bundleDir, 'schemas', 'ADR.schema.json'),
      JSON.stringify(
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          required: ['adr'],
          properties: {
            adr: {
              type: 'object',
              required: ['id', 'title', 'status', 'created_at', 'version', 'project', 'decision_type'],
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                status: { type: 'string' },
                created_at: { type: 'string' },
                version: { type: 'string' },
                project: { type: 'string' },
                decision_type: { type: 'string' },
              },
            },
            authors: { type: 'array' },
            decision_owner: { type: 'object' },
            context: {
              type: 'object',
              properties: {
                description: { type: 'string' },
              },
            },
            alternatives: { type: 'array' },
            decision: {
              type: 'object',
              properties: {
                chosen_alternative: { type: 'string' },
                rationale: { type: 'string' },
                decision_date: { type: 'string' },
              },
            },
            consequences: { type: 'object' },
            confirmation: {
              type: 'object',
              properties: {
                description: { type: 'string' },
              },
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    await fs.writeFile(
      path.join(bundleDir, 'bundle', 'adrs', 'ADR-0001-nested.yaml'),
      `adr:
  id: ADR-0001-nested
  title: Nested identifier ADR
  status: draft
  created_at: "2026-03-29T10:00:00Z"
  version: "1.0"
  project: Nested ID test
  decision_type: technology
authors:
  - name: Test Author
    role: Architect
decision_owner:
  name: Test Owner
  role: Owner
context:
  description: This ADR proves that nested idField paths load correctly.
alternatives:
  - name: Nested IDs
    description: Keep identifiers under adr.id.
    pros: [Matches governed schema]
    cons: [Needs path-aware loading]
  - name: Flat IDs
    description: Keep ids at the root.
    pros: [Simpler loader]
    cons: [Does not match target schema]
decision:
  chosen_alternative: Nested IDs
  rationale: Keep the ADR document shape aligned with the governed schema.
  decision_date: "2026-03-29"
consequences:
  positive: [Schema-conformant IDs]
confirmation:
  description: Load the bundle and confirm the ADR is discoverable by its nested id.
`,
      'utf8',
    );

    const { diagnostics, bundle } = await loadBundleWithSchemaValidation(bundleDir);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);

    const adrs = bundle.entities.get('ADR');
    expect(adrs?.has('ADR-0001-nested')).toBe(true);
    expect(bundle.idRegistry.get('ADR-0001-nested')?.entityType).toBe('ADR');
  });
});
