# Spec Studio – Implementation Tracker

This file tracks unfinished implementation work only.

Completed work belongs in:
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AGENTS.md](./AGENTS.md)
- commit history

## Priority View

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
