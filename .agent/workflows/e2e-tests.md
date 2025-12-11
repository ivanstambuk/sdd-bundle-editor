---
description: How to write new E2E tests with proper patterns
---

# Creating New E2E Tests

This workflow ensures new E2E tests follow established patterns to avoid flaky tests.

## Prerequisites

- Understand that all tests share a single backend server
- Tests run serially (workers: 1) to avoid race conditions
- Agent state persists between tests unless explicitly reset

## Step-by-Step Guide

### 1. Choose the Right Bundle Pattern

**If your test MODIFIES files (creates/edits/deletes):**
```typescript
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';

let tempBundleDir: string;

test.beforeEach(async ({ page }) => {
    tempBundleDir = await createTempBundle('sdd-your-test-');
    
    // IMPORTANT: Reset agent state
    await page.goto('/');
    await page.evaluate(async () => {
        await fetch('/agent/abort', { method: 'POST' });
    });
});

test.afterEach(async () => {
    await cleanupTempBundle(tempBundleDir);
});
```

**If your test is READ-ONLY:**
```typescript
import { getSampleBundlePath } from './bundle-test-fixture';

const bundleDir = getSampleBundlePath();
// Can use bundleDir directly in test without temp copy
```

### 2. Reset Agent State (MANDATORY)

Every test that uses the agent MUST reset state. Add this to `beforeEach`:

```typescript
test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
        await fetch('/agent/abort', { method: 'POST' });
    });
});
```

### 3. Configure Agent via UI

**ALWAYS** configure the agent via UI after page load:

```typescript
// Navigate with debug=true (required for mock agent)
await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true`);

// Wait for app to load
await page.waitForSelector('.app-shell', { timeout: 10000 });
await page.waitForSelector('.entity-group', { timeout: 10000 });

// Configure mock agent via UI
await page.click('[data-testid="agent-settings-btn"]');
await page.selectOption('.form-control', 'mock');
await page.click('[data-testid="agent-save-config-btn"]');

// Start conversation
const startBtn = page.locator('[data-testid="agent-start-btn"]');
await expect(startBtn).toBeEnabled({ timeout: 5000 });
await startBtn.click();
```

### 4. Wait for Responses Properly

Use `waitForResponse` instead of timeouts:

```typescript
const responsePromise = page.waitForResponse(response =>
    response.url().includes('/agent/message') && response.status() === 200
);
await page.locator('[data-testid="agent-send-btn"]').click();
await responsePromise;
```

### 5. Add Screenshots for Debugging

Capture screenshots for visual verification and debugging:

```typescript
await page.screenshot({ path: 'artifacts/your_test_step.png' });
```

// turbo
### 6. Run Your Test

```bash
pnpm test:e2e e2e/your-new-test.spec.ts
```

// turbo
### 7. Run Full Suite to Verify No Regressions

```bash
pnpm test:e2e
```

## Complete Example Template

```typescript
import { test, expect } from '@playwright/test';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';

test.describe('Your Feature Test', () => {
    let tempBundleDir: string;

    test.beforeEach(async ({ page }) => {
        tempBundleDir = await createTempBundle('sdd-feature-');
        
        // Reset agent state
        await page.goto('/');
        await page.evaluate(async () => {
            await fetch('/agent/abort', { method: 'POST' });
        });
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('should do something with the agent', async ({ page }) => {
        // Navigate with debug mode
        await page.goto(`/?bundleDir=${encodeURIComponent(tempBundleDir)}&debug=true`);
        
        // Wait for app
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });
        
        // Configure mock agent via UI
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');
        
        // Start conversation
        await expect(page.locator('[data-testid="agent-start-btn"]')).toBeEnabled({ timeout: 5000 });
        await page.click('[data-testid="agent-start-btn"]');
        
        // Use the agent...
        await page.fill('[data-testid="agent-message-input"]', 'propose change');
        
        const responsePromise = page.waitForResponse(r => 
            r.url().includes('/agent/message') && r.status() === 200
        );
        await page.click('[data-testid="agent-send-btn"]');
        await responsePromise;
        
        // Verify results
        await expect(page.locator('text=Proposed Changes')).toBeVisible({ timeout: 15000 });
        
        // Screenshot for debugging
        await page.screenshot({ path: 'artifacts/feature_test.png' });
    });
});
```

## Common Pitfalls to Avoid

❌ **Don't configure agent via API before navigation** - use UI after page load
❌ **Don't skip agent reset in beforeEach** - causes state pollution
❌ **Don't use parallel workers** - config is set to 1 for a reason
❌ **Don't forget debug=true** - mock agent requires it
❌ **Don't use hardcoded paths** - use bundle-test-fixture functions
❌ **Don't expect 'idle' after New Chat** - `startNewChat()` results in 'active' status

## Shared Agent Test Fixture

For agent tests, prefer using the shared fixture from `e2e/fixtures/agent-test-fixture.ts`:

```typescript
import { 
    setupMockAgent, 
    startAgentConversation, 
    sendAgentMessage,
    clickNewChat 
} from './fixtures/agent-test-fixture';

test('my agent test', async ({ page }) => {
    await setupMockAgent(page, bundleDir);
    await startAgentConversation(page);
    await sendAgentMessage(page, 'Hello agent');
    // ... rest of test
});
```

This ensures consistent agent setup and prevents common configuration issues.

## Agent State Transitions

Understanding agent state transitions is critical for writing correct assertions:

| Action | Starting Status | Resulting Status |
|--------|----------------|------------------|
| Start Conversation | idle | active |
| Send Message | active | active (or pending_changes) |
| Accept Changes | pending_changes | committed → active |
| Click New Chat | active/pending_changes | **active** (NOT idle!) |
| Abort Conversation | any | idle |

> ⚠️ **Important**: `startNewChat()` resets then immediately starts a new conversation,
> so the status transitions to 'active' (new conversation), NOT 'idle'.

## AgentPanel Page Object

For cleaner tests, use the AgentPanel page object from `e2e/page-objects/AgentPanel.ts`:

```typescript
import { AgentPanel } from './page-objects/AgentPanel';

test('my agent test', async ({ page }) => {
    const agent = new AgentPanel(page);
    
    await agent.navigate(bundleDir);         // go to app with reset
    await agent.configure('mock');           // set up mock agent
    await agent.sendMessage('Hello');        // send and wait for response
    
    if (await agent.hasPendingChanges()) {
        await agent.acceptChanges();
    }
});
```

This provides a clean API with proper encapsulation of UI selectors.

## Debug Logging

Enable verbose API logging during test runs:

```bash
DEBUG_E2E=true pnpm test:e2e
```

This logs all API requests/responses to the backend server, making it easier to debug failures.

