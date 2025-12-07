## Notes for AI agents working in this repo

This is a pnpm-based TypeScript monorepo that follows `sdd-bundle-editor-spec.md`.  
Please keep the structure and internal dependencies consistent with what is already in place.

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

### AI-driven browser testing (browser_subagent)

For visual design review and exploratory testing, AI agents can use the `browser_subagent` tool. See `.agent/workflows/browser-testing.md` for detailed instructions.

This is useful for:
- Taking screenshots for design review.
- Verifying UI renders correctly.
- Exploratory testing beyond scripted Playwright tests.

**Note:** This requires manually starting servers first – see the workflow file for details.

