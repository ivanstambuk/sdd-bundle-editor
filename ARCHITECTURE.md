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

### 4. Git Discipline for AI Operations
AI-driven modifications require:
- Clean working tree (no uncommitted changes)
- Non-protected branch (not `main`)
- Automatic commit after successful changes

This ensures AI operations are always reviewable and reversible.

### 5. Health Endpoint for Playwright
The server exposes `GET /health` specifically for Playwright's `webServer` configuration to detect when the server is ready.

### 6. Development Server Command
`pnpm dev` runs both backend and frontend concurrently using `concurrently`. Output is prefixed with `[server]` and `[web]`.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check for readiness detection |
| `/bundle` | GET | Load bundle snapshot (manifest, entities, diagnostics, schemas, refGraph) |
| `/bundle/validate` | POST | Run validation and return diagnostics |
| `/bundle/save` | POST | Validate and persist changes (stub for now) |
| `/ai/generate` | POST | AI-driven bundle generation (requires non-main branch) |
| `/ai/fix-errors` | POST | AI-driven error fixing (requires non-main branch) |

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo + Title + Actions (Compile Spec, AI Generate) │
├──────────────┬──────────────────────────────────────────────┤
│  Sidebar     │  Main Content                                 │
│  - Filters   │  - Entity Details (RJSF form)                │
│  - Entity    │  - Outgoing/Incoming References               │
│    Navigator │  - AI Panels (when active)                    │
│              │                                               │
├──────────────┴──────────────────────────────────────────────┤
│  Bottom Panel: Diagnostics                                   │
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

## Future Direction: Agent-First Editing

The planned evolution (Phase 8) shifts the editor to a **read-only viewer** where all modifications happen through conversational AI:

1. User describes intent in natural language
2. Agent proposes structured changes
3. User reviews and accepts/rejects
4. Changes are applied, linted, and auto-committed

This maintains Git discipline while enabling natural language editing.
