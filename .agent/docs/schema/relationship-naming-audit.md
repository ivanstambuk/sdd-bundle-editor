# Relationship Naming Audit Report

> Generated: 2025-12-19 | Last Updated: 2025-12-19

## Summary

| Metric | Count |
|--------|-------|
| **Total relationships** | 72 |
| **With title** | 72 ✅ |
| **Missing title** | 0 |
| **Bare target names (no verb)** | 0 ✅ (3 fixed) |

## Current State

All 72 relationship fields now follow the naming convention. The UI displays human-readable `title` values (JSON Schema standard) in the Relationships table and graph.

## Fixes Applied

### ✅ Bare Target Names Fixed

These 3 field names were just the target entity type. They have been renamed to include a verb prefix:

| From Entity | Old Field | New Field | title |
|-------------|-----------|-----------|-------------|
| HealthCheckSpec | `protocolId` | `exposedByProtocolId` | "exposed by" |
| TelemetryContract | `scenarioId` | `forScenarioId` | "for scenario" |
| View | `viewpointId` | `fromViewpointId` | "from viewpoint" |

### Naming Patterns (Reference)

| Pattern | Examples | Verdict |
|---------|----------|---------|
| `verbTargetIds` | `governedByAdrIds`, `realizesFeatureIds` | ✅ Preferred for clarity in code |
| `verbTarget` | `implementsRequirements`, `usesComponents` | ✅ Also acceptable |
| `verb` only | `supersedes`, `dependsOn` | ✅ Good when target is obvious |

## Guidelines for New Relationships

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
      "x-sdd-refTargets": ["Feature"]
    },
    "title": "implements",
    "description": "Features this component implements"
  }
}
```

**Rules:**
1. Field name: `verb` + `TargetType` + `Id` or `Ids`
2. `title`: verb only, lowercase (target entity shown in UI column)
3. `description`: full sentence for tooltips

## Well-Named Relationships (69 of 72)

| From Entity | Field | title | To Entity |
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
