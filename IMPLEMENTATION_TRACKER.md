# Spec Studio – Implementation Tracker

This file tracks **active and planned** implementation work only.

For completed work and architecture, see:
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Core concepts, package structure, design decisions
- **[AGENTS.md](./AGENTS.md)** – Developer/agent operational guide
- **[packages/mcp-server/README.md](./packages/mcp-server/README.md)** – MCP server documentation

---

## Completed Work Summary

The following major milestones have been completed:

| Phase | Description |
|-------|-------------|
| 0-7 | Monorepo, core packages, CLI, backend, UI, testing |
| 8.1 | Conversational agent interface with speech-to-text |
| 8.3 | Change proposal/application workflow |
| 8.4 | Read-only UI mode |
| 8.6 | Testing and documentation |
| 8.8 | MCP server with tools and resources |
| 8.9 | Conformance testing (Profile rules, audit templates) |
| Infra | External bundle repository migration |
| Infra (2026-02-27) | Port remapping (5174/3003), Chrome CDP systemd service, PlantUML headless fix, crypto.subtle POST fallback, canonical restart-chrome.sh propagated to all sister projects |
| UI (2026-02-27) | Boolean fields rendered as colored pill chips (`x-sdd-displayHint: booleanChips`); enum fields replaced with pill selector. Entity Types tab initial card grid implementation. |
| UI/Core (2026-03-27) | Timeline layouts for Scenario Steps. Addressed schema cache invalidation. Redesigned Entity Type cards to 'Structured Enterprise' layout (color-hashed side-stripes, high-density, no attributes). Fixed Cloud Run Dockerfile `plantuml.jar` access by explicitly curling it during build. |
| Metamodels (2026-03-27) | Fully hydrated the `jwt-validator-bundle`, successfully enforcing graph integrity and rigorous schema validation for cryptographic entities, pipelines, and test vectors. |
| UI/Core (2026-03-28) | Added depth-of-connection visualization to `EntityDependencyGraph`. Implemented dynamically configurable BFS bounds (1st/2nd/3rd/Full) alongside terminology alignment and edge deduplication logic. |
| UI/Core (2026-03-28) | **Type Relationships Map**: Embedded the N-degree relationship graph into the generic `EntityTypeDetails` summary component, intelligently parsing theoretical schema connections (`extractRelationsFromSchemas`) to produce lateral diagram views of structural blueprint domains. |

**Current state**: Full read-only UI with MCP-based AI integration. All modifications via `apply_changes` MCP tool.

---

## In Progress

### Agent Backend Implementations

- [x] `CliAgentBackend` – Spawns CLI agent process (stdin/stdout)
- [x] `HttpAgentBackend` – Calls external HTTP API (DeepSeek, OpenAI, etc.)
- [ ] `VsCodeAgentBackend` – Communicates with VS Code's integrated agent
- [ ] `McpAgentBackend` – Uses MCP for agent communication

---

## Future Work

### ADR Governance Migration
Status:
- Implemented for the JWT validator bundle on 2026-03-29 with exact `adr-governance` document structure, `ADR-NNNN-slug` IDs, generated `y_statement` values, bundle-wide ADR reference rewiring, and zero-error strict validation.
- Remaining follow-up in this initiative: authoring/documentation cleanup only.
- Recommended execution baseline:
  - Adopt the `adr-governance` sectioned document model as the semantic target, but keep an SDD-adapted schema variant for the JWT bundle rather than copying the sibling schema verbatim.
  - Keep `ADR-slug` identifiers for the first migration pass to avoid unnecessary graph churn across the JWT bundle. Numeric prefixes can be revisited later if you explicitly want full `adr-governance` parity.
  - Preserve bundle-native traceability through `x-...` extension fields rather than dropping graph semantics that are currently useful to the editor and reference bundle.
  - Populate `authors`, `decision_owner`, `reviewers`, and `approvals` using explicit reference-bundle defaults derived from the existing actor model, not empty placeholders. The first pass should bias toward honest lightweight governance, not fake enterprise ceremony.
  - Generate `y_statement` for all accepted ADRs during the content migration.
  - Treat Mermaid as additive first. Do not remove PlantUML until Mermaid rendering is implemented, validated, and explicitly approved as the replacement/default path.
- Recommended execution order:
  - `ADR-1` mapping freeze
  - `ADR-2` schema port
  - `ADR-3` content migration
  - `ADR-4` bundle rewiring and integrity cleanup
  - `MMD-1` diagram strategy freeze
  - `MMD-2` Mermaid renderer implementation
  - `MMD-3` Mermaid UI validation and ADR diagram conversion
  - `MMD-4` PlantUML keep/deprecate/remove decision
  - `ADR-5` final documentation and reusable migration guidance
- Rollback strategy:
  - Keep each phase commit-scoped and validator-clean so the migration can stop after any phase without leaving the bundle broken.
  - Do not intermingle Mermaid renderer work with ADR schema/content rewrites in the same commit.
  - Re-run strict bundle validation after every schema or YAML mutation batch, not just at the end.
- Global validation gates for the initiative:
  - `pnpm --filter @sdd-bundle-editor/mcp-server mcp-cli validate_bundle --bundle jwt --json`
  - `pnpm test`
  - UI verification of migrated ADR rendering once the new schema lands

- [x] Phase ADR-1: Design the JWT ADR to `adr-governance` mapping and freeze the target shape before any data rewrite.
  Scope:
  - Compare [reference-bundles/jwt-validator-bundle/schemas/ADR.schema.json](./reference-bundles/jwt-validator-bundle/schemas/ADR.schema.json) against the sibling `adr-governance` schema.
  - Produce a field-by-field mapping table from current JWT ADR fields into the governed model sections.
  - Freeze the target as an SDD-adapted governed ADR schema:
    - governed section structure from `adr-governance`
    - SDD-compatible ID choice
    - `x-...` extension fields for bundle-native traceability
  - Define the preservation strategy for current JWT-specific fields such as `relatedProfileIds`, `relatedRuleIds`, `relatedStrategyIds`, `relatedConstraintIds`, `relatedClassIds`, `relatedSuiteIds`, `relatedFormatIds`, and `relatedDataStructureIds`.
  - Freeze the ownership/governance strategy for reference bundles:
    - how `ACT-sec-team` maps into named people/roles
    - whether approvals are always required for accepted reference-bundle ADRs
    - which governance fields are mandatory versus recommended
  - Define the target mapping for:
    - `decision` -> `decision.chosen_alternative`, `decision.rationale`, `decision.tradeoffs`
    - current timestamps -> governed metadata fields
    - current consequences -> governed `consequences.*`
    - assumptions -> `context.assumptions`
    - confirmation evidence for a bundle that is itself a reference model
  Deliverables:
  - Field-by-field mapping spec
  - Gap list of fields that require enrichment rather than direct transformation
  - Frozen target-shape decision with rationale
  - Extension-field proposal for bundle-native traceability
  - Explicit sample ADR before/after conversion example
  Acceptance:
  - Written migration spec reviewed and approved before schema or YAML conversion starts

- [x] Phase ADR-2: Port the JWT validator ADR schema to the governed ADR model.
  Scope:
  - Replace the JWT ADR schema with the approved target shape from ADR-1.
  - Implement the governed top-level sections needed by the port:
    - `adr`
    - `authors`
    - `decision_owner`
    - `reviewers`
    - `approvals`
    - `context`
    - `alternatives`
    - `decision`
    - `consequences`
    - `confirmation`
  - Implement `x-...` extension fields for preserved SDD graph semantics.
  - Decide whether to support optional lifecycle/audit sections in the first pass or defer them.
  - Update any bundle-type or manifest assumptions affected by the ADR schema change.
  - Ensure the UI can still render the new ADR document shape read-only without field loss.
  Deliverables:
  - Updated JWT ADR schema
  - Updated example/default metadata shape for governed ADRs in the JWT bundle
  - Any schema compatibility helpers required by UI rendering
  - Updated sample/fixture expectations if tests depend on ADR shape
  Acceptance:
  - Strict bundle validation passes for the JWT bundle
  - Existing test suite passes
  - No current ADR content becomes unreachable in the UI
  - At least one converted canary ADR renders legibly in the UI before the full corpus rewrite starts

- [x] Phase ADR-3: Convert the JWT validator ADR corpus to the governed ADR structure.
  Scope:
  - Rewrite all JWT validator ADR YAML files into the new sectioned structure approved in ADR-2.
  - Generate `y_statement` values for accepted ADRs.
  - Convert current `decision` prose into `decision.chosen_alternative`, `decision.rationale`, and `decision.tradeoffs`.
  - Promote current ADR prose into richer governed sections:
    - `context.description`
    - `context.technical_drivers` / `context.constraints` where they are materially implied by current content
    - `consequences.positive` / `consequences.negative` / `consequences.neutral`
    - `confirmation.description` and `confirmation.artifact_ids` where validation/conformance evidence already exists in-bundle
  - Lift current assumptions and consequences into the governed structure.
  - Preserve current semantic traceability via approved `x-...` extension fields.
  - Maintain current ADR intent and tone; do not invent product claims that the bundle does not support.
  Deliverables:
  - Converted ADR YAML corpus
  - Generated `y_statement` values for all accepted ADRs
  Acceptance:
  - Bundle validates with zero errors
  - All `governedByAdrIds` references resolve
  - No decision meaning is lost during conversion
  - Every accepted ADR contains a coherent `y_statement`

- [x] Phase ADR-4: Rewire the JWT bundle and supporting schemas around the converted ADR IDs and shape.
  Scope:
  - Update `governedByAdrIds` across token profiles, operations, rules, strategies, suites, classes, constraints, formats, and related entities if ADR identifiers change.
  - Update any schemas that constrain ADR ID patterns.
  - Update any tests, fixtures, or lint assumptions that depend on the old ADR format.
  - Re-run and fix any graph integrity issues surfaced by the richer structure.
  Deliverables:
  - Fully rewired JWT bundle graph
  - Updated ADR ID validation rules if needed
  Acceptance:
  - Strict validator passes
  - Repo tests pass
  - No broken ADR references remain
  - No orphaned or silently dropped traceability fields remain after the port

- [ ] Phase ADR-5: Add migration safeguards and authoring guidance.
  Scope:
  - Document the chosen governed ADR format for SDD bundles.
  - Add a short migration note explaining which `adr-governance` concepts are adopted directly and which are adapted for bundle use.
  - If the new model is intended for reuse, define the pattern for other reference bundles.
  Deliverables:
  - Documentation update
  - Reusable migration notes/patterns
  Acceptance:
  - Another bundle author can follow the documented pattern without reverse-engineering the JWT implementation

### Mermaid Follow-Up
- Implemented on 2026-03-29 as additive Mermaid support in the markdown renderer. PlantUML remains available; explicit deprecation/removal is still pending.
- [x] Phase MMD-1: Define the diagram-format strategy for markdown-rendered entities.
  Scope:
  - Freeze the recommended strategy:
    - Mermaid support lands additively first
    - ADR narrative content may start using Mermaid after rendering support is proven
    - PlantUML remains supported until an explicit removal decision is approved
  - Identify every current PlantUML-specific path in the app and server:
    - markdown widget rendering
    - server render endpoints/cache
    - schema hints and sample content
  Deliverables:
  - Diagram strategy note
  - Inventory of PlantUML-coupled code paths
  Acceptance:
  - Approved scope for Mermaid support before implementation starts

- [x] Phase MMD-2: Implement Mermaid rendering in the markdown pipeline.
  Scope:
  - Extend the markdown renderer to recognize fenced `mermaid` blocks in read-only and preview modes.
  - Choose the rendering approach:
    - preferred: client-side Mermaid library in the UI shell
    - only choose server-side rendering if there is a concrete security or portability reason
  - Keep current PlantUML behavior working unchanged during this phase.
  Deliverables:
  - Mermaid-capable markdown widget
  - Tests covering fenced `mermaid` rendering
  Acceptance:
  - Markdown with Mermaid diagrams renders correctly in the UI
  - Existing PlantUML rendering does not regress unless intentionally removed

- [x] Phase MMD-3: Add UI validation and bundle-level content migration support for Mermaid.
  Scope:
  - Add or update tests for Mermaid rendering behavior.
  - Validate the UI visually on the actual rendered entity content.
  - Convert ADR markdown diagrams from PlantUML to Mermaid only after Mermaid rendering is proven stable in the UI.
  Deliverables:
  - UI validation evidence
  - Converted ADR markdown diagrams where applicable
  Acceptance:
  - Visual validation completed against the affected ADRs
  - Diagram rendering is proven, not assumed

- [ ] Phase MMD-4: Decide whether PlantUML remains supported.
  Scope:
  - After Mermaid support lands, decide whether PlantUML stays as a secondary capability or is removed from the markdown path.
  - If removing it, plan deprecation/migration of existing content and server endpoints.
  Deliverables:
  - Explicit keep/deprecate/remove decision
  Acceptance:
  - No accidental half-supported diagram mode remains in the codebase

### Richer Example Bundles
- [ ] Protocol spec bundle (e.g., EC-OPRF/FHE-style)
- [ ] Crypto profile reference bundle: port the sibling `sdd-specs` TurboSHAKE / KangarooTwelve / HopMAC RFC 9861 profile into a dedicated bundle type.
- [ ] Feature-based project bundle (e.g., EUDIW simulator)

### VS Code Integration
- [ ] VS Code extension for tighter agent integration than web UI

### MCP Enhancements
- [ ] Additional prompts for specialized workflows
- [ ] Cross-bundle relationship analysis
- [ ] Resource template completions (autocomplete for bundleId, entityType, id)
- [ ] Prompt argument completions using `completable()` wrapper
