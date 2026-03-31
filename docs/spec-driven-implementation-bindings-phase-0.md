# Spec-Driven Implementation Bindings – Phase 0

Status: Implemented for pilot modeling
Parent design: [docs/spec-driven-implementation-bindings.md](./spec-driven-implementation-bindings.md)
Focus: Concrete entity model and MCP prompt-serving architecture

## Purpose

This document turns the high-level binding concept into an implementation-ready phase-0 design.

The goal of phase 0 is not to generate code yet. The goal is to define:
- the minimum viable entity set
- the field shape of those entities
- the relationship model
- the MCP prompt adapter architecture
- the pilot runtime scope

If phase 0 is accepted, implementation can begin without reopening the core architecture.

## Architectural Decision

Recommendation: use a dedicated binding bundle model layered on top of the abstract JWT bundle.

| Option | Description | Pattern consistency | SSOT | Recommendation |
|---|---|---|---|---|
| A | Put runtime-binding fields directly into the JWT abstract entities | Low | Weak | No |
| B | Keep abstract JWT bundle separate and add binding-specific entities in a separate bundle layer | High | Strong | Yes |
| C | Keep prompts only in server code and model no binding entities | Medium | Weak | No |

Recommendation:
- choose option B as the long-term architecture
- use path 2 for the pilot delivery shape
- keep a small generic prompt adapter in server code
- move binding-specific prompt content into bundle entities

## Pilot Scope

Phase-0 planning assumes:
- one abstract JWT bundle
- one Node.js pilot binding
- one Python pilot binding
- future binding profiles for Java, C#, Go, and Rust

Verification scope for the first implementation wave:
- generate and test Node.js
- generate and test Python
- document but do not verify Java, C#, Go, and Rust yet

## Proposed Bundle Strategy

Two viable implementation paths exist:

### Path 1: New `implementation-binding` bundle type

Pros:
- clean separation of concerns
- reusable beyond JWT
- clear ownership boundary for platform teams

Cons:
- more schema and bundle-type work up front

### Path 2: Extend `jwt-validator` bundle type with binding entities

Pros:
- faster pilot
- fewer moving pieces initially

Cons:
- risks coupling JWT-specific modeling to a broader platform-binding concern

Chosen pilot path:
- implement the pilot as an extension of the JWT validator reference bundle shape
- keep the entity names and schemas generic enough to move into a reusable `implementation-binding` bundle type later

That gives us a fast first delivery without locking ourselves into JWT-only semantics.

## Minimum Viable Entity Set

### 1. `ImplementationBinding`

Purpose:
- the top-level entity for a platform-specific implementation target

Owns:
- target runtime
- supported operations
- dependency policy
- output contract
- prompt templates
- pilot status

Required fields:
- `id`
- `kind`
- `title`
- `bindingFamily`
- `language`
- `runtimeProfileId`
- `dependencyPolicyId`
- `outputContractId`
- `implementsOperationIds`

Suggested fields:
- `description`
- `rationale`
- `tags`
- `bindingStatus`
- `stability`
- `targetProfileIds`
- `governedByAdrIds`
- `promptTemplateIds`
- `conformanceSuiteIds`
- `exampleBindingIds`

Suggested enums:
- `bindingFamily`: `library`, `sdk`, `endpoint-example`, `cli`, `middleware`
- `bindingStatus`: `proposed`, `pilot`, `active`, `deprecated`
- `stability`: `experimental`, `candidate`, `stable`

### 2. `RuntimeProfile`

Purpose:
- capture the execution environment and language/toolchain policy

Required fields:
- `id`
- `kind`
- `title`
- `language`
- `runtimeName`
- `runtimeVersion`

Suggested fields:
- `packageManager`
- `toolchain`
- `moduleSystem`
- `minimumLanguageVersion`
- `platformNotes`
- `supportsAsync`
- `distributionFormat`

Examples:
- Node.js 22 + TypeScript 5 + `pnpm`
- Python 3.12 + `pip`
- Java 21 + Maven

### 3. `DependencyPolicy`

Purpose:
- declare exactly which libraries and versions the generator may use

Required fields:
- `id`
- `kind`
- `title`
- `dependencyMode`
- `allowedDependencies`

Suggested fields:
- `forbiddenDependencies`
- `pinningPolicy`
- `upgradePolicy`
- `securityNotes`

Recommended dependency item shape:
- `name`
- `version`
- `purpose`
- `required`

Recommended enums:
- `dependencyMode`: `allowlist-only`, `allowlist-with-optional-extras`
- `pinningPolicy`: `exact`, `minor-range`, `major-range`

### 4. `OutputContract`

Purpose:
- define what generated artifacts must exist and what public API shape they expose

Required fields:
- `id`
- `kind`
- `title`
- `artifactMode`
- `publicEntrypoints`
- `requiredArtifacts`

Suggested fields:
- `readmeSections`
- `testLayout`
- `exampleArtifacts`
- `manifestFields`

Recommended enums:
- `artifactMode`: `library-only`, `library-and-examples`

Example public entrypoints:
- `validateJwt`
- `parseValidatedClaims`

### 5. `BindingPromptTemplate`

Purpose:
- define binding-specific prompt templates that the MCP server can expose via a generic adapter

Required fields:
- `id`
- `kind`
- `title`
- `promptRole`
- `templateVersion`
- `templateBody`
- `argumentSchema`

Suggested fields:
- `description`
- `selectionPolicy`
- `outputExpectations`
- `defaultModelClass`
- `maxContextBudget`

Recommended enums:
- `promptRole`: `implement-binding`, `generate-binding-tests`, `binding-gap-analysis`, `explain-binding`

### 6. `BindingConstraint`

Purpose:
- capture runtime-specific restrictions that should not be buried inside free text

Examples:
- “must reject `alg: none`”
- “must not fetch remote JWKS in phase 1”
- “must return structured error codes, not raw library exceptions”

## Relationship Model

Recommended reference direction:

- `ImplementationBinding.runtimeProfileId -> RuntimeProfile`
- `ImplementationBinding.dependencyPolicyId -> DependencyPolicy`
- `ImplementationBinding.outputContractId -> OutputContract`
- `ImplementationBinding.implementsOperationIds -> Operation`
- `ImplementationBinding.targetProfileIds -> TokenProfile`
- `ImplementationBinding.promptTemplateIds -> BindingPromptTemplate`
- `ImplementationBinding.conformanceSuiteIds -> ConformanceSuite`
- `ImplementationBinding.constraintIds -> BindingConstraint`
This keeps the binding as the composition root.

## ID Conventions

Recommended ID prefixes:
- `BIND-...` for `ImplementationBinding`
- `RTPROF-...` for `RuntimeProfile`
- `DEPPOL-...` for `DependencyPolicy`
- `OUTCON-...` for `OutputContract`
- `BPROMPT-...` for `BindingPromptTemplate`
- `BCON-...` for `BindingConstraint`
- `BEX-...` for `BindingExample`

Examples:
- `BIND-node-jose-library`
- `BIND-python-pyjwt-library`
- `RTPROF-node22-ts5-pnpm`
- `DEPPOL-node-jose-v5`
- `OUTCON-library-core-v1`
- `BPROMPT-implement-binding-v1`

## Draft Field Sketches

These are not final JSON Schemas. They are the target shape phase 1 should encode.

### `ImplementationBinding`

```yaml
id: BIND-node-jose-library
kind: ImplementationBinding
title: Node.js JWT Validation Library using jose
bindingFamily: library
bindingStatus: pilot
stability: experimental
language: typescript
description: |
  Generates a library-only JWT validator for Node.js using the jose package.
runtimeProfileId: RTPROF-node22-ts5-pnpm
dependencyPolicyId: DEPPOL-node-jose-v5
outputContractId: OUTCON-library-core-v1
implementsOperationIds:
  - OP-validate-jwt
targetProfileIds:
  - PROF-jwt-core
promptTemplateIds:
  - BPROMPT-implement-binding-v1
  - BPROMPT-generate-binding-tests-v1
conformanceSuiteIds:
  - SUITE-jwt-core-validation
constraintIds:
  - BCON-no-framework-integration
```

### `RuntimeProfile`

```yaml
id: RTPROF-node22-ts5-pnpm
kind: RuntimeProfile
title: Node.js 22 + TypeScript 5 + pnpm
language: typescript
runtimeName: node
runtimeVersion: "22"
minimumLanguageVersion: "5.0"
packageManager: pnpm
moduleSystem: esm
supportsAsync: true
distributionFormat:
  - source
  - types
```

### `DependencyPolicy`

```yaml
id: DEPPOL-node-jose-v5
kind: DependencyPolicy
title: Node jose v5 allowlist
dependencyMode: allowlist-only
pinningPolicy: exact
allowedDependencies:
  - name: jose
    version: "5.9.6"
    purpose: JWT parsing and signature verification
    required: true
forbiddenDependencies:
  - jsonwebtoken
securityNotes: |
  Do not add alternative JWT libraries. Keep verification behavior anchored
  to the approved dependency set.
```

### `OutputContract`

```yaml
id: OUTCON-library-core-v1
kind: OutputContract
title: Core library artifact contract
artifactMode: library-only
publicEntrypoints:
  - name: validateJwt
    kind: function
    required: true
  - name: parseValidatedClaims
    kind: function
    required: false
requiredArtifacts:
  - src/validator.ts
  - src/types.ts
  - tests/conformance/validator.spec.ts
  - README.md
  - binding-manifest.json
  - CONFORMANCE.md
```

### `BindingPromptTemplate`

```yaml
id: BPROMPT-implement-binding-v1
kind: BindingPromptTemplate
title: Implement Binding
promptRole: implement-binding
templateVersion: "1.0.0"
targetBindingIds:
  - BIND-node-jose-library
argumentSchema:
  required:
    - bindingId
    - operationId
  properties:
    bindingId:
      type: string
    operationId:
      type: string
    artifactMode:
      type: string
      enum: [library-only, library-and-examples]
templateBody: |
  Implement the target operation using the referenced implementation binding.
  Use the bound dependency policy exactly.
  Produce the required artifacts from the output contract.
  Follow the referenced conformance suites and test vectors.
outputExpectations:
  - Produce code only for approved artifacts.
  - Do not add framework integration unless the output contract requires it.
  - Emit structured errors matching the referenced error codes.
selectionPolicy:
  includeRelations:
    - implementsOperationIds
    - targetProfileIds
    - conformanceSuiteIds
    - dependencyPolicyId
    - outputContractId
```

## MCP Prompt Adapter Design

Current state in this repo:
- prompts are registered in TypeScript via `registerPrompt(...)`
- prompt implementations already know how to gather bundle context

Proposed phase-1 evolution:
- add a generic prompt adapter that reads `BindingPromptTemplate` entities
- validate those entities against a strict schema
- register them as MCP prompts at server startup
- resolve their referenced entities at invocation time

### Adapter Responsibilities

The adapter should:
- discover all `BindingPromptTemplate` entities across loaded bundles
- expose prompt metadata to MCP clients
- validate prompt arguments against an entity-defined schema
- collect referenced entities
- render final prompt text deterministically
- enforce context-budget limits where configured

### Adapter Non-Responsibilities

The adapter should not:
- invent runtime policy
- rewrite dependency versions
- inject hidden implementation rules
- execute generation itself

### Minimal Invocation Model

For the initial `implement-binding` prompt, the adapter should resolve:
- one `ImplementationBinding`
- one `Operation`
- the binding's `RuntimeProfile`
- the binding's `DependencyPolicy`
- the binding's `OutputContract`
- related `TokenProfile`
- related `ConformanceSuite`
- referenced `TestVector`
- referenced `ErrorCode`
- related `SecurityConstraint`

## Context Assembly Rules

To avoid context explosion:
- include full detail for the target `ImplementationBinding`
- include full detail for the selected `Operation`
- include full detail for `DependencyPolicy` and `OutputContract`
- include summaries for large related sets by default
- include full `TestVector` payload only for vectors in the selected suite
- truncate large markdown fields with an explicit truncation marker

This should align with the MCP prompt scaling guidance already present in the repo.

## Pilot Runtime Matrix

| Binding | Language | Library | Model status | Verification target |
|---|---|---|---|---|
| `BIND-node-jose-library` | TypeScript | `jose` | Pilot | Yes |
| `BIND-python-pyjwt-library` | Python | `PyJWT` | Pilot | Yes |
| `BIND-java-jjwt-library` | Java | `jjwt` | Planned | No |
| `BIND-csharp-dotnet-jwt-library` | C# | `System.IdentityModel.Tokens.Jwt` | Planned | No |
| `BIND-go-golangjwt-library` | Go | `golang-jwt/jwt` | Planned | No |
| `BIND-rust-jsonwebtoken-library` | Rust | `jsonwebtoken` | Planned | No |

## Phase-0 Deliverables

- agreed entity set
- agreed ID conventions
- agreed bundle strategy
- agreed MCP prompt adapter scope
- explicit Node.js and Python pilot profiles

## Implementation Status

Implemented in the JWT pilot bundle:
- new schemas for `ImplementationBinding`, `RuntimeProfile`, `DependencyPolicy`, `OutputContract`, `BindingPromptTemplate`, and `BindingConstraint`
- seed prompt templates for `implement-binding` and `generate-binding-tests`
- concrete binding profiles for Node.js, Python, Java, C#, Go, and Rust
- pilot runtime and dependency policies
- a shared library-only output contract
- a first local generation harness at `scripts/run-binding-harness.ts`
- a successful Node.js pilot run using Gemini CLI with artifacts/logs written under `.scratch/binding-runs/`
- first isolated validation signal: the generated Node.js workspace installs and type-checks, but currently fails most conformance tests
- codified harness modes:
  - `generate-only` for semantic-observability runs
  - `self-verify` for agent-executed test/build loops inside the generated workspace

Not implemented yet:
- runtime verification beyond prompt resolution and initial artifact generation
- automated install/build/test execution and conformance scoring for generated workspaces

## Status Tracker

| Item | Status | Notes |
|---|---|---|
| High-level design | Done | Captured in parent design note |
| Concrete entity set | Done | Schemas and seed entities added to the JWT pilot bundle |
| Binding bundle strategy | Done | Pilot uses JWT bundle extension while keeping generic entity names |
| MCP prompt adapter design | Done | Generic adapter implemented in the MCP server |
| Node.js pilot profile | Done | `jose` profile modeled |
| Python pilot profile | Done | `PyJWT` profile modeled |
| Future language profiles | Done | Java, C#, Go, and Rust modeled but not verified |
| Generation harness | Done | MCP prompt resolution and Gemini CLI invocation now automated |
| Conformance verification | In progress | First generated Node.js workspace installs and type-checks, but currently fails 6 of 7 pilot tests |
| Harness mode policy | Done | Two-step pattern is now explicit; phase 1 stays in `generate-only` |

## Immediate Next Step

After review, the next implementation action should be:

1. install and execute the generated Node.js pilot workspace in isolation
2. compare the generated validator against the conformance vectors and structured error contract
3. tighten prompt instructions or bundle data wherever the generated output drifts
4. only then mirror the same flow for Python

## Harness Policy

The current harness pattern is intentionally split:

General working rule:
- freeze normative tests from spec entities before implementation generation
- treat those tests as immutable contract inputs
- keep end-of-run structural and semantic audits outside the model loop

1. `generate-only`
Purpose: observe prompt quality and semantic drift without mixing in package-manager or runner effects.
Outer harness policy:
- run a post-generation audit after the model exits
- reject runs that omit modeled vector IDs, contain placeholder/prose-plan markers, or fail clean typecheck/build-test gates for the active runtime

2. `self-verify`
Purpose: let the model execute a compact spec-driven loop:
- generate or refine conformance tests first
- implement against them
- install dependencies
- run build/test
- iterate until green or blocked

Current status: the JWT pilot remains in step 1 until the generated Node.js output is close enough that autonomous execution loops produce useful signals instead of noise.
