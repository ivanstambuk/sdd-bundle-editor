# TurboSHAKE / KangarooTwelve / HopMAC Port Plan

Status: implementation started

This directory captures the pre-implementation plan for porting the sibling `sdd-specs` unit
`sdd.crypto.xof.turboshake-kt-hopmac-rfc9861-profile` into a new bundle in this repo.

An initial bundle scaffold now exists at
`reference-bundles/turboshake-k12-rfc9861-bundle`.

This document continues to serve as the planning and source-analysis record for
that implementation.

## Source of truth

Primary source unit:
- `/home/ivan/dev/sdd-specs/specs/protocols/crypto/turboshake-kt-hopmac-rfc9861-profile`

Important files:
- `spec.yaml`
- `spec.md`
- `profile-spec.md`
- `profile-core.yaml`
- `conformance.yaml`
- `decision-log.md`
- `open-questions.md`

Relevant local precedents:
- `reference-bundles/jwt-validator-bundle/`
- `reference-bundles/sdd-sample-bundle/`
- `.agent/docs/schema/schema-authoring-guide.md`
- `.agent/docs/terminology.md`

## Executive summary

The sibling spec unit is real, cataloged, and materially complete enough to port, but it is not
clean enough to consume blindly.

What is solid:
- The spec unit is indexed in `sdd-specs/catalog/specs-index.yaml`.
- The normative core is clearly separated from narrative text.
- The source covers primitives, constraints, API contracts, error semantics, conformance criteria,
  RFC test-vector families, and local HopMAC vectors.
- `open-questions.md` is empty, so the source is not visibly blocked on unresolved design issues.

What is not solid:
- `profile-core.yaml` is not valid YAML as currently checked in.
- `conformance.yaml` contains at least one malformed-looking hex string with an embedded space.
- Some narrative files contain stale references to files that do not exist.

Conclusion:
- The source is good enough for a planned port.
- The first implementation step must include source normalization or a controlled import shim.

## Recommended bundle strategy

### Options

| Concern | Option A: force into generic `sdd-core` entities | Option B: create a purpose-built crypto-profile bundle type |
|---|---|---|
| SSOT | Weak: much of the source would collapse into prose blobs | Strong: source concepts stay first-class |
| Separation of concerns | Weak: profile semantics get mixed into generic product-planning entities | Strong: cryptographic profile concepts get dedicated shapes |
| Pattern consistency | Mixed: reuses sample bundle, but not the stronger domain-specific precedent | Strong: follows the `jwt-validator-bundle` pattern of a specialized reference bundle |
| Reuse and propagation | Weak: hard to reuse constraints, operations, and vectors cleanly | Strong: entities line up with future protocol/crypto bundles |
| Import fidelity | Weak: loses structure from `Constraints`, `API`, `ConformanceCriteria` | Strong: preserves the spec's real machine-readable structure |

Recommendation:
- Choose Option B.

Why:
- This source is already a structured profile with named primitives, constraints, APIs, and
  conformance assets.
- Reusing the architectural pattern of `jwt-validator-bundle` is better than flattening
  cryptographic semantics into the generic `sdd-core` vocabulary.
- The eventual result should be a dedicated crypto-profile reference bundle, not a generic
  sample-bundle variant with overloaded fields.

## Proposed target model

Recommended bundle type name:
- `crypto-profile`

Recommended design stance:
- Use the `jwt-validator-bundle` as the architectural precedent for specialized, reference-grade
  standards content.
- Keep the bundle read-mostly and spec-focused.
- Preserve "editor is dumb, AI is smart" by keeping transformations importable and traceable, not
  hand-maintained through ad hoc prose edits.

### Proposed first-class entity types

| Proposed entity type | Purpose | Why first-class |
|---|---|---|
| `CryptoProfile` | Top-level profile definition and scope | The source is a named profile, not just a loose set of algorithms |
| `NormativeReference` | RFC 9861, FIPS 202, Keccak references, historical draft | Stable external anchors reused across many entities |
| `Primitive` | KP, TurboSHAKE128, TurboSHAKE256, KT128, KT256, HopMAC128, HopMAC256, TurboSHAKEContext, length_encode | These are the main semantic objects of the source |
| `Constraint` | Parameter bounds and policy constraints | `Constraints.*` is a core normative block and should remain queryable |
| `Operation` | Public APIs and callable behaviors | The source distinguishes callable contracts from named primitives |
| `DataStructure` | Conceptual types and state carriers | Needed for ByteString, ResultType, context state, vector payloads |
| `ErrorCategory` | ParameterError, StateError, InternalError and tags | Error semantics are explicit and should not be hidden in prose |
| `ConformanceClass` | Requirement bundles for specific supported primitive sets | Matches local precedent and keeps conformance queryable |
| `ConformanceSuite` | Executable vector suites | Maps well to RFC and local HopMAC vector groupings |
| `TestVector` | Individual or family vector definitions | The conformance artifact is a major part of the source |

### Entities intentionally deferred from first-class modeling in v1

| Source section | Recommended handling |
|---|---|
| `AgentCoreView` | Derived/index view only; do not import as primary entities |
| `SpecIndex` | Derived/index view only |
| `ProfileSchemaMeta` | Keep as profile metadata or documentation |
| `ProfileSchemaInvariants` | Capture as profile-level notes in v1; promote later only if we need machine-validated schema-invariant entities |
| `ImplementationChecklist` | Planning/support artifact, not normative source content |
| `decision-log.md` | Optional documentation import later |
| `open-questions.md` | Not needed unless new questions arise during port |

## Recommended entity mapping

### 1. Overall source unit

| Source artifact | Target entity | Notes |
|---|---|---|
| `spec.yaml` | `CryptoProfile` | Carry source ID, version, status, owner, lifecycle, source bundle paths |
| `spec.md` | `CryptoProfile` narrative fields | Keep as overview/summary, not as source of behavior |
| `profile-spec.md` | `CryptoProfile` long-form narrative plus import notes | Human-readable companion only; do not duplicate all structure into prose fields |

Recommended `CryptoProfile` responsibilities:
- describe scope
- identify supported primitives
- reference normative sources
- point to applicable conformance classes and suites
- record source-import caveats

### 2. External references

| Source item | Target entity type | Suggested IDs |
|---|---|---|
| RFC 9861 | `NormativeReference` | `RFC-9861` |
| FIPS 202 | `NormativeReference` | `FIPS-202` |
| Keccak team TurboSHAKE page | `NormativeReference` | `REF-KECCAK-TURBOSHAKE` |
| Keccak RFC 9861 commentary | `NormativeReference` | `REF-KECCAK-RFC9861` |
| KangarooTwelve draft | `NormativeReference` | `DRAFT-K12-10` |

### 3. Primitives and helpers

| Source item | Target entity type | Notes |
|---|---|---|
| `KP` | `Primitive` | permutation primitive |
| `TurboSHAKE128` | `Primitive` | XOF primitive |
| `TurboSHAKE256` | `Primitive` | XOF primitive |
| `TurboSHAKEContext` | `Primitive` | stateful/streaming primitive |
| `KT128` | `Primitive` | XOF/tree-hash primitive |
| `KT256` | `Primitive` | XOF/tree-hash primitive |
| `HopMAC128` | `Primitive` | MAC primitive |
| `HopMAC256` | `Primitive` | MAC primitive |
| `length_encode` | `Primitive` | helper algorithm, still first-class because it has a normative domain and algorithm identity |

Recommended primitive fields:
- category
- family
- summary
- normativeReferenceIds
- governedByConstraintIds
- exposesOperationIds
- returnsErrorCategoryIds
- outputModelId

### 4. Constraints

Each `Constraints.*` leaf should become its own `Constraint` entity, not a single monolithic blob.

Suggested split:
- `Constraints.TurboSHAKE.M_length`
- `Constraints.TurboSHAKE.D`
- `Constraints.TurboSHAKE.L`
- `Constraints.KangarooTwelve.M_length`
- `Constraints.KangarooTwelve.C_length`
- `Constraints.KangarooTwelve.length_encode_domain`
- `Constraints.HopMAC.Key_length`
- `Constraints.HopMAC.L_HopMAC128`
- `Constraints.HopMAC.L_HopMAC256`
- `Constraints.Streaming.squeeze_len`

Recommended mapping rule:
- primitives and operations hold outgoing references to the constraints that govern them
- do not duplicate reverse references on constraints

This follows the repo's target-holds-reference rule in `.agent/docs/schema/schema-authoring-guide.md`.

### 5. Operations

Recommended rule:
- model callable contracts as `Operation`
- model named algorithm families and conceptual primitives as `Primitive`

This keeps public behavior and primitive identity separate.

Suggested operation set:
- `OP-kp-permute`
- `OP-turboshake128`
- `OP-turboshake256`
- `OP-turboshake-context-init`
- `OP-turboshake-context-absorb`
- `OP-turboshake-context-finalize`
- `OP-turboshake-context-squeeze`
- `OP-turboshake-context-reset`
- `OP-kt128`
- `OP-kt256`
- `OP-hopmac128`
- `OP-hopmac256`
- `OP-length-encode`

Each `Operation` should reference:
- accepted input structures
- produced output structures
- governed constraints
- produced/possible error categories
- normative references
- owning primitive

### 6. Data structures

Recommended `DataStructure` candidates:
- `STRUCT-byte-string`
- `STRUCT-bitstring-1600`
- `STRUCT-result-type`
- `STRUCT-error-category-tags`
- `STRUCT-turboshake-context-state`
- `STRUCT-turboshake-oneshot-input`
- `STRUCT-turboshake-output`
- `STRUCT-kt-input`
- `STRUCT-hopmac-input`
- `STRUCT-test-vector-parameters`

Why this matters:
- the source has explicit conceptual types and a state model
- operations need stable input/output references
- test vectors need reusable parameter payload shapes

### 7. Error semantics

Do not overload application-style `ErrorCode` for this source.

Recommendation:
- introduce a dedicated `ErrorCategory` entity type for:
  - `ERRCAT-parameter`
  - `ERRCAT-state`
  - `ERRCAT-internal`

Why:
- the source defines categories, not protocol/application error codes
- categories are conceptual and cross-cutting
- they are referenced by operations and constraints

### 8. Conformance assets

Recommended split:

`ConformanceClass`
- primitive capability claims, for example:
  - `CLASS-kp`
  - `CLASS-turboshake-core`
  - `CLASS-kt-core`
  - `CLASS-hopmac-profile`
  - `CLASS-full-rfc9861-profile`

`ConformanceSuite`
- executable vector groups:
  - `SUITE-rfc9861-turboshake`
  - `SUITE-rfc9861-k12`
  - `SUITE-local-hopmac`

`TestVector`
- individual imported vectors or compact family entities

Recommended v1 choice:
- import RFC vector families as one entity per family when the source itself only gives
  pattern families and refers to RFC 9861 for canonical outputs
- import local HopMAC vectors as individual concrete `TestVector` entities because the
  expected outputs are in the source unit

## Source-to-entity mapping detail

### `profile-core.yaml`

| Source block | Target handling |
|---|---|
| `ExternalSpecs` | `NormativeReference` |
| `TypesAndNotation` | `DataStructure` plus profile narrative |
| `HostMapping` | `Constraint` or profile-level narrative, depending on granularity |
| `Constraints` | `Constraint` |
| `ResultType` | `DataStructure` |
| `ErrorCategory` | `ErrorCategory` |
| `ErrorCategoryTags` | `DataStructure` or `ErrorCategory` metadata |
| `ResultSemantics` | `Constraint` or `CryptoProfile` policy notes |
| `ContextLifetime` | `Constraint` attached to `TurboSHAKEContext` |
| `ContextIndependence` | `Constraint` attached to context-bearing primitives/operations |
| `API.*` | `Operation` |
| `ALG.*` | `Primitive` and/or `Operation` linkage |
| `ConformanceCriteria` | `ConformanceClass` and `ConformanceSuite` support text |
| `ImplementationChecklist` | planning/support only; not first-class in v1 |

### `conformance.yaml`

| Source block | Target handling |
|---|---|
| `ConformanceBundle` | `CryptoProfile` metadata or bundle-level provenance note |
| `ExternalTestSuites` | `ConformanceSuite` |
| `ExternalTestVectors` | `TestVector` family entities |
| `LocalHopMACTestVectors` | concrete `TestVector` entities |

## Import rules and non-goals

### Import rules

- Preserve source IDs and names where possible in titles, but use local bundle ID patterns.
- Record source-path provenance on every imported entity.
- Keep narrative and normative content separate.
- Import constraints as separate entities, not embedded arrays inside one profile record.
- Prefer stable traceability over maximal normalization.

### Non-goals for the first port

- Do not attempt to represent every informative index block as its own entity.
- Do not build generator logic or execution logic in this phase.
- Do not "improve" the cryptographic profile semantics during import.
- Do not silently rewrite source defects without recording them in the imported profile notes.

## Preflight defects that must be handled

### Blocking defect 1: invalid YAML in `profile-core.yaml`

Observed issue:
- `ErrorCategory` is malformed and prevents YAML parsing.

Current practical implication:
- direct machine import from the checked-in file is unsafe
- we need either:
  - a normalization patch in the sibling repo first, or
  - a controlled local import shim that repairs only known syntax defects and records that repair

Recommendation:
- fix the sibling source first if possible
- if not, write a narrow normalizer that performs auditable, deterministic cleanup

### Blocking defect 2: malformed HopMAC256 expected hex string

Observed issue:
- the expected tag in `conformance.yaml` contains an embedded space

Practical implication:
- importing it as-is risks a bad vector or downstream confusion

Recommendation:
- confirm intended canonical hex before importing
- if we normalize locally, record both original source text and normalized value

### Editorial drift

Observed issues:
- `profile-design-notes.md` refers to `rfc.md`, but the current file is `profile-spec.md`
- `spec.md` references `critique.md` and `feedback.md`, which are not present

Practical implication:
- not a blocker for the bundle model
- should be recorded in source-analysis notes, not imported as normative content

## Proposed future bundle layout

Recommended shape:

```text
reference-bundles/turboshake-k12-rfc9861-bundle/
├── sdd-bundle.yaml
├── schemas/
│   ├── CryptoProfile.schema.json
│   ├── Primitive.schema.json
│   ├── Constraint.schema.json
│   ├── Operation.schema.json
│   ├── DataStructure.schema.json
│   ├── ErrorCategory.schema.json
│   ├── NormativeReference.schema.json
│   ├── ConformanceClass.schema.json
│   ├── ConformanceSuite.schema.json
│   └── TestVector.schema.json
├── bundle/
│   ├── profiles/
│   ├── primitives/
│   ├── constraints/
│   ├── operations/
│   ├── data-structures/
│   ├── error-categories/
│   ├── normative-references/
│   ├── conformance-classes/
│   ├── conformance-suites/
│   └── test-vectors/
├── domain/
└── config/
```

## Suggested implementation order

1. Normalize and freeze the source snapshot.
2. Define the new bundle type and schemas.
3. Create top-level profile and normative-reference entities.
4. Import primitives and constraints.
5. Import operations and data structures.
6. Import error categories.
7. Import conformance classes, suites, and vectors.
8. Validate the bundle with the strict validator and inspect graph integrity.

## Acceptance criteria for the planning phase

Planning is complete when:
- the target metamodel is chosen
- first-class entity types are named
- the source-to-entity mapping is explicit
- known source defects are documented
- an implementation tracker exists with phaseable work items

That condition is satisfied by this directory.
