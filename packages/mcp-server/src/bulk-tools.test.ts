/**
 * Unit tests for bulk MCP tools: read_entities, list_entity_summaries
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
    loadBundleWithSchemaValidation,
} from '@sdd-bundle-editor/core-model';

// Test bundle directory
let testBundleDir: string;

// Sample bundle structure for testing
async function createTestBundle(): Promise<string> {
    const bundleDir = path.join(tmpdir(), `mcp-bulk-test-${randomUUID()}`);

    // Create directories
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'schemas'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'requirements'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'features'), { recursive: true });

    // Create minimal bundle manifest
    const manifest = `
apiVersion: sdd.v1
kind: Bundle
metadata:
  name: test-bundle
  bundleType: test
  schemaVersion: 1.0.0
spec:
  bundleTypeDefinition: schemas/bundle-type.json
  schemas:
    documents:
      Requirement: schemas/Requirement.schema.json
      Feature: schemas/Feature.schema.json
  layout:
    documents:
      Requirement:
        dir: bundle/requirements
        filePattern: "{id}.yaml"
      Feature:
        dir: bundle/features
        filePattern: "{id}.yaml"
`;
    await fs.writeFile(path.join(bundleDir, 'sdd-bundle.yaml'), manifest);

    // Create bundle-type definition
    const bundleType = {
        bundleType: "test",
        version: "1.0.0",
        entities: [
            {
                entityType: "Requirement",
                idField: "id",
                schemaPath: "schemas/Requirement.schema.json",
                directory: "bundle/requirements",
                filePattern: "{id}.yaml"
            },
            {
                entityType: "Feature",
                idField: "id",
                schemaPath: "schemas/Feature.schema.json",
                directory: "bundle/features",
                filePattern: "{id}.yaml"
            }
        ],
        relations: []
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'bundle-type.json'),
        JSON.stringify(bundleType, null, 2)
    );

    // Create Requirement schema
    const reqSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Requirement",
        "type": "object",
        "required": ["id", "title"],
        "properties": {
            "id": { "type": "string", "pattern": "^REQ-[0-9]{3}$" },
            "title": { "type": "string", "minLength": 1 },
            "description": { "type": "string" },
            "priority": { "type": "string", "enum": ["low", "medium", "high"] },
            "state": { "type": "string", "enum": ["draft", "approved", "implemented"] }
        }
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'Requirement.schema.json'),
        JSON.stringify(reqSchema, null, 2)
    );

    // Create Feature schema
    const featureSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Feature",
        "type": "object",
        "required": ["id", "title"],
        "properties": {
            "id": { "type": "string", "pattern": "^FEAT-[0-9]{3}$" },
            "title": { "type": "string", "minLength": 1 },
            "description": { "type": "string" }
        }
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'Feature.schema.json'),
        JSON.stringify(featureSchema, null, 2)
    );

    // Create multiple test requirements
    for (let i = 1; i <= 5; i++) {
        const id = `REQ-00${i}`;
        const req = `id: ${id}
title: Test Requirement ${i}
description: A test requirement for unit testing
priority: ${i <= 2 ? 'high' : i <= 4 ? 'medium' : 'low'}
state: ${i === 1 ? 'approved' : 'draft'}
`;
        await fs.writeFile(
            path.join(bundleDir, 'bundle', 'requirements', `${id}.yaml`),
            req
        );
    }

    // Create test features
    for (let i = 1; i <= 3; i++) {
        const id = `FEAT-00${i}`;
        const feat = `id: ${id}
title: Test Feature ${i}
description: A test feature for unit testing
`;
        await fs.writeFile(
            path.join(bundleDir, 'bundle', 'features', `${id}.yaml`),
            feat
        );
    }

    return bundleDir;
}

async function cleanupTestBundle(bundleDir: string): Promise<void> {
    try {
        await fs.rm(bundleDir, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
}

describe('bulk MCP tools functionality', () => {
    beforeEach(async () => {
        testBundleDir = await createTestBundle();
    });

    afterEach(async () => {
        await cleanupTestBundle(testBundleDir);
    });

    describe('read_entities simulation', () => {
        it('should fetch multiple entities by ID', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const entityType = 'Requirement';
            const ids = ['REQ-001', 'REQ-002', 'REQ-003'];

            const entitiesOfType = bundle.entities.get(entityType);
            expect(entitiesOfType).toBeDefined();

            const entities: Array<Record<string, unknown>> = [];
            const notFound: string[] = [];

            for (const id of ids) {
                const entity = entitiesOfType?.get(id);
                if (entity) {
                    entities.push({ id: entity.id, ...entity.data });
                } else {
                    notFound.push(id);
                }
            }

            expect(entities.length).toBe(3);
            expect(notFound.length).toBe(0);
            expect(entities[0].id).toBe('REQ-001');
            expect(entities[1].id).toBe('REQ-002');
            expect(entities[2].id).toBe('REQ-003');
        });

        it('should report not found IDs', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const entityType = 'Requirement';
            const ids = ['REQ-001', 'REQ-999', 'REQ-003'];

            const entitiesOfType = bundle.entities.get(entityType);
            const entities: Array<Record<string, unknown>> = [];
            const notFound: string[] = [];

            for (const id of ids) {
                const entity = entitiesOfType?.get(id);
                if (entity) {
                    entities.push({ id: entity.id, ...entity.data });
                } else {
                    notFound.push(id);
                }
            }

            expect(entities.length).toBe(2);
            expect(notFound).toContain('REQ-999');
        });

        it('should filter fields when specified', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const entityType = 'Requirement';
            const ids = ['REQ-001'];
            const fields = ['title', 'priority'];

            const entitiesOfType = bundle.entities.get(entityType);
            const entity = entitiesOfType?.get('REQ-001');
            expect(entity).toBeDefined();

            const filtered: Record<string, unknown> = { id: entity!.id };
            const data = entity!.data as Record<string, unknown>;
            for (const field of fields) {
                if (field in data) {
                    filtered[field] = data[field];
                }
            }

            expect(filtered.id).toBe('REQ-001');
            expect(filtered.title).toBe('Test Requirement 1');
            expect(filtered.priority).toBe('high');
            expect(filtered.description).toBeUndefined(); // Not in fields
            expect(filtered.state).toBeUndefined(); // Not in fields
        });
    });

    describe('list_entity_summaries simulation', () => {
        it('should return summaries with requested fields', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const entityType = 'Requirement';
            const include = ['title', 'state'];

            const entitiesOfType = bundle.entities.get(entityType);
            expect(entitiesOfType).toBeDefined();

            const items: Array<Record<string, unknown>> = [];

            for (const [eId, entity] of entitiesOfType!) {
                const summary: Record<string, unknown> = { entityType, id: eId };
                const data = entity.data as Record<string, unknown>;

                for (const field of include) {
                    if (field in data) {
                        summary[field] = data[field];
                    }
                }

                items.push(summary);
            }

            expect(items.length).toBe(5);
            expect(items[0].entityType).toBe('Requirement');
            expect(items[0].id).toBeDefined();
            expect(items[0].title).toBeDefined();
            expect(items[0].state).toBeDefined();
            expect(items[0].description).toBeUndefined(); // Not in include
        });

        it('should apply pagination correctly', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
            const entityType = 'Requirement';
            const limit = 2;
            const offset = 1;

            const entitiesOfType = bundle.entities.get(entityType);
            const allItems = Array.from(entitiesOfType!.entries()).map(([id, e]) => ({
                id,
                title: (e.data as Record<string, unknown>).title,
            }));

            const paginatedItems = allItems.slice(offset, offset + limit);
            const total = allItems.length;
            const hasMore = offset + limit < total;

            expect(paginatedItems.length).toBe(2);
            expect(total).toBe(5);
            expect(hasMore).toBe(true);
        });

        it('should list entities across all types when entityType not specified', async () => {
            const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);

            const allItems: Array<Record<string, unknown>> = [];

            for (const [eType, entities] of bundle.entities) {
                for (const [eId, entity] of entities) {
                    allItems.push({
                        entityType: eType,
                        id: eId,
                        title: (entity.data as Record<string, unknown>).title,
                    });
                }
            }

            // 5 requirements + 3 features = 8 total
            expect(allItems.length).toBe(8);
            expect(allItems.filter(i => i.entityType === 'Requirement').length).toBe(5);
            expect(allItems.filter(i => i.entityType === 'Feature').length).toBe(3);
        });
    });
});
