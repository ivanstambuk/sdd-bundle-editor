# SDD Metamodel Modeling Guide

> Living guidance for domain modeling, metamodel design, and spec-driven prompt design in Spec Studio bundles.

This document is the durable place for modeling learnings that should not be lost in chat context.

Use it for:
- deciding where semantics should live
- designing new entity types and relationships
- deciding what belongs in prompt templates versus bundle data
- shaping spec-driven generation harnesses

Do not use this document for UI rendering mechanics or low-level `x-sdd-*` keyword reference. That belongs in [schema-authoring-guide.md](./schema-authoring-guide.md).

---

## Scope Split

There are two different concerns:

1. **Schema authoring**
How to express an entity schema so Spec Studio can validate and render it.

2. **Metamodel modeling**
What concepts should exist at all, where semantics should live, and how entities should relate to each other.

Rule:
- put JSON Schema mechanics in [schema-authoring-guide.md](./schema-authoring-guide.md)
- put cross-cutting modeling rules and learnings in this document

---

## Core Modeling Rules

### 1. Structured Entities Carry Normative Semantics

If behavior is required for correct implementation, validation, conformance, or auditing, it must live in first-class structured fields or references.

Examples:
- expected outcomes
- primary error mappings
- required DTO fields
- allowed algorithms
- runtime policy
- validation context
- output contract
- dependency allowlists

Do not leave required semantics only in:
- handwritten prompt prose
- `implementationHints`
- one-off README notes
- ad hoc agent instructions

### 2. Free-Form Hints Are Advisory Only

Fields such as `implementationHints`, `platformNotes`, `securityNotes`, and similar prose fields are useful, but they are not the contract.

Use them for:
- runtime-specific caveats
- library quirks
- generation tips
- practical implementation nudges

Do not use them as the only place where required behavior is expressed.

If a hint keeps being treated as mandatory, promote it into:
- a structured field
- a relation
- a constraint entity
- a rule entity
- a test vector expectation

### 3. Keep Prompt Templates Generic

Handwritten prompt templates should be:
- reusable
- plain-English
- invariant-focused

They should describe workflow and general obligations, not bundle-instance specifics.

Do not hardcode in reusable prompt prose:
- vector IDs
- rule IDs
- error IDs
- one-off exception cases
- exact DTO field-name lists

Instead:
- keep the template generic
- store narrowing guidance in entities
- have the MCP resolver render a generated appendix for the concrete invocation

### 4. Resolver Output Carries Exact Contract Detail

Machine-derived prompt sections are the right place for exactness.

Use resolver-generated sections for:
- DTO field lists
- contract matrices
- vector expectation tables
- error mapping tables
- resolved fixtures
- selected rule sets

This keeps:
- templates stable
- entity data authoritative
- prompt specificity high without creating prose drift

### 5. Freeze Tests Before Implementation

For spec-driven code generation harnesses:

1. resolve context from MCP
2. generate a normative test pack from entities
3. freeze that pack
4. implement against it
5. run structural and semantic audits outside the model loop

This is the default harness pattern.

Why:
- reduces test drift
- prevents the model from weakening tests
- keeps conformance sourced from entities
- makes failures attributable to implementation

### 6. Use Domain-Specific Names When They Are Truly Normative

Do not abstract too early.

If a bundle is genuinely domain-specific, domain-specific field names are acceptable when they represent real contract semantics.

Example:
- `rawJwtInput` is appropriate in a JWT-specific `TestVector`

Do not rename a correct domain concept into something vaguer just to sound generic.

Only generalize when:
- the same concept is reused across domains
- the abstraction improves the model rather than hiding meaning

### 7. Share Contract Fragments Deliberately

When multiple entities mirror the same structure, keep one authoritative fragment and align the others to it exactly.

Examples:
- shared request fragments
- shared policy fragments
- shared context fragments
- repeated DTO substructures

If the repo lint rules enforce shape equality, treat even descriptive metadata as part of the shared contract and keep it synchronized.

### 8. Bind Specificity to the Smallest Correct Artifact

Put specificity where it belongs.

Examples:
- runtime-specific dependency behavior belongs in `DependencyPolicy`
- language/runtime execution constraints belong in `RuntimeProfile`
- per-vector expectations belong in `TestVector`
- security semantics belong in `ValidationRule`, `SecurityConstraint`, and `ErrorCode`
- output shape belongs in `OutputContract` and `DataStructure`

Do not push these details upward into generic prompt templates.

### 9. Prefer Relations Over Redundant Prose

If one entity governs or constrains another, encode that relationship directly.

Prefer:
- explicit refs
- typed entities
- traceable links

Over:
- repeating the same rule in multiple text fields
- encoding governance only in descriptions
- relying on a prompt to “remember” the relationship

### 10. Promote Repeated Learnings Into Repo Guidance

If a modeling lesson changes how multiple bundles, prompts, or harnesses should be authored, do not leave it in chat context.

Promote it into one or more of:
- this guide
- [schema-authoring-guide.md](./schema-authoring-guide.md)
- `.agent/snippets/`
- `packages/mcp-server/README.md`
- bundle-specific design docs

Rule:
- transient finding stays in chat
- reusable rule gets codified

### 11. Use Vectors First, Then Add Minimal Execution Semantics

Rich test vectors should be the primary source of observable semantics.

Prefer to prove behavior with:
- expected outcomes
- expected primary errors
- expected trust decisions
- expected key-selection states
- expected failed rules and terminal steps

Only add extra execution modeling when repeated drift shows the model cannot
reliably infer the right generalization from vectors alone.

Good minimal additions:
- rule precedence within a step
- step success projections
- state-preservation semantics for later failures
- narrowly scoped failure projections for specific rules

Avoid jumping straight to a large orchestration model if vectors plus one small
explicit layer are sufficient.

### 12. Do Not Model Library-Specific Runtime Quirks

Metamodels should capture domain semantics, contracts, precedence, and
 traceable execution meaning.

> "We should not try to solve every implementation quirk in generation time."

They should not encode library-specific implementation trivia such as:
- exact exception class names
- package-internal error type layouts
- transient framework or SDK method quirks
- language-specific compiler workarounds

Rule:
- if the problem is about domain meaning, model it
- if the problem is about a specific library/runtime API, prefer to handle it in
  execution-time repair loops such as Step 2 `self-verify`

Why:
- library-specific details are brittle
- they reduce bundle portability
- they do not generalize across bindings
- they are better discovered and repaired through execution than through
  metamodel design

---

## Prompt Design Rules

### Loose Template, Tight Data

Recommended split:

| Concern | Template | Entity Data / Resolver |
|---|---|---|
| workflow | yes | no |
| generic obligations | yes | no |
| exact DTO fields | no | yes |
| exact vector IDs | no | yes |
| exact error mappings | no | yes |
| runtime quirks | sometimes, if truly generic | yes |
| bundle exceptions | no | yes |

Short rule:
- loose prompt template
- tight structured data
- exact resolver output

### Plain English for Handwritten Prompt Prose

Write static prompt text in plain English.

Prefer:
- “Treat modeled expected outcomes as normative.”
- “Follow the referenced request and result contracts exactly.”

Avoid:
- long field-name enumerations in static prose
- hand-maintained ID lists in static prose
- schema-shaped wording unless it is truly part of the reusable metamodel

### Generated Code Should Preserve Traceability

When a generator emits non-obvious methods, branches, guards, or data
transformations, it should leave concise comments explaining why that code
exists.

Good traceability comments reference:
- validation steps
- validation rules
- representative vectors or vector families
- public-result contract semantics

These comments should answer:
- what modeled behavior this code is satisfying
- why this branch exists
- what semantic distinction would be lost if it were removed

Do not overcomment trivial assignments. Use traceability comments where the code
would otherwise hide the governing business rule or conformance rationale.

### Do Not Smuggle Contract Semantics Into the Prompt

If the prompt has to say something highly specific for correctness, ask:

“Why is this not modeled?”

Very often the right fix is:
- add a field
- add a rule
- add a constraint
- add a test vector expectation
- add a relationship

---

## Harness Modeling Rules

### Structural Audit and Semantic Audit Are Different

Keep both.

Structural audit checks:
- files exist
- frozen tests unchanged
- build runs
- typecheck runs
- test command runs

Semantic audit checks:
- expected outcomes match
- expected primary errors match
- trust/key-selection semantics match
- drift categories are reported per vector

Both are needed.

### Test-First Means Spec-First, Not Model-Invented Tests

In a spec-driven harness, “test first” should normally mean:
- tests are derived from bundle entities first
- implementation comes second

Not:
- ask the model to invent its own normative tests from prose

---

## Modeling Review Checklist

When introducing or changing a modeling pattern, check:

1. Is the required behavior captured in structured fields or relations?
2. Is any required semantic rule living only in prompt prose?
3. Are free-form hints being used as the contract?
4. Are exact field names and IDs being rendered mechanically rather than hand-maintained in template prose?
5. Are shared contract fragments aligned exactly where lint rules expect equality?
6. Is the level of abstraction right for the domain, or did we generalize too early?
7. Does the harness derive tests from entities before implementation?
8. Is this learning reusable enough to codify outside chat?

---

## Current Repo-Specific Conclusions

These are active conclusions from the current binding-generation work:

- reusable prompt templates must stay generic and plain-English
- bundle-specific narrowing guidance belongs in entity data
- resolver-generated prompt sections should carry exact DTOs, vectors, and mappings
- `implementationHints` are advisory only
- normative conformance semantics belong in `TestVector`, `ValidationRule`, `ErrorCode`, `DataStructure`, `OutputContract`, and related entities
- JWT-specific names such as `rawJwtInput` are acceptable inside a JWT-specific bundle when they are truly part of the contract
- frozen-test-first harnessing is the default pattern for spec-driven generation

---

## Maintenance Rule

When a new modeling or metamodel lesson is discovered that is likely to matter again:

1. update this document
2. update any narrower doc it affects
3. update snippets or README guidance if agents will need the rule during execution

Do not rely on conversation memory for reusable modeling rules.
