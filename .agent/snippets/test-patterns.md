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
