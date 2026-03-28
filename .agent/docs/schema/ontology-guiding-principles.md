# Ontology Guiding Principles

> Default modeling principles for ontologies in this repo when the bundle is expected to support code generation, conformance testing, and human-readable browsing.

## Primary Purpose Order

Use this priority order when there is tension between goals:

1. Code generation contract
2. Executable conformance specification
3. Human-readable documentation

Interpretation:

- The ontology must be precise enough to generate implementations without hidden assumptions.
- The ontology must be precise enough to assess whether an existing implementation conforms.
- The ontology should remain self-documenting and readable for non-technical stakeholders, but readability must not weaken execution precision.

## Core Principle

The ontology is a contract first, documentation second.

Documentation value is required, but it should emerge from a well-structured ontology rather than from relaxed or ambiguous semantics.

## Rule Modeling

### Active Rules Must Be Executable

If a rule participates in code generation or conformance, it is an `active` rule and must:

- be reachable from an execution step
- have clear traceability to outcomes or error conditions
- be eligible for coverage analysis

### Non-Executable Rules Must Be Explicit

Rules that are informative but not part of the current executable contract must be explicitly marked, for example:

- `advisory`
- `planned`

They must not be counted as active conformance behavior.

## Execution Model

### Prefer Explicit Pipelines

Execution should be modeled as clear steps with one responsibility each.

Each step should have:

- a clear purpose
- a stable order
- explicit rule membership
- explicit outputs or failure outcomes

Avoid:

- duplicated rule placement unless intentional
- step titles that do not match executed rules
- “floating” rules with unclear operational status

### Fail-Fast For Authoritative Validation

Authoritative validation should be fail-fast by default.

If multi-error collection is needed, model it as a separate audit or analysis operation rather than weakening the main validation contract.

## Test Vector Policy

### Core Suite Vectors Must Be Executable

Every test vector that belongs to a core conformance suite must be fully executable.

The suite must not depend on hidden fixture synthesis or unstated assumptions.

### Illustrative Vectors Are Allowed, But Must Be Marked

Human-oriented example vectors are allowed if they are explicitly marked as illustrative and excluded from core conformance completeness.

## Configuration And Runtime Modeling

Separate static specification from runtime behavior.

Recommended layers:

- `Profile`: static normative contract
- `RuntimePolicy`: configuration knobs and overrides
- `ExecutionContext` or `ValidationContext`: resolved runtime inputs and environment state

This separation prevents hidden assumptions and keeps both codegen and conformance tractable.

## Error Modeling

Prefer domain-first errors.

The ontology should define stable domain error semantics. Transport mappings such as HTTP status should be modeled separately or treated as adapter concerns unless transport behavior is itself the subject of the ontology.

## Security-Critical Operational Semantics

Any behavior that can materially change security outcomes or conformance results should be explicit in the ontology.

Examples:

- cache behavior
- refresh behavior
- key rotation semantics
- network failure behavior
- stale-data fallback policy
- unsafe diagnostic behavior

If these are not modeled, they should be explicitly declared out of scope rather than left ambiguous.

## Diagnostic Safety

Unsafe or weakly authoritative workflows should be separated from authoritative validation.

Example:

- safe authoritative validation operation
- separate explicitly diagnostic operation for claim inspection after signature failure

Do not mix these two under one ambiguous contract.

## Traceability Expectations

For contract-grade ontologies, aim for traceability across:

- execution step
- rule
- expected outcome or error
- test vector
- governing constraint
- normative reference

This makes the ontology easier to generate from, audit against, and browse as documentation.

## Default Recommendation

When unsure, choose the more explicit, contract-grade model.

A good rule of thumb:

- if a generator would have to guess, the ontology is under-specified
- if a conformance harness would have to infer intent, the ontology is under-specified
- if a human reader can understand the ontology without weakening either of the above, the ontology is in a good state
