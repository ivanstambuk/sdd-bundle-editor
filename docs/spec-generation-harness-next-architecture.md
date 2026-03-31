# Spec Generation Harness – Next Architecture

Status: Proposed
Parent documents:
- [docs/spec-driven-implementation-bindings.md](./spec-driven-implementation-bindings.md)
- [docs/spec-driven-implementation-bindings-phase-0.md](./spec-driven-implementation-bindings-phase-0.md)

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
4. Builder model generates or repairs implementation artifacts.
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
