# Pending Task: ADR Schema Upgrade to v6

**Created:** 2024-12-19T16:44:00+01:00
**Priority:** High
**Estimated Effort:** 30-45 minutes

---

## Summary

Upgrade the ADR (Architecture Decision Record) schema in the sample bundle to v6, incorporating best practices from MADR, Nygard, and Microsoft guidance. Also update the Constraint schema to support decision drivers.

---

## Background

This task was designed through extensive discussion analyzing:
- User's existing ADR templates from `openauth-sim` and `journeyforge` projects
- Industry standards (MADR, Michael Nygard's original format, Y-statements)
- External criticism covering conditional requirements, validation enforcement, and semantic completeness

Key design decisions:
1. **Normalized design** - ADR links to external entities (Constraints, Actors, etc.) rather than embedding
2. **Conditional requirements** - Non-draft ADRs must have complete content
3. **Schema-enforced validation** - `isChosen` exactly-one rule enforced via JSON Schema 2020-12 features
4. **Decision drivers via Constraints** - Existing Constraint entity expanded with new `kind` values

---

## Implementation Plan

### Phase 1: Update Constraint Schema (5 min)

**File:** `/home/ivan/dev/sdd-sample-bundle/schemas/Constraint.schema.json`

**Changes:**
1. Add new `kind` enum values:
   - `"regulatory"` - GDPR, PCI-DSS, SOX, etc.
   - `"strategic"` - Business initiatives, programs
   - `"technical"` - Technical debt, architecture principles

**Current enum:**
```json
"kind": {
  "enum": ["performance", "security", "cost", "organisational", "observability", "reliability", "other"]
}
```

**New enum:**
```json
"kind": {
  "enum": ["performance", "security", "cost", "organisational", "observability", "reliability", "regulatory", "strategic", "technical", "other"]
}
```

---

### Phase 2: Update ADR Schema to v6 (15 min)

**File:** `/home/ivan/dev/sdd-sample-bundle/schemas/ADR.schema.json`

**Complete replacement with v6 schema.** Key changes from current:

#### 2.1 ID Pattern (slug-only)
```json
"id": {
  "type": "string",
  "pattern": "^ADR-[a-z][a-z0-9]*(-[a-z0-9]+)*$",
  "x-sdd-idTemplate": "ADR-{slug}",
  "x-sdd-entityType": "ADR",
  "x-sdd-idScope": "bundle",
  "description": "Unique identifier using kebab-case slug",
  "maxLength": 60
}
```

#### 2.2 Status (extended)
```json
"status": {
  "enum": ["draft", "proposed", "accepted", "rejected", "deprecated", "superseded"]
}
```

#### 2.3 Conditional Requirements (via allOf)
```json
"allOf": [
  {
    "if": { "properties": { "status": { "enum": ["proposed", "accepted", "rejected", "deprecated", "superseded"] } }, "required": ["status"] },
    "then": { "required": ["decidedDate", "context", "problem", "decision", "alternativesConsidered"] }
  },
  {
    "if": { "properties": { "status": { "const": "accepted" } }, "required": ["status"] },
    "then": { "required": ["deciderActorIds"] }
  }
]
```

#### 2.4 Three Date Fields
- `createdDate` - when drafted
- `decidedDate` - when finalized
- `lastModifiedDate` - for metadata corrections

#### 2.5 New Fields
- `assumptions: string[]` - implicit beliefs that could invalidate decision
- `confidence: enum(low|medium|high)` - decision confidence level
- `neutralConsequences: string[]` - neither positive nor negative outcomes
- `problem: string` - separate from context

#### 2.6 Alternatives Validation
```json
"alternativesConsidered": {
  "type": "array",
  "contains": { "properties": { "isChosen": { "const": true } }, "required": ["isChosen"] },
  "minContains": 1,
  "maxContains": 1,
  "items": {
    "allOf": [{
      "if": { "properties": { "isChosen": { "const": true } }, "required": ["isChosen"] },
      "then": { "properties": { "reasonRejected": false } }
    }],
    "properties": {
      "name": { "type": "string", "maxLength": 50 },
      "description": { "type": "string", "x-sdd-displayHint": "markdown" },
      "pros": { "type": "array", "items": { "type": "string" } },
      "cons": { "type": "array", "items": { "type": "string" } },
      "isChosen": { "type": "boolean", "default": false },
      "reasonRejected": { "type": "string", "x-sdd-displayHint": "markdown" }
    }
  }
}
```

#### 2.7 Follow-ups (with both Actor link and free-form)
```json
"followUps": {
  "type": "array",
  "items": {
    "properties": {
      "description": { "type": "string" },
      "assigneeActorIds": { "type": "array", "items": { "format": "sdd-ref", "x-sdd-refTargets": ["Actor"] } },
      "assigneeName": { "type": "string" }
    },
    "required": ["description"]
  }
}
```

#### 2.8 UI Metadata Namespace
Change all custom properties to `x-sdd-*` prefix:
- `displayHint` → `x-sdd-displayHint`
- `displayName` → `x-sdd-displayName`
- `ui:widget` → `x-sdd-widget`
- `x-refTargets` → `x-sdd-refTargets`
- `x-idTemplate` → `x-sdd-idTemplate`
- `x-entityType` → `x-sdd-entityType`
- `x-idScope` → `x-sdd-idScope`

---

### Phase 3: Migrate Existing ADRs (10 min)

**Files:**
- `/home/ivan/dev/sdd-sample-bundle/bundle/adrs/ADR-auth-strategy.yaml`
- `/home/ivan/dev/sdd-sample-bundle/bundle/adrs/ADR-storage-choice.yaml`

**Migration steps for each:**
1. Change `id` to slug format if needed
2. Add required dates (`createdDate`, `decidedDate`)
3. Split `consequences` into `positiveConsequences`, `negativeConsequences`, `neutralConsequences`
4. Add `problem` field (extract from `context` if needed)
5. Add `alternativesConsidered` with at least one `isChosen: true`
6. Add `confidence` level
7. Update `supersedes` to use new ID format

---

### Phase 4: Create Example ADR (5 min)

**File:** `/home/ivan/dev/sdd-sample-bundle/bundle/adrs/ADR-mcp-api-consolidation.yaml`

Create a comprehensive example ADR demonstrating all v6 features. Use the example from this conversation.

---

### Phase 5: Create Example Constraints as Drivers (5 min)

**Files:**
- `/home/ivan/dev/sdd-sample-bundle/bundle/constraints/CON-Q4-DELIVERY.yaml` (kind: strategic)
- `/home/ivan/dev/sdd-sample-bundle/bundle/constraints/CON-REDUCE-MAINTENANCE.yaml` (kind: organisational)

Demonstrate using Constraints as decision drivers.

---

### Phase 6: Validate and Test (5 min)

1. Run bundle validation: `pnpm --filter @sdd-bundle-editor/core-lint test`
2. Load in UI to verify display
3. Verify no TypeScript errors in dependent packages

---

## Full v6 ADR Schema

See conversation for complete JSON Schema. Key structural overview:

```
ADR
├── Identity: id, title, status
├── Dates: createdDate, decidedDate, lastModifiedDate
├── Deciders: deciderActorIds → Actor[]
├── Cross-refs:
│   ├── relatedFeatureIds → Feature[]
│   ├── relatedRequirementIds → Requirement[]
│   ├── relatedConstraintIds → Constraint[] (includes decision drivers!)
│   ├── relatedDecisionIds → Decision[]
│   ├── relatedOpenQuestionIds → OpenQuestion[]
│   └── supersedes → ADR[]
├── Problem Definition: context, problem, assumptions[]
├── Decision: decision, confidence
├── Consequences: positiveConsequences[], neutralConsequences[], negativeConsequences[]
├── Alternatives: alternativesConsidered[]
│   └── Each: name, description, pros[], cons[], isChosen, reasonRejected
├── Impact: nonfunctionalImpact
├── Follow-ups: followUps[]
│   └── Each: description, assigneeActorIds[], assigneeName
└── Links: links[]
    └── Each: label, url
```

---

## Conditional Requirements Summary

| Status | Additional Required Fields |
|--------|---------------------------|
| `draft` | none |
| `proposed`, `rejected`, `deprecated`, `superseded` | decidedDate, context, problem, decision, alternativesConsidered |
| `accepted` | All above + deciderActorIds |

---

## Validation Rules (Schema-Enforced)

1. **Exactly one chosen alternative:** `minContains: 1, maxContains: 1` on alternatives where `isChosen: true`
2. **No reasonRejected on chosen:** `if isChosen=true then reasonRejected: false`
3. **Slug-only IDs:** Pattern `^ADR-[a-z][a-z0-9]*(-[a-z0-9]+)*$`

---

## Files to Modify

| File | Action |
|------|--------|
| `schemas/Constraint.schema.json` | Add 3 new `kind` values |
| `schemas/ADR.schema.json` | Replace with v6 schema |
| `bundle/adrs/ADR-auth-strategy.yaml` | Migrate to v6 format |
| `bundle/adrs/ADR-storage-choice.yaml` | Migrate to v6 format |
| `bundle/adrs/ADR-mcp-api-consolidation.yaml` | Create new example |
| `bundle/constraints/CON-Q4-DELIVERY.yaml` | Create (kind: strategic) |
| `bundle/constraints/CON-REDUCE-MAINTENANCE.yaml` | Create (kind: organisational) |

---

## Notes

- The sample bundle is at `/home/ivan/dev/sdd-sample-bundle` (separate from the editor repo)
- UI metadata uses `x-sdd-*` namespace consistently
- Reference integrity is validated by bundle linter, not JSON Schema
- This schema aligns with MADR v3, Nygard's original format, and Microsoft's ADR guidance

---

## Success Criteria

- [ ] Constraint schema updated with new `kind` values
- [ ] ADR schema v6 implemented with all conditional requirements
- [ ] Both existing ADRs migrated to v6 format
- [ ] New example ADR created demonstrating all features
- [ ] Example Constraints created showing driver usage
- [ ] Bundle validates without errors
- [ ] Changes committed
