# Relationship Naming Audit Report

> Generated: 2025-12-19

## Summary

| Metric | Count |
|--------|-------|
| **Total relationships** | 72 |
| **With displayName** | 72 ✅ |
| **Missing displayName** | 0 |
| **Bare target names (no verb)** | 3 |

## Current State

The schemas are in **good shape** - all 72 relationship fields already have `displayName` values. The UI was previously showing raw field names instead of these human-readable values. This has been fixed.

## Issues Found

### ⚠️ Bare Target Names (No Verb)

These 3 field names are just the target entity type, which doesn't convey the relationship's semantic meaning:

| From Entity | Field | To Entity | Current displayName | Recommendation |
|-------------|-------|-----------|---------------------|----------------|
| HealthCheckSpec | `protocolId` | Protocol | "Protocol" | Rename to `monitorsProtocolId`, displayName: "monitors" |
| TelemetryContract | `scenarioId` | Scenario | "scenario" | Rename to `forScenarioId`, displayName: "for scenario" |
| View | `viewpointId` | Viewpoint | "viewpoint" | Rename to `fromViewpointId`, displayName: "from viewpoint" |

### Naming Pattern Inconsistency (Minor)

Some fields include the target type while others don't. This is acceptable because `displayName` handles the UI, but for code consistency consider:

| Pattern | Examples | Verdict |
|---------|----------|---------|
| `verbTargetIds` | `governedByAdrIds`, `realizesFeatureIds` | ✅ Preferred for clarity in code |
| `verbTarget` | `implementsRequirements`, `usesComponents` | ✅ Also acceptable |
| `verb` only | `supersedes`, `dependsOn` | ✅ Good when target is obvious |
| `targetId` only | `protocolId`, `scenarioId` | ⚠️ Avoid - lacks semantic meaning |

## Recommendations

### 1. Fix the 3 Bare Target Names (Low Priority)

These are minor issues since `displayName` is already set. If you want perfect consistency:

```yaml
# HealthCheckSpec.schema.json
# Before
protocolId:
  displayName: "Protocol"
  
# After - rename field and update displayName
monitorsProtocolId:
  displayName: "monitors"
```

### 2. UI Now Uses displayName ✅

The `BundleOverview.tsx` Relationships table now shows:

| From Entity | Relationship | To Entity |
|-------------|--------------|-----------|
| FEATURE | governed by | ADR |
| TASK | fulfills | REQUIREMENT |

Instead of the raw field names like `governedByAdrIds`.

### 3. Future Schema Changes

When adding new relationship fields, follow this pattern:

```json
{
  "implementsFeatureIds": {
    "type": "array",
    "items": {
      "type": "string",
      "format": "sdd-ref",
      "x-refTargets": ["Feature"]
    },
    "displayName": "implements",
    "description": "Features this component implements"
  }
}
```

**Rules:**
1. Field name: `verb` + `TargetType` + `Id` or `Ids`
2. `displayName`: verb only (target shown in UI column)
3. `description`: full sentence for tooltips

## Well-Named Relationships (69 of 72)

| From Entity | Field | displayName | To Entity |
|-------------|-------|-------------|-----------|
| ADR | `supersedes` | "supersedes" | ADR |
| Actor | `ownsRequirements` | "owns" | Requirement |
| Actor | `usesComponents` | "uses" | Component |
| Component | `dependsOn` | "depends on" | Component |
| Component | `implementsRequirements` | "implements" | Requirement |
| Component | `implementsFeatureIds` | "implements" | Feature |
| Component | `providesProtocols` | "provides" | Protocol |
| Component | `consumesProtocols` | "consumes" | Protocol |
| Constraint | `constrainsRequirements` | "constrains" | Requirement |
| Constraint | `constrainsScenarios` | "constrains" | Scenario |
| Constraint | `constrainsComponents` | "constrains" | Component |
| Constraint | `derivedFromPolicy` | "derived from" | Policy |
| DataSchema | `usedInProtocols` | "used in" | Protocol |
| Decision | `affectsFeatureIds` | "affects" | Feature |
| Decision | `relatedDecisionIds` | "related to" | Decision |
| ErrorCode | `problemDetailsSchemaId` | "problem details schema" | DataSchema |
| ErrorCode | `raisedInScenarios` | "raised in" | Scenario |
| ErrorCode | `documentedInProtocols` | "documented in" | Protocol |
| ErrorCode | `referencedInTelemetrySchemas` | "referenced in" | TelemetrySchema |
| Feature | `governedByAdrIds` | "governed by" | ADR |
| Fixture | `belongsToFeatureIds` | "belongs to" | Feature |
| Fixture | `validatesRequirementIds` | "validates" | Requirement |
| Fixture | `usedInScenarios` | "Used in Scenarios" | Scenario |
| HealthCheckSpec | `relatedComponents` | "related to" | Component |
| HealthCheckSpec | `coveredByScenarios` | "covered by" | Scenario |
| OpenQuestion | `touchesRequirements` | "touches" | Requirement |
| OpenQuestion | `touchesAdrs` | "touches" | ADR |
| OpenQuestion | `touchesScenarios` | "touches" | Scenario |
| Policy | `enforcedByConstraints` | "enforced by" | Constraint |
| Policy | `appliesToProtocols` | "applies to" | Protocol |
| Policy | `appliesToComponents` | "applies to" | Component |
| Policy | `appliesToRequirements` | "applies to" | Requirement |
| Principle | `guidesAdrs` | "guides" | ADR |
| Principle | `guidesRequirements` | "guides" | Requirement |
| Profile | `requiresFeatures` | "requires" | Feature |
| Profile | `optionalFeatures` | "optional" | Feature |
| Protocol | `providedByComponents` | "provided by" | Component |
| Protocol | `consumedByComponents` | "consumed by" | Component |
| Protocol | `nfrBindings` | "NFR bindings" | Requirement |
| Protocol | `supportsFeatureIds` | "supports" | Feature |
| Protocol | `governedByAdrIds` | "governed by" | ADR |
| Requirement | `ownerId` | "owner" | Actor |
| Requirement | `parentId` | "parent" | Requirement |
| Requirement | `realizesFeatureIds` | "realizes" | Feature |
| Requirement | `governedByAdrIds` | "governed by" | ADR |
| Requirement | `realizedByComponents` | "realized by" | Component |
| Requirement | `refinesRequirements` | "refines" | Requirement |
| Risk | `relatedRequirements` | "related to" | Requirement |
| Risk | `relatedAdrs` | "related to" | ADR |
| Risk | `relatedComponents` | "related to" | Component |
| Risk | `relatedScenarios` | "related to" | Scenario |
| Risk | `relatedThreats` | "related to" | Threat |
| Scenario | `coversRequirements` | "covers" | Requirement |
| Scenario | `usesComponents` | "uses" | Component |
| Scenario | `usesProtocols` | "uses" | Protocol |
| Scenario | `usesFixtures` | "uses" | Fixture |
| Task | `fulfillsRequirementIds` | "fulfills" | Requirement |
| Task | `belongsToFeatureIds` | "belongs to" | Feature |
| TelemetryContract | `telemetrySchemaIds` | "uses" | TelemetrySchema |
| TelemetryContract | `boundByConstraints` | "bound by" | Constraint |
| TelemetryContract | `linkedErrorCodes` | "linked to" | ErrorCode |
| TelemetrySchema | `appliesToComponents` | "applies to" | Component |
| TelemetrySchema | `appliesToProtocols` | "applies to" | Protocol |
| TelemetrySchema | `appliesToScenarios` | "applies to" | Scenario |
| Threat | `affectsComponents` | "affects" | Component |
| Threat | `affectsProtocols` | "affects" | Protocol |
| Threat | `mitigatedByRequirements` | "mitigated by" | Requirement |
| Threat | `relatedToRisks` | "related to" | Risk |
| Threat | `documentedInAdrs` | "documented in" | ADR |
