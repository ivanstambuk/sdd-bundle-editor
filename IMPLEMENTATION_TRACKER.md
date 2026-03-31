# Spec Studio – Implementation Tracker

This file tracks unfinished implementation work only.

Completed work belongs in:
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AGENTS.md](./AGENTS.md)
- commit history

## Priority View

### P1 – Spec-Driven Implementation Bindings
- [ ] JWT validator implementation-binding workflow

Why it matters:
- Demonstrates how Spec Studio can drive code generation from abstract spec plus platform binding policy.
- Creates a reusable pattern for platform teams to define implementation-ready bindings without collapsing the abstract domain model.

Current status:
- Design docs are in place.
- Bundle-defined binding prompts are served through MCP.
- A local harness can resolve `implement-binding`, invoke Gemini CLI, and write a generated Node.js workspace under `.scratch/binding-runs/`.
- The harness pattern is now explicit:
  - `generate-only` for semantic-observability runs
  - `self-verify` for autonomous test/build loops inside the generated workspace
- `generate-only` now includes a post-generation audit layer so obviously non-usable runs fail immediately on missing vector coverage, placeholder markers, or failed local typecheck/test gates.
- General harness rule is now frozen-test-first: generate normative tests from MCP context, freeze them, then implement against them.
- Step 2 `self-verify` now works for the Node.js pilot after a frozen-pack omission fix in the harness.
- The next architectural move is to remove pilot-specific runtime scaffolding from the harness and replace it with generic packet resolution plus a separate AI critic pass.
- Harness policy is now builder-fast / critic-strong by default: use a cheaper generation model and a stronger semantic-validation model.
- Remaining work is harness generalization, critic-pass design, and a second verified runtime.

### P1 – Reference Bundles
- [ ] Protocol spec bundle (for example EC-OPRF/FHE-style)
- [ ] Feature-based project bundle (for example EUDIW simulator)

Why it matters:
- Improves the quality and breadth of the reference corpus.
- Useful if the next focus is bundle design, ontology pressure-testing, or demo quality.

### P2 – MCP Enhancements
- [ ] Additional prompts for specialized workflows
- [ ] Cross-bundle relationship analysis
- [ ] Resource template completions (`bundleId`, `entityType`, `id`)
- [ ] Prompt argument completions using `completable()` wrapper

### P2 – openFinance Post-v1
- [ ] Deeper lifecycle/event modeling beyond current status transitions
- [ ] Richer actor/interaction layer above current capability and flow model
- [ ] Broader normative enrichment beyond current strict extraction set
- [ ] Additional value-object subtyping only where it improves agent usefulness

Why it matters:
- Improves AI ergonomics and cross-bundle intelligence.
- Good follow-up once backend priorities are settled.

## Detailed Backlog

### Spec-Driven Implementation Bindings
- [ ] JWT validator implementation-binding workflow
  Scope:
  - Design a workflow that combines an abstract JWT spec bundle with platform-specific binding profiles.
  - Support MCP-served implementation prompts derived from bundle data through a generic server adapter.
  - Pilot on library-only generation for Node.js and Python, while modeling Java, C#, Go, and Rust for later expansion.
  Acceptance:
  - Detailed design is captured in [docs/spec-driven-implementation-bindings.md](./docs/spec-driven-implementation-bindings.md).
  - Concrete phase-0 entity modeling is captured in [docs/spec-driven-implementation-bindings-phase-0.md](./docs/spec-driven-implementation-bindings-phase-0.md).
  - Next harness refactor target is captured in [docs/spec-generation-harness-next-architecture.md](./docs/spec-generation-harness-next-architecture.md).
  - The target entity model, prompt-serving strategy, and phased plan are concrete enough to implement without redesign.
  - MCP can serve bundle-defined binding prompts for the JWT pilot.
  - A local generation harness can produce a pilot Node.js workspace from `implement-binding`.
  - The workflow remains incomplete until the harness is generalized away from embedded runtime scaffolding and gains a separate critic phase.

### Reference Bundles
- [ ] Protocol spec bundle
  Scope:
  - Create a bundle that stresses protocol modeling, flows, constraints, and conformance.
  Acceptance:
  - Bundle validates cleanly and is useful as a reference corpus.

- [ ] Feature-based project bundle
  Scope:
  - Add a realistic project-style bundle such as an EUDIW simulator.
  Acceptance:
  - Bundle validates cleanly and serves as a high-quality project reference.

### MCP Enhancements
- [ ] Additional prompts for specialized workflows
- [ ] Cross-bundle relationship analysis
- [ ] Resource template completions (`bundleId`, `entityType`, `id`)
- [ ] Prompt argument completions using `completable()` wrapper

### openFinance Post-v1
- [ ] Deeper lifecycle/event modeling beyond current status transitions
  Scope:
  - Extend the domain bundle with richer event/lifecycle semantics only where it adds real design or implementation value.
  Acceptance:
  - New lifecycle entities are clearly domain-led and remain traceable to the current conformance layer.

- [ ] Richer actor/interaction layer above current capability and flow model
  Scope:
  - Model higher-level interaction structures only if they improve navigation or agent reasoning materially.
  Acceptance:
  - New actor/interaction entities do not duplicate existing capability/flow semantics.

- [ ] Broader normative enrichment beyond current strict extraction set
  Scope:
  - Expand document-derived extraction only after publication needs are met.
  Acceptance:
  - Additional normative material is source-backed and does not reduce current bundle clarity.

- [ ] Additional value-object subtyping only where it improves agent usefulness
  Scope:
  - Refine value-object structure conservatively, not for its own sake.
  Acceptance:
  - Each new subtype has a clear domain or conformance payoff.
