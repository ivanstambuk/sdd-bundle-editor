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
- `examples/basic-bundle` – minimal SDD bundle used for end‑to‑end tests.

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

## Example bundle

The repo includes a small example bundle in `examples/basic-bundle`:

- `sdd-bundle.yaml` – manifest.
- `schemas/*.schema.json` – document schemas for `Feature`, `Requirement`, `Task`.
- `bundle/features/FEAT-001.yaml` – a single feature.
- `bundle/requirements/REQ-001.yaml` – a requirement linked to the feature.
- `bundle/tasks/TASK-001.yaml` – a task linked to the requirement and feature.
- `config/sdd-lint.yaml` – lint rules (title capitalization, has‑link coverage).

You can use this bundle to exercise the CLI and UI end‑to‑end.

---

## CLI usage

The CLI is defined in `packages/cli` and exposed as `sdd-bundle`.

From the repo root (after `pnpm install`):

```bash
pnpm --filter @sdd-bundle-editor/cli build
node packages/cli/dist/index.js validate --bundle-dir examples/basic-bundle --output json
```

Or, if you wire it into `pnpm` bins:

```bash
sdd-bundle validate --bundle-dir examples/basic-bundle --output json
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

- `GET /bundle` – returns `{ bundle, diagnostics }` snapshot for the current `sdd-bundle.yaml` directory.
- `POST /bundle/validate` – returns `{ diagnostics }`.
- `POST /bundle/save` – runs validation and, if clean, returns `{ saved: true, diagnostics, bundle }`.
- `POST /ai/generate` / `POST /ai/fix-errors` – stub AI routes calling the no‑op provider.

> AI routes enforce Git discipline: they require a Git repo, non‑protected branch (not `main`/`master`), and a clean working tree.

---

## Web UI

The web app lives in `apps/web` and consumes the server’s HTTP API.

To run in development:

```bash
cd apps/web
pnpm dev
```

This starts a webpack dev server (default `http://localhost:5173`) with a dev proxy to the backend (`http://localhost:3000`).

The UI currently supports:

- Loading a bundle via `/bundle`.
- Navigating entities by type.
- Viewing entities in schema‑driven forms (read‑only).
- Inspecting incoming/outgoing references.
- Viewing diagnostics with severity/entity‑type filters.
- Clicking “Compile Spec” to re‑run validation via `/bundle/validate`.
- Running a stub “AI Generate” flow and seeing diffs/notes (no real changes without a provider).

---

## Status and next work

The MVP skeleton is functionally wired end‑to‑end but still needs:

- Real AI provider integration in `core-ai` and corresponding workflows.
- Additional lint rules and bundle types as the SDD ecosystem grows.
- Richer example bundles:
  - SDD requirements bundles at scale.
  - Protocol spec bundles (e.g. EC‑OPRF/FHE‑style).
  - Feature‑based project bundles (e.g. Feature 006‑like).
- Persistence of edits from the UI back to YAML.

Use `IMPLEMENTATION_TRACKER.md` to track and coordinate further work. The tracker mirrors the spec’s phases and is up‑to‑date with the current implementation.

