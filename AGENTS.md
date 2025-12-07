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

---

### CLI validation against the sample bundle

From the repo root:

- `pnpm --filter @sdd-bundle-editor/cli build`
- `node packages/cli/dist/index.js validate --bundle-dir examples/basic-bundle --output json`

Use `examples/basic-bundle` as the primary end-to-end sanity check when touching `core-model`, `core-schema`, or `core-lint`.

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

This runs both the backend server and web dev server concurrently using `concurrently`. Output is prefixed with `[server]` and `[web]` for clarity.

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
- **Do NOT Assume IDs**: When testing against `examples/basic-bundle`, verify the entity IDs first (e.g., `PROF-BASIC`, not `user`).
- **Best Practice**: Use `list_dir` or `view_file` to confirm IDs before hardcoding them in test expectations.

---

### Session Handover / Handoff Protocol

When the user says "session handover", you must perform two distinct actions:

1.  **Generate the Handover Summary**: Use the template below to provide high-signal context for the next agent.
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
- **Wasted Time / Lessons**:
  - [e.g. "Spent time debugging X, solution was Y"]

## 5. Immediate Action Items
1. [First command to run]
2. [First file to check]
```

#### Retrospective & Process Improvements (Proposals)

After generating the code block above, strictly outside of it, you must conduct a retrospective. Reflect on the session and propose improvements to workflows, documentation, or code.

*Format:*
*In this session, I noticed [X] caused friction. I propose:*
1.  **[Improvement Name]**: [Description]
2.  **[Improvement Name]**: [Description]

