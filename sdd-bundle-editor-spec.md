# SDD Bundle Editor – Architecture and Design Spec

Version: 1.0  
Status: Living Document  
See also: [ARCHITECTURE.md](./ARCHITECTURE.md) for implementation details, [AGENTS.md](./AGENTS.md) for operational guide

---

## 1. Problem Statement & Goals

### 1.1 Problem

We want a **schema-driven, AI-first visual editor** for bundles of YAML specifications used in Spec‑Driven Development (SDD). These bundles describe things like:

- Functional and non-functional requirements
- ADRs (Architecture Decision Records)
- Conformance and fixtures for protocol specs
- Project or product features (feature specs)
- Profiles and capability/feature flags

Today these are spread across YAML and Markdown with ad‑hoc structure. We want a **governed source-of-truth system** where:

- YAML is **canonical machine-readable truth**.
- Markdown is **human-readable narrative** attached to structured entities.
- JSON Schema (plus a small meta-layer) defines the shapes and relations.
- The editor guarantees that what's on disk is always structurally valid and lint‑clean.

### 1.2 High-level Goals

1. **Bundle-centric editing:** Always open and edit an entire *bundle* of spec files, not isolated YAML fragments.
2. **Schema-driven UI:** The editor derives its forms and controls from JSON Schemas and bundle-type metadata.
3. **No raw YAML editing in the UI:** Users interact via forms, lists, and graphs; YAML is implementation detail.
4. **Strict validation gates:** "Compile Spec" validates schemas and lint rules. If they fail, nothing is written.
5. **ID + reference governance:** All entities have schema-defined IDs; references are by ID with guaranteed integrity.
6. **Feature-aware:** The schema model supports both feature-based and feature-free bundles via configuration.
7. **AI‑first workflows:** All modifications happen through conversational AI, operating under schema + lint constraints and Git discipline.
8. **Implementation-friendly:** Core implementation in TypeScript, usable as:
   - Standalone web app
   - CLI (for CI / automation)
   - Later: VS Code extension with the same core.

### 1.3 Out of Scope

- Multi-user, concurrent editing.
- Cross-bundle references (only intra-bundle refs are supported).
- Schema migrations (projects must migrate explicitly, possibly with AI help).
- Authentication/authorization.
- Rich graph visualizations (basic inbound/outbound reference lists are sufficient).

---

## 2. Core Concepts & Domain Model

### 2.1 Bundle

A **bundle** is the atomic unit of editing and validation.

- It corresponds to a directory (project or subproject) in a Git repo.
- It is declared and configured by a **bundle manifest** file: `sdd-bundle.yaml`.
- A bundle contains:
  - A manifest (`sdd-bundle.yaml`).
  - A local copy of the **bundle-type definition** JSON.
  - One or more **entity types**, each stored as multiple YAML files (one entity per file).
  - One **domain knowledge** Markdown file (context/background for AI).
  - An optional **lint config** YAML file.

### 2.2 Entity Types

Entities are typed YAML objects: `Requirement`, `Task`, `ADR`, `Feature`, `Fixture`, `Profile`, etc.

Each entity type has:
- A JSON Schema (document-level schema).
- A directory where its YAML files live.
- An ID field, which is globally unique within the bundle.
- Optional reference fields to other entity types.

### 2.3 IDs

- IDs are **human-readable codes** (e.g. `REQ-123`, `FEAT-006`, `ADR-0001`).
- ID format is defined in JSON Schema using:
  - A regex `pattern` for validation, and
  - A custom `x-idTemplate` for generation (e.g. `REQ-{000}`, `FEAT-{000}`).
- IDs must be **globally unique within the bundle** (`x-idScope: "bundle"`).

### 2.4 References

- References between entities are **ID-based**, never positional.
- In JSON Schema, reference fields are marked as:

```json
{
  "type": "string",
  "format": "sdd-ref",
  "x-refTargets": ["Requirement"]
}
```

Or for arrays:

```json
{
  "type": "array",
  "items": {
    "type": "string",
    "format": "sdd-ref",
    "x-refTargets": ["Requirement", "ADR"]
  },
  "uniqueItems": true
}
```

- `format: "sdd-ref"` marks the field as a reference ID.
- `x-refTargets` enumerates allowed entity types (polymorphic refs supported).
- **x-refTargets validation**: References are validated to ensure they point to entities of allowed types.

### 2.5 Features

Features are first-class entities with entity type `Feature`:
- **Product features** (e.g. "Feature 006 – EUDIW OpenID4VP Simulator").
- **Capability flags** (e.g. `ec-oprf-core`, `fhe-bfv-membership`).

The schema system supports both feature-based and feature-free bundles via lint configuration.

### 2.6 Domain Knowledge Markdown

Each bundle has a **domain knowledge Markdown file**, referenced in the manifest.

- Purpose: store human-level background/context for AI generation and refinement.
- It is read-only input to AI flows and optionally shown in the UI.

---

## 3. File Layout & Bundle Manifest

### 3.1 Directory Structure

```text
.
├── sdd-bundle.yaml                 # Bundle manifest
├── schemas/
│   ├── bundle-type.sdd-core.json   # Bundle-type definition
│   ├── Feature.schema.json
│   ├── Requirement.schema.json
│   └── ...
├── bundle/
│   ├── features/
│   ├── requirements/
│   ├── tasks/
│   └── ...
├── domain/
│   └── domain-knowledge.md         # Domain context for AI
└── config/
    └── sdd-lint.yaml               # Lint + gate configuration
```

### 3.2 Bundle Manifest: `sdd-bundle.yaml`

```yaml
apiVersion: sdd.v1
kind: Bundle
metadata:
  name: my-project-spec
  bundleType: sdd-core
  schemaVersion: 1.0.0

spec:
  bundleTypeDefinition: schemas/bundle-type.sdd-core.json

  schemas:
    documents:
      Feature:     schemas/Feature.schema.json
      Requirement: schemas/Requirement.schema.json
      Task:        schemas/Task.schema.json

  layout:
    documents:
      Feature:
        dir: bundle/features
        filePattern: "{id}.yaml"
      Requirement:
        dir: bundle/requirements
        filePattern: "{id}.yaml"
      Task:
        dir: bundle/tasks
        filePattern: "{id}.yaml"

  domainKnowledge:
    path: domain/domain-knowledge.md

  lintConfig:
    path: config/sdd-lint.yaml
```

### 3.3 Bundle-Type Definition

The bundle-type JSON defines entity types and their relations:

```json
{
  "bundleType": "sdd-core",
  "version": "1.0.0",
  "entities": [
    {
      "entityType": "Feature",
      "idField": "id",
      "schemaPath": "schemas/Feature.schema.json",
      "directory": "bundle/features",
      "filePattern": "{id}.yaml",
      "role": "feature"
    },
    // ... more entity types
  ],
  "relations": [
    {
      "name": "RequirementBelongsToFeature",
      "fromEntity": "Requirement",
      "fromField": "featureIds",
      "toEntity": "Feature",
      "multiplicity": "many"
    }
  ]
}
```

---

## 4. JSON Schemas for Entities

Schemas use JSON Schema Draft 2020-12 with SDD-specific extensions.

### Key Extensions

| Keyword | Purpose |
|---------|---------|
| `x-idTemplate` | Template for ID generation (e.g., `REQ-{000}`) |
| `x-entityType` | Entity type this ID belongs to |
| `x-idScope` | Scope for uniqueness (`"bundle"`) |
| `x-refTargets` | Allowed target entity types for references |

### Example: Requirement Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Requirement",
  "type": "object",
  "required": ["id", "title"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^REQ-[0-9]{3}$",
      "x-idTemplate": "REQ-{000}",
      "x-entityType": "Requirement",
      "x-idScope": "bundle"
    },
    "title": { "type": "string", "minLength": 5 },
    "featureIds": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "sdd-ref",
        "x-refTargets": ["Feature"]
      }
    }
  }
}
```

---

## 5. Lint Rules & Gates

### 5.1 Lint Configuration

Lint rules are configured per-bundle in `config/sdd-lint.yaml`:

```yaml
rules:
  titleCapitalization:
    type: regex
    targetEntities: ["Requirement", "ADR"]
    field: "title"
    pattern: "^[A-Z].+"

  requirementMustHaveFeature:
    type: has-link
    fromEntity: "Requirement"
    viaField: "featureIds"
    minLinks: 1

  noBrokenRefs:
    type: no-broken-ref
```

### 5.2 Rule Types

| Type | Description |
|------|-------------|
| `regex` | Field must match a pattern |
| `has-link` | Entity must have minimum N references via a field |
| `coverage` | Entity type must be referenced by another type |
| `no-broken-ref` | All references must resolve to existing entities |
| `ref-type-mismatch` | References must target allowed entity types (per x-refTargets) |

### 5.3 Gates

Gates are lint rules that block saving. Any `error` severity diagnostic is a gate failure.

---

## 6. Validation & "Compile Spec" Pipeline

### On Bundle Load

1. Parse `sdd-bundle.yaml` manifest.
2. Load bundle-type definition and document schemas.
3. Scan directories for YAML entity files.
4. Parse YAML and validate each entity against its JSON Schema.
5. Build ID registry (assert global uniqueness).
6. Build reference graph.
7. Validate x-refTargets constraints.
8. Run lint rules, producing diagnostics.

### On "Compile Spec"

1. Re-run full validation pipeline.
2. If errors or failing gates exist, return diagnostics (no write).
3. If everything passes, the bundle is valid.

---

## 7. AI Integration via MCP

### 7.1 MCP-First Architecture

> **Key paradigm shift**: All modifications happen through MCP tools, not HTTP endpoints.

- The UI is a **read-only viewer**.
- All writes via `apply_changes` MCP tool.
- Users manage Git commits externally.

### 7.2 MCP Server

The MCP Server provides bundle access to AI assistants:

| Transport | Use Case |
|-----------|----------|
| **stdio** | Claude Desktop, VS Code Copilot |
| **HTTP/SSE** | Web clients, programmatic access |

### 7.3 Key Tools

| Tool | Description |
|------|-------------|
| `list_bundles` | List all loaded bundles |
| `read_entity` | Read entity by type and ID |
| `list_entities` | List all entity IDs |
| `search_entities` | Search across bundles |
| `validate_bundle` | Validate and return diagnostics |
| `apply_changes` | Atomic batch create/update/delete |

### 7.4 apply_changes Flow

1. AI proposes changes (create/update/delete operations)
2. MCP Server validates all changes atomically
3. If valid: files written to disk
4. If invalid: error returned with `changeIndex` attribution
5. User commits changes via normal Git workflow


---

## 8. Architecture Overview

### Core Packages

| Package | Responsibility |
|---------|----------------|
| `core-schema` | JSON Schema loading & validation (Ajv) |
| `core-model` | Bundle loading, ID registry, RefGraph |
| `core-lint` | Lint rules, gate semantics |
| `core-ai` | AI provider abstraction |
| `ui-shell` | React components |
| `cli` | Command-line interface |
| `git-utils` | Git operations |

### Apps

| App | Description |
|-----|-------------|
| `apps/server` | Fastify HTTP API |
| `apps/web` | React SPA |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed implementation documentation.

---

## 9. CLI & CI Integration

### Commands

```bash
# Validate bundle
sdd-bundle validate [--bundle-dir DIR] [--output json]

# Generate bundle with AI
sdd-bundle generate --bundle-type sdd-core --domain domain/domain-knowledge.md

# Report coverage
sdd-bundle report-coverage [--output json]
```

### CI Usage

```yaml
- name: Validate SDD bundle
  run: sdd-bundle validate --output json > sdd-diagnostics.json
```

---

## 10. Design Principles

When in doubt:

1. **Strictness over convenience**: Do not allow saving invalid bundles.
2. **Schema + configuration over code**: New bundle types should require only configuration changes.
3. **AI under constraints**: AI operates under schema + lint rules with Git discipline.
4. **No raw YAML in UI**: Users see forms and structured views, never raw YAML.
5. **Generic and extensible**: New entity types and schemas can be added without code changes.

---

## References

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Detailed implementation, package structure, design decisions
- **[AGENTS.md](./AGENTS.md)** – Operational guide for developers and AI agents
- **[IMPLEMENTATION_TRACKER.md](./IMPLEMENTATION_TRACKER.md)** – Current active work and roadmap
