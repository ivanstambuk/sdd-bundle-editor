# SDD Bundle Editor – Architecture & Design

This document captures the foundational architecture, domain concepts, and key design decisions for the SDD Bundle Editor. It serves as a reference for contributors and AI agents working in the codebase.

---

## Overview

The SDD Bundle Editor is a **Schema-Driven Development** tool that manages bundles of related entities (features, requirements, tasks, etc.) defined in YAML files and validated against JSON Schemas. The system supports validation, linting, reference tracking, and AI-assisted editing.

---

## Core Concepts

### Bundle
A **bundle** is a collection of related entities defined by a `sdd-bundle.yaml` manifest. The manifest declares:
- Bundle type (references a JSON definition file)
- Schema locations for each entity type
- Entity directories to scan for YAML files
- Optional lint configuration

### Entity
An **entity** is a single YAML file representing a domain object (e.g., a Feature, Requirement, or Task). Each entity has:
- `entityType`: The schema type (e.g., "Feature", "Requirement")
- `id`: Unique identifier within its type
- `data`: The parsed YAML content validated against its schema

### Reference Graph (RefGraph)
The **RefGraph** tracks relationships between entities via `sdd-ref` formatted references. It contains:
- `edges`: Array of `{fromEntityType, fromId, fromField, toEntityType, toId}`
- Enables navigation between related entities (incoming/outgoing references)

### ID Registry
The **IdRegistry** maps entity IDs to their types, ensuring uniqueness and enabling reference resolution.

### Diagnostics
**Diagnostics** are structured validation/lint results with:
- `severity`: "error" | "warning"
- `code`: Rule identifier (e.g., "schema-validation", "no-broken-ref", "ref-type-mismatch")
- `message`: Human-readable description
- `entityType`, `entityId`, `path`: Location information

### Domain Knowledge
Each bundle can optionally include a **domain knowledge Markdown file** (`spec.domainKnowledge.path` in manifest). This file:
- Contains human-readable background/context for the bundle
- Is loaded automatically and stored in `bundle.domainMarkdown`
- Will be passed to AI for context in generation/refinement flows

### x-refTargets Validation
The system validates that `sdd-ref` fields only reference allowed entity types:
- Schemas can specify `x-refTargets: ["Feature", "Requirement"]` on ref fields
- During validation, actual referenced entity types are checked against allowed targets
- Mismatches produce a `ref-type-mismatch` diagnostic

---

## Package Architecture

```
sdd-bundle-editor/
├── packages/
│   ├── core-schema     # JSON Schema loading & validation (Ajv, Draft 2020-12)
│   ├── core-model      # Bundle loading, parsing, ID registry, RefGraph
│   ├── core-lint       # Lint rules, gate semantics, diagnostics
│   ├── core-ai         # AI provider abstraction (no-op, http, cli)
│   ├── ui-shell        # React components (EntityNavigator, EntityDetails, etc.)
│   ├── cli             # Command-line interface (validate, report-coverage)
│   └── git-utils       # Git operations (branch checks, clean working tree)
├── apps/
│   ├── server          # Fastify HTTP API server
│   └── web             # Webpack-bundled React app
├── examples/
│   └── basic-bundle/   # Sample bundle for testing
└── e2e/                # Playwright end-to-end tests
```

### Package Dependencies (Simplified)
```
core-schema ─┐
             ├─> core-model ─┬─> core-lint
             │               ├─> core-ai
             │               ├─> cli
             │               └─> server
ui-shell ────────────────────────> web
git-utils ───────────────────────> server
```

---

## Key Design Decisions

### 1. Schema-Driven Forms (RJSF)
The UI uses **React JSON Schema Form** (`@rjsf/core`) to render entity editors automatically from JSON Schemas. Custom widgets handle `sdd-ref` fields.

**Key requirement**: RJSF v5 requires an explicit validator (`@rjsf/validator-ajv8`).

### 2. Reference Format (`sdd-ref`)
References between entities use the format: `EntityType:EntityId` (e.g., `Requirement:REQ-001`).

The `sdd-ref` custom format is registered with Ajv for schema validation.

### 3. Minimal Lint Interface
`core-lint` deliberately avoids importing `core-model` types. It defines a minimal `LintBundle` shape to keep the lint engine decoupled and testable.

### 4. MCP-First Architecture
Bundle modifications are done exclusively via the MCP Server:
- **No HTTP write endpoints** – Server is read-only
- **MCP `apply_changes` tool** – Atomic batch operations with validation
- **External Git management** – Users commit changes manually
- **Dual transport** – Stdio for Claude/Copilot, HTTP for web clients

This ensures AI operations are validated and users maintain full Git control.


### 5. Health Endpoint for Playwright
The server exposes `GET /health` specifically for Playwright's `webServer` configuration to detect when the server is ready.

### 6. Development Server Command
`pnpm dev` runs both backend and frontend concurrently using `concurrently`. Output is prefixed with `[server]` and `[web]`.

---

## API Endpoints

### HTTP Server (Read-Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check for readiness detection |
| `/bundle` | GET | Load bundle snapshot (manifest, entities, diagnostics, schemas, refGraph) |

### MCP Server (Write Operations)

All bundle modifications happen via MCP tools:

| Tool | Description |
|------|-------------|
| `list_bundles` | List all loaded bundles |
| `read_entity` | Read entity by type and ID |
| `list_entities` | List all entity IDs |
| `search_entities` | Search across bundles |
| `validate_bundle` | Validate and return diagnostics |
| `get_context` | Get entity with related dependencies |
| `apply_changes` | Atomic batch create/update/delete |


---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo + Title + Actions (Compile Spec)              │
├──────────────┬──────────────────────────────────────────────┤
│  Sidebar     │  Main Content                                 │
│  - Filters   │  - Entity Details (read-only RJSF form)      │
│  - Entity    │  - Outgoing/Incoming References               │
│    Navigator │  - Domain Knowledge                           │
│              │                                               │
├──────────────┴──────────────────────────────────────────────┤
│  Bottom Panel: Diagnostics + Read-Only Banner               │
└─────────────────────────────────────────────────────────────┘
```


### Entity Navigator
- Entities grouped by type
- Color-coded dots (purple=Feature, cyan=Requirement, orange=Task)
- Click to select and view details

### Entity Details
- Type badge + ID header
- Schema-driven form (read-only in current design)
- Clickable reference links for navigation

### Diagnostics Panel
- Grouped by entity type
- Severity badges (error=red, warning=yellow)
- Filter by severity and entity type

---

## Testing Strategy

### Unit Tests (Vitest)
- `core-model`, `core-lint`: Logic tests
- `ui-shell`: Component tests with React Testing Library

### End-to-End Tests (Playwright)
Located in `e2e/`, configured in `playwright.config.ts`.

**Key tests:**
- Load bundle and verify entity listing
- Select entity and verify details + references
- Run Compile Spec and verify diagnostics

**Screenshot capture:**
- `e2e/screenshot-capture.spec.ts` saves UI screenshots to `test-results/`

---

## CSS Design System

The UI uses a **dark theme** with CSS custom properties defined in `apps/web/src/styles.css`:

### Color Tokens
- `--color-bg-primary`: #0f172a (dark blue-gray)
- `--color-accent`: #3b82f6 (blue)
- `--color-feature`: #8b5cf6 (purple)
- `--color-requirement`: #06b6d4 (cyan)
- `--color-task`: #f97316 (orange)

### Typography
- Font: Inter (Google Fonts)
- Monospace: SF Mono / Fira Code (for IDs and code)

---

## Current Architecture: MCP-First

The editor now follows an **MCP-first architecture** where the UI is a read-only viewer and all modifications happen via MCP tools:

1. User browses entities and diagnostics in read-only UI
2. AI (Claude/Copilot) uses MCP tools to propose/apply changes
3. Changes validated atomically via `apply_changes`
4. User manages Git commits externally

This provides complete validation before writes while giving users full Git control.

