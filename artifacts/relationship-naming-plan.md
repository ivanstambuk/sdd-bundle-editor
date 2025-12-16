# Relationship Field Naming Standardization Plan

## Overview

This plan standardizes reference field naming across all entity schemas in the SDD bundle.
The goal is to make relationship field names **self-describing** and add **human-readable display names**.

## Principles

### Naming Convention for Reference Fields

**Pattern:** `{verb}{TargetEntity}Ids` (plural) or `{verb}{TargetEntity}Id` (singular)

**Examples:**
- `realizesFeatureIds` - Requirement **realizes** these Features
- `implementsRequirementIds` - Component **implements** these Requirements
- `governedByAdrIds` - Protocol **is governed by** these ADRs

### Display Names

Each reference property should have a `displayName` field for UI rendering:
```json
"realizesFeatureIds": {
  "type": "array",
  "items": { "type": "string", "format": "sdd-ref", "x-refTargets": ["Feature"] },
  "description": "Features this requirement helps realize",
  "displayName": "Realizes Features"
}
```

---

## Fields to Rename

### Priority 1: Ambiguous `featureIds` and `requirementIds`

These generic names don't convey the relationship semantics:

| Entity | Current Field | New Field | Display Name | Rationale |
|--------|---------------|-----------|--------------|-----------|
| Requirement | `featureIds` | `realizesFeatureIds` | Realizes Features | Req helps realize the feature |
| Task | `featureIds` | `belongsToFeatureIds` | Belongs to Features | Task is part of feature scope |
| Task | `requirementIds` | `fulfillsRequirementIds` | Fulfills Requirements | Task fulfills requirements |
| Component | `featureIds` | `implementsFeatureIds` | Implements Features | Component implements features |
| Fixture | `featureIds` | `belongsToFeatureIds` | Belongs to Features | Fixture belongs to feature |
| Fixture | `requirementIds` | `validatesRequirementIds` | Validates Requirements | Fixture validates requirements |
| Protocol | `featureIds` | `supportsFeatureIds` | Supports Features | Protocol supports features |
| Decision | `featureIds` | `affectsFeatureIds` | Affects Features | Decision affects features |

### Priority 2: Ambiguous `adrIds`

| Entity | Current Field | New Field | Display Name | Rationale |
|--------|---------------|-----------|--------------|-----------|
| Feature | `adrIds` | `governedByAdrIds` | Governed by ADRs | Feature constrained by ADRs |
| Requirement | `adrIds` | `governedByAdrIds` | Governed by ADRs | Requirement constrained by ADRs |
| Protocol | `adrIds` | `governedByAdrIds` | Governed by ADRs | Protocol follows ADR decisions |

### Priority 3: Add Display Names to Already-Good Fields

These fields have good names but need `displayName` added:

| Entity | Field | Display Name |
|--------|-------|--------------|
| Profile | `requiresFeatures` | Requires Features |
| Profile | `optionalFeatures` | Optional Features |
| ADR | `supersedes` | Supersedes ADR |
| Component | `dependsOn` | Depends On |
| Component | `implementsRequirements` | Implements Requirements |
| Component | `providesProtocols` | Provides Protocols |
| Component | `consumesProtocols` | Consumes Protocols |
| Protocol | `providedByComponents` | Provided By Components |
| Protocol | `consumedByComponents` | Consumed By Components |
| Actor | `ownsRequirements` | Owns Requirements |
| Actor | `usesComponents` | Uses Components |
| Requirement | `realizedByComponents` | Realized By Components |
| Requirement | `refinesRequirements` | Refines Requirements |
| Requirement | `ownerId` | Owner |
| Requirement | `parentId` | Parent Requirement |
| Scenario | `coversRequirements` | Covers Requirements |
| Scenario | `usesComponents` | Uses Components |
| Scenario | `usesProtocols` | Uses Protocols |
| Scenario | `usesFixtures` | Uses Fixtures |
| Principle | `guidesAdrs` | Guides ADRs |
| Principle | `guidesRequirements` | Guides Requirements |
| Policy | `enforcedByConstraints` | Enforced By Constraints |
| Policy | `appliesToProtocols` | Applies To Protocols |
| Policy | `appliesToComponents` | Applies To Components |
| Policy | `appliesToRequirements` | Applies To Requirements |
| Constraint | `derivedFromPolicy` | Derived From Policy |
| Constraint | `constrainsRequirements` | Constrains Requirements |
| Constraint | `constrainsScenarios` | Constrains Scenarios |
| Constraint | `constrainsComponents` | Constrains Components |
| Risk | `relatedRequirements` | Related Requirements |
| Risk | `relatedAdrs` | Related ADRs |
| Risk | `relatedComponents` | Related Components |
| Risk | `relatedScenarios` | Related Scenarios |
| Risk | `relatedThreats` | Related Threats |
| Threat | `affectsComponents` | Affects Components |
| Threat | `affectsProtocols` | Affects Protocols |
| Threat | `mitigatedByRequirements` | Mitigated By Requirements |
| Threat | `documentedInAdrs` | Documented In ADRs |
| Threat | `relatedToRisks` | Related To Risks |
| OpenQuestion | `touchesRequirements` | Touches Requirements |
| OpenQuestion | `touchesAdrs` | Touches ADRs |
| OpenQuestion | `touchesScenarios` | Touches Scenarios |
| View | `viewpointId` | Viewpoint |
| DataSchema | `usedInProtocols` | Used In Protocols |
| TelemetrySchema | `appliesToComponents` | Applies To Components |
| TelemetrySchema | `appliesToProtocols` | Applies To Protocols |
| TelemetrySchema | `appliesToScenarios` | Applies To Scenarios |
| TelemetryContract | `scenarioId` | Scenario |
| TelemetryContract | `telemetrySchemaIds` | Uses Telemetry Schemas |
| TelemetryContract | `boundByConstraints` | Bound By Constraints |
| TelemetryContract | `linkedErrorCodes` | Linked Error Codes |
| ErrorCode | `raisedInScenarios` | Raised In Scenarios |
| ErrorCode | `documentedInProtocols` | Documented In Protocols |
| ErrorCode | `referencedInTelemetrySchemas` | Referenced In Telemetry Schemas |
| HealthCheckSpec | `protocolId` | Protocol |
| HealthCheckSpec | `relatedComponents` | Related Components |
| HealthCheckSpec | `coveredByScenarios` | Covered By Scenarios |

---

## Files to Modify

### 1. Entity Schemas (in `/home/ivan/dev/sdd-sample-bundle/schemas/`)

For each renamed field:
1. Rename the property key
2. Add `displayName` property
3. Update `description` if needed

Files to modify:
- `Requirement.schema.json` - rename `featureIds`, `adrIds`
- `Task.schema.json` - rename `featureIds`, `requirementIds`
- `Component.schema.json` - rename `featureIds`
- `Fixture.schema.json` - rename `featureIds`, `requirementIds`
- `Protocol.schema.json` - rename `featureIds`, `adrIds`
- `Decision.schema.json` - rename `featureIds`
- `Feature.schema.json` - rename `adrIds`
- All other schemas - add `displayName` to existing reference fields

### 2. Bundle Type Definition

File: `/home/ivan/dev/sdd-sample-bundle/schemas/bundle-type.sdd-core.json`

Update `relations` array:
- Change `fromField` to match new field names
- Consider adding `displayName` to relation definitions

### 3. Entity YAML Files (in `/home/ivan/dev/sdd-sample-bundle/bundle/`)

For each entity file that uses renamed fields:
- Rename the field key to match new schema

Directories to scan:
- `bundle/requirements/` - rename `featureIds` → `realizesFeatureIds`, `adrIds` → `governedByAdrIds`
- `bundle/tasks/` - rename `featureIds`, `requirementIds`
- `bundle/components/` - rename `featureIds`
- `bundle/fixtures/` - rename `featureIds`, `requirementIds`
- `bundle/protocols/` - rename `featureIds`, `adrIds`
- `bundle/decisions/` - rename `featureIds`
- `bundle/features/` - rename `adrIds`

### 4. UI Code Updates

#### `mcpBundleApi.ts`
Update `refPatterns` map with new field names:
```typescript
const refPatterns: Record<string, string> = {
  realizesFeatureIds: 'Feature',
  belongsToFeatureIds: 'Feature',
  implementsFeatureIds: 'Feature',
  supportsFeatureIds: 'Feature',
  affectsFeatureIds: 'Feature',
  fulfillsRequirementIds: 'Requirement',
  validatesRequirementIds: 'Requirement',
  governedByAdrIds: 'ADR',
  // ... keep existing patterns for correctly-named fields
};
```

#### `EntityDetails.tsx` (Dependency Graph)
Update to read `displayName` from property schema and show in graph instead of raw field name.

#### `EntityTypeDetails.tsx` (Schema Properties Table)
Already shows property names - consider adding display name column or using it as the primary label.

---

## Implementation Steps

### Step 1: Update Schema Files (schemas/*.schema.json)
For each schema:
1. Rename reference fields per the table above
2. Add `displayName` to all reference properties
3. Verify JSON syntax is valid

### Step 2: Update Bundle Type Definition
Update `bundle-type.sdd-core.json`:
1. Change `fromField` values in relations array
2. Validate JSON syntax

### Step 3: Update Entity YAML Files
For each entity directory:
1. Find all files using old field names
2. Rename fields to new names
3. Validate YAML syntax

### Step 4: Update UI Code
1. Update `refPatterns` in `mcpBundleApi.ts`
2. Update dependency graph to use `displayName`
3. Test UI renders correctly

### Step 5: Validate
1. Run `pnpm build` across all packages
2. Run `pnpm test` to verify no regressions
3. Run CLI validation: `pnpm --filter cli run cli validate /path/to/bundle`
4. Manual UI testing

### Step 6: Commit
Commit with message:
```
refactor: standardize relationship field naming

- Renamed ambiguous fields (featureIds → realizesFeatureIds, etc.)
- Added displayName to all reference properties
- Updated bundle-type relations
- Updated entity YAML files
- Updated UI refPatterns
```

---

## Estimated Effort

| Task | Time Estimate |
|------|---------------|
| Schema updates (24 files) | 30 min |
| Bundle type definition | 10 min |
| Entity YAML files (~50+ files) | 45 min |
| UI code updates | 20 min |
| Testing and validation | 30 min |
| **Total** | **~2.5 hours** |

---

## Rollback Plan

If issues are found:
1. Git revert the commit in both repos
2. Re-run validation
3. Restart dev server

---

## Notes

- This is a **breaking change** for the sample bundle
- Any external tools reading the YAML files will need to be updated
- The UI will continue to work after updates since refPatterns are updated together
