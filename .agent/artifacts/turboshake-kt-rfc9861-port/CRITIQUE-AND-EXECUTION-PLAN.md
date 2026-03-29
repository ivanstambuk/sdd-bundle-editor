# TurboSHAKE Bundle Critique And Execution Plan

Date: 2026-03-29

Bundle under review:
- `reference-bundles/turboshake-k12-rfc9861-bundle`

Artifact purpose:
- Capture a grounded critique of the current bundle.
- Separate structural validity from execution readiness.
- Propose a concrete, phased improvement plan.

## Evaluation method

Evidence sources:
- Local MCP validation against an isolated server instance on port `3012`
- Bundle snapshot and relation inspection
- Direct inspection of representative profile, constraint, primitive, operation, data-structure, conformance, and test-vector files

Validation result:
- `validate_bundle` returned `isValid: true` with `0` errors and `0` warnings.

Inventory summary:
- `65` entities across `10` types
- `1` CryptoProfile
- `9` Primitives
- `13` Operations
- `10` Constraints
- `9` DataStructures
- `3` ErrorCategories
- `4` ConformanceClasses
- `3` ConformanceSuites
- `8` TestVectors

Coverage observations from the full snapshot:
- Constraint `rationale`: `1/10`
- DataStructure `samplePayload`: `0/9`
- Primitive `notes`: `1/9`
- Operation `phases`: `5/13`
- TestVector `notes`: `1/8`

## Executive assessment

Architecturally, the bundle is good. It preserves the source domain as first-class entities, has clean traceability, and validates cleanly.

Operationally, it is not yet self-contained enough to serve as a strong execution artifact. The biggest gap is that several conformance assets are still modeled as descriptive references to the RFC instead of locally executable cases with unambiguous expected behavior.

Recommendation:
- Treat the bundle as `structurally sound but execution-incomplete`.
- Prioritize conformance semantics and vector concretization before adding more breadth.

## Strengths

1. The bundle follows the right domain model.
   Commentary: `CryptoProfile`, `Primitive`, `Operation`, `Constraint`, `ConformanceClass`, `ConformanceSuite`, and `TestVector` are the correct first-class concepts for this source. The current structure preserves normative meaning instead of flattening it into prose.

2. Traceability is already strong.
   Commentary: The profile points cleanly to references, primitives, classes, and suites, and the primitives and operations are consistently wired to constraints and error categories.

3. The bundle is honest about import debt.
   Commentary: The profile records known source issues and import deferrals instead of hiding them. That makes future cleanup work tractable.

4. The source separation is sensible.
   Commentary: Primitives, operations, constraints, and conformance artifacts are separated well enough that further refinement can happen incrementally without remapping the whole bundle.

## Findings

### 1. High severity: the profile contract and one conformance vector family appear to disagree

Evidence:
- The public TurboSHAKE constraint disallows reserved values `0x06`, `0x07`, and `0x0B` on the public surface when KT is present in [CON-turboshake-domain-byte.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/constraints/CON-turboshake-domain-byte.yaml#L4) and [CON-turboshake-domain-byte.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/constraints/CON-turboshake-domain-byte.yaml#L15).
- The `TurboSHAKE256` domain-case vector explicitly includes `D: 6`, `D: 7`, and `D: 11` while still invoking `OP-turboshake256` in [VEC-rfc9861-turboshake256-domain-cases.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/test-vectors/VEC-rfc9861-turboshake256-domain-cases.yaml#L18) and [VEC-rfc9861-turboshake256-domain-cases.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/test-vectors/VEC-rfc9861-turboshake256-domain-cases.yaml#L25).
- That vector currently expects canonical RFC outputs, not an expected rejection, in [VEC-rfc9861-turboshake256-domain-cases.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/test-vectors/VEC-rfc9861-turboshake256-domain-cases.yaml#L33).

Why this matters:
- This is the most serious quality issue because it creates ambiguity about what a conforming implementation must do.
- A conformance suite should not silently require behavior that the profile contract prohibits.

Recommendation:
- Decide one of these and encode it explicitly:
- Reclassify those RFC cases as informative upstream coverage, not profile conformance.
- Keep them in conformance, but mark them as negative tests whose expected result is a `ParameterError`.
- Split public-surface conformance from upstream-algorithm parity coverage into separate suites or suite modes.

### 2. High severity: external-family vectors are not concrete enough for deterministic local execution

Evidence:
- Several RFC vectors defer expected outputs to upstream text rather than storing local canonical outputs, for example in [VEC-rfc9861-turboshake128-core.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/test-vectors/VEC-rfc9861-turboshake128-core.yaml#L31) and [VEC-rfc9861-turboshake128-core.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/test-vectors/VEC-rfc9861-turboshake128-core.yaml#L34).
- Family parameters use symbolic expressions such as `17**0` through `17**6` in [VEC-rfc9861-turboshake128-core.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/test-vectors/VEC-rfc9861-turboshake128-core.yaml#L28).
- The test-vector parameter model is extremely generic in [STRUCT-test-vector-parameters.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/data-structures/STRUCT-test-vector-parameters.yaml#L10).

Why this matters:
- An execution harness cannot reliably infer how to expand symbolic families unless the expansion grammar is itself modeled.
- Deferring canonical outputs to the RFC forces the consumer to leave the bundle to complete a supposedly local conformance workflow.

Recommendation:
- Pick an execution-first strategy:
- Materialize RFC family vectors into concrete child vectors with exact inputs and outputs.
- Or add a formal family-expansion model plus generator semantics, then generate concrete fixtures as a build artifact.

Preferred option:
- Materialize concrete vectors.

Why:
- It is architecturally better for SSOT and execution reliability.
- The bundle becomes self-contained.
- Tooling complexity stays lower than inventing and maintaining a mini DSL for vector families.

### 3. High severity: one local canonical vector is still unresolved

Evidence:
- The local HopMAC256 vector carries both a source text hex value with an embedded space and a normalized candidate in [VEC-hopmac256-local-canonical.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/test-vectors/VEC-hopmac256-local-canonical.yaml#L26).
- The profile also records this as a known source issue in [PROF-TURBOSHAKE-K12-RFC9861.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/profiles/PROF-TURBOSHAKE-K12-RFC9861.yaml#L51).

Why this matters:
- A contract-grade local canonical vector should have exactly one authoritative expected result.
- Until confirmed, this vector is evidence of a known correctness ambiguity, not a stable conformance fixture.

Recommendation:
- Resolve the canonical HopMAC256 expected tag against the authoritative source or a reference implementation.
- Once confirmed, collapse the dual representation into one definitive field.

### 4. Medium severity: the data-structure layer is descriptive, not execution-grade

Evidence:
- The schema supports `samplePayload`, but none of the nine data structures use it in [DataStructure.schema.json](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/schemas/DataStructure.schema.json#L17).
- `STRUCT-test-vector-parameters` reduces the model to generic `string`, `object`, and `object` buckets in [STRUCT-test-vector-parameters.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/data-structures/STRUCT-test-vector-parameters.yaml#L10).

Why this matters:
- Operations and test vectors refer to these structures as if they were contracts.
- In practice they are closer to documentation stubs than precise IO models.

Recommendation:
- Enrich the structures most used by conformance:
- `STRUCT-test-vector-parameters`
- `STRUCT-xof-call-input`
- `STRUCT-hopmac-call-input`
- `STRUCT-context-method-input`
- `STRUCT-turboshake-context-state`

Minimum improvement:
- Add `samplePayload` everywhere it helps execution and debugging.
- Make `schemaDefinition` fields more explicit about required keys, allowed shapes, and semantic meaning.

### 5. Medium severity: rationale and state semantics are under-modeled

Evidence:
- The `Constraint` schema includes `rationale`, but only one current constraint uses it in [Constraint.schema.json](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/schemas/Constraint.schema.json#L19).
- The profile explicitly says some invariants remain deferred in [PROF-TURBOSHAKE-K12-RFC9861.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/profiles/PROF-TURBOSHAKE-K12-RFC9861.yaml#L55).

Why this matters:
- For AI-assisted reasoning, the difference between a bound and the reason for the bound is important.
- Stateful operations especially benefit from explicit preconditions, transitions, and illegal-state consequences.

Recommendation:
- Add rationale to all normative constraints that narrow or reinterpret RFC behavior.
- Add explicit state-transition commentary to the context operations and context-state structure.
- If the current schema becomes too cramped, evolve it instead of burying semantics in free-form prose.

### 6. Low severity: quality gates are mostly manual right now

Evidence:
- Lint configuration is empty in [sdd-lint.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/config/sdd-lint.yaml#L1).
- The top-level profile is still `draft` even though most linked entities are `active` in [PROF-TURBOSHAKE-K12-RFC9861.yaml](/home/ivan/dev/sdd-bundle-editor/reference-bundles/turboshake-k12-rfc9861-bundle/bundle/profiles/PROF-TURBOSHAKE-K12-RFC9861.yaml#L14).

Why this matters:
- The bundle currently relies on human discipline to maintain consistency.
- The current maturity signals are understandable, but they are not yet enforced by policy.

Recommendation:
- Add lint rules that fail on obvious conformance drift and unresolved canonical vector ambiguity.
- Promote the profile lifecycle only after the execution-grade work is complete.

## Architectural comparison of the two main remediation options

| Concern | Option A: keep family vectors abstract and improve documentation | Option B: materialize concrete executable vectors and tighten suite semantics |
|---|---|---|
| SSOT | Weak: true expected behavior still lives partly in the RFC | Strong: expected behavior lives in the bundle |
| Separation of concerns | Mixed: suite semantics stay blended with narrative interpretation | Strong: contract vectors and informative references can be separated cleanly |
| Pattern consistency | Mixed: valid as a read-mostly import, weak for conformance artifacts | Strong: better matches how executable conformance assets should behave |
| Propagation and reuse | Weak: every consumer must implement family expansion and RFC lookup | Strong: consumers reuse one concrete fixture model |
| Tooling simplicity | Weak: hidden complexity in every downstream consumer | Strong: complexity moved into curated data, not every client |

Recommendation:
- Choose Option B.

## Detailed execution plan

### Phase 1: remove correctness ambiguity

Goal:
- Make the current contract internally coherent.

Tasks:
1. Decide the status of reserved-domain RFC cases.
2. Either move them out of profile conformance or convert them into explicit negative tests.
3. Resolve the HopMAC256 canonical output ambiguity.
4. Update profile `knownSourceIssues` to reflect what remains unresolved after the cleanup.

Deliverables:
- Updated test-vector entities
- Updated conformance suite boundaries or semantics
- Cleared or reduced source-issue list

Exit criteria:
- No conformance vector contradicts a public profile constraint without an explicit negative-test marker.
- No local canonical vector has multiple competing expected results.

### Phase 2: make conformance locally executable

Goal:
- Remove dependency on human RFC lookup during normal execution.

Tasks:
1. Expand RFC family vectors into concrete vectors, starting with TurboSHAKE128/256 core and domain cases.
2. Preserve the family-level source entities only as documentation or provenance anchors if desired.
3. Store canonical outputs directly in the concrete vectors.
4. Add any missing metadata needed to distinguish positive and negative cases.

Deliverables:
- Concrete vector set for all currently referenced RFC families
- Clear suite membership for executable vectors
- Reduced reliance on `canonicalOutputs: upstream-rfc-9861`

Exit criteria:
- A local harness can execute every vector in the active conformance suites without consulting the RFC.

### Phase 3: harden the contract model

Goal:
- Improve machine readability and AI consumability of the IO and state model.

Tasks:
1. Enrich `schemaDefinition` for key input and output structures.
2. Add `samplePayload` for high-value structures.
3. Add more explicit semantics for streaming state transitions and result handling.
4. Backfill constraint rationales where the profile narrows or interprets RFC behavior.

Deliverables:
- Improved structure entities
- Improved constraint commentary
- Stronger state and error semantics

Exit criteria:
- A new contributor can understand operation inputs, outputs, and invalid states from the bundle alone.

### Phase 4: automate quality gates

Goal:
- Prevent the same ambiguity from re-entering the bundle.

Tasks:
1. Add lint rules for conformance-vs-constraint conflicts.
2. Add lint rules for unresolved canonical vector fields.
3. Add lint rules or tests for required coverage on high-value fields such as `samplePayload` and `rationale` where appropriate.
4. Re-run `validate_bundle` and targeted lint/test workflows after each change set.

Deliverables:
- Non-empty lint configuration
- Regression checks for execution-critical bundle quality

Exit criteria:
- Structural validity and execution readiness are both machine-checked.

## Suggested work order

Order recommendation:
1. Fix reserved-domain vector semantics.
2. Confirm HopMAC256 canonical output.
3. Materialize RFC family vectors.
4. Enrich data structures and rationales.
5. Add lint rules and tests.

Why this order:
- It addresses correctness before convenience.
- It prevents the team from concretizing vectors on top of unresolved semantics.
- It adds automation only after the contract itself is sharp enough to enforce.

## Final commentary

This bundle is already a strong domain-model port. The remaining work is not broad refactoring. It is targeted tightening of the conformance and execution layer.

The right bar is not just "the bundle validates." The right bar is "a consumer can implement, test, and audit against this bundle without guessing." That bar is within reach, but the conformance assets need one more pass to become authoritative execution artifacts rather than structured notes about the RFC.
