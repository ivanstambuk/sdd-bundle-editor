# Spec Studio – Implementation Tracker

This file tracks unfinished implementation work only.

Completed work belongs in:
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AGENTS.md](./AGENTS.md)
- commit history

## Priority View

### P1 – Reference Bundles
- [ ] Protocol spec bundle (for example EC-OPRF/FHE-style)
- [ ] Crypto profile reference bundle: port the sibling `sdd-specs` TurboSHAKE / KangarooTwelve / HopMAC RFC 9861 profile into a dedicated bundle type
- [ ] Feature-based project bundle (for example EUDIW simulator)

Why it matters:
- Improves the quality and breadth of the reference corpus.
- Useful if the next focus is bundle design, ontology pressure-testing, or demo quality.

### P2 – MCP Enhancements
- [ ] Additional prompts for specialized workflows
- [ ] Cross-bundle relationship analysis
- [ ] Resource template completions (`bundleId`, `entityType`, `id`)
- [ ] Prompt argument completions using `completable()` wrapper

Why it matters:
- Improves AI ergonomics and cross-bundle intelligence.
- Good follow-up once backend priorities are settled.

### P3 – VS Code Integration
- [ ] VS Code extension for tighter agent integration than web UI

Why it matters:
- Potentially high value, but broader surface area and less bounded than the backend/MCP items.

## Detailed Backlog

### Reference Bundles
- [ ] Protocol spec bundle
  Scope:
  - Create a bundle that stresses protocol modeling, flows, constraints, and conformance.
  Acceptance:
  - Bundle validates cleanly and is useful as a reference corpus.

- [ ] Crypto profile reference bundle
  Scope:
  - Port the sibling `sdd-specs` TurboSHAKE / KangarooTwelve / HopMAC RFC 9861 material into a dedicated bundle type.
  Acceptance:
  - Bundle validates cleanly and reflects the target domain faithfully.

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

### VS Code Integration
- [ ] VS Code extension for tighter agent integration than web UI
