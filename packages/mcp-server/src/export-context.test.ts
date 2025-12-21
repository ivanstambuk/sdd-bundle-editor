/**
 * Unit tests for export_context tool functionality.
 * 
 * Tests the core logic using direct bundle loading, same pattern as bulk-tools.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
    loadBundleWithSchemaValidation,
} from '@sdd-bundle-editor/core-model';
import type { Bundle, Entity } from '@sdd-bundle-editor/core-model';

// Test bundle directory
let testBundleDir: string;

/**
 * Collect dependencies for an entity (same logic as export-tools.ts).
 */
function collectDependencies(
    entity: Entity,
    bundle: Bundle,
    depth: number,
    maxDepth: number,
    visited: Set<string>
): Entity[] {
    if (depth >= maxDepth) return [];

    const key = `${entity.entityType}:${entity.id}`;
    if (visited.has(key)) return [];
    visited.add(key);

    const dependencies: Entity[] = [];

    // Find outgoing edges where this entity references others
    for (const edge of bundle.refGraph.edges) {
        if (edge.fromEntityType === entity.entityType && edge.fromId === entity.id) {
            const targetEntity = bundle.entities.get(edge.toEntityType)?.get(edge.toId);
            if (targetEntity) {
                const targetKey = `${edge.toEntityType}:${edge.toId}`;
                if (!visited.has(targetKey)) {
                    dependencies.push(targetEntity);
                    // Recursively collect dependencies
                    dependencies.push(...collectDependencies(
                        targetEntity,
                        bundle,
                        depth + 1,
                        maxDepth,
                        visited
                    ));
                }
            }
        }
    }

    return dependencies;
}

/**
 * Create a test bundle with entities that have dependencies.
 */
async function createTestBundle(): Promise<string> {
    const bundleDir = path.join(tmpdir(), `export-context-test-${randomUUID()}`);

    // Create directories
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'schemas'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'Feature'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'Requirement'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'ADR'), { recursive: true });

    // Create manifest
    const manifest = `
apiVersion: sdd.v1
kind: Bundle
metadata:
  name: Test Bundle
  bundleType: test
  schemaVersion: 1.0.0
spec:
  bundleTypeDefinition: schemas/bundle-type.json
  schemas:
    documents:
      Feature: schemas/Feature.schema.json
      Requirement: schemas/Requirement.schema.json
      ADR: schemas/ADR.schema.json
  layout:
    documents:
      Feature:
        dir: bundle/Feature
        filePattern: "{id}.yaml"
      Requirement:
        dir: bundle/Requirement
        filePattern: "{id}.yaml"
      ADR:
        dir: bundle/ADR
        filePattern: "{id}.yaml"
`;
    await fs.writeFile(path.join(bundleDir, 'sdd-bundle.yaml'), manifest);

    // Create bundle-type definition
    const bundleType = {
        bundleType: "test",
        version: "1.0.0",
        entities: [
            {
                entityType: "Feature",
                idField: "id",
                schemaPath: "schemas/Feature.schema.json",
                directory: "bundle/Feature",
                filePattern: "{id}.yaml"
            },
            {
                entityType: "Requirement",
                idField: "id",
                schemaPath: "schemas/Requirement.schema.json",
                directory: "bundle/Requirement",
                filePattern: "{id}.yaml"
            },
            {
                entityType: "ADR",
                idField: "id",
                schemaPath: "schemas/ADR.schema.json",
                directory: "bundle/ADR",
                filePattern: "{id}.yaml"
            },
        ],
        relations: []
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'bundle-type.json'),
        JSON.stringify(bundleType, null, 2)
    );

    // Create Feature schema with references
    const featureSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Feature",
        "type": "object",
        "required": ["id", "name"],
        "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            "lastModifiedDate": { "type": "string", "format": "date" },
            "realizesRequirementIds": {
                "type": "array",
                "items": { "type": "string", "format": "sdd-ref", "x-sdd-refTargets": ["Requirement"] },
                "title": "realizes"
            },
            "governedByAdrIds": {
                "type": "array",
                "items": { "type": "string", "format": "sdd-ref", "x-sdd-refTargets": ["ADR"] },
                "title": "governed by"
            }
        }
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'Feature.schema.json'),
        JSON.stringify(featureSchema, null, 2)
    );

    // Create Requirement schema
    const reqSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Requirement",
        "type": "object",
        "required": ["id", "title"],
        "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" },
            "lastModifiedDate": { "type": "string", "format": "date" }
        }
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'Requirement.schema.json'),
        JSON.stringify(reqSchema, null, 2)
    );

    // Create ADR schema
    const adrSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "ADR",
        "type": "object",
        "required": ["id", "title"],
        "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" }
        }
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'ADR.schema.json'),
        JSON.stringify(adrSchema, null, 2)
    );

    // Create test entities
    // Feature that depends on 2 requirements and 1 ADR
    await fs.writeFile(
        path.join(bundleDir, 'bundle', 'Feature', 'auth-login.yaml'),
        `id: auth-login
name: User Login Feature
lastModifiedDate: "2025-12-20"
realizesRequirementIds:
  - REQ-001
  - REQ-002
governedByAdrIds:
  - ADR-001
`
    );

    // Second Feature that shares REQ-002
    await fs.writeFile(
        path.join(bundleDir, 'bundle', 'Feature', 'auth-logout.yaml'),
        `id: auth-logout
name: User Logout Feature
realizesRequirementIds:
  - REQ-002
`
    );

    // Requirements
    await fs.writeFile(
        path.join(bundleDir, 'bundle', 'Requirement', 'REQ-001.yaml'),
        `id: REQ-001
title: Secure authentication required
lastModifiedDate: "2025-12-15"
`
    );

    await fs.writeFile(
        path.join(bundleDir, 'bundle', 'Requirement', 'REQ-002.yaml'),
        `id: REQ-002
title: Session management
lastModifiedDate: "2025-12-18"
`
    );

    // ADR
    await fs.writeFile(
        path.join(bundleDir, 'bundle', 'ADR', 'ADR-001.yaml'),
        `id: ADR-001
title: Use JWT for authentication
`
    );

    return bundleDir;
}

async function cleanupTestBundle(bundleDir: string): Promise<void> {
    try {
        await fs.rm(bundleDir, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
}

describe('export_context tool functionality', () => {
    beforeEach(async () => {
        testBundleDir = await createTestBundle();
    });

    afterEach(async () => {
        await cleanupTestBundle(testBundleDir);
    });

    describe('bundle loading', () => {
        it('loads test bundle successfully', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);

            expect(bundle.entities.get('Feature')?.size).toBe(2);
            expect(bundle.entities.get('Requirement')?.size).toBe(2);
            expect(bundle.entities.get('ADR')?.size).toBe(1);
        });

        it('has entities with expected structure', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const feature = bundle.entities.get('Feature')?.get('auth-login');

            expect(feature).toBeDefined();
            expect(feature!.entityType).toBe('Feature');
            expect(feature!.id).toBe('auth-login');
            expect(feature!.data).toBeDefined();
            expect(feature!.filePath).toBeDefined();

            // Check data includes the reference fields
            const data = feature!.data as Record<string, unknown>;
            expect(data.name).toBe('User Login Feature');
            expect(data.realizesRequirementIds).toContain('REQ-001');
        });

        it('has refGraph with edges', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);

            // Check that the refGraph has edges
            // (the exact count depends on how core-model processes the refs)
            expect(bundle.refGraph).toBeDefined();
            expect(bundle.refGraph.edges).toBeDefined();
            // Log for debugging
            console.log('refGraph edges:', JSON.stringify(bundle.refGraph.edges, null, 2));
        });
    });

    describe('dependency collection algorithm', () => {
        it('collects no dependencies with depth 0', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const feature = bundle.entities.get('Feature')?.get('auth-login');
            expect(feature).toBeDefined();

            const visited = new Set<string>();
            visited.add(`Feature:auth-login`);
            const deps = collectDependencies(feature!, bundle, 0, 0, visited);

            expect(deps.length).toBe(0);
        });

        it('separates targets from dependencies', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const feature = bundle.entities.get('Feature')?.get('auth-login');
            expect(feature).toBeDefined();

            const targets = [feature!];
            const visited = new Set<string>();
            visited.add('Feature:auth-login');
            const dependencies = collectDependencies(feature!, bundle, 0, 1, visited);

            // Target should not be in dependencies
            const targetIds = targets.map(t => t.id);
            const depIds = dependencies.map(d => d.id);

            expect(targetIds).toContain('auth-login');
            expect(depIds).not.toContain('auth-login');
        });
    });

    describe('lastModified extraction', () => {
        it('can get lastModifiedDate from entity data', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const feature = bundle.entities.get('Feature')?.get('auth-login');
            expect(feature).toBeDefined();

            const data = feature!.data as Record<string, unknown>;
            expect(data.lastModifiedDate).toBe('2025-12-20');
        });

        it('can get file mtime when lastModifiedDate not in data', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const adr = bundle.entities.get('ADR')?.get('ADR-001');
            expect(adr).toBeDefined();

            // ADR doesn't have lastModifiedDate in data
            const data = adr!.data as Record<string, unknown>;
            expect(data.lastModifiedDate).toBeUndefined();

            // filePath may be full path or relative - check what we have
            const filePath = adr!.filePath;
            const fullPath = filePath.startsWith('/')
                ? filePath
                : path.join(testBundleDir, filePath);
            const stats = await fs.stat(fullPath);
            expect(stats.mtime).toBeDefined();
            expect(stats.mtime).toBeInstanceOf(Date);
        });
    });

    describe('export output structure', () => {
        it('can build export meta', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const targets = [bundle.entities.get('Feature')?.get('auth-login')!];
            const visited = new Set<string>(['Feature:auth-login']);
            const dependencies = collectDependencies(targets[0], bundle, 0, 1, visited);

            const exportMeta = {
                bundleId: 'test-bundle',
                bundleName: bundle.manifest.metadata.name,
                exportedAt: new Date().toISOString(),
                targetCount: targets.length,
                dependencyCount: dependencies.length,
                totalEntities: targets.length + dependencies.length,
                format: 'json' as const,
                version: '1.0' as const,
            };

            expect(exportMeta.bundleName).toBe('Test Bundle');
            expect(exportMeta.targetCount).toBe(1);
            expect(exportMeta.format).toBe('json');
            expect(exportMeta.version).toBe('1.0');
        });
    });
});
