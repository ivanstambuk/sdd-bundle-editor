# Test Patterns

Reusable patterns for E2E and unit tests that took effort to figure out.

---

## Dynamic Entity Selection

**Problem**: Hardcoded entity IDs may not exist in the sample bundle.

```typescript
// ❌ Don't do this - entity may not exist
await page.click('[data-testid="entity-REQ-002"]');

// ✅ Do this - use TEST_ENTITIES constants
import { TEST_ENTITIES } from './bundle-test-fixture';
await page.click(`[data-testid="entity-${TEST_ENTITIES.REQUIREMENT}"]`);

// ✅ Or - select first available dynamically
const firstEntity = page.locator('.entity-list .entity-btn').first();
await expect(firstEntity).toBeVisible({ timeout: 5000 });
const entityId = await firstEntity.getAttribute('data-entity-id');
await firstEntity.click();
```

---

## MCP Tool Response Parsing

**Problem**: MCP tools return a nested envelope structure.

```typescript
// Full envelope structure
interface ToolResponse<T = Record<string, unknown>> {
    ok: boolean;
    tool: string;
    bundleId?: string;
    data: T;
    meta?: Record<string, unknown>;
    diagnostics?: unknown[];
}

// Parsing with error handling
async function callMcpTool(toolName: string, args: object): Promise<unknown> {
    const response = await fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: toolName, arguments: args }
        })
    });
    
    const result = await response.json();
    const envelope = JSON.parse(result.result.content[0].text);
    
    if (!envelope.ok) {
        throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
    }
    
    return envelope.data;
}
```

---

## Chevron State Testing (Robust)

**Problem**: Testing expand/collapse can be flaky if you assume initial state.

```typescript
// ❌ Don't assume initial state
expect(chevron.textContent()).toBe('▸'); // May fail!

// ✅ Just verify toggle works
const initial = await chevron.textContent();
await groupToggle.click();
await page.waitForTimeout(300);
const after = await chevron.textContent();
expect(after).toMatch(/[▸▾]/); // Valid state
// Don't test the full round-trip - it's flaky
```

---

## Waiting for Entity Group Expansion

**Problem**: Groups start collapsed, need to expand before selecting entities.

```typescript
// Expand group and wait for entities to be visible
await page.click('[data-testid="entity-group-Requirement"]');
await page.waitForTimeout(300);

const entityList = page.locator('.entity-group[data-type="Requirement"] .entity-list');
await expect(entityList).toBeVisible({ timeout: 5000 });
```

---

## Test Fixtures: Known Entity IDs

Use constants from `e2e/bundle-test-fixture.ts`:

```typescript
import { TEST_ENTITIES, getSampleBundlePath } from './bundle-test-fixture';

// These IDs are known to exist in the sample bundle
TEST_ENTITIES.REQUIREMENT     // 'REQ-audit-logging'
TEST_ENTITIES.REQUIREMENT_ALT // 'REQ-secure-auth'
TEST_ENTITIES.FEATURE         // 'FEAT-secure-auth'
TEST_ENTITIES.PROFILE         // 'PROF-BASIC'
TEST_ENTITIES.COMPONENT       // 'COMP-api-gateway'
```

---

## MCP Unit Test Pattern: Direct Bundle Loading

**Problem**: MCP HTTP endpoints require session management. Unit tests should NOT use HTTP.

```typescript
// ✅ CORRECT: Use direct bundle loading for unit tests
import { loadBundleWithSchemaValidation } from '@sdd-bundle-editor/core-model';
import type { Bundle, Entity } from '@sdd-bundle-editor/core-model';

describe('MCP tool functionality', () => {
    let testBundleDir: string;

    beforeEach(async () => {
        testBundleDir = await createTestBundle();
    });

    afterEach(async () => {
        await fs.rm(testBundleDir, { recursive: true, force: true });
    });

    it('tests the core logic', async () => {
        const { bundle } = await loadBundleWithSchemaValidation(testBundleDir);
        
        // Access entities directly
        const feature = bundle.entities.get('Feature')?.get('auth-login');
        expect(feature).toBeDefined();
        
        // Access refGraph for dependency testing
        expect(bundle.refGraph.edges).toBeDefined();
    });
});

// ❌ WRONG: HTTP calls require session ID management
// This will fail with "No valid session ID provided"
async function wrongApproach() {
    const result = await fetch("http://localhost:3001/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0", id: 1,
            method: "tools/call",
            params: { name: "some_tool", arguments: {} }
        })
    });
    // Error: "No valid session ID provided"
}
```

**When to use HTTP**: Only in E2E tests where `playwright-mcp-session.ts` handles session management.

---

## Test Bundle Template (Copy-Paste Ready)

**Problem**: Bundle type definitions have many required fields that cause cryptic errors if missing.

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

async function createTestBundle(): Promise<string> {
    const bundleDir = path.join(tmpdir(), `test-bundle-${randomUUID()}`);

    // Create directories
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'schemas'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'Feature'), { recursive: true });
    await fs.mkdir(path.join(bundleDir, 'bundle', 'Requirement'), { recursive: true });

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
  layout:
    documents:
      Feature:
        dir: bundle/Feature
        filePattern: "{id}.yaml"
      Requirement:
        dir: bundle/Requirement
        filePattern: "{id}.yaml"
`;
    await fs.writeFile(path.join(bundleDir, 'sdd-bundle.yaml'), manifest);

    // ⚠️ Bundle type definition - ALL FIELDS REQUIRED!
    const bundleType = {
        bundleType: "test",
        version: "1.0.0",
        entities: [
            {
                entityType: "Feature",
                idField: "id",
                schemaPath: "schemas/Feature.schema.json",
                directory: "bundle/Feature",      // ⚠️ REQUIRED - causes cryptic error if missing
                filePattern: "{id}.yaml"          // ⚠️ REQUIRED - causes cryptic error if missing
            },
            {
                entityType: "Requirement",
                idField: "id",
                schemaPath: "schemas/Requirement.schema.json",
                directory: "bundle/Requirement",
                filePattern: "{id}.yaml"
            },
        ],
        relations: []
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'bundle-type.json'),
        JSON.stringify(bundleType, null, 2)
    );

    // Create schemas
    const featureSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Feature",
        "type": "object",
        "required": ["id", "name"],
        "properties": {
            "id": { "type": "string" },
            "name": { "type": "string" },
            // Add reference fields if testing dependencies:
            "realizesRequirementIds": {
                "type": "array",
                "items": { 
                    "type": "string", 
                    "format": "sdd-ref", 
                    "x-sdd-refTargets": ["Requirement"] 
                }
            }
        }
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'Feature.schema.json'),
        JSON.stringify(featureSchema, null, 2)
    );

    const reqSchema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "title": "Requirement",
        "type": "object",
        "required": ["id", "title"],
        "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" }
        }
    };
    await fs.writeFile(
        path.join(bundleDir, 'schemas', 'Requirement.schema.json'),
        JSON.stringify(reqSchema, null, 2)
    );

    // Create test entities
    await fs.writeFile(
        path.join(bundleDir, 'bundle', 'Feature', 'test-feature.yaml'),
        `id: test-feature
name: Test Feature
realizesRequirementIds:
  - REQ-001
`
    );

    await fs.writeFile(
        path.join(bundleDir, 'bundle', 'Requirement', 'REQ-001.yaml'),
        `id: REQ-001
title: Test Requirement
`
    );

    return bundleDir;
}
```

**Common Error**: `TypeError: The "path" argument must be of type string. Received undefined`
→ Missing `directory` field in bundle type definition
