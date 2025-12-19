# Project Structure & Architecture

## Monorepo Overview

This is a pnpm-based TypeScript monorepo. The structure:

```
sdd-bundle-editor/
├── apps/
│   └── web/                 # React UI (consumes ui-shell)
├── packages/
│   ├── core-model/          # Bundle loading, entity types
│   ├── core-schema/         # JSON Schema validation
│   ├── core-lint/           # Linting rules
│   ├── core-ai/             # AI agent backends
│   ├── git-utils/           # Git operations
│   ├── ui-shell/            # Shared React components
│   ├── mcp-server/          # MCP server (stdio + HTTP)
│   ├── cli/                 # Command-line interface
│   └── shared-types/        # Shared TypeScript types
└── e2e/                     # Playwright E2E tests
```

---

## Tooling & Package Management

- Use **Node 18+** and **pnpm** (see `package.json#packageManager`)
- All internal packages use workspace ranges:
  - Prefer `workspace:*` for `@sdd-bundle-editor/*` dependencies
  - Do **not** replace these with fixed versions
- Per-package `tsconfig.json` files:
  - Always `extends: "../../tsconfig.base.json"`
  - Set `rootDir: "src"` and `outDir: "dist"` in the package config
  - We emit declarations in core packages; keep `"declaration": true` and `"exclude": ["dist"]`

---

## Cross-Package Types and Imports

- `packages/core-model` is the canonical place for bundle-domain types:
  - It re-exports key types from `src/index.ts` (e.g. `Bundle`, `Diagnostic`)
  - If you need these types elsewhere, import from `@sdd-bundle-editor/core-model` **only in leaf packages** (CLI, server, etc.)
- `packages/core-lint` deliberately avoids importing `core-model` types:
  - It defines a minimal `LintBundle` shape (entities, idRegistry, refGraph) in `src/index.ts`
  - When adding new lint rules, keep using this minimal shape instead of tightening it to `core-model` types
- Avoid adding global `declare module '@sdd-bundle-editor/*'` shims:
  - We fixed earlier issues by exporting proper types and adjusting tsconfig, not by adding ambient declarations

---

## Build and Validate

From the repo root:

```bash
pnpm build
```

This builds all core packages and apps in dependency order.

If you add new packages, make sure their `build` scripts succeed under `pnpm -r build` before leaving changes.

### CRITICAL: Build on Interface Change

If you modify any `types.ts` or interface definition in a core package:

```bash
# You MUST run this immediately
pnpm build
```

- Dependent packages consume the *built* declaration files (`dist/*.d.ts`), not the source `src/`
- Consumers will NOT see your changes (and linter will error) until you build the core package

### CRITICAL: Always Rebuild After TypeScript Changes

**The MCP server and other consumers import from `dist/`, NOT from `src/`.**

After modifying **ANY** TypeScript file in a core package (`packages/*`):

```bash
# Rebuild the specific package
pnpm --filter @sdd-bundle-editor/core-model build

# Or rebuild everything
pnpm build
```

**Symptom of forgetting**: Your code changes appear correct, tests pass, but the running server doesn't reflect your changes.

---

## Development Mode

From the repo root:

```bash
pnpm dev  # MCP server + web + ui-shell watch
```

This runs:
- MCP server (port 3001)
- Web dev server (port 5173)
- ui-shell TypeScript compiler in watch mode

**How the pieces work together:**
- ✅ Changes to `apps/web/src/**` → **Hot reload** (instant)
- ✅ Changes to `packages/ui-shell/src/**` → **Auto-rebuild** (1-2 seconds)
- ⚠️ Changes to `packages/mcp-server/src/**` → Requires restart

Alternatively, run components separately:
- **MCP Server only**: `pnpm --filter @sdd-bundle-editor/mcp-server start:http`
- **Web only**: `pnpm --filter @sdd-bundle-editor/web dev`

---

## UI Shell Architecture

The `ui-shell` is a **shared component library** consumed by `apps/web`:

1. `apps/web/src/index.tsx` imports: `import { AppShell } from '@sdd-bundle-editor/ui-shell'`
2. This resolves to: `packages/ui-shell/dist/index.js` (the **built** output)
3. TypeScript must compile `.tsx` → `.js` before webpack can use it

When extending the UI:
- Prefer adding components under `packages/ui-shell/src/components`
- Keep imports from `apps/web` limited to the `AppShell` API

The entity editor uses **RJSF** (`@rjsf/core`) with:
- JSON Schema–driven forms
- Custom widgets for `sdd-ref` fields (`SddRefWidget`)
- The `@rjsf/validator-ajv8` validator (required for RJSF v5)

---

## CLI Validation

From the repo root:

```bash
pnpm --filter @sdd-bundle-editor/cli build
node packages/cli/dist/index.js validate --bundle-dir $SDD_SAMPLE_BUNDLE_PATH --output json
```

Use the external sample bundle (default: `/home/ivan/dev/sdd-sample-bundle`) as the primary end-to-end sanity check when touching `core-model`, `core-schema`, or `core-lint`.

**Accessing the external sample bundle:**
- The sample bundle is **outside the workspace**, so `view_file` and `list_dir` will fail with workspace access errors
- **Use shell commands instead**:
  ```bash
  cat /home/ivan/dev/sdd-sample-bundle/sdd-bundle.yaml
  ls -la /home/ivan/dev/sdd-sample-bundle/schemas
  ```

---

## Implementation Tracking

- Treat `IMPLEMENTATION_TRACKER.md` as the canonical backlog for this repo
- Before starting any new feature, refactor, or testing effort, add or update an item in `IMPLEMENTATION_TRACKER.md` first
- When you add new work, group it under an appropriate phase and logical feature heading
