## Notes for AI agents working in this repo

This is a pnpm-based TypeScript monorepo that follows `sdd-bundle-editor-spec.md`.  
Please keep the structure and internal dependencies consistent with what is already in place.

**Mandatory Verification**:
After any completed (meaningful, self-contained) change, you MUST run the full test suite to verify no regressions:
1. `pnpm test` (Unit/Package tests)
2. `pnpm test:e2e` (End-to-end tests)

### Interaction Protocol: UI Features

For any new feature or change that impacts the User Interface (UI), the following protocol is **MANDATORY**:

1.  **Playwright Test Required**: You MUST write or update a Playwright E2E test (`e2e/*.spec.ts`) that covers the new feature.
    *   **Simulate Interaction**: The test must simulate real user interactions (clicks, typing) to verify behavior.
    *   **Verify Appearance**: Use assertions to verify element visibility, styling classes, and state changes.
2.  **Screenshot Capture**: The test MUST capture a screenshot of the relevant UI state.
    *   Use `await page.screenshot({ path: 'artifacts/<feature_name>.png' });`.
    *   Save screenshots to the artifacts directory so they can be embedded in reports.
3.  **Agent Verification**:
    *   **Run the Test**: You MUST run `pnpm test:e2e` and confirm it passes.
    *   **Inspect Results**: Verify the screenshot exists and embed it in your `walkthrough.md` or completion report to demonstrate the result to the user.
4.  **No Skipping**: Do NOT skip these tests or ask the user to test manually. You must validate the feature yourself before successful hand-off.

---

### Debug-First Workflow for UI/CSS Issues

When a visual bug is reported (spacing, alignment, colors, layout issues), follow this **measure-before-guessing** approach:

1.  **Create a Reproduction Test FIRST**:
    - Write an E2E test that reproduces the issue
    - Inject test HTML if needed (don't depend on API responses)
    - Use `boundingBox()` to measure actual pixel values
    - Log computed styles (`getComputedStyle()`) for affected elements

    ```typescript
    // Example: Measure spacing between list items
    const box1 = await items.nth(0).boundingBox();
    const box2 = await items.nth(1).boundingBox();
    const gap = box2.y - (box1.y + box1.height);
    console.log(`Gap: ${gap}px`); // Quantify the issue!
    ```

2.  **Run Test to Establish Baseline**:
    - Get actual measurements before making changes
    - Compare actual vs expected values
    - This identifies WHERE the extra space is coming from

3.  **Check for CSS Cascade Issues**:
    - Parent styles can affect children unexpectedly
    - Watch for: `white-space: pre-wrap`, `display: flex`, `gap`, `line-height`
    - Use browser DevTools or test to inspect computed styles

4.  **Make Targeted CSS Changes**:
    - Only after you understand the root cause
    - Use `!important` sparingly; prefer more specific selectors

5.  **Re-run Test to Verify Fix**:
    - Test MUST pass before considering the issue fixed
    - Capture screenshot for visual verification

**Why this matters**: CSS bugs often have non-obvious causes (cascade, inheritance, whitespace). Measuring first prevents wasted time on incorrect fixes.

**Reference implementation**: See `e2e/css-spacing-validation.spec.ts` for a reusable test suite with helpers for measuring gaps (`measureGaps()`) and injecting test HTML (`injectTestMessage()`).

---

### Implementation tracking

- Treat `IMPLEMENTATION_TRACKER.md` as the canonical backlog for this repo.
- Before starting any new feature, refactor, or testing effort, add or update an item in `IMPLEMENTATION_TRACKER.md` first.
- When you add new work, group it under an appropriate phase and, where helpful, under a logical feature heading (e.g. “Documentation & example bundles”, “Testing & automation”).
- Use this `AGENTS.md` primarily for operational knowledge (commands, conventions); if you add new recurring workflows or commands here, make sure any related work items also appear in `IMPLEMENTATION_TRACKER.md` so they are not lost.

---

### Tooling & package management

- Use **Node 18+** and **pnpm** (see `package.json#packageManager`).
- All internal packages use workspace ranges:
  - Prefer `workspace:*` for `@sdd-bundle-editor/*` dependencies.
  - Do **not** replace these with fixed versions.
- Per-package `tsconfig.json` files:
  - Always `extends: "../../tsconfig.base.json"`.
  - Set `rootDir: "src"` and `outDir: "dist"` in the package config.
  - We now emit declarations in core packages; keep `"declaration": true` and `"exclude": ["dist"]` when adding new TS configs.

---

### Cross-package types and imports

- `packages/core-model` is the canonical place for bundle-domain types:
  - It re-exports key types from `src/index.ts` (e.g. `Bundle`, `Diagnostic`).
  - If you need these types elsewhere, import from `@sdd-bundle-editor/core-model` **only in leaf packages** (CLI, server, etc.).
- `packages/core-lint` deliberately avoids importing `core-model` types:
  - It defines a minimal `LintBundle` shape (entities, idRegistry, refGraph) in `src/index.ts`.
  - When adding new lint rules, keep using this minimal shape instead of tightening it to `core-model` types.
- Avoid adding global `declare module '@sdd-bundle-editor/*'` shims:
  - We fixed earlier issues by exporting proper types and adjusting tsconfig, not by adding ambient declarations.

---

### Build and validate the monorepo

From the repo root:

- `pnpm build`

This:

- Builds all core packages (`core-schema`, `core-model`, `core-lint`, `core-ai`, `git-utils`, `ui-shell`).
- Builds `apps/server` and `apps/web` (webpack bundle for the UI).

If you add new packages, make sure their `build` scripts succeed under `pnpm -r build` before leaving changes.

### CRITICAL: Build on Interface Change
If you modify any `types.ts` or interface definition in a core package (e.g., `packages/core-ai/src/types.ts`, `packages/core-model/src/types.ts`), you **MUST** run `pnpm build` immediately.
- Dependent packages (like `apps/server` or `packages/ui-shell`) consume the *built* declaration files (`dist/*.d.ts`), not the source `src/`.
- Consumers will NOT see your changes (and linter will error) until you build the core package.

### CRITICAL: Always Rebuild After TypeScript Changes
**The server and other consumers import from `dist/`, NOT from `src/`.**

After modifying **ANY** TypeScript file in a core package (`packages/*`), you **MUST** rebuild before testing:

```bash
# Rebuild the specific package you modified
pnpm --filter @sdd-bundle-editor/core-model build
pnpm --filter @sdd-bundle-editor/git-utils build
# etc.

# Or rebuild everything
pnpm build
```

**Why this matters**: The dev server uses `ts-node` for `apps/server`, but it imports packages like `@sdd-bundle-editor/core-model` from their compiled `dist/` output. If you edit `packages/core-model/src/write.ts` but don't rebuild, the server still uses the OLD code from `packages/core-model/dist/write.js`.

**Symptom of forgetting**: Your code changes appear correct, tests pass, but the running server doesn't reflect your changes.

**For ui-shell development**: Use `pnpm dev:watch` instead of `pnpm dev` to automatically rebuild on changes. See "Development mode" section below.

---

### CLI validation against the sample bundle

From the repo root:

- `pnpm --filter @sdd-bundle-editor/cli build`
- `node packages/cli/dist/index.js validate --bundle-dir $SDD_SAMPLE_BUNDLE_PATH --output json`

Use the external sample bundle (default: `/home/ivan/dev/sdd-sample-bundle`) as the primary end-to-end sanity check when touching `core-model`, `core-schema`, or `core-lint`.

---

### Backend server

From the repo root:

- `pnpm --filter @sdd-bundle-editor/server build`
- `node apps/server/dist/index.js`

The server exposes:

- `GET /health` – health check endpoint for monitoring and Playwright readiness detection.
- `GET /bundle`
- `POST /bundle/validate`
- `POST /bundle/save`
- `POST /ai/generate`, `POST /ai/fix-errors` (wired to a no-op AI provider; Git discipline enforced).

Keep new routes thin and delegate logic to core packages.

---

### Development mode (server + web)

From the repo root:

```bash
pnpm dev
```

This runs the backend server, web dev server, **and** the ui-shell TypeScript compiler in watch mode using `concurrently`. Output is prefixed with `[server]`, `[web]`, and `[ui-shell]` for clarity.

**⚠️ IMPORTANT: Watch Mode is Now Default**

As of the recent update, `pnpm dev` automatically includes watch mode for `ui-shell`. This is critical because:

**How ui-shell compilation works:**
- ✅ Changes to `apps/web/src/**` → **Hot reload** (instant)
- ✅ Changes to `apps/server/src/**` → Server restarts automatically
- ✅ Changes to `packages/ui-shell/src/**` → **Auto-rebuild** (1-2 seconds)

The `ui-shell` is a **shared component library** consumed by `apps/web`:
1. `apps/web/src/index.tsx` imports: `import { AppShell } from '@sdd-bundle-editor/ui-shell'`
2. This resolves to: `packages/ui-shell/dist/index.js` (the **built** output)
3. TypeScript must compile `.tsx` → `.js` before webpack can use it
4. Watch mode automates this compilation step

**If you need to save resources** (e.g., only working on backend):
```bash
pnpm dev:simple  # No ui-shell watch, manual rebuild required
```

**Visual indicator**: Watch the `[ui-shell]` output. When you save a file:
```
[ui-shell] File change detected. Starting incremental compilation...
[ui-shell] Found 0 errors. Watching for file changes.
```

---

Alternatively, run them separately:

- **Backend only**: `pnpm exec ts-node apps/server/src/index.ts`
- **Web only**: `pnpm --filter @sdd-bundle-editor/web dev`

Notes:

- The UI shell (`packages/ui-shell`) is consumed from its **built** output (`dist`), with a simple type shim in `apps/web/src/typings.d.ts`.
- The entity editor uses **RJSF** (`@rjsf/core`) with:
  - JSON Schema–driven forms.
  - Custom widgets for `sdd-ref` fields (`SddRefWidget`).
  - The `@rjsf/validator-ajv8` validator (required for RJSF v5).
- When extending the UI:
  - Prefer adding components under `packages/ui-shell/src/components`.
  - Keep imports from `apps/web` limited to the `AppShell` API (`@sdd-bundle-editor/ui-shell`).

---

### Tests

- Tests live alongside code and can be run recursively with `pnpm -r test`, but not all packages have tests yet.
- Some packages (e.g. `core-model`, `core-lint`) already have basic Vitest tests.
- The UI shell has its own component tests:
  - `pnpm --filter @sdd-bundle-editor/ui-shell test`
- If you add tests to new packages, follow the existing pattern:
  - `*.test.ts` under `src`.
  - Make sure they run under the root `vitest.config.ts` include patterns.
- For targeted test runs during development, from the repo root:
  - `pnpm --filter @sdd-bundle-editor/core-model test`
  - `pnpm --filter @sdd-bundle-editor/core-lint test`
  - `pnpm --filter @sdd-bundle-editor/server test`
  - `pnpm --filter @sdd-bundle-editor/ui-shell test`

---

### End-to-end browser tests (Playwright)

E2e tests are defined under `e2e/` and configured in `playwright.config.ts`.

**Running e2e tests:**

```bash
pnpm test:e2e
```

Playwright will automatically:
1. Start the backend server using `ts-node` (dev mode) from the repo root.
2. Start the web dev server.
3. Wait for both to be ready (using the `/health` endpoint for the backend).
4. Run all tests and then shut down the servers.

**Manual server mode (optional):**

If you already have the server and web UI running from local development, you can skip Playwright's managed servers:

```bash
PW_SKIP_WEB_SERVER=1 pnpm test:e2e
```

**Headed mode (visual debugging):**

To watch tests run in a visible browser window:

```bash
pnpm exec playwright test --headed
```

**Capturing screenshots:**

The `e2e/screenshot-capture.spec.ts` test captures UI screenshots to `test-results/`:

```bash
pnpm exec playwright test e2e/screenshot-capture.spec.ts
```

Screenshots are saved as:
- `test-results/ui-initial.png` - Initial state with entities list
- `test-results/ui-entity-details.png` - After selecting an entity
- `test-results/ui-diagnostics.png` - After running Compile Spec

---

### AI-driven browser testing

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

**When adding UI features:**
1. Write a Playwright test in `e2e/` that exercises the feature
2. Add `await page.screenshot({ path: 'artifacts/<feature_name>.png' });` to capture screenshots
3. Run the test with `pnpm test:e2e` or `pnpm exec playwright test <test_file>`
4. View the captured screenshots using `view_file` tool to validate

**Screenshot locations:**
- `artifacts/` - Primary location for feature screenshots
- `test-results/` - Playwright's automatic test artifacts

**Do NOT:**
- Use `browser_subagent` tool (it will fail)
- Ask the user to test manually without running E2E tests first
- Skip visual verification on UI changes

---

### E2E Testing Patterns (MANDATORY)

> [!IMPORTANT]
> All E2E tests share a single backend server with persistent agent state. Follow these patterns to avoid flaky tests.

#### Agent State Management

**PATTERN 1: Reset agent state via URL param (RECOMMENDED)**

The application supports a `resetAgent=true` query parameter that triggers a hard reset of the agent backend state on load. Use this in `beforeEach` to guarantee a deterministic starting state.

```typescript
test.beforeEach(async ({ page }) => {
    const bundlePath = getSampleBundlePath();
    // This ensures the agent backend is idle and memory is cleared
    await page.goto(`/?bundleDir=${bundlePath}&debug=true&resetAgent=true`);
    
    // Now safe to click Start immediately without checking status
    await page.getByTestId('agent-start-btn').click();
});
```

**PATTERN 2: Reset agent state before each test (Alternative)**

Every test that interacts with the agent backend MUST reset state in `beforeEach` if not using `resetAgent=true`:

```typescript
test.beforeEach(async ({ page }) => {
    // Reset agent state to ensure clean state
    await page.goto('/');
    await page.evaluate(async () => {
        await fetch('/agent/abort', { method: 'POST' });
    });
});
```

**PATTERN 3: Configure agent via UI, not API**

Configure the agent via UI selectors AFTER page load, not via API calls before navigation:

```typescript
// ✅ CORRECT - Configure via UI after page load
await page.goto(`/?bundleDir=${bundlePath}&debug=true`);
await page.waitForSelector('.app-shell', { timeout: 10000 });
await page.click('[data-testid="agent-settings-btn"]');
await page.selectOption('.form-control', 'mock');
await page.click('[data-testid="agent-save-config-btn"]');

// ❌ WRONG - Pre-configuring via API often fails in full suite
await page.evaluate(async () => {
    await fetch('/agent/config', { ... });  // May be overwritten by other tests
});
await page.goto('/');
```

**Why this matters**: When tests run serially, API calls made before `page.goto()` may be affected by previous tests' lingering state or race conditions.

#### External Bundle Fixture

**MANDATORY**: Use the shared fixture from `e2e/bundle-test-fixture.ts`:

```typescript
import { createTempBundle, cleanupTempBundle, getSampleBundlePath } from './bundle-test-fixture';

// For tests that MODIFY the bundle (use temp copy)
let tempBundleDir: string;
test.beforeEach(async () => {
    tempBundleDir = await createTempBundle('sdd-test-prefix-');
});
test.afterEach(async () => {
    await cleanupTempBundle(tempBundleDir);
});

// For READ-ONLY tests (use external bundle directly)
const bundleDir = getSampleBundlePath();
```

**Environment Variable**: `SDD_SAMPLE_BUNDLE_PATH` controls the bundle location. Default: `/home/ivan/dev/sdd-sample-bundle`.

#### Mock Agent Requirements

- **Use `debug=true`** in URL for mock agent: `/?bundleDir=${path}&debug=true`
- Mock agent is only enabled in debug mode for security
- The mock agent triggers proposals when message contains "change"

#### Why Tests Run Serially

The `playwright.config.ts` sets `workers: 1` and `fullyParallel: false`. **Do NOT change this** without understanding that:
- All tests share a single server process
- Agent state is global (one conversation at a time)
- Parallel tests cause race conditions on `/agent/*` endpoints

---

### Pre-Fix Code Path Analysis (Prevent Iterative Debugging)

**Problem**: Complex bugs often span multiple layers (UI → API → Service → Data). Fixing one layer at a time leads to multiple iterations and wasted effort.

**Protocol**: Before making ANY code fix for a bug that involves data flow, **trace the ENTIRE path first**.

#### Step 1: Map the Complete Flow
For bugs involving entity creation/modification, trace these layers:

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

#### Step 2: Check Each Layer BEFORE Fixing
At each layer, verify:
- [ ] Input data format (log or inspect)
- [ ] Expected vs actual behavior
- [ ] Error handling (what happens on failure?)
- [ ] Output data format

#### Step 3: Document All Issues Found
Create a list of ALL issues before fixing ANY of them:
```markdown
## Issues Found in Entity Creation Flow
1. ChangeApplicationService: Multiple creates for same entity
2. write.ts: File path generated incorrectly
3. ChangeApplicationService: fieldPath "data" not handled
4. git-utils: New files not staged before commit
```

#### Step 4: Fix in Order (Bottom-Up or Top-Down)
Fix issues in logical order, not discovery order. Usually:
- Bottom-up: Fix data layer first, then service, then API, then UI
- This prevents "fix cascades" where fixing one layer reveals the next

#### Example: Entity Creation Flow
When debugging entity creation, check:
1. **Agent proposes changes** → What does `pendingChanges` array look like?
2. **Accept is clicked** → What goes to `/agent/accept`?
3. **Changes applied** → Does `applyChangesToBundle` succeed?
4. **Entity created** → Does `createEntity` use correct file path?
5. **File saved** → Does `saveEntity` write valid YAML?
6. **Git commit** → Does `commitChanges` stage new files?
7. **Validation** → Does reload find the new entity?
8. **UI refresh** → Does `setBundle` receive updated data?

**Time saved**: 30 minutes upfront analysis prevents 2+ hours of iterative fixes.

---

### Testing & Debugging Best Practices

**1. Explicit Context is Mandatory**
- The backend server is stateless regarding "active bundle".
- **Rule**: Every API call to `/agent/*` or `/bundle/*` MUST include `?bundleDir=...` or pass `bundleDir` in the body.
- **Why**: E2E tests run on temporary directories, not `process.cwd()`. Omitting this causes silent failures or 400 errors.

**2. E2E Debugging**
- **Unified Logs**: When debugging E2E test failures, always capture output to a file to see server logs side-by-side with test results:
  ```bash
  pnpm test:e2e e2e/target.spec.ts > debug_log.txt 2>&1
  ```
- **Workflows**: See `.agent/workflows/debug-e2e.md` for detailed instructions.
- **Console Listeners**: Ensure your test file listens to browser console logs:
  ```typescript
  page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
  ```

**3. Entity IDs in Tests**
- **Do NOT Assume IDs**: When testing against the sample bundle, verify the entity IDs first (e.g., `PROF-BASIC`, not `user`).
- **Best Practice**: Use `list_dir` or `view_file` to confirm IDs before hardcoding them in test expectations.

---

### React Development Best Practices

**CRITICAL: ESLint React Hooks Plugin**

This project uses `eslint-plugin-react-hooks` to catch common React pitfalls automatically.

**Running ESLint on React Components:**

```bash
# Lint all React components (run from repo root)
ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src --ext .tsx,.ts

# Lint a specific file
ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src/AppShell.tsx
```

**Key Rules Enabled:**

1. **`react-hooks/rules-of-hooks`** (error): Enforces the Rules of Hooks (only call hooks at top level, only in function components)
2. **`react-hooks/exhaustive-deps`** (warning): Ensures all dependencies are listed in useEffect/useCallback/useMemo arrays

**Example - This WILL trigger a warning:**

```typescript
const [selectedEntity, setSelectedEntity] = useState(null);
const [bundle, setBundle] = useState(null);

useEffect(() => {
  if (bundle && selectedEntity) {
    // ... logic using selectedEntity ...
  }
}, [bundle]); // ⚠️ WARNING: Missing dependency: 'selectedEntity'
```

**Fix:**

```typescript
useEffect(() => {
  if (bundle && selectedEntity) {
    // ... logic using selectedEntity ...
  }
}, [bundle, selectedEntity]); // ✅ All dependencies listed
```

**When to Ignore (Rare):**

Use `// eslint-disable-next-line react-hooks/exhaustive-deps` ONLY if:
- The dependency is a stable reference (e.g., `setX` from useState)
- Adding it would cause infinite loops
- You've verified it's safe to omit

**Always document WHY you're disabling the rule.**

**Before Committing React Code:**

1. Run ESLint: `ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src --ext .tsx,.ts`
2. Fix all errors
3. Review all warnings carefully
4. Rebuild if you modified ui-shell: `pnpm --filter @sdd-bundle-editor/ui-shell build`

**Debugging React State Issues:**

Common symptoms:
- UI doesn't update after state change
- Stale data displayed
- Changes work on refresh but not on first render

**Use the systematic debugging workflow**: See `.agent/workflows/debug-react-state.md` for a complete step-by-step checklist.

Quick checklist:
1. ✅ Check React DevTools for state updates
2. ✅ Run ESLint with react-hooks plugin enabled
3. ✅ Verify useEffect dependencies match the rule warning
4. ✅ Add console.log at state update point
5. ✅ Check if component is re-rendering (add console.log in render)
6. ✅ Verify data is actually changing (deep comparison)

**Development Logging:**

This project uses a structured logger (`packages/ui-shell/src/utils/logger.ts`) instead of raw `console.log`.

**Creating a logger**:
```typescript
import { createLogger } from './utils/logger';
const log = createLogger('MyComponent');

// Use appropriate log levels
log.debug('Detailed state:', { bundle, entity });  // Verbose debugging
log.info('User action completed', { action });     // Significant events
log.warn('Unusual condition', { state });          // Potential issues
log.error('Operation failed', error);              // Actual errors
```

**Log levels** (in order of severity):
- `debug` - Detailed debugging info (state changes, function calls)
- `info` - Significant events (user actions, data updates)
- `warn` - Unexpected but handled situations
- `error` - Actual errors that need attention

**Runtime control** (in browser console):
```javascript
// Show all logs including debug
localStorage.setItem('sdd:logLevel', 'debug');

// Only important messages (default)
localStorage.setItem('sdd:logLevel', 'info');

// Only warnings and errors
localStorage.setItem('sdd:logLevel', 'warn');

// Disable all logs
localStorage.setItem('sdd:logLevel', 'off');

// Filter by component
localStorage.setItem('sdd:logFilter', 'AppShell');

// View current config
loggerConfig();
```

**Benefits over console.log**:
- ✅ Filterable by level and component
- ✅ Automatically disabled in production
- ✅ Consistent formatting with timestamps
- ✅ Easy to toggle at runtime without code changes
- ✅ Works with browser DevTools filtering

---

### Session Handover / Handoff Protocol

When the user says "session handover", you must perform two distinct actions:

1.  **Generate the Handover Summary**: Use the template below to provide high-signal context for the next agent. **IMPORTANT**: Output this as a single Markdown code block in your final chat message. Do **NOT** create a `session_handover.md` file.
2.  **Conduct a Retrospective**: Reflect on the session and propose improvements.
    *   Draft these proposals as a numbered list **after** the code block.
    *   **DO NOT implement them yet**. Wait for user approval.

#### Handoff Template

```markdown
# Session Handoff

## 1. Core Context
- **Project**: SDD Bundle Editor (Monorepo: React UI, Fastify Backend, TypeScript Core)
- **Goal**: [Current high-level goal, e.g. "Polishing Agent Panel UI"]
- **Repository State**: `[Clean/Dirty]` (Branch: `[main/feature]`)
- **Context Source**: Read @[AGENTS.md] for protocols and `IMPLEMENTATION_TRACKER.md` for backlog.

## 2. Recent Changes (This Session)
- **Implemented**:
  - [Feature A]: [Brief description]
  - [Feature B]: [Brief description]
- **Fixed**:
  - [Bug X]: [Description]
- **Verified**:
  - [Test Suite]: `pnpm test` [Pass/Fail]
  - [E2E Tests]: `pnpm test:e2e` [Pass/Fail]
  - [Visuals]: Screenshots in `artifacts/` [Check/Skip]

## 3. Current State & Pending Scope
- **Active Task**: [What was in progress?]
- **Pending / Next Up**:
  - [Task 1]
  - [Task 2]
- **Known Issues**:
  - [Issue Description]

## 4. Operational Notes (For Next Agent)
- **Environment**: Node 18+, pnpm, Linux.
- **Gotchas**:
  - [e.g. "Do not use browser_subagent"]
  - [e.g. "AppShell requires fixed height"]
- **Testing Contextual Actions**:
  - **Regex Locators**: When verifying AI messages or multi-line text, ALWAYS use regex locators (e.g. `getByText(/Fix the following issues/)`) instead of strict string matching. This handles whitespace variations and avoids brittle tests.
  - **Test IDs**: Use the standard `data-testid` attributes (e.g. `chat-message-user-0`) for selecting specific elements.
  - **Timing**: Optimistic updates in React state can sometimes race with DOM assertions. Ensure you wait for specific element visibility before asserting content.
- **Wasted Time / Lessons**:
  - [e.g. "Spent time debugging X, solution was Y"]

## 5. Immediate Action Items
1. [First file to check]
```

#### Retrospective & Process Improvements (Proposals)

After generating the code block above, strictly outside of it, you must conduct a retrospective. Reflect on the session and propose improvements to workflows, documentation, or code.

*Format:*
*In this session, I noticed [X] caused friction. I propose:*
1.  **[Improvement Name]**: [Description]
2.  **[Improvement Name]**: [Description]

