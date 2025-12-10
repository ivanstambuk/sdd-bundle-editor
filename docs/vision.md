## 🧠 Consolidated constraints

You are designing an SDD-oriented spec bundle for a bounded context where:

* The **spec is the sole source of truth** for architecture, behavior, protocols, requirements, observability, and contracts.
* **Delivery artifacts (tasks, plans, user stories, epics)** live outside the spec and may be generated from it; they do not appear in the meta-model.
* Scope: **application + technical architecture**, plus decisions, protocols, executable scenarios/tests, telemetry, error codes. No classic business EA (capabilities/strategy/plateaus).
* Deployment topology is out-of-scope; runtime **telemetry, trace headers (W3C traceparent/baggage), and OTel semantics** are in-scope.
* Requirements are **generic “requirements”**, but every requirement must belong to one of a **small, predefined set of categories** (FR/NFR/security/etc.), likely encoded in ID prefixes.
* Behavior is specified as **scenarios**, each with a `viewpoint: ui | api | e2e-test | perf-test`. Scenarios are the unit for E2E flows, API usage, and tests.
* Components are **coarse-grained domain components**, implementation-agnostic and language-agnostic.
* Tests must be **executable** (HTTP flows, multi-step E2E, load/perf), not just “test case” bullets.
* Traceability: spec-level artefacts ⇄ scenarios ⇄ components ⇄ protocols ⇄ telemetry ⇄ external plans/tasks ⇄ code. Code comments only reference **task IDs**, and tasks map back to spec IDs (requirements, scenarios, etc.).
* All diagrams must be **PlantUML stored in the spec** (static-first), with AI responsible for keeping diagrams in sync and generating new ones on demand.
* Repositories are **Git-based** (YAML/JSON/MD/XML) with web UI and AI agents; **no manual editing**, all changes go through agents that propose diffs which you approve.
* Cross-bundle dependencies are explicit, with **bundle ID + version + referenced element ID**, and AI should be able to pull/update external bundles.

Given that, here is a concrete meta-model + operation set that (a) captures the relevant capabilities of EA/Archi and (b) fits your SDD+AI constraints.

---

## 🧱 SDD meta-model proposal (20–30 element types)

I’ll organise this in layers:

1. Core structural & behavioral entities
2. Governance & risk
3. Observability & error modelling
4. Cross-bundle & external specs
5. Views, viewpoints, and PlantUML

Within each entity, “key relations” are **logical links** (IDs in YAML), not physical DB foreign keys.

---

### 🧩 Core root and structural entities

#### 1. `bundle`

**Role:** Root of everything for one bounded context / product domain.

**Fields (indicative):**

* `id`: short stable identifier, e.g. `payments-auth-bundle`
* `name`, `description`
* `version`: semantic version of the spec (not the code)
* `owners`: team / repo / contact
* `tags`: domain tags
* `external_refs`: links to repos, docs, runbooks

**Key relations:**

* Contains lists/sections for all other entity collections (`requirements`, `components`, `protocols`, etc.).
* Referenced by other bundles in `cross_bundle_dependency`.

---

#### 2. `component`

**Role:** Coarse-grained domain-level unit (service, UI app, worker, adapter, external system), equivalent to UML Component / C4 Container / ArchiMate ApplicationComponent, but stripped of deployment details.

**Fields:**

* `id`: `CMP-auth-service`, `CMP-user-portal`
* `kind`: `service | ui | worker | external_system | adapter | library`
* `description`, `responsibilities`
* `owned_by`: optional domain team / tribe
* `tags`: `["auth", "critical"]`

**Key relations:**

* `implements_requirements: [REQ-…]`
* `participates_in_scenarios: [SCN-…]`
* `provides_protocols: [PRT-…]`
* `consumes_protocols: [PRT-…]`
* `telemetry_profiles: [TELSC-…]` (what telemetry schemas apply)

This covers EA’s “Component/Class/Subsystem” and Archi’s application components, but without deployment nodes.

---

#### 3. `protocol`

**Role:** Interaction/communication contract (especially APIs), including HTTP REST, GraphQL, gRPC, message bus, etc.

**Fields:**

* `id`: `PRT-login-api`, `PRT-event-bus`
* `kind`: `http-rest | http-graphql | http-grpc | messaging | cli | web-socket | file | custom`
* `role`: `provider | consumer | both`
* `summary`
* `external_spec_refs: [EXT-openapi-login-v1]` (see `external_spec_ref` below)
* `security_model`: e.g. `oauth2-authorization-code`, `mtls`, `enterprise-token`
* `nfr_bindings: [REQ-…]` (e.g. latency/availability/hardening constraints specific to this protocol)

**Key relations:**

* `provided_by_components: [CMP-auth-service]`
* `consumed_by_components: [CMP-web-portal]`
* `used_in_scenarios: [SCN-login-api-main]`

This is where OpenAPI/AsyncAPI/etc. hang off.

---

#### 4. `data_schema`

**Role:** Logical data contract / schema, especially when not fully captured by OpenAPI (e.g. domain events, problem details variants, messages).

**Fields:**

* `id`: `DSC-auth-session`, `DSC-problem-details-auth`
* `format`: `json-schema | avro | protobuf | xsd | custom`
* `usage`: `request | response | event | problem_details | telemetry_payload | config`
* `location`: inline snippet or path to external file
* `summary`

**Key relations:**

* Used by `protocols` (`request_schema`, `response_schema`, etc.)
* Used by `scenarios` (specific payloads)
* Used by `telemetry_schema` (log/metric/trace payloads if structured)

If you want to keep the entity count down, `problem_details_schema` can be represented as a `data_schema` with `usage: problem_details`.

---

### 🧩 Requirements & scenarios

#### 5. `requirement`

**Role:** Canonical requirement node (FR, NFR, security, observability, etc.), hierarchically nestable. No separate "epics/features/stories"; those are delivery-time projections.

**Fields:**

* `id`: `REQ-FR-001`, `REQ-NFR-PERF-010`, etc. (prefix encodes kind + category)
* `kind`: `functional | non_functional | constraint` (explicit, not derived)
* `category`: one of ~10 predefined values (FR/NFR/SEC/OBS/PRV/CPL/DATA/UX/OPS/NG)
* `subtype`: optional SysML-style refinement: `interface | performance | latency | physical | design_constraint | ...`
* `title`, `description`
* `state`: `draft | proposed | accepted | deprecated | rejected`
* `owner_id`: reference to `Actor` who owns/requested this requirement
* `parent_id`: optional; allows nesting
* `rationale`: why this exists
* `source`: spec, RFC, regulation, stakeholder, etc.
* `quality_attributes`: optional checklist `{ atomic, cohesive, complete, traceable, verifiable, unambiguous }`

**Key relations:**

* `refines_requirements: [REQ-…]` (non-tree cross-links if needed)
* `covered_by_scenarios: [SCN-…]`
* `realized_by_components: [CMP-…]`
* `governed_by_policies: [POL-…]`
* `governed_by_constraints: [CON-…]`
* `decided_in_adrs: [ADR-…]`
* `mitigates_threats: [THR-…]` (security requirements mitigate threats)

This fully replaces "features/user stories" at spec level and gives EA-style requirements management + traceability.

---

#### 6. `scenario`

**Role:** Unified artifact for “how this behaves”. This is the *only* place where “flows” are modelled: UI interaction, API usage, E2E test flows, and perf / load tests.

**Fields:**

* `id`: `SCN-LOGIN-001`, `SCN-API-RESET-PASS-001`, `SCN-PERF-LOGIN-01`
* `viewpoint`: `ui | api | e2e-test | perf-test`
* `title`, `intent`
* `preconditions`: references to requirements/fixtures
* `steps`: ordered collection; each step can reference:

  * `component_id`
  * `protocol_id`
  * `data_schema_id` (payload shape)
  * `expected_response` (for HTTP: status, headers, body patterns)
* `postconditions`: expected system state, derived requirements satisfied
* `telemetry_contract_refs: [TELC-…]` (for scenario-level telemetry expectations)

**Key relations:**

* `covers_requirements: [REQ-…]`
* `uses_components: [CMP-…]`
* `uses_protocols: [PRT-…]`
* `uses_fixtures: [FXT-…]`

This entity subsumes EA use cases, sequence diagrams, test cases, and ArchiMate application flows, but as executable specs.

---

#### 7. `fixture`

**Role:** Deterministic test/interaction fixtures for scenarios: data, environment, mocks, service doubles, etc.

**Fields:**

* `id`: `FXT-user-seed-basic`, `FXT-hotp-code-valid`
* `kind`: `data | environment | mock-service | secrets | clock | external-system-harness`
* `description`
* `spec`: arbitrary YAML/JSON describing how to provision the fixture (can be turned into code/CI scripts)

**Key relations:**

* `used_in_scenarios: [SCN-…]`
* `governed_by_requirements: [REQ-…]` (especially observability and correctness NFRs)

This aligns with your “deterministic fixtures” references in the plan template.

---

#### 8. `actor`

**Role:** Human or system role that participates in scenarios and owns requirements. Aligns with UML Actor / ArchiMate Business Actor at application level.

**Fields:**

* `id`: `ACT-end-user`, `ACT-admin`, `ACT-external-system`
* `kind`: `human | system | external`
* `name`, `description`
* `responsibilities`: what this actor does in the system
* `tags`: `["internal", "privileged"]`

**Key relations:**

* `participates_in_scenarios: [SCN-…]`
* `owns_requirements: [REQ-…]` (requirements owned/requested by this actor)
* `uses_components: [CMP-…]` (which components this actor interacts with)

This enables scenario steps to specify which actor performs each action, and requirements to have explicit ownership.

---

### 🧩 Governance & risk entities

#### 9. `adr` (Architecture Decision Record)

**Role:** Canonical decision log; “decisions” can be treated as the same entity with different scope.

**Fields:**

* `id`: `ADR-0001`
* `title`
* `status`: `proposed | accepted | superseded | rejected`
* `context`
* `decision`
* `consequences`
* `alternatives_considered`
* `tags`: `["security", "observability"]`

**Key relations:**

* `affects_requirements: [REQ-…]`
* `affects_components: [CMP-…]`
* `affects_protocols: [PRT-…]`
* `affects_scenarios: [SCN-…]`
* `related_risks: [RSK-…]`
* `governed_by_principles: [PRIN-…]`

That gives you Sparx/Archi “decisions” in a spec-native, minimalistic format.

---

#### 9. `principle`

**Role:** High-level architectural principles.

**Fields:**

* `id`: `PRIN-SEC-BY-DESIGN`
* `title`, `description`
* `status`: `proposed | accepted | deprecated`
* `category`: e.g. `security | reliability | evolvability`

**Relations:**

* `guides_adrs: [ADR-…]`
* `guides_requirements: [REQ-…]`

---

#### 10. `policy`

**Role:** Normative rules (e.g. “error responses MUST use RFC7807 Problem Details”, “all external APIs require W3C tracecontext headers”).

**Fields:**

* `id`: `POL-PROBLEM-DETAILS-REQ`
* `text`: normative statement
* `category`: `security | privacy | observability | compliance | data-retention | other`
* `status`

**Relations:**

* `enforced_by_constraints: [CON-…]`
* `applies_to_protocols: [PRT-…]`
* `applies_to_components: [CMP-…]`
* `applies_to_requirements: [REQ-…]`

---

#### 11. `constraint`

**Role:** Concrete constraints derived from policies, requirements, or ADRs.

**Fields:**

* `id`: `CON-LATENCY-LOGIN-P99-250MS`
* `text`
* `kind`: `performance | security | cost | organisational | observability`
* `severity`: `must | should | may`

**Relations:**

* `constrains_requirements: [REQ-…]`
* `constrains_scenarios: [SCN-…]`
* `constrains_telemetry_contracts: [TELC-…]`

---

#### 12. `risk`

**Role:** Classic risk register node.

**Fields:**

* `id`: `RSK-TELEMETRY-GAP-001`
* `description`
* `likelihood`: `low | medium | high`
* `impact`: `low | medium | high | catastrophic`
* `mitigation`
* `status`: `open | mitigated | accepted`

**Relations:**

* `related_requirements: [REQ-…]`
* `related_adrs: [ADR-…]`
* `related_components: [CMP-…]`
* `related_scenarios: [SCN-…]`

This gives you enough governance to match EA/Archi-level constraints/risks without introducing “issues” unless you want them.

---

#### 13. `threat`

**Role:** Structured threat modeling entity (STRIDE-style or custom). Captures security threats, attack surfaces, and links to mitigating controls.

**Fields:**

* `id`: `THR-AUTH-BRUTE-FORCE-001`, `THR-DATA-EXFIL-001`
* `category`: `spoofing | tampering | repudiation | information_disclosure | denial_of_service | elevation_of_privilege | custom`
* `title`, `description`
* `attack_surface`: where the threat manifests (e.g. `login-api`, `session-storage`, `admin-portal`)
* `assets_at_risk`: what is being protected `["user-credentials", "session-tokens", "pii"]`
* `likelihood`: `low | medium | high`
* `impact`: `low | medium | high | catastrophic`
* `status`: `identified | analyzed | mitigated | accepted | rejected`

**Key relations:**

* `affects_components: [CMP-…]`
* `affects_protocols: [PRT-…]`
* `mitigated_by_requirements: [REQ-SEC-…]` (security requirements that address this threat)
* `related_to_risks: [RSK-…]`
* `documented_in_adrs: [ADR-…]`

This enables systematic threat modeling with traceability from threats → security requirements → components → tests.

---

#### 14. `open_question` (optional)

**Role:** If you ever decide to model open design questions explicitly (instead of just `open-questions.md`), this is that node.

**Fields:**

* `id`: `OQ-001`
* `question`
* `context`
* `status`: `open | answered | abandoned`

**Relations:**

* `touches_requirements: [REQ-…]`
* `touches_adrs: [ADR-…]`
* `touches_scenarios: [SCN-…]`

You can keep this entity purely optional and continue to centralise questions in a Markdown document as your templates already do.

---

### 🛰 Observability, error modelling, and health

#### 14. `telemetry_schema`

**Role:** Unified schema definition for traces, metrics, logs, events, with explicit OTel semantics and W3C headers where applicable.

**Fields:**

* `id`: `TELSC-http-login-trace`, `TELSC-login-metrics`
* `kind`: `trace | metric | log | event`
* `signal_convention`: e.g. `otel-http`, `otel-db`, `custom`, with references to semantic conventions used
* `span_names` / `metric_names` / `log_categories`
* `attributes`: list of `{name, type, description, required, semantic_convention_ref}`
* `w3c_headers`: if relevant: `traceparent`, `tracestate`, `baggage` usage and rules
* `export_destinations`: conceptual (e.g. “otel-collector/main”, “jaeger”, “prometheus”)

**Relations:**

* `applies_to_components: [CMP-…]`
* `applies_to_protocols: [PRT-…]`
* `applies_to_scenarios: [SCN-…]` (baseline instrumentation)

---

#### 15. `telemetry_contract`

**Role:** Scenario-level expectations that must be asserted in tests and CI.

**Fields:**

* `id`: `TELC-login-e2e-001`
* `scenario_id: SCN-LOGIN-001`
* `telemetry_schema_ids: [TELSC-http-login-trace, TELSC-login-metrics]`
* `expectations`:

  * Span shape expectations (e.g. root span name, children, service names)
  * OTel semantic attributes that MUST be present (e.g. `http.route`, `enduser.id`)
  * Metric thresholds (P99 latency, error rates)
* `ci_enforcement`: description of how tests verify this (e.g. “check trace export in test harness”, “assert on recorded span attributes”)

**Relations:**

* `bound_by_constraints: [CON-…]` (e.g., which latency budgets apply)
* `linked_error_codes: [ERR-…]` (which errors are expected/observable)

This is the bridge between spec and CI “semantic gate” you described.

---

#### 16. `error_code`

**Role:** Enumerated error codes, used consistently across responses and telemetry.

**Fields:**

* `id`: `ERR-AUTH-INVALID-CREDENTIALS`
* `http_status`: `401`
* `human_message`
* `machine_code`: if distinct from `id`
* `category`: `client | server | business | security`
* `problem_details_schema_id`: if using RFC7807

**Relations:**

* `raised_in_scenarios: [SCN-…]`
* `documented_in_protocols: [PRT-…]`
* `referenced_in_telemetry_schemas: [TELSC-…]`

---

#### 17. `health_check_spec`

**Role:** Specification of health endpoints (e.g. `/health`, `/ready`, `/live`).

**Fields:**

* `id`: `HLTH-auth-service`
* `protocol_id`: the API providing the health endpoint
* `path`: `/health` or similar
* `checks`: list of logical checks (DB, queue, dependency).
* `semantics`: when is it “ready” vs “live”; how this maps to infra.

**Relations:**

* `related_components: [CMP-…]`
* `covered_by_scenarios: [SCN-…]` (health check scenarios/tests)

This is narrow enough not to drag you into full deployment modelling.

---

### 🔗 Cross-bundle and external specs

#### 18. `cross_bundle_dependency`

**Role:** Captures use of elements from other bundles (bounded contexts).

**Fields:**

* `id`: `XDEP-payments-auth-001`
* `target_bundle_id`: `payments-core`
* `target_bundle_version`: `1.3.0`
* `target_element_id`: `PRT-payments-initiate`
* `usage_kind`: `uses_protocol | relies_on_component | reuses_schema`
* `notes`

**Relations:**

* Used by local `components`, `scenarios`, or `protocols` to indicate they depend on external domains.

This is exactly the hook for “pull external bundle and do a delta upgrade” semantics.

---

#### 19. `external_spec_ref`

**Role:** Reference to external spec documents (OpenAPI, AsyncAPI, Avro, etc.) that your SDD spec must align with.

**Fields:**

* `id`: `EXT-openapi-auth-v1`
* `spec_type`: `openapi3 | asyncapi2 | protobuf | graphql-schema | custom`
* `location`: path/URL
* `version`
* `hash`: optional checksum for drift detection

**Relations:**

* `attached_to_protocols: [PRT-…]`
* Potentially to `data_schemas` if decoupled.

This allows both embedded and referenced patterns: either inline the OpenAPI, or reference it while still treating SDD as canonical.

---

### 🧭 Views, viewpoints, and PlantUML

#### 20. `viewpoint`

**Role:** Reusable diagram template + semantic rules; the thing your library will maintain.

**Fields:**

* `id`: `VP-c4-context`, `VP-api-sequence`, `VP-error-propagation`, `VP-test-flow`, `VP-nfr-impact`
* `diagram_kind`: `plantuml-component | plantuml-sequence | plantuml-class | plantuml-activity | plantuml-archimate` (whatever subset you standardise)
* `allowed_entity_types`: e.g. `["component", "protocol", "scenario", "actor"]`
* `selection_defaults`: optional (e.g. “all components with tag = 'auth'”)
* `plantuml_template`: optional Jinja/parameterised template snippet

**Core initial viewpoints (based on your acceptance of “all” earlier):**

* `c4_context` – system vs external actors/components
* `c4_container` – components within system
* `component_dependency` – components + protocols + dependencies
* `api_sequence` – sequence of calls for a scenario
* `error_propagation` – how errors bubble across components
* `test_flow` – E2E test path including fixtures and telemetry
* `nfr_impact` – components and scenarios affected by a given NFR

You can extend as needed later.

---

#### 21. `view`

**Role:** Concrete diagram definition bound to a viewpoint, with static PlantUML stored in spec (static-first) but generated/maintained by AI.

**Fields:**

* `id`: `VIEW-login-api-seq-main`
* `name`
* `viewpoint_id`: `VP-api-sequence`
* `scope`: e.g. `{ scenario_ids: [SCN-LOGIN-001] }` or filters
* `plantuml`: the actual PlantUML source

**Relations:**

* References all entities included in the view, typically via IDs inside the PlantUML comments or via a sidecar link list.

**Governance rule:**
AI agents must regenerate or patch `plantuml` whenever the underlying entities change, and they must be able to verify that every `VIEW` still corresponds to valid IDs in the spec (no broken references).

---

## 🧬 Requirements categories and ID scheme

You want:

* No “epic/feature/story” as entities.
* A **single `requirement` entity**, but every requirement must have a category and the ID prefix encodes that category.

A provisional category set (to be realigned when you paste your image):

1. `functional` (`FR-`) – behavior, use cases, API behavior.
2. `non_functional` (`NFR-`) – latency, throughput, availability, scalability.
3. `security` (`SEC-`) – authN/Z, confidentiality, integrity, anti-abuse.
4. `privacy` (`PRV-`) – data minimisation, retention, consent, GDPR-like.
5. `compliance` (`CPL-`) – legal, regulatory, standards.
6. `observability` (`OBS-`) – logs, metrics, traces, span attributes, Problem Details consistency.
7. `data` (`DATA-`) – schemas, invariants, referential integrity, data lifecycle.
8. `ux` (`UX-`) – user interaction requirements not tied to specific UI flows.
9. `operational` (`OPS-`) – backup, maintenance, configuration, feature flags.
10. `non_goal` (`NG-`) – explicit “we will not do X” (aligning with your previous “non-goal IDs (N-)”).

Then a requirement ID scheme like:

* `REQ-FR-001`, `REQ-SEC-010`, `REQ-OBS-005`, `REQ-NG-001`, etc.

You can still maintain them in one document grouped by category, e.g.:

```yaml
requirements:
  - id: REQ-FR-001
    category: functional
    title: "User can log in with password + WebAuthn"
    parent_id: null
  - id: REQ-OBS-001
    category: observability
    title: "All login requests are traced with W3C traceparent and baggage headers"
```

This keeps the meta-model minimal but expressive.

---

## 🎛 Scenarios, tests, telemetry – end-to-end chain

With the above entities, the **core SDD chain** becomes:

1. `requirement` (FR/NFR/SEC/OBS/…)
2. `scenario` (`viewpoint: ui | api | e2e-test | perf-test`)
3. `component` + `protocol` (implementation direction)
4. `fixture` (deterministic setup, harnesses)
5. `telemetry_schema` (what we emit)
6. `telemetry_contract` (what tests must assert)
7. `error_code` + `health_check_spec` (runtime correctness)
8. External **plan/tasks** that reference `REQ-*` and `SCN-*` IDs

Your existing templates already assume that tasks and increments reference FR/NFR/Scenario IDs and that spec sections (requirements/NFR/behaviour/telemetry) and ADRs are updated as clarifications land.

The meta-model here provides the minimum structure needed for agents to:

* Generate **plan documents** with increments (I1, I2, …) and tasks (T-01, T-02, …) referencing spec IDs.
* Generate **test harnesses** (HTTP tests, load tests) from `scenario` + `fixture` + `telemetry_contract`.
* Run **semantic gates** that:

  * Check that all referenced IDs exist and are consistent.
  * Ensure telemetry contracts satisfy OTel/W3C semantics (correct headers, attributes, spans, metrics) during integration tests.

---

## 🛰 Cross-bundle dependencies and reverse engineering

With `cross_bundle_dependency` + `external_spec_ref`, you get:

* **Cross-bundle modeling**:

  * local component `CMP-auth-service` uses `cross_bundle_dependency` pointing to external bundle `payments-core` and its `PRT-payments-initiate` v1.3.0.
  * When external spec updates to v1.4.0, AI can pull remote SDD bundle, diff the external spec, and propose changes to local protocols/scenarios.

* **Reverse engineering flows:**

  1. From OpenAPI: parse an existing OpenAPI file into:

     * `protocol` (endpoints, methods, security)
     * `data_schema` for request/response shapes
     * optionally stub `scenario` entries for canonical flows
  2. From telemetry (e.g. OTel traces): infer:

     * Candidate `telemetry_schema` (span names, attributes, metrics)
     * Candidate `telemetry_contract` for frequently observed flows
  3. From code (indirectly):

     * Code is tagged with `T-…` task IDs; tasks reference `REQ/SCN`; agents can discover which classes/methods implement which spec elements, but this linkage lives in a separate “implementation knowledge” layer, not in the SDD spec itself.

This covers the “both forward and reverse” requirement without forcing implementation into the meta-model.

---

## 🤖 Agent roles and operations over the meta-model

Given “no manual edits” and “propose + approve” gating, the agent API over the spec should roughly be:

* **CRUD ops by entity type**: `AddRequirement`, `RefineRequirement`, `SplitRequirement`, `AddScenario`, `ModifyScenarioSteps`, `AddProtocol`, etc.
* **Traceability ops**:

  * “Link requirements to scenarios/components/telemetry contracts.”
  * “Show uncovered requirements / orphaned scenarios / unreachable components.”
* **Observability ops**:

  * “Generate telemetry_schema + telemetry_contract for scenarios SCN-… based on OTel HTTP conventions.”
  * “Check that telemetry_contract TELC-… is satisfied by captured traces from test run.”
* **Diagram ops**:

  * “Generate/refresh VIEW-login-api-seq-main using VP-api-sequence for SCN-LOGIN-001.”
  * “List views that have broken references or drift from current spec.”
* **Cross-bundle ops**:

  * “Pull external bundle `payments-core@1.3.0`, compare with local cross_bundle_dependency entries, and propose upgrades to 1.4.0.”
* **Governance ops**:

  * “List all constraints with severity ‘must’ that are not yet bound to any scenario or telemetry_contract.”
  * “Find risks without mitigation ADRs.”

Every operation emits a **diff** (proposed YAML changes + PlantUML updates). You approve them (or not), typically via PR in Git.

---

## ⚖ Criticism & potential pitfalls of this meta-model

1. **Category rigidity for requirements**

   * Forcing every requirement into one of ~10 categories is clean but brittle: new kinds (e.g. AI alignment, ethics) may not fit neatly. Mitigation: allow a “custom” category + tags while still recommending a default set.

2. **Scenario overloading**

   * Using a single `scenario` entity for UI, API, e2e-test, and perf-test keeps the type count small but risks conflating concerns. You’ll need strict viewpoint semantics and validation to prevent scenarios from becoming a junk drawer.

3. **Observability complexity**

   * `telemetry_schema` + `telemetry_contract` + OTel/W3C adherence adds real cognitive load. Teams often under-invest in this. The upside is strong traceability and testable observability; the downside is that agents must be very good at synthesising and updating these specs correctly.

4. **PlantUML drift and layout entropy**

   * Static PlantUML in the spec is powerful, but preserving readability while agents mutate diagrams is non-trivial. You’ll need clear conventions on node naming, grouping, and comments plus tests that check for broken references and layout regressions, or you will recreate EA diagram sprawl in textual form.

5. **Cross-bundle dependency management**

   * Cross-bundle dependencies + versioning is essential for large landscapes but can explode quickly if not curated. You may want rules like “no more than X external protocols per bundle” or mandatory ADRs for new cross-bundle dependencies.

6. **Agent trust and review overhead**

   * With “propose + approval” only, there’s a trade-off: safety vs friction. If agents are too verbose in diffs, human reviewers will rubber-stamp changes; if they’re too silent, you risk hidden drift. You may want a “change budget” or gating based on changed entities count.

7. **EA/Archi parity vs SDD pragmatism**

   * This meta-model intentionally **does not** replicate EA/Archi business layers, portfolios, or deployment views. That’s good for focus, but it means some EA practitioners will find it “incomplete” in EA terms. That’s acceptable given your SDD goals, but it is a conscious trade-off.

---

## 📊 Summary table – Entity set and purpose

| #  | Entity                    | Purpose in SDD bundle                                                       | EA/Archi analogue(s)                               |
| -- | ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| 1  | `bundle`                  | Root for one bounded context/domain                                         | Model root / Archi model                           |
| 2  | `component`               | Coarse-grained domain service/UI/worker                                     | UML Component, C4 Container, Archi ApplicationComp |
| 3  | `protocol`                | API/interaction contract                                                    | Interface, Port, Archi Interface/Service           |
| 4  | `data_schema`             | Logical schema (JSON, Avro, etc.)                                           | Class/ER/Archi Data Object                         |
| 5  | `requirement`             | Canonical requirement with kind/category/subtype + hierarchy                | Requirement, Goal, Constraint                      |
| 6  | `scenario`                | Unified behavior / test flow (UI/API/E2E/perf)                              | Use Case, Sequence, Activity, TestCase             |
| 7  | `fixture`                 | Deterministic data/environment/mocks for scenarios                          | Test data/environment                              |
| 8  | `actor`                   | Human or system role in scenarios, requirement owner                        | UML Actor, ArchiMate Business Actor                |
| 9  | `adr`                     | Architecture decision record                                                | Decision, Rationale elements                       |
| 10 | `principle`               | Architectural principle                                                     | Principle / Rationale                              |
| 11 | `policy`                  | Normative rule (security, observability, etc.)                              | Policy / Business Rule                             |
| 12 | `constraint`              | Concrete constraint derived from policies/requirements                      | Constraint elements                                |
| 13 | `risk`                    | Risk with likelihood/impact/mitigation                                      | Risk/Issue elements                                |
| 14 | `threat`                  | STRIDE-style threat with assets, attack surfaces, mitigations               | Threat model elements                              |
| 15 | `open_question` (opt.)    | Open design question                                                        | Issue/Open question entities                       |
| 16 | `telemetry_schema`        | OTel-style schema for traces/metrics/logs/events                            | Monitoring/Instrumentation specs                   |
| 17 | `telemetry_contract`      | Scenario-level telemetry expectations enforced in CI                        | Testable observability contracts                   |
| 18 | `error_code`              | Enumerated error codes, HTTP status, mapping to Problem Details & telemetry | Error catalogue / Message schema                   |
| 19 | `health_check_spec`       | Health endpoint behaviour                                                   | Runtime health/monitoring views                    |
| 20 | `cross_bundle_dependency` | Explicit dependency on another bundle's element with version                | Inter-model dependency                             |
| 21 | `external_spec_ref`       | Reference to OpenAPI/AsyncAPI/etc.                                          | External artefact references                       |
| 22 | `viewpoint`               | Reusable PlantUML viewpoint/template                                        | Viewpoint definition (Archi viewpoint, EA profile) |
| 23 | `view`                    | Concrete diagram with embedded PlantUML                                     | Diagram instance                                   |

This set stays within your desired 20–30 element window (23 entities), is strongly aligned with SDD/spec-as-source, and captures the parts of EA/Archi that actually matter for application + technical architecture, tests, security, and observability, without dragging in legacy baggage like epics/features/stories or heavy deployment modeling.

