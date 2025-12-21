# SDD Bundle Editor – Terminology

Status: Living Document | Last updated: 2025-12-21

This document defines common terms used across the SDD Bundle Editor docs and specs to ensure consistent vocabulary. As new terms are introduced, this document should be updated.

---

## Core Concepts

### Bundle & Entities

- **SDD (Specification-Driven Development)**
  - A methodology where software specifications are captured as structured, machine-readable data that can be processed by AI agents and tooling.
  - The core philosophy is "specs as data, not docs."

- **Spec Bundle** (or just **Bundle**)
  - A collection of entity YAML files, schemas, and configuration that together define a software specification.
  - Located in a directory with `bundle-type.sdd-core.json` at the root.
  - Contains: entity files, schemas, and bundle type definition.

- **Entity**
  - A single specification artifact stored as a YAML file.
  - Has an `id`, `entityType`, and `data` (the actual content).
  - Examples: Feature, Requirement, ADR, Actor, Constraint.

- **Entity Type**
  - The category/class of an entity (e.g., "Feature", "ADR", "Actor").
  - Each entity type has a corresponding JSON Schema that defines its structure.
  - Configured in `bundle-type.sdd-core.json`.

- **Entity ID**
  - A unique identifier for an entity within a bundle.
  - Follows a pattern defined by `x-sdd-idTemplate` (e.g., `FTR-auth-service`, `ADR-001`).

### Schema Keywords

- **`x-sdd-*` Keywords**
  - Custom JSON Schema extension keywords used by the SDD Bundle Editor.
  - All use the `x-sdd-` prefix to avoid conflicts with standard JSON Schema.
  - Examples: `x-sdd-refTargets`, `x-sdd-displayHint`, `x-sdd-prominence`.

- **Entity Reference** (or **Ref**)
  - A field that points to another entity by ID.
  - Marked with `format: "sdd-ref"` and `x-sdd-refTargets: ["EntityType"]`.
  - Rendered as clickable links in the UI.

---

## UI Concepts

### Layout & Structure

- **Layout Group**
  - A named group of fields that appear together in a sub-tab.
  - Defined at schema root with `x-sdd-layoutGroups`.
  - Assigned to fields via `x-sdd-layoutGroup`.
  - Purpose: Reduce visual clutter for entities with many fields.

- **Sub-tab**
  - A secondary tab within the Details tab that shows a subset of fields.
  - Created when a schema defines `x-sdd-layoutGroups`.
  - Examples: "Overview", "Alternatives", "Consequences", "Meta".

### Visual Hierarchy

- **Prominence**
  - The visual weight of a field, controlled by `x-sdd-prominence`.
  - Levels: `hero` (most prominent), `primary`, `secondary`, `tertiary` (least).
  - Used to guide the user's eye to important content.

- **Prominence Header**
  - A styled section header that appears above hero/primary/secondary fields.
  - Includes an icon (`x-sdd-prominenceIcon`) and title (`x-sdd-prominenceLabel`).
  - Example: "❓ THE PROBLEM", "✅ THE DECISION".

- **Narrative Fields Pattern**
  - A UI pattern for entities that tell a story (ADRs, design docs).
  - Uses prominence headers to create flow: Problem (❓) → Context (🧭) → Decision (✅).
  - See: `.agent/docs/ui/layout-guidelines.md`.

### Header Metadata

- **Header Metadata**
  - System fields displayed in the entity header bar instead of the main form.
  - Controlled by `x-sdd-displayLocation: "header"`.
  - Typical fields: `createdDate`, `lastModifiedDate`, `lastModifiedBy`.
  - Purpose: Reduce form clutter for audit/tracking fields.

### Enum Styling

- **Enum Badge**
  - A colored badge that displays an enum value instead of a dropdown.
  - Controlled by `x-sdd-enumStyles` with color values: `success`, `warning`, `error`, `info`, `neutral`.
  - Example: Status "ACCEPTED" as a green badge.

---

## Graph & Dependency Concepts

### Relationship Direction

- **Dependency**
  - An entity that the target entity **depends on** (needed to implement/fulfill the target).
  - Found by reading the target's reference fields (`x-sdd-refTargets`).
  - Example: Requirement is a dependency of Feature (Feature depends on Requirement).

- **Referrer**
  - An entity that **depends on** the target (the target is referenced by that entity).
  - Not directly discoverable from the target's fields; requires scanning other entities.
  - Example: Component is a referrer of Feature (Component references Feature).

- **Reference Field**
  - A field with `format: "sdd-ref"` and `x-sdd-refTargets` that contains IDs of other entities.
  - The entity holding the reference field is the **source** of the relationship.
  - Example: `Feature.realizesRequirementIds` is a reference field on Feature pointing to Requirements.

### Semantic Classification

- **Upstream / Governor**
  - Entities that constrain, govern, or specify other entities.
  - Examples: ADR, Requirement, Constraint, Policy, Principle, Decision.
  - These entities typically **receive** references (are dependencies of downstream entities).

- **Downstream / Implementable**
  - Entities that are constrained, governed, or implement upstream specs.
  - Examples: Feature, Component, Protocol, Scenario.
  - These entities typically **hold** references to their upstream governors.

### Target-Holds-Reference Convention

- **Target-Holds-Reference**
  - The canonical convention for relationship direction in SDD bundles.
  - Rule: The entity being **constrained/governed** holds the reference to its **constraints/governors**.
  - Rationale: To find everything needed to implement Feature X, look at Feature X's reference fields.
  - See: [Schema Authoring Guide](schema/schema-authoring-guide.md#relationship-direction-convention).

### Graph Direction vs Implementation Semantics

| Graph Term | Implementation Term | Example |
|------------|---------------------|---------|
| Outgoing edge (from target) | Dependency | Feature → Requirement |
| Incoming edge (to target) | Referrer | Component → Feature |

**Key insight**: Our convention aligns graph direction with implementation needs. The entity's "outgoing edges" (its reference fields) point to its "dependencies" (what it needs).

---

## Architecture Components

### Packages

- **`ui-shell`**
  - The React component library that renders the bundle editor UI.
  - Contains: EntityDetails, EntityNavigator, BundleOverview, DiagnosticsPanel.

- **`mcp-server`**
  - The MCP (Model Context Protocol) server that provides bundle data to AI agents.
  - Exposes: resources, tools, prompts for bundle manipulation.

- **`core-model`**
  - The core data model for loading, validating, and manipulating bundles.
  - Contains: BundleContainer, RefGraph, EntityLoader.

- **`core-schema`**
  - JSON Schema loading and validation utilities.
  - Registers custom `x-sdd-*` keywords with AJV.

- **`core-lint`**
  - Linting rules for validating bundle content beyond schema validation.
  - Produces diagnostics (errors, warnings) for bundle issues.

### APIs & Protocols

- **MCP (Model Context Protocol)**
  - The protocol used to expose bundle data to AI agents (e.g., VS Code Copilot, Claude).
  - Supports: resources (read data), tools (perform actions), prompts (get guidance).

- **HTTP Transport**
  - The HTTP wrapper around MCP for browser-based access.
  - Default: `http://localhost:3001/mcp`.

---

## RJSF (React JSON Schema Form)

- **RJSF**
  - The library used to render entity forms from JSON Schema.
  - Automatically generates form fields based on schema properties.

- **Widget**
  - An RJSF component that renders a specific input type.
  - Examples: `SelectWidget`, `TextWidget`, `CheckboxWidget`.

- **Field Template**
  - An RJSF component that wraps a field with label, description, and layout.
  - `CustomFieldTemplate` is the main template used in EntityDetails.

- **Array Field Template**
  - An RJSF component that renders arrays of items.
  - `CustomArrayFieldTemplate` handles different layouts (chips, bulletList, alternatives).

---

## Wording Conventions

### Canonical Term Map

| Use ✅ | Avoid ❌ | Reason |
|--------|---------|--------|
| Bundle | Spec, Specification | "Bundle" is more concrete |
| Entity | Record, Item, Object | "Entity" is the domain term |
| Entity Type | Entity Kind, Category | Matches schema terminology |
| Prominence | Importance, Priority | UI-specific term |
| Layout Group | Tab Group, Section | Matches schema keyword |
| Header Metadata | Header Fields, System Fields | Precise term |
| Dependency | Outgoing reference | Implementation perspective |
| Referrer | Incoming reference | Implementation perspective |

### When Introducing New Terms

- Add the term to this document as part of the same change.
- If uncertain, mark as provisional and note in commit message.
- Avoid synonyms for established terms to maintain consistency.

---

## See Also

- [Schema Authoring Guide](schema/schema-authoring-guide.md) - Full `x-sdd-*` keyword reference
- [UI Layout Guidelines](ui/layout-guidelines.md) - Visual hierarchy and layout patterns
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture overview
