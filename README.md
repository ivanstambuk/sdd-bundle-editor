# SDD Bundle Editor (MVP Skeleton)

This repo contains a TypeScript monorepo for an **SDD (Spec‑Driven Development) Bundle Editor**, implemented according to `sdd-bundle-editor-spec.md`.

It is an MVP skeleton that already supports:

- Loading and validating SDD bundles against JSON Schemas.
- Linting with a small rule engine (regex / has-link / coverage).
- Building an ID registry and reference graph across entities.
- A CLI (`sdd-bundle`) with `validate`, `report-coverage`, and stubbed `generate`.
- A Fastify-based backend exposing bundle and AI endpoints.
- A React-based UI shell with:
  - Entity navigator.
  - Schema-driven forms (RJSF) with custom widgets for `sdd-ref` fields.
  - Reference viewer (incoming / outgoing).
  - Diagnostics panel with grouping and filters.
  - AI refinement stub panel with diff/apply controls.

> For the full design, see `sdd-bundle-editor-spec.md`.

---

## Monorepo layout

- `packages/core-schema` – JSON Schema loading/compilation and validation (Ajv, custom `sdd-ref` format).
- `packages/core-model` – bundle manifest/entity loading, ID registry, reference graph, validation pipeline.
- `packages/core-lint` – lint engine (`regex`, `has-link`, `coverage`) on top of the core model.
- `packages/core-ai` – AI provider abstraction and stub `generate/refine/fix` flows.
- `packages/git-utils` – shared Git helpers (repo detection, branch, clean working tree).
- `packages/ui-shell` – React UI components and app shell (used by `apps/web`).
- `packages/cli` – `sdd-bundle` CLI wrapping the core model/lint (plus stub AI).
- `apps/server` – Fastify HTTP API around the core (bundle, validation, AI routes).
- `apps/web` – React SPA that talks to `apps/server`.

**Bundle Repositories** (external):
- SDD bundles are now maintained in separate repositories to decouple content from the editor.
- Example: `/home/ivan/dev/sdd-sample-bundle` (or set via `SDD_SAMPLE_BUNDLE_PATH` environment variable).

---

## Getting started

### Prerequisites

- Node.js 18+.
- `pnpm` (recommended; see `package.json#packageManager`).
- Git (required for AI flows, which enforce Git discipline).

### Install dependencies

```bash
pnpm install
```

### Build and test

From the repo root:

```bash
pnpm build
pnpm test
```

This runs `tsc` and `vitest` across all workspaces.

---

## External Bundle Setup

SDD bundles are maintained in separate repositories. The sample bundle is at `/home/ivan/dev/sdd-sample-bundle`:

- `sdd-bundle.yaml` – manifest.
- `schemas/*.schema.json` – document schemas for `Feature`, `Requirement`, `Task`, etc.
- `bundle/features/FEAT-001.yaml` – a single feature.
- `bundle/requirements/REQ-001.yaml` – a requirement linked to the feature.
- `bundle/tasks/TASK-001.yaml` – a task linked to the requirement and feature.
- `config/sdd-lint.yaml` – lint rules (title capitalization, has‑link coverage).

**Configuration**: Set the `SDD_SAMPLE_BUNDLE_PATH` environment variable to point to your bundle location, or pass `bundleDir` parameter to CLI/UI.

---

## CLI usage

The CLI is defined in `packages/cli` and exposed as `sdd-bundle`.

From the repo root (after `pnpm install`):

```bash
pnpm --filter @sdd-bundle-editor/cli build
node packages/cli/dist/index.js validate --bundle-dir /home/ivan/dev/sdd-sample-bundle --output json
```

Or, if you wire it into `pnpm` bins:

```bash
sdd-bundle validate --bundle-dir $SDD_SAMPLE_BUNDLE_PATH --output json
```

### Commands

- `sdd-bundle validate [--bundle-dir DIR] [--output json|text]`
  - Loads the bundle.
  - Runs schema + lint + gate checks.
  - Exit code 0 on success, 1 on any `error` severity diagnostic.
- `sdd-bundle report-coverage [--bundle-dir DIR] [--output json|text]`
  - Uses bundle‑type `relations` + ref graph to report coverage metrics.
- `sdd-bundle generate [...]`
  - Stubbed AI entrypoint using the no‑op provider (no writes yet).

---

## Backend server

Run the Fastify server:

```bash
pnpm --filter @sdd-bundle-editor/server build
node apps/server/dist/index.js
```

Key endpoints (default base URL: `http://localhost:3000`):

- `GET /bundle` – returns `{ bundle, diagnostics }` snapshot.
- `GET /agent/status` – current conversation state and git status.
- `POST /agent/start` – initialize conversation (requires clean git state).
- `POST /agent/message` – send message to agent.
- `POST /agent/accept` – apply proposed changes, lint, and commit.
- `POST /agent/rollback` – revert uncommitted changes from the current session.

> **Git Discipline**: The server enforces a strict "Clean Working Tree" policy. You cannot start an agent conversation if there are uncommitted changes.

---

## Development Workflow

### Running the Full Stack

From the repo root, run:

```bash
pnpm dev
```

This starts **three concurrent processes**:
- **[server]** (blue) – Backend API server
- **[web]** (green) – Webpack dev server for the UI
- **[ui-shell]** (yellow) – TypeScript compiler in watch mode

**Why watch mode by default?**
The `packages/ui-shell` is consumed as a **compiled library**. When AI agents (or you) edit React components, those changes must be compiled from `src/` to `dist/` before the browser can use them. Watch mode ensures this happens automatically.

**Alternative (lighter weight, no auto-compile):**
```bash
pnpm dev:simple
```

Use this if you're only working on the backend and want to save CPU resources. If you make changes to `ui-shell`, you'll need to manually rebuild:
```bash
pnpm --filter @sdd-bundle-editor/ui-shell build
```

### Agent-First Workflow

The editor is designed to be a **Read-Only Viewer** by default. You cannot directly edit fields in the forms. Instead, you interact with an AI Agent to modify the bundle.

1.  **View & Navigate**: Browse entities, references, and diagnostics in read-only mode.
2.  **Open Agent**: Press **`Ctrl+J`** or click the **"Edit via Agent"** button.
3.  **Chat**: Describe your intent (e.g., "Add a requirement for login").
4.  **Review**: The agent proposes changes. Review the diffs.
5.  **Accept**: Click "Apply Changes". The agent applies edits, runs linter, and **automatically commits** if successful.

### Features

- **Read-only mode UI prevents accidental schema edits when working with the AI agent.
- **Contextual Actions**: "Fix with Agent" buttons on diagnostic errors.
- **Error Recovery**: Network handling and "Discard Changes" (rollback) capability.
- **Diagnostics**: Real-time validation and linting feedback.

---

## Keyboard Shortcuts

### Global Shortcuts
- **`Ctrl+J` / `Cmd+J`** - Toggle Agent Panel (AI chat interface)
- **`Ctrl+B` / `Cmd+B`** - Toggle Sidebar (entity navigator)
- **`Ctrl+P` / `Cmd+P`** - Quick Search (entity finder)

### UI Features
- **Resizable Sidebar** - Drag right edge to resize (200-500px range)
- **Collapsible Groups** - Click entity type headers to expand/collapse
- **Breadcrumb Navigation** - Shows current location: Bundle > EntityType > EntityID

---

## Status and next work

The project has transitioned to the **Agent-First** architecture (Phase 8).

**Completed:**
- ✅ Core Agent Protocol (Start/Message/Accept/Abort).
- ✅ Change Application Service with automatic Git commits.
- ✅ Read-Only UI with `Ctrl+J` agent panel toggle.
- ✅ Error Recovery and Rollback (`/agent/rollback`).

**In Progress / Planned:**
- Real AI Provider integration (currently using a stub/mock).
- Enhanced standard library of bundle types.
- VS Code extension integration.

Use `IMPLEMENTATION_TRACKER.md` to track and coordinate further work.

