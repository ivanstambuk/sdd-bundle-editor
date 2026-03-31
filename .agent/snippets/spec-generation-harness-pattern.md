# Spec Generation Harness Pattern

Reusable rule for any code-generation harness backed by Spec Studio / MCP.

## Default Working Rule

Do not start from free-form implementation generation.

Every spec-driven code-generation harness should use this order:

1. Resolve an immutable implementation packet from MCP
2. Generate a normative test pack from spec entities first
3. Freeze that test pack
4. Generate implementation code against the frozen tests
5. Run outer structural and semantic audits
6. Only then allow autonomous self-verify loops if needed

## Why

This keeps single source of truth in bundle data instead of in model prose.

Benefits:
- reduces test drift
- reduces DTO drift
- prevents the model from quietly weakening conformance tests
- makes semantic failures attributable to implementation rather than test invention

## Prompt Authoring Rule

Keep handwritten prompt templates generic.

Do not encode bundle-specific IDs, rule names, vector names, or one-off semantic
exceptions directly in the English prose of a reusable prompt template.

Instead:
- keep static template text focused on generic invariants and workflow
- store narrowing guidance on entities such as bindings, runtime profiles,
  dependency policies, validation rules, and test vectors
- have the MCP resolver render those entity-level hints into a generated
  appendix for the concrete invocation
- keep handwritten template prose plain-English and stable; exact schema field
  names, DTO field lists, vector IDs, rule IDs, and contract matrices should be
  emitted mechanically by the resolver from source entities

Why:
- template prose becomes reusable across bundles
- renaming a rule or vector does not require hand-editing prompt text
- bundle-specific semantics stay attached to the entities that govern them
- drift risk moves from free-form prose to structured bundle data

Additional rule:
- normative behavior must live in first-class structured fields and relations
- free-form fields such as `implementationHints` are advisory only and should
  not be the only place where required semantics are expressed
- generated code should include concise traceability comments for non-obvious
  logic, mapping branches and helpers back to the governing modeled semantics
- Step 1 should tighten only generic domain semantics; do not encode
  library-specific exception names, package quirks, or runtime API trivia into
  the metamodel or prompt as if they were domain rules
- Step 2 `self-verify` is the correct place for repairing library/runtime usage
  mistakes discovered by build/test execution

## Harness Stages

### Stage 1: Frozen Test Pack

Inputs:
- `generate-binding-tests` prompt
- conformance suite IDs
- fixtures
- vector expectations

Requirements:
- create normative tests first
- preserve modeled vector IDs
- preserve modeled expected outcomes
- do not create placeholder tests

Outputs:
- frozen test files
- test-pack manifest with file hashes

### Stage 2: Implementation

Inputs:
- `implement-binding` prompt
- frozen test pack already present in workspace

Requirements:
- implement source/config/docs around the frozen tests
- do not rewrite frozen tests
- treat test pack as immutable contract

### Stage 3: Outer Audit

Minimum audit gates:
- generated files present
- frozen test files unchanged
- expected vector coverage present
- placeholder markers absent
- install/build/typecheck/test pass where applicable

### Stage 4: Semantic Audit

Parse conformance results and compare expected versus actual semantics:
- `outcomeClass`
- `primaryErrorCode`
- `keySelectionStatus`
- `trustDecision`
- `failedRuleId`

## Mode Policy

### `generate-only`
- stage 1 and stage 2 are model-assisted
- execution is outside the model loop
- outer harness performs audit

### `self-verify`
- frozen tests still come first
- model may then iterate on implementation against those frozen tests
- semantic guardrail still remains outside the model loop
