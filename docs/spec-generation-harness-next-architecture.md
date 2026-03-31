# Spec Generation Harness – Next Architecture

Status: Proposed
Parent documents:
- [docs/spec-driven-implementation-bindings.md](./spec-driven-implementation-bindings.md)
- [docs/spec-driven-implementation-bindings-phase-0.md](./spec-driven-implementation-bindings-phase-0.md)
- [docs/spec-generation-harness-flow.md](./spec-generation-harness-flow.md)
- [docs/opencode-builder-setup.md](./opencode-builder-setup.md)

## Purpose

This document defines the next architecture for Spec Studio generation harnesses after the successful JWT Node.js pilot.

The goal is to remove pilot-specific runtime scaffolding from the local harness while preserving:
- bundle-first domain ownership
- generic MCP serving
- autonomous model execution loops
- strong outer guardrails

Recommendation:
- keep the harness generic
- keep the MCP server implementation-agnostic
- keep domain semantics in bundle entities
- introduce an AI critic pass as a first-class semantic guardrail
- retain a minimal set of generic mechanical checks

## Core Principle

Do not move runtime-specific or bundle-specific implementation logic into the harness or MCP server.

Instead:
- the bundle defines the domain contract
- MCP serves resolved domain packets
- a fast builder model implements
- a stronger critic model validates semantically
- the harness orchestrates and records evidence

The practical implication is:
- MCP is primarily needed for **resolution**
- the builder is primarily responsible for **implementation**

If the harness has already materialized the resolved implementation packet, conformance packet, validation packet, and frozen tests, then the builder often does not need live MCP access anymore.

That is not a loss of domain fidelity.
It is a shift from:
- live domain lookup during implementation
to:
- packet-driven implementation from frozen local artifacts

This separation is desirable when it keeps the builder focused on writing code instead of re-exploring the same domain context.

## Problem Statement

The current pilot proved the workflow, but it still contains Node/TypeScript-specific frozen test generation inside the harness:
- inline TypeScript module renderers
- Node-specific token/fixture preparation logic
- runtime-specific knowledge embedded in `scripts/run-binding-harness.ts`

That is acceptable for a pilot but wrong as a long-term architecture because:
- it couples the harness to one runtime family
- it duplicates domain intent that should stay in bundle data
- it makes the harness harder to reuse across metamodels
- it pushes scaffold semantics into code instead of domain packets and evaluation passes

## Target Architecture

### Layer Responsibilities

| Layer | Responsibility | Must not do |
|---|---|---|
| Bundle | Domain semantics, vectors, rules, fixtures, contracts, traceability | Runtime-specific code generation behavior |
| MCP server | Resolve bundle data into generic packets, prompts, and evidence payloads | Hardcode bundle-specific or runtime-specific scaffolds |
| Harness | Orchestrate phases, persist artifacts, run commands, enforce generic gates | Render language-specific source files |
| Builder model | Generate and repair implementation artifacts | Redefine domain semantics |
| Critic model | Review semantic fidelity from bundle context and runtime evidence | Mutate normative frozen artifacts |

### High-Level Flow

1. Harness requests a resolved implementation packet from MCP.
2. Harness requests a resolved conformance packet from MCP.
3. Harness writes those packets to the run workspace as immutable inputs.
4. Builder model generates or repairs implementation artifacts from those frozen inputs.
5. Harness runs deterministic commands such as install, build, and test.
6. Critic model reviews generated code, frozen packets, and command outputs.
7. Harness aggregates machine results plus critic findings into one final report.

## Proposed MCP Outputs

The MCP server should stay generic and domain-serving.

It should expose generic outputs such as:
- `resolve_implementation_packet`
- `resolve_conformance_packet`
- `resolve_traceability_packet`
- `resolve_validation_packet`

These are not runtime-specific scaffolds. They are structured domain packets.

Example packet contents:
- implementation packet:
  - selected binding
  - runtime profile
  - dependency policy
  - output contract
  - relevant operations
  - relevant profiles
  - relevant rules and steps
  - exact DTO contracts
- conformance packet:
  - suite
  - ordered vectors
  - fixtures
  - expected outputs
  - frozen artifact policy
- traceability packet:
  - rule-to-vector map
  - step-to-rule map
  - contract coverage expectations
- validation packet:
  - acceptance commands
  - artifact expectations
  - semantic evaluation checklist

## Builder And Critic Model Roles

### Builder Model

The builder model should:
- read resolved packets
- generate implementation artifacts
- optionally run a compact repair loop in `self-verify`
- explain non-obvious logic with traceability comments

Default policy:
- use a faster, cheaper model for the builder phase
- prefer `gemini-3-flash` class models for generation and repair loops

It may generate:
- source code
- config
- docs
- examples
- tests, if tests are declared mutable for that workflow

### Critic Model

The critic model should be a separate pass from the builder.

Default policy:
- use a stronger reasoning model than the builder
- prefer `gemini-3-pro` class models for semantic validation
- current harness default uses the CLI-available identifier `gemini-3-pro-preview`
- support pluggable critic backends so the harness can switch between provider CLIs without changing bundle or MCP semantics
- support a `critic-only` mode so an existing run directory can be re-evaluated without paying for regeneration again
- when the critic backend supports structured output, enforce the verdict shape at the CLI layer rather than relying on prose-only instructions
- if a critic session explores but does not finish, prefer bounded resume prompts over restarting from scratch
- do not default the critic to the same model as the builder unless cost or availability forces it

Inputs:
- resolved MCP packets
- generated workspace
- command outputs
- audit logs
- traceability expectations

Outputs:
- findings
- semantic fidelity assessment
- suspected cheating or overfitting
- missing coverage or suspicious shortcuts
- recommendation: pass, fail, or rerun

The critic should look for things like:
- silent weakening of assertions
- mutation of normative frozen artifacts
- mismatch between code comments and actual rule behavior
- DTO drift
- vectors that are technically present but semantically misrepresented

Operational note:
- stronger critics may require tighter review prompts than builders
- if a critic spends too long spelunking artifacts, tighten the critic brief and packet set before adding more harness-specific logic
- a practical bounded pattern is:
  1. first pass with enforced output schema and a shallow packet-only review
  2. if machine evidence is green and the shallow critic finds no concrete anomaly, stop there
  3. only escalate to deep review when machine evidence or shallow findings justify it
  4. if no final verdict appears, resume the same session with a short "finish now" prompt
  5. cap retries and then mark the critic inconclusive

Do not solve green-run critic stalls by just giving the critic more time.
Prefer:
- narrower evidence scope
- bounded file-inspection budgets
- shallow-then-deep escalation

## OpenCode Builder Checkpoint

The harness now supports:
- pluggable builder backends
- an OpenCode builder backend
- a stricter OpenCode `packet-only` builder profile
 - a GLM-specific `glm-strict` builder profile
 - builder observability artifacts

Current proven results with the binding harness using OpenCode with GLM-5 Turbo as builder and GPT-5.2 as critic:
- Python JWT pilot:
  - `glm-strict` completed a full `self-verify` run successfully
  - install, build, tests, semantic audit, and critic all passed
  - [report.json](/home/ivan/dev/sdd-bundle-editor/.scratch/binding-runs/2026-03-31T17-01-17-613Z-BIND-python-pyjwt-library/report.json)
- Node JWT pilot:
  - `glm-strict` completed a full `self-verify` run successfully
  - frozen-test integrity, `pnpm install`, `pnpm build`, `pnpm test`, semantic audit, and critic all passed
  - [report.json](/home/ivan/dev/sdd-bundle-editor/.scratch/binding-runs/2026-03-31T18-46-52-952Z-BIND-node-jose-library/report.json)

That means the OpenCode/LiteLLM path is no longer just an experiment in harness wiring.
It is now a validated execution path for multiple runtime-specific bindings.
- session resume for finalization

Over:
- unbounded exploration
- hour-long critic runs by default
- broad workspace spelunking on already-green audits

## Generic Mechanical Guardrails

These should remain deterministic and generic:
- workspace creation
- prompt and packet logging
- file hashing for frozen assets
- artifact existence checks
- install/build/test command execution
- report persistence
- semantic report storage

These checks are allowed because they are not domain-specific.

## Current Checkpoint

The current JWT Node.js pilot has already proven the basic workflow:
- bundle-defined binding prompts are served through MCP
- the harness can run both `generate-only` and `self-verify`
- a fresh Node.js pilot run can pass machine audit and semantic audit
- critic-only replay now works with a bounded shallow-first Codex critic flow
- deterministic frozen packs are now selected through manifest-declared compatibility metadata instead of one exact runtime triple

That means the workflow is viable.

The remaining work is no longer “can this work at all?”
It is now mostly:
- generalization
- cleanup
- second-runtime verification

## Next Steps

This section is the explicit handoff of the remaining work that has been discussed so far.

### A. Finish Harness Generalization

Goal:
- keep the harness generic and evidence-oriented
- remove remaining JS/TS-shaped assumptions where they are not truly generic

Concrete work:
- replace language-specific check names such as `typescript-typecheck` with more runtime-neutral names
- prefer runtime-profile build commands for outer static/build validation, with TypeScript compiler checks only as a fallback
- continue reducing JS/TS-shaped artifact-priority assumptions in critic workspace snapshot selection
- derive more audit and critic-selection behavior from runtime profile, output contract, and validation packet data
- continue shrinking pilot-specific template assumptions under `scripts/binding-harness-templates/*`
- prefer declarative frozen-pack compatibility metadata such as package manager, runtime language, toolchain, and tags over one exact runtime-name convention
- prefer manifest-declared frozen-pack directories and file outputs over hardcoded harness directory creation
- prefer manifest-declared replacement keys over hardcoded replacement enums in harness code
- prefer manifest-declared fixture/vector projection rules over hardcoded frozen-context shaping in harness code
- prefer manifest-declared named context entries over harness-owned literal context keys like `fixtureMap` or `suiteId`
- prefer pack-local template references over manifest paths that know the global harness template tree
- allow small frozen-pack artifacts to live as inline templates in the manifest instead of requiring separate `.tmpl` files

Why this matters:
- the Node.js pilot is green, but the harness still reflects its first successful runtime family
- a second runtime will be harder than necessary until this bias is reduced

### B. Verify A Second Runtime

Goal:
- prove the architecture is not just a successful Node.js special case

Recommended second runtime:
- Python

Concrete work:
- add or tighten the Python binding profile
- run the same harness pattern end to end for Python
- verify:
  - generation
  - frozen-test workflow
  - machine audit
  - semantic audit
  - critic replay

Why Python:
- already modeled as a high-priority family
- different enough from Node.js to expose harness assumptions
- still common enough to be a strong validation target

Current checkpoint:
- the harness can now materialize a deterministic Python frozen test pack for `BIND-python-pyjwt-library`
- runtime command policy now supports `pip`
- a fully automated Python `self-verify` run now exits cleanly end to end with:
  - dependency install via `pip`
  - `python -m compileall src`
  - `pytest`
  - passing semantic audit
  - passing Codex critic verdict
- the harness now has two generic long-run completion paths:
  - builder quiescence handoff once real non-test artifacts exist and the builder goes quiet
  - structured critic early-complete once a schema-valid verdict file has been written
- default harness runs now resolve implementation and conformance packets through MCP packet types instead of calling prompt endpoints directly
- a fresh-port non-green Python run proved the packet-tool path is live and that the shallow-first critic now fails correctly on concrete harness evidence
- critic workspace snapshots now ignore common cache/build artifacts and prioritize runtime-relevant manifests plus source/test/docs more generically

### C. Move From Prompt Names To Packet-Type Resolution

Goal:
- reduce harness awareness of runtime MCP prompt endpoint names

Current state:
- default harness runs now resolve `implementation` and `conformance` packets through MCP
- legacy prompt-name overrides still exist for explicit fallback and debugging
- run artifacts now keep raw prompt bodies under `prompt/` while packets store summaries and file references

Target state:
- the harness asks MCP for generic packet types such as:
  - implementation packet
  - conformance packet
  - validation packet
  - traceability packet

Concrete work:
- continue moving prompt-name selection behind MCP
- keep packet contents summary-oriented and avoid duplicating raw prompt bodies outside the `prompt/` artifact area
- keep prompt templates and prompt entities as MCP internals rather than harness concerns

Why this matters:
- it reduces prompt-serving leakage into the harness
- it makes the harness simpler and more metamodel-agnostic

### D. Continue Tightening The Critic Pattern

Goal:
- keep the critic bounded, structured, and useful

Already done:
- structured output
- bounded resume loop
- shallow-first critic flow
- critic-only replay mode

Remaining work:
- make sure the deep critic path stays bounded and anomaly-driven
- consider whether multiple critic backends should share one common report normalization layer

Why this matters:
- a critic that wanders is expensive and hard to trust
- a critic that is too shallow may miss real semantic drift

### E. Remove Remaining Transitional Pilot Seams

Goal:
- separate “working pilot” code from “target architecture” code

Examples of transitional seams:
- current packet contents still persist large resolved prompt responses
- critic workspace snapshot is still partly driven by current project-shape assumptions
- some conformance-generation behavior is still closer to the pilot path than the target packet-only path

This work should be done carefully:
- keep the working Node pilot path green
- remove one seam at a time
- validate after each slice

## Refactor Plan For The Current Harness

### Delete From Harness

These are pilot-specific runtime scaffolds and should leave `scripts/run-binding-harness.ts`:

| Current function or block | Why delete |
|---|---|
| `renderNodeFixtureModule()` | Node/TypeScript-specific source generation |
| `renderNodeVectorsModule()` | Node/TypeScript-specific source generation |
| `renderNodeTestUtilsModule()` | Hardcoded runtime helper logic |
| `renderNodeConformanceTestModule()` | Hardcoded test file template |
| Node-specific source strings embedded in the harness | Mixes orchestration with scaffold rendering |

These should not be replaced with new runtime-specific code inside MCP.

### Generalize In Harness

These should remain, but only as generic orchestration or evidence plumbing:

| Current function or block | How to generalize |
|---|---|
| `runGeminiPhase()` | Rename conceptually to generic builder-model phase runner |
| critic backend selection | Keep as generic provider/runtime selection, not bundle logic |
| `critic-only` reuse path | Keep as generic evidence replay over an existing run directory |
| `runAuditCommand()` | Keep as generic command executor |
| audit report writing | Keep as generic evidence emission |
| frozen manifest hashing and verification | Keep as generic immutable-input guard |
| vector coverage scan | Keep only if it remains packet-driven and language-agnostic |
| prompt and run directory logging | Keep unchanged |

### Replace With Packet Materialization

These current behaviors should stop generating source and instead write generic resolved packets:

| Current behavior | Replace with |
|---|---|
| `tryMaterializeDeterministicFrozenTests()` | `materializeResolvedPackets()` or equivalent generic packet writer |
| writing `tests/*.ts` from inline templates | writing JSON/Markdown/YAML packet artifacts from MCP responses |
| Node-only deterministic frozen test pack | runtime-neutral conformance packet plus immutable manifest |

### Replace With Critic Pass

These responsibilities should move from ad hoc prompt tightening or runtime scaffolding into a separate AI critic:

| Current pressure point | Replace with critic responsibility |
|---|---|
| trying to hardcode more runtime semantics into builder prompts | critic flags semantic drift explicitly |
| trying to predict every cheating strategy in harness code | critic reviews for cheating and weak assertions |
| overfitting prompt text for one library/runtime | critic compares output behavior against packet intent |
| bundle-specific semantic interpretation in harness code | critic reasons from bundle packets directly |

## Specific Current Seams

The current file [run-binding-harness.ts](/home/ivan/dev/sdd-bundle-editor/scripts/run-binding-harness.ts) should be treated as having three architectural zones:

### Zone A: Keep

- CLI argument parsing
- MCP session/bootstrap
- run directory management
- phase orchestration
- report serialization
- command execution
- hash-based frozen integrity checks

### Zone B: Transitional

- vector coverage parsing
- TAP semantic parsing
- placeholder scans

These can remain for now, but should eventually consume generic packet metadata rather than implicit Node-specific assumptions.

### Zone C: Remove

- embedded Node source templates
- Node-specific fixture and token-preparation logic
- runtime-specific deterministic scaffold materialization

## Recommended New Harness Phases

### Phase 1: Resolve Packets

Harness asks MCP for:
- implementation packet
- conformance packet
- validation packet

Harness writes them to disk as immutable inputs.

### Phase 2: Build

Builder model receives:
- packets
- workspace path
- artifact mode
- mutation policy

Builder generates or repairs code.

### Phase 3: Execute

Harness runs:
- install
- build
- test

### Phase 4: Critique

Critic model receives:
- packets
- generated workspace
- execution logs
- machine audit results

Critic emits:
- pass/fail recommendation
- findings
- confidence statement

### Phase 5: Final Gate

Harness combines:
- deterministic machine checks
- critic findings

Final status is successful only if:
- generic machine checks pass
- critic does not report blocking semantic failures

## Migration Plan

### Stage 1

Keep current harness working, but stop adding new runtime-specific rendering logic.

### Stage 2

Introduce packet-writing outputs in MCP or alongside MCP responses without changing the builder loop yet.

### Stage 3

Replace embedded Node test/scaffold renderers with packet persistence.

### Stage 4

Add a separate critic-model phase.

### Stage 5

Remove remaining runtime-specific scaffold generation from the harness.

## Recommendation

Do not evolve the current harness by adding more embedded runtime code or by moving that code into the MCP server.

The next architecture should be:
- bundle-owned domain semantics
- generic MCP packet resolution
- generic harness orchestration
- fast builder model for generation
- stronger critic model for semantic validation
- minimal deterministic mechanical gates

That is the cleanest path to a truly project-agnostic harness.
