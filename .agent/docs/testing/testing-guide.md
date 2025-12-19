# Testing Guide

## Test Scripts Reference

| Script | Purpose |
|--------|---------|
| `pnpm test` | Run all unit tests (fast, ~15s) |
| `pnpm test:watch` | Run tests in watch mode (interactive development) |
| `pnpm test:smoke` | Quick validation: MCP unit tests + core E2E scenarios (~30s) |
| `pnpm test:e2e` | Full E2E test suite (~3-5 min) |
| `pnpm test:e2e:smoke` | Subset of E2E tests for quick validation |
| `pnpm test:visual` | Visual regression tests (screenshot comparison) |
| `pnpm test:visual:update` | Update visual regression baselines |

**When to use each:**
- **After code changes**: `pnpm test` (always)
- **Quick sanity check**: `pnpm test:smoke` (includes MCP + key E2E tests)
- **Before committing UI changes**: `pnpm test:e2e` (full suite)
- **After intentional visual changes**: `pnpm test:visual:update`

---

## Unit Tests

Tests live alongside code and can be run recursively with `pnpm -r test`.

For targeted test runs during development:
```bash
pnpm --filter @sdd-bundle-editor/core-model test
pnpm --filter @sdd-bundle-editor/core-lint test
pnpm --filter @sdd-bundle-editor/mcp-server test
pnpm --filter @sdd-bundle-editor/ui-shell test
```

If you add tests to new packages, follow the existing pattern:
- `*.test.ts` under `src`
- Make sure they run under the root `vitest.config.ts` include patterns

---

## End-to-End Browser Tests (Playwright)

E2E tests are defined under `e2e/` and configured in `playwright.config.ts`.

**Running E2E tests:**
```bash
pnpm test:e2e
```

Playwright will automatically:
1. Build and start the MCP server (port 3001)
2. Start the web dev server (port 5173)
3. Wait for both to be ready (using the `/health` endpoint)
4. Run all tests and then shut down the servers

**Manual server mode (optional):**
```bash
PW_SKIP_WEB_SERVER=1 pnpm test:e2e
```

**Headed mode (visual debugging):**
```bash
pnpm exec playwright test --headed
```

---

## E2E Testing Patterns (MANDATORY)

> [!IMPORTANT]
> The UI is now **read-only**. E2E tests cover bundle browsing, entity navigation, and diagnostics.

### External Bundle Fixture

**MANDATORY**: Use the shared fixture from `e2e/bundle-test-fixture.ts`:

```typescript
import { getSampleBundlePath } from './bundle-test-fixture';

const bundleDir = getSampleBundlePath();

test('loads entities', async ({ page }) => {
    await page.goto(`/?bundleDir=${bundleDir}`);
    await page.waitForSelector('.entity-list');
    // ... assertions
});
```

**Environment Variable**: `SDD_SAMPLE_BUNDLE_PATH` controls the bundle location. Default: `/home/ivan/dev/sdd-sample-bundle`.

### Test Fixtures and Helpers

- `getSampleBundlePath()` – Returns path to external sample bundle
- `TEST_ENTITIES` – Known entity IDs for tests (e.g., `TEST_ENTITIES.REQUIREMENT`)
- `getFirstEntityId(page, entityType)` – Dynamically get first entity of a type
- `createTempBundle(prefix)` – Create isolated temp bundle for write tests
- `cleanupTempBundle(tempDir)` – Clean up temp bundle after tests

### Why Tests Run Serially

The `playwright.config.ts` sets `workers: 1` and `fullyParallel: false`. This ensures consistent ordering and avoids resource contention.

---

## AI-Driven Browser Testing

> [!CAUTION]
> **NEVER use the `browser_subagent` tool in this project.** CDP browser is NOT available and will always fail with `ECONNREFUSED 127.0.0.1:9222`.
>
> **ALL visual verification and screenshot capture MUST be done via Playwright E2E tests.**

**Use Playwright tests for all visual verification:**

```bash
# Run the screenshot capture test
pnpm exec playwright test e2e/screenshot-capture.spec.ts

# Run agent configuration test (captures 6 screenshots)
pnpm exec playwright test e2e/agent-configuration.spec.ts

# View captured screenshots
ls -la artifacts/*.png
```

**Screenshot locations:**
- `artifacts/` - Primary location for feature screenshots
- `test-results/` - Playwright's automatic test artifacts

---

## Testing & Debugging Best Practices

**1. Explicit Context is Mandatory**
- The backend server is stateless regarding "active bundle"
- **Rule**: Every API call to `/agent/*` or `/bundle/*` MUST include `?bundleDir=...` or pass `bundleDir` in the body
- **Why**: E2E tests run on temporary directories, not `process.cwd()`. Omitting this causes silent failures or 400 errors

**2. E2E Debugging**
- **Unified Logs**: Capture output to a file to see server logs side-by-side with test results:
  ```bash
  pnpm test:e2e e2e/target.spec.ts > debug_log.txt 2>&1
  ```
- **Workflows**: See `.agent/workflows/debug-e2e.md` for detailed instructions
- **Console Listeners**: Ensure your test file listens to browser console logs:
  ```typescript
  page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
  ```

**3. Entity IDs in Tests**
- **Do NOT Assume IDs**: When testing against the sample bundle, verify the entity IDs first (e.g., `PROF-BASIC`, not `user`)
- **Best Practice**: Use `list_dir` or `view_file` to confirm IDs before hardcoding them in test expectations

---

## Pre-Fix Code Path Analysis

**Problem**: Complex bugs often span multiple layers (UI → API → Service → Data). Fixing one layer at a time leads to multiple iterations and wasted effort.

**Protocol**: Before making ANY code fix for a bug that involves data flow, **trace the ENTIRE path first**.

### Step 1: Map the Complete Flow

```
1. UI Component (what triggers the action?)
   └── AppShell.tsx → handler function

2. API Call (what endpoint is called?)
   └── /agent/accept, /bundle/save, etc.

3. Route Handler (how is the request processed?)
   └── apps/server/src/routes/agent.ts

4. Service Layer (what business logic runs?)
   └── ChangeApplicationService.ts, write.ts

5. Data Layer (how is data persisted?)
   └── saveEntity(), git commit

6. Reload/Refresh (how does UI get updated data?)
   └── fetchJson('/bundle'), setBundle()
```

### Step 2: Check Each Layer BEFORE Fixing

At each layer, verify:
- [ ] Input data format (log or inspect)
- [ ] Expected vs actual behavior
- [ ] Error handling (what happens on failure?)
- [ ] Output data format

### Step 3: Document All Issues Found

Create a list of ALL issues before fixing ANY of them.

### Step 4: Fix in Order (Bottom-Up or Top-Down)

Fix issues in logical order, not discovery order. Usually:
- Bottom-up: Fix data layer first, then service, then API, then UI
- This prevents "fix cascades" where fixing one layer reveals the next

**Time saved**: 30 minutes upfront analysis prevents 2+ hours of iterative fixes.
