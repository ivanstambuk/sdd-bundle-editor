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
- Harness now supports pluggable critic backends and a critic-only replay mode for re-evaluating an existing generated run.
- Bounded critic orchestration is now the target pattern: enforce structured output when the backend allows it, then use short resume prompts instead of blind full reruns.
- Critic execution is now being tightened toward a shallow-first pattern: packet-only review on green machine evidence, deep artifact review only on anomalies, with bounded resume-to-finish instead of open-ended critic exploration.
- The harness now has a verified Python pilot path:
  - Python-specific frozen conformance templates can be materialized for `BIND-python-pyjwt-library`
  - runtime command policy now understands `pip`
  - a full automated Python `self-verify` run now exits cleanly end to end with passing outer audit, semantic audit, and critic verdict
  - the harness now has generic builder-quiescence and structured-critic early-complete handoff paths for long-running model processes
  - packet-oriented MCP resolution is now live for implementation and conformance packets, so default harness runs no longer need to call prompt endpoints by name
  - a fresh-port non-green Python run exercised the packet-tool path and produced the expected fail gate when generated code imported `schema` incorrectly
  - run packets are now summary-oriented and no longer duplicate the full resolved prompt bodies that already live under `prompt/`
  - critic workspace snapshots now ignore common cache/build artifacts and prioritize runtime-relevant manifests plus source/test/docs more generically
  - deterministic frozen test packs are now selected through manifest-declared compatibility metadata such as package manager, runtime language, and tags rather than one exact runtime triple
  - deterministic frozen pack directory creation is now manifest-driven too, so the harness no longer hardcodes a fixed `tests/fixtures` layout
  - deterministic frozen pack replacements now use manifest-declared context keys instead of a hardcoded replacement enum in harness code
  - deterministic fixture/vector projection for frozen packs is now manifest-declared, including preserved fields, defaults, and simple derived fields
  - deterministic frozen pack context entries are now fully named by the manifest, so the harness no longer owns literal keys like `fixtureMap` or `suiteId`
  - deterministic frozen pack template references are now pack-local, so manifests no longer need to know the global template-root layout
  - small frozen-pack artifacts can now be rendered from inline manifest templates instead of always requiring separate `.tmpl` files
- Remaining work is now explicitly:
  - continue harness generalization away from JS/TS-specific assumptions
  - keep shrinking the remaining prompt-name dependency and prompt-related metadata leakage in run artifacts
  - remove remaining transitional pilot seams without breaking the working Node.js path

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
  Remaining implementation work:
  - Generalize the harness further so audit names, artifact prioritization, and critic inputs are less JS/TS-shaped.
  - Continue pushing packet-oriented MCP resolution so prompt names and resolved prompt prose become less central to harness orchestration.
  - Continue removing transitional pilot seams from the harness while keeping the current Node.js and Python paths green.
  Acceptance:
  - Detailed design is captured in [docs/spec-driven-implementation-bindings.md](./docs/spec-driven-implementation-bindings.md).
  - Concrete phase-0 entity modeling is captured in [docs/spec-driven-implementation-bindings-phase-0.md](./docs/spec-driven-implementation-bindings-phase-0.md).
  - Next harness refactor target is captured in [docs/spec-generation-harness-next-architecture.md](./docs/spec-generation-harness-next-architecture.md).
  - Flow and packet provenance are documented in [docs/spec-generation-harness-flow.md](./docs/spec-generation-harness-flow.md).
  - OpenCode builder setup is documented in [docs/opencode-builder-setup.md](./docs/opencode-builder-setup.md).
  - OpenCode now has a stricter `packet-only` builder profile, a GLM-specific `glm-strict` profile, backend-specific builder log names, and `builder-observability.json` output for backend comparison.
  - The binding harness now defaults to this OpenCode-backed setup unless explicitly overridden: builder `litellm-local/glm-5-turbo`, critic backend `codex`, critic model `gpt-5.2`, critic reasoning `medium`.
  - Current binding-harness checkpoint using OpenCode with GLM-5 Turbo as builder and GPT-5.2 as critic:
    - Python JWT pilot is proven green:
      - full `self-verify` run passed install, build, tests, semantic audit, and critic
      - [2026-03-31T17-01-17-613Z-BIND-python-pyjwt-library](./.scratch/binding-runs/2026-03-31T17-01-17-613Z-BIND-python-pyjwt-library)
    - Node JWT pilot is now also proven green:
      - full `self-verify` run passed frozen-test integrity, `pnpm install`, `pnpm build`, `pnpm test`, semantic audit, and critic
      - [2026-03-31T18-46-52-952Z-BIND-node-jose-library](./.scratch/binding-runs/2026-03-31T18-46-52-952Z-BIND-node-jose-library)
  - The target entity model, prompt-serving strategy, and phased plan are concrete enough to implement without redesign.
  - MCP can serve bundle-defined binding prompts for the JWT pilot.
  - A local generation harness can produce a pilot Node.js workspace from `implement-binding`.
  - A local generation harness can also produce a fully automated green Python pilot run for `BIND-python-pyjwt-library`.
  - Default harness runs can resolve implementation and conformance packets through MCP without directly calling prompt endpoints by name.
  - The shallow-first critic pattern has now been exercised on both green and non-green Python runs.
  - The workflow remains incomplete until the harness is generalized away from embedded runtime scaffolding and the prompt-name dependency is reduced.

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
