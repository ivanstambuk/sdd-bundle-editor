# Schema Relationship Migration Plan

> Migrate bundle schemas to follow Target-Holds-Reference convention

## Overview

This migration moves reference fields from "governor" entities to "implementable" entities, ensuring predictable dependency traversal for AI agents.

**Convention**: The entity being constrained/governed holds the reference TO its constraints/governors.

---

## Current State Audit

### ✅ Already Correct (Keep As-Is)

These relationships already follow the convention:

| Schema | Field | Target | Status |
|--------|-------|--------|--------|
| Feature | `governedByAdrIds` | ADR | ✅ Correct |
| Requirement | `governedByAdrIds` | ADR | ✅ Correct |
| Requirement | `ownerId` | Actor | ✅ Correct |
| Requirement | `parentId` | Requirement | ✅ Correct |
| Requirement | `realizedByComponents` | Component | ✅ Correct |
| Constraint | `derivedFromPolicyId` | Policy | ✅ Correct |
| Decision | `originatingAdrIds` | ADR | ✅ Correct |
| Protocol | `governedByAdrIds` | ADR | ✅ Correct |
| Protocol | `providedByComponents` | Component | ✅ Correct |
| Protocol | `consumedByComponents` | Component | ✅ Correct |
| Task | `belongsToFeatureIds` | Feature | ✅ Correct |
| Fixture | `belongsToFeatureIds` | Feature | ✅ Correct |
| Threat | `mitigatedByRequirements` | Requirement | ✅ Correct |
| Threat | `documentedInAdrs` | ADR | ✅ Correct |
| HealthCheckSpec | `exposedByProtocolId` | Protocol | ✅ Correct |
| HealthCheckSpec | `coveredByScenarios` | Scenario | ✅ Correct |
| TelemetryContract | `boundByConstraints` | Constraint | ✅ Correct |
| ADR | `supersedesAdrIds` | ADR | ✅ Correct (ADR → ADR is symmetric) |

---

### ⚠️ Needs Migration (Move Reference Field)

These relationships have the reference on the "governor" entity instead of the "governed" entity:

| Current Location | Current Field | Move To | New Field | Why |
|------------------|---------------|---------|-----------|-----|
| Requirement | `realizesFeatureIds` | Feature | `realizedByRequirementIds` | Feature should know its requirements |
| Component | `implementsRequirements` | Requirement | `implementedByComponentIds` | Requirement should know its implementers |
| Component | `implementsFeatureIds` | Feature | `implementedByComponentIds` | Feature should know its components |
| Constraint | `constrainsRequirementIds` | Requirement | `constrainedByConstraintIds` | Requirement should know its constraints |
| Constraint | `constrainsScenarioIds` | Scenario | `constrainedByConstraintIds` | Scenario should know its constraints |
| Constraint | `constrainsComponentIds` | Component | `constrainedByConstraintIds` | Component should know its constraints |
| Decision | `affectsFeatureIds` | Feature | `affectedByDecisionIds` | Feature should know decisions affecting it |
| Threat | `affectsComponents` | Component | `affectedByThreatIds` | Component should know threats |
| Threat | `affectsProtocols` | Protocol | `affectedByThreatIds` | Protocol should know threats |
| Policy | `enforcedByConstraints` | Constraint | `enforcesPolicy` | ✅ Keep - already correct direction |
| Policy | `appliesToProtocols` | Protocol | `governedByPolicyIds` | Protocol should know its policies |
| Policy | `appliesToComponents` | Component | `governedByPolicyIds` | Component should know its policies |
| Policy | `appliesToRequirements` | Requirement | `governedByPolicyIds` | Requirement should know its policies |
| Principle | `guidesAdrs` | ADR | `guidedByPrincipleIds` | ADR should know guiding principles |
| Principle | `guidesRequirements` | Requirement | `guidedByPrincipleIds` | Requirement should know guiding principles |
| TelemetrySchema | `appliesToComponents` | Component | `telemetrySchemaIds` | Component should know its schemas |
| TelemetrySchema | `appliesToProtocols` | Protocol | `telemetrySchemaIds` | Protocol should know its schemas |
| TelemetrySchema | `appliesToScenarios` | Scenario | `telemetrySchemaIds` | Scenario should know its schemas |
| Actor | `ownsRequirements` | Requirement | `ownerId` (exists) | ✅ Already exists - REMOVE from Actor |
| Actor | `usesComponents` | Component | `usedByActorIds` | Component should know its users |
| Scenario | `coversRequirements` | Requirement | `coveredByScenarioIds` | Requirement should know its coverage |
| Scenario | `usesComponents` | Component | `usedInScenarioIds` | Component should know where it's used |
| Scenario | `usesProtocols` | Protocol | `usedInScenarioIds` | Protocol should know where it's used |
| Scenario | `usesFixtures` | Fixture | `usedInScenarioIds` | Fixture should know where it's used |
| Fixture | `validatesRequirementIds` | Requirement | `validatedByFixtureIds` | Requirement should know its validations |
| Profile | `requiresFeatures` | Feature | `requiredByProfileIds` | Feature should know which profiles require it |
| Profile | `optionalFeatures` | Feature | `optionalInProfileIds` | Feature should know which profiles optionally use it |

---

### 🔄 Keep As-Is (Symmetric or Special Cases)

| Schema | Field | Target | Reason |
|--------|-------|--------|--------|
| Component | `dependsOn` | Component | Self-referential, keep on dependent |
| DataSchema | `usedInProtocols` | Protocol | Data schema describes its usage |
| ErrorCode | `raisedInScenarios` | Scenario | ErrorCode describes where it's raised |
| ErrorCode | `documentedInProtocols` | Protocol | ErrorCode describes its documentation |
| Risk | `relatedRequirements` | Requirement | "Related to" is symmetric |
| Risk | `relatedAdrs` | ADR | "Related to" is symmetric |
| Risk | `relatedComponents` | Component | "Related to" is symmetric |
| Risk | `relatedScenarios` | Scenario | "Related to" is symmetric |
| Risk | `relatedThreats` | Threat | "Related to" is symmetric |
| ADR | `relatedFeatureIds` | Feature | "Related to" is symmetric |
| ADR | `relatedRequirementIds` | Requirement | "Related to" is symmetric |
| ADR | `relatedConstraintIds` | Constraint | "Related to" is symmetric |
| ADR | `relatedDecisionIds` | Decision | "Related to" is symmetric |
| ADR | `relatedOpenQuestionIds` | OpenQuestion | "Related to" is symmetric |
| View | `fromViewpointId` | Viewpoint | View describes its viewpoint |
| TelemetryContract | `forScenarioId` | Scenario | Contract is for a scenario |
| TelemetryContract | `telemetrySchemaIds` | TelemetrySchema | Contract uses schemas |
| TelemetryContract | `linkedErrorCodes` | ErrorCode | Contract links to error codes |

---

## Migration Strategy

### Phase 1: Schema Updates (No Data Migration Yet)

1. **Update target schemas** to add new fields with `x-sdd-refTargets`
2. **Keep old fields** temporarily (allows gradual migration)
3. **Mark old fields** as deprecated in schema description

### Phase 2: Entity Data Migration

For each affected relationship:
1. Read entities with old field
2. Populate new field on target entities
3. Clear old field on source entities

### Phase 3: Schema Cleanup

1. Remove deprecated fields from source schemas
2. Validate all references are migrated

---

## Implementation Order

**Batch 1: Core Governance** (Most impactful for export_context)
1. Requirement → Feature (realizesFeatureIds → realizedByRequirementIds)
2. Constraint → Requirement/Scenario/Component (constrains* → constrainedBy*)
3. Decision → Feature (affectsFeatureIds → affectedByDecisionIds)

**Batch 2: Threat Model**
4. Threat → Component/Protocol (affects* → affectedByThreatIds)
5. Policy → Protocol/Component/Requirement (appliesTo* → governedByPolicyIds)

**Batch 3: Principles & Guidance**
6. Principle → ADR/Requirement (guides* → guidedByPrincipleIds)

**Batch 4: Implementation Links**
7. Component → Requirement/Feature (implements* → implementedBy*)
8. Actor → Requirement (ownsRequirements → remove, use existing ownerId)

**Batch 5: Operational**
9. Scenario → Requirement/Component/Protocol (covers/uses* → coveredBy*/usedIn*)
10. Profile → Feature (requires/optional → requiredBy*/optionalIn*)

---

## Estimated Effort

- **Schema changes**: ~20 schema files, 1-2 hours
- **Entity data migration**: Script development, 1-2 hours
- **Testing**: Validate UI and MCP tools, 1 hour
- **Total**: 4-6 hours

---

## Decision Point

Before proceeding:

1. **Full migration now** - Do all batches before export_context
2. **Incremental** - Do Batch 1 (core governance) first, implement export_context, then continue

**Recommendation**: Batch 1 is sufficient for export_context to work well. We can do the rest incrementally.

---

*Migration plan created: 2025-12-21*
