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

- `GET /health` – Health check for Playwright and monitoring
- `GET /bundle` – Load bundle with entities, schemas, reference graph, diagnostics

> **Read-Only**: The HTTP server is now read-only. All write operations are handled via MCP.

---

## MCP Server (AI Integration)

The project uses an **MCP-first architecture** where all bundle modifications are done via the MCP Server, accessible to AI assistants like GitHub Copilot and Claude Desktop.

### Quick Start

```bash
# Build and test with MCP Inspector
pnpm build
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js /path/to/bundle

# Or run in HTTP mode for web clients
node packages/mcp-server/dist/index.js --http --port 3001 /path/to/bundle
```

### Available Tools

| Tool | Description |
|------|-------------|
| `list_bundles` | List all loaded bundles |
| `read_entity` | Read a specific entity by type and ID |
| `list_entities` | List all entity IDs |
| `get_context` | Get entity with all related dependencies |
| `search_entities` | Search across all bundles |
| `validate_bundle` | Validate and return diagnostics |
| `apply_changes` | **Atomic batch changes** (create/update/delete with validation) |

### Configuration

**VS Code + GitHub Copilot** - Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "sdd-bundle": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/home/ivan/dev/sdd-bundle-editor/packages/mcp-server/dist/index.js",
        "/path/to/your/bundle"
      ]
    }
  }
}
```

Then in Copilot Chat (Agent Mode), use `#apply_changes`, `#read_entity`, etc.

**Claude Desktop** - Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sdd-bundle": {
      "command": "node",
      "args": [
        "/home/ivan/dev/sdd-bundle-editor/packages/mcp-server/dist/index.js",
        "/path/to/your/bundle"
      ]
    }
  }
}
```

See [`packages/mcp-server/README.md`](packages/mcp-server/README.md) for full documentation.

---

## Development Workflow

### Running the Full Stack

From the repo root, run:

```bash
pnpm dev
```

This starts **three concurrent processes**:
- **[server]** (blue) – Backend API server (read-only)
- **[web]** (green) – Webpack dev server for the UI
- **[ui-shell]** (yellow) – TypeScript compiler in watch mode

**Why watch mode by default?**
The `packages/ui-shell` is consumed as a **compiled library**. When you edit React components, those changes must be compiled from `src/` to `dist/` before the browser can use them. Watch mode ensures this happens automatically.

**Alternative (lighter weight, no auto-compile):**
```bash
pnpm dev:simple
```

### Read-Only UI

The UI is a **read-only viewer** for browsing and inspecting bundles:

1. **Navigate**: Browse entities by type in the sidebar
2. **View Details**: See entity data, references, and diagnostics
3. **Validate**: Click "Compile Spec" to run validation

To **modify** bundles, use MCP tools via Claude Desktop, GitHub Copilot, or curl to the HTTP endpoint.

### Keyboard Shortcuts

- **`Ctrl+B` / `Cmd+B`** - Toggle Sidebar
- **`Ctrl+P` / `Cmd+P`** - Quick Search


---

---

## UI Features

- **Resizable Sidebar** - Drag right edge to resize (200-500px range)
- **Collapsible Groups** - Click entity type headers to expand/collapse
- **Breadcrumb Navigation** - Shows current location: Bundle > EntityType > EntityID

---

## Status

The project has transitioned to the **MCP-First Architecture**.

**Completed:**
- ✅ Read-Only UI for bundle browsing and viewing
- ✅ MCP Server with stdio and HTTP transports
- ✅ `apply_changes` tool for atomic batch modifications
- ✅ Multi-bundle support
- ✅ Schema-driven validation and linting
- ✅ **UI uses MCP protocol directly** (Phase 4.4)

**Architecture:**

```
┌──────────┐     MCP Protocol      ┌────────────┐
│  Web UI  │ ────────────────────▶ │ MCP Server │
│ (React)  │ ◀──────────────────── │ (port 3001)│
└──────────┘    HTTP POST + SSE    └────────────┘
      │                                   │
      │ (fallback if MCP fails)           │
      ▼                                   ▼
┌──────────┐                       ┌────────────┐
│  Legacy  │                       │  Bundle    │
│  Server  │                       │  Files     │
│(port 3000)│                      └────────────┘
└──────────┘
```

- UI loads data via MCP tools (`list_bundles`, `read_entity`, etc.)
- Falls back to legacy HTTP server if MCP unavailable
- Header shows `🔗 MCP` or `📡 HTTP` status
- Users manage Git commits externally

**URL Parameters:**
- `?mcpUrl=<url>` - Override MCP server URL
- `?useMcp=false` - Force legacy HTTP mode

Use `IMPLEMENTATION_TRACKER.md` to track and coordinate further work.


