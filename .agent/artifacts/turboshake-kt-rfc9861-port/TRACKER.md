# TurboSHAKE / KangarooTwelve Port Tracker

Status: implementation started

This tracker breaks the future bundle port into executable phases.

## Phase 0: Source normalization

- [x] Re-parse `profile-core.yaml` and isolate all YAML syntax defects.
- [x] Confirm the intended structure for `ErrorCategory`.
- [ ] Confirm the canonical `HopMAC256` expected tag value.
- [x] Record any local normalization rules if the sibling repo is not patched first.
- [x] Freeze a source snapshot/version for import.

## Phase 1: Bundle type design

- [x] Confirm bundle type name, currently recommended: `crypto-profile`.
- [x] Finalize first-class entity types:
  - `CryptoProfile`
  - `NormativeReference`
  - `Primitive`
  - `Constraint`
  - `Operation`
  - `DataStructure`
  - `ErrorCategory`
  - `ConformanceClass`
  - `ConformanceSuite`
  - `TestVector`
- [x] Decide whether `HostMapping` and `ResultSemantics` live as `Constraint` entities or profile-level fields.
- [x] Decide whether helper `length_encode` is modeled only as a `Primitive`, or as both `Primitive` and `Operation`.

## Phase 2: Bundle scaffolding

- [x] Create new reference bundle directory.
- [x] Create `sdd-bundle.yaml`.
- [x] Create all schema files for the chosen entity types.
- [x] Define bundle layout directories.
- [x] Add domain knowledge and lint config stubs.

## Phase 3: Profile and references

- [x] Create top-level `CryptoProfile` entity.
- [x] Import RFC 9861, FIPS 202, and supporting references as `NormativeReference`.
- [x] Attach source provenance metadata.

## Phase 4: Core primitives and constraints

- [x] Import all primitives/helpers.
- [x] Import all constraint leaf entries as separate `Constraint` entities.
- [x] Link primitives and operations to the constraints that govern them.

## Phase 5: Operations, structures, and error semantics

- [x] Create input/output `DataStructure` entities.
- [x] Create `Operation` entities for one-shot and context methods.
- [x] Create `ErrorCategory` entities and link them from constraints and operations.

## Phase 6: Conformance assets

- [x] Create `ConformanceClass` entities.
- [x] Create `ConformanceSuite` entities.
- [x] Import RFC vector families as `TestVector` family entities.
- [x] Import local HopMAC vectors as concrete `TestVector` entities.

## Phase 7: Validation

- [x] Run strict bundle validation.
- [x] Inspect graph integrity and missing-reference diagnostics.
- [ ] Review UI rendering for entity readability.
- [ ] Fix schema/layout issues before treating the bundle as reference-quality.

## Current recommendation checkpoints

- [x] Source unit located and reviewed.
- [x] Structural defects identified.
- [x] Architectural recommendation made: use a purpose-built crypto-profile bundle type.
- [x] Initial source-to-entity mapping drafted.
- [x] Bundle type schema work started.

## Notes

- `length_encode` is modeled as both a `Primitive` and an `Operation`.
- `HostMapping` and `ResultSemantics` remain summarized in profile/constraint content
  rather than being promoted to extra entity types in this first implementation.
- Strict validation was run through a dedicated temporary MCP server on port `3101`
  against bundle id `turboshake-k12-rfc9861-bundle`.
- The remaining substantive source issue is the unconfirmed canonical value of the
  local `HopMAC256` vector, whose source text currently contains an embedded space.
