# Spec-Driven Implementation Bindings

Status: Phase 0 in progress
Owner: AI-assisted implementation workflow
Scope: JWT validation library generation from Spec Studio bundles

## Summary

This document proposes a Spec Studio workflow for generating implementation-ready platform bindings from an abstract specification bundle plus a platform-specific binding bundle.

Concrete phase-0 modeling work lives in:
- [docs/spec-driven-implementation-bindings-phase-0.md](./spec-driven-implementation-bindings-phase-0.md)
- [docs/spec-generation-harness-next-architecture.md](./spec-generation-harness-next-architecture.md)

The initial target is a JWT validation library:
- abstract behavior stays in a spec bundle
- platform/runtime policy stays in a binding bundle
- MCP assembles the relevant context
- a CLI-accessible model generates code, tests, and conformance artifacts

Default harness policy:
- use a faster builder model for generation and repair loops
- use a stronger critic model for semantic validation and final gating

The architectural intent is to preserve Spec Studio as the single source of truth while making code generation deterministic enough to be useful for real platform teams.

## Recommendation

Use two cooperating bundle layers:
- `jwt-spec`: abstract behavior, conformance rules, fixtures, error taxonomy
- `binding-<platform>`: runtime policy, dependency/version constraints, output shape

Do not encode security-relevant behavior only in prompt prose. The model should generate code from bundle data, not from unstated assumptions.

## Why This Approach

| Concern | Ad hoc prompt + pasted spec | Spec bundle + binding bundle |
|---|---|---|
| Single source of truth | Weak | Strong |
| Reuse across runtimes | Low | High |
| Security drift risk | High | Lower |
| Test fixture reuse | Weak | Strong |
| Agent ergonomics | Unstructured | Structured |

This approach also fits existing repo patterns:
- the JWT reference bundle already models operations, rules, errors, and conformance inputs
- the openFinance bundle already uses binding-style entities such as API contract bindings
- the MCP server already exposes planning and quality prompts that gather bundle context before handing off to a model

## Goals

- Generate a self-contained JWT validation library from bundle data.
- Keep the spec abstract and reusable across runtimes.
- Make dependency versions explicit and reviewable.
- Generate conformance tests from shared fixtures.
- Support multiple target runtimes without changing the abstract JWT model.
- Expose the workflow through MCP so agent clients can discover and invoke it consistently.

## Non-Goals

- Framework-specific integrations in phase 1.
- Full application scaffolding.
- Automatic support for every language from day one.
- Replacing hand-written security review.
- Letting the model improvise algorithm policy, key policy, or error semantics.

## Target Languages

These are the initial platform families worth modeling:

| Language | Likely library family | Priority | Phase 1 test target |
|---|---|---|---|
| Node.js / TypeScript | `jose` | High | Yes |
| Python | `PyJWT` or `python-jose` | High | Yes |
| Java | `jjwt` or Nimbus JOSE JWT | Medium | No |
| C# | `System.IdentityModel.Tokens.Jwt` | Medium | No |
| Go | `golang-jwt/jwt` | Medium | No |
| Rust | `jsonwebtoken` | Medium | No |

Recommendation:
- pilot generation and validation on Node.js and Python
- model the others early as binding profiles, but do not promise runtime verification for them yet

## Architectural Model

### 1. Abstract Spec Bundle

The abstract JWT bundle should contain entities such as:
- `TokenProfile`
- `ValidationRule`
- `SecurityConstraint`
- `ErrorCode`
- `Operation`
- `ConformanceSuite`
- `TestVector`
- `MockKeySet`
- `ADR`

This bundle answers:
- what constitutes a valid token
- what claims must be present
- how clock handling works
- how keys are resolved
- which algorithms are permitted
- what error codes the validator must emit
- what tests prove conformance

### 2. Platform Binding Bundle

Introduce a new bundle type or extend an existing one with implementation-binding entities such as:
- `ImplementationBinding`
- `RuntimeProfile`
- `DependencyPolicy`
- `OutputContract`
- `BindingPromptTemplate`
- `BindingExample`
- `BindingConstraint`

This bundle answers:
- which language/runtime is targeted
- which dependency names and versions are allowed
- whether the output is library-only or includes examples
- which public functions or classes must exist
- which platform-specific constraints apply
- which MCP-served prompts are available for this binding

### 3. Generated Artifact Contract

Each generated binding should aim at a stable output contract:
- `src/validator.*`
- `src/types.*`
- `tests/conformance/*`
- `tests/fixtures/*`
- `examples/*`
- `README.md`
- `binding-manifest.json`
- `CONFORMANCE.md`

This keeps generated outputs comparable across languages.

## Entity Relationship Model

Recommended relationship direction:
- `ImplementationBinding` references one or more abstract `Operation` entities it realizes
- `ImplementationBinding` references applicable `TokenProfile`, `ValidationRule`, `SecurityConstraint`, and `ErrorCode` entities
- `RuntimeProfile` references `DependencyPolicy` and `OutputContract`
- `BindingPromptTemplate` references `ImplementationBinding`
- `ConformanceSuite` references shared `TestVector` and `MockKeySet`

This keeps abstract semantics upstream and implementation concerns downstream.

## Prompt Serving Through MCP

Current state:
- prompt registration in this repo is code-defined in the MCP server
- prompt content can already gather bundle context before handing off to a model

### Short Answer

Yes, in principle this can be served via MCP rather than hard-coded as one-off prompts.

### Important Clarification

MCP prompts do not appear automatically just because prompt-like entities exist in a bundle. The server still needs generic runtime logic that:
- reads prompt entities from loaded bundles
- validates their schema
- turns them into MCP prompt registrations
- resolves bundle/entity references into final prompt text at call time

So the correct model is:
- prompt definitions are data
- prompt serving is generic server code
- prompt execution context is assembled from bundle relations

### Recommended Prompt Strategy

Use a hybrid model.

Keep a small amount of generic prompt-serving code in the MCP server, then let prompt content and binding-specific instructions live as bundle entities.

That would support prompts such as:
- `implement-binding`
- `generate-binding-tests`
- `binding-gap-analysis`
- `explain-binding`
- `scaffold-example-endpoints`

For example:
- agent asks: "How do I implement this in Java?"
- MCP exposes or resolves a binding prompt associated with the Java binding profile
- the server expands the prompt using referenced entities
- the client model receives a structured implementation brief rather than raw bundle dumps

### Proposed Prompt Entity Shape

A `BindingPromptTemplate` should include:
- prompt id
- title
- purpose
- target binding ids
- input arguments
- entity selection rules
- rendering template
- output expectations
- optional model guidance

Example argument set:
- `bindingId`
- `operationId`
- `depth`
- `artifactMode` such as `library-only` or `library-and-examples`

### Proposed End-to-End Flow

1. Author or refine the abstract JWT bundle.
2. Author a platform binding profile such as `binding-node-jose`.
3. Define conformance fixtures and negative cases in the abstract bundle.
4. Expose a generic MCP prompt such as `implement-binding`.
5. The prompt gathers:
   - operations
   - rules
   - constraints
   - error codes
   - fixtures
   - dependency/version policy
   - output contract
6. The CLI model generates code and tests.
7. Local verification runs language-specific tests and conformance checks.
8. A conformance report is written back or captured as an artifact.

## JWT Phase 1 Scope

Keep phase 1 intentionally narrow:
- library-only output
- no framework integration
- one core operation: validate JWT
- optional helper operation: parse validated claims
- explicit required claims such as `iss`, `aud`, `exp`, `nbf`
- explicit algorithm allowlist
- shared positive and negative fixtures

Recommended pilot targets:
- Node.js with `jose`
- Python with `PyJWT`

## Detailed Design Decisions

### Decision 1: Spec and binding stay separate

Reason:
- prevents runtime-specific policy from polluting the abstract JWT model
- allows several bindings to share one conformance suite

### Decision 2: Prompt templates become bundle data

Reason:
- enables per-binding workflow specialization
- reduces pressure to hard-code every implementation workflow in TypeScript

Constraint:
- the server still needs a generic adapter layer to expose them through MCP

### Decision 3: Conformance fixtures are first-class bundle entities

Reason:
- code generation without fixtures produces demos, not reliable libraries
- shared fixtures make cross-language comparison possible

### Decision 4: Stable artifact contract across languages

Reason:
- simplifies CI, review, and downstream adoption

## Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Prompt overgrowth | Raw bundle dumps will exceed context budgets | Use entity summaries and targeted expansion |
| Security drift | Models may invent JWT behavior | Make rules, constraints, and errors explicit in bundle data |
| Library mismatch | Different runtimes expose different abstractions | Separate abstract operations from runtime output contracts |
| Prompt entity abuse | Users may treat prompt templates as arbitrary codegen scripts | Keep template schema constrained and typed |
| Verification gap | Generated code may look plausible but fail edge cases | Make fixtures and conformance suites mandatory |

## Implementation Phases

### Phase 0: Discovery and schema design
- define the binding entity set
- decide whether to add a new bundle type or extend existing schemas
- align naming with existing reference bundles

### Phase 1: JWT pilot corpus hardening
- tighten the existing JWT reference bundle
- ensure operations, rules, errors, fixtures, and suites are sufficient for code generation
- identify any missing abstract entities

### Phase 2: Binding bundle modeling
- create Node.js and Python binding profiles
- specify dependencies, versions, artifact contracts, and prompt templates
- model future Java, C#, Go, and Rust bindings at a lighter level

### Phase 3: MCP dynamic prompt serving
- implement generic prompt entity loading
- expose bundle-defined prompts through the server
- support typed arguments and completions

### Phase 4: Generator workflow
- add a CLI-facing workflow that invokes MCP, collects prompt output, and hands it to a model
- write results into a generated target directory
- codify two harness modes:
  - `generate-only` for prompt and semantic-observability work
  - `self-verify` for a small spec-driven loop where the agent writes tests, implements code, and runs local verification

### Phase 5: Conformance verification
- run generated tests
- publish conformance status
- compare Node.js and Python outputs against the same suite

### Phase 6: Expansion
- add endpoint scaffolding examples
- add more languages only after the library-only flow is stable

## Implementation Tracker

| ID | Item | Scope | Acceptance |
|---|---|---|---|
| BIND-001 | Define binding entity model | `ImplementationBinding`, `RuntimeProfile`, `DependencyPolicy`, prompt template entities | Schema is documented and implementable |
| BIND-002 | Harden JWT abstract bundle | Fill any gaps in rules, errors, fixtures, operations | Bundle is sufficient to drive generation |
| BIND-003 | Create Node.js binding profile | `jose`-based library-only target | Profile is explicit about versions and outputs |
| BIND-004 | Create Python binding profile | `PyJWT`-based library-only target | Profile is explicit about versions and outputs |
| BIND-005 | Model future language bindings | Java, C#, Go, Rust as planning artifacts | Profiles exist, runtime validation optional |
| BIND-006 | Implement prompt entity serving in MCP | Generic prompt adapter from bundle data to MCP prompts | Prompts are discoverable and callable via MCP |
| BIND-007 | Implement `implement-binding` workflow | Context assembly and output contract instructions | Prompt output is actionable for a codegen model |
| BIND-008 | Implement generation harness | CLI path from MCP context to model invocation to output dir | Can generate a pilot library locally |
| BIND-009 | Add conformance verification flow | Shared fixture execution and reporting | Generated bindings can be compared consistently |
| BIND-010 | Evaluate endpoint examples | Optional protected endpoint examples after library success | Kept out of phase 1 unless justified |

## Status Tracker

| Workstream | Status | Notes | Exit Criteria |
|---|---|---|---|
| Problem framing | Done | Concept accepted: abstract spec plus binding profile | Design approved |
| JWT pilot scope | Done | Library-only, no framework integration | Scope frozen for phase 1 |
| Binding entity model | Done | Schemas and seed entities added to the JWT pilot bundle | Entity set reviewed |
| Dynamic MCP prompt serving | Implemented for binding templates | Generic prompt adapter now exposes bundle-defined binding prompts through MCP | MCP can list and invoke bundle-defined prompts |
| Generation harness | Implemented for initial local runs | `scripts/run-binding-harness.ts` resolves MCP prompts, invokes Gemini CLI, and writes prompts/logs/artifacts into `.scratch/binding-runs/*` | First Node.js pilot run completes reproducibly |
| Node.js binding | Modeled | Highest-value pilot runtime | Generated library passes pilot suite |
| Python binding | Modeled | Second pilot runtime for cross-language proof | Generated library passes pilot suite |
| Java/C#/Go/Rust planning | Modeled | Model only, do not promise verification yet | Profiles documented |
| Conformance reporting | Proposed | Must avoid “looks right” validation | Shared report generated from fixtures |

## Open Questions

- Should binding prompts be their own entity type, or a generalized prompt-template type usable across domains?
- Should generated artifacts remain outside the bundle model, or should generation runs produce result entities?
- Is a new bundle type cleaner than extending the existing JWT validator bundle type?
- Should dependency versions be exact pins or policy ranges with an approval workflow?
- Should conformance reports become persisted entities inside a bundle or stay external artifacts?

## Recommended Next Step

Move from generation to verification:
- harden the generated Node.js pilot against the current conformance suite
- keep `generate-only` as phase-1 default while we reduce semantic drift
- then use `self-verify` as phase 2 once the generated artifacts are close enough that install/build/test loops are meaningful
- add a machine-readable conformance report for each run
- repeat the same flow for the Python pilot once Node.js is stable

## Harness Pattern

The harness should be treated as a two-step pattern, not a single monolithic mode.

General rule for Spec Studio-backed code generation:
- resolve spec context from MCP
- generate a frozen normative test pack first
- implement against that frozen pack second
- keep structural and semantic guardrails outside the model loop
- keep handwritten prompt templates generic
- move bundle-specific narrowing guidance into entity-level fields
- have the MCP resolver render entity-derived guidance at runtime instead of
  hardcoding vector IDs, rule IDs, or one-off semantics into template prose
- keep handwritten template prose plain-English and invariant-focused; exact
  field names, IDs, and contract matrices should come from resolver-generated
  sections
- keep required semantics in first-class structured fields and relations;
  free-form hint fields are advisory only and should not be the sole source of
  normative behavior

### Step 1: `generate-only`
- Purpose: inspect prompt quality, bundle completeness, DTO drift, and semantic correctness without mixing in package-manager or runner noise.
- Agent behavior: write manifests, source files, tests, and docs only.
- Outer harness behavior: run a post-generation audit afterward and analyze the failure profile.
- Current audit gates:
  - expected vector IDs are present in generated tests
  - placeholder or prose-plan markers are absent from generated source/test files
  - for Node.js / TypeScript pilots, `npm install`, `npx tsc -p tsconfig.json --noEmit`, and `npm test` are executed by the harness audit
- Use when: prompt/bundle quality is still the main uncertainty.

### Step 2: `self-verify`
- Purpose: allow a small autonomous spec-driven loop inside the generated workspace.
- Agent behavior:
  - write or refine conformance tests first from the modeled vectors
  - implement against those tests
  - install dependencies
  - run build/test commands
  - iterate until green or blocked
- Use when: step-1 output is close enough that local execution failures are likely to be actionable rather than pure prompt drift.

Current project status:
- We are still in Step 1 for the JWT pilot.
- The harness supports both modes, but `generate-only` remains the default until the Node.js binding stops drifting on the modeled semantics.
