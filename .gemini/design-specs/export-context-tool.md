# Design Spec: `export_context` MCP Tool

> Structured export of entity subsets for AI agent consumption

## Overview

**Problem**: The existing `export_entity_markdown` tool generates human-readable documents. However, AI agents implementing features need a **machine-parseable subset** of the bundle - entities with their transitive dependencies and relevant schemas - optimized for:

1. **Context window efficiency** - pre-computed subset, not N MCP calls
2. **Offline work** - agent can work with exported file without MCP connection
3. **Traceability** - exported file is a snapshot, can be versioned/reviewed

**Solution**: A new `export_context` tool that outputs structured JSON/YAML containing the target entities, their dependencies, and relevant schemas.

---

## Comparison with Existing Tools

| Tool | Output | Consumer | Use Case |
|------|--------|----------|----------|
| `export_entity_markdown` | Markdown | Humans | Reading, documentation, review |
| `get_context` | JSON (live) | Agents | Real-time queries during work |
| **`export_context`** | JSON/YAML | Agents | Offline work, implementation planning |

**Key difference from `get_context`**:
- `get_context` returns one entity + related entities (flat)
- `export_context` returns multiple targets + deep transitive deps + schemas (hierarchical, portable)

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `bundleId` | string | no | (single-bundle default) | Bundle ID |
| `targets` | `EntityRef[]` | **yes** | - | Array of `{entityType, entityId}` to export |
| `includeSchemas` | boolean | no | `true` | Include JSON schemas for exported entity types |
| `dependencyDepth` | number | no | `3` | How deep to traverse dependencies (max 5) |
| `format` | `"json"` \| `"yaml"` | no | `"json"` | Output format |
| `includeRelationMetadata` | boolean | no | `true` | Include relationship metadata (what field references what) |

### EntityRef Schema
```typescript
interface EntityRef {
  entityType: string;  // e.g., "Feature"
  entityId: string;    // e.g., "auth-login"
}
```

---

## Output Schema

```typescript
interface ExportContextOutput {
  // Metadata about the export
  exportMeta: {
    bundleId: string;
    bundleName: string;
    exportedAt: string;  // ISO timestamp
    targetCount: number;
    dependencyCount: number;
    totalEntities: number;
    format: "json" | "yaml";
    version: "1.0";  // Export format version for future compatibility
  };

  // The explicitly requested entities
  targets: ExportedEntity[];

  // Transitive dependencies (not including targets)
  dependencies: ExportedEntity[];

  // Relationship metadata - how entities connect
  relations: RelationEdge[];

  // JSON schemas for the entity types present in the export
  schemas?: Record<string, object>;
}

interface ExportedEntity {
  entityType: string;
  id: string;
  data: Record<string, unknown>;
  // Source tracking
  source: {
    filePath: string;  // Relative path within bundle
  };
}

interface RelationEdge {
  from: EntityRef;
  to: EntityRef;
  field: string;      // Field name on source entity
  displayName: string; // Human-readable relationship name
}
```

---

## Example Request

```json
{
  "bundleId": "sdd-sample-bundle",
  "targets": [
    { "entityType": "Feature", "entityId": "auth-login" },
    { "entityType": "Feature", "entityId": "auth-logout" }
  ],
  "includeSchemas": true,
  "dependencyDepth": 2,
  "format": "json"
}
```

---

## Example Response

```json
{
  "ok": true,
  "tool": "export_context",
  "data": {
    "exportMeta": {
      "bundleId": "sdd-sample-bundle",
      "bundleName": "SDD Sample Bundle",
      "exportedAt": "2025-12-20T23:50:00Z",
      "targetCount": 2,
      "dependencyCount": 8,
      "totalEntities": 10,
      "format": "json",
      "version": "1.0"
    },
    "targets": [
      {
        "entityType": "Feature",
        "id": "auth-login",
        "data": {
          "id": "auth-login",
          "title": "User Login",
          "description": "...",
          "realizesRequirementIds": ["REQ-001", "REQ-002"]
        },
        "source": { "filePath": "bundle/Feature/auth-login.yaml" }
      }
    ],
    "dependencies": [
      {
        "entityType": "Requirement",
        "id": "REQ-001",
        "data": { "id": "REQ-001", "title": "Secure authentication", "..." },
        "source": { "filePath": "bundle/Requirement/REQ-001.yaml" }
      }
    ],
    "relations": [
      {
        "from": { "entityType": "Feature", "entityId": "auth-login" },
        "to": { "entityType": "Requirement", "entityId": "REQ-001" },
        "field": "realizesRequirementIds",
        "displayName": "Realizes"
      }
    ],
    "schemas": {
      "Feature": { "$schema": "...", "properties": { ... } },
      "Requirement": { "$schema": "...", "properties": { ... } }
    }
  },
  "meta": {
    "bundleId": "sdd-sample-bundle"
  }
}
```

---

## Implementation Notes

### Dependency Collection Algorithm

We follow the **Target-Holds-Reference** convention: each entity holds references to what it depends on. This means traversing the entity's reference fields to find its dependencies.

1. Start with target entities
2. For each entity, read its reference fields (`x-sdd-refTargets`) to find the entities it depends on
3. Recursively collect dependencies until `dependencyDepth` is reached
4. De-duplicate across all targets (the same entity may be a dependency of multiple targets)
5. Separate into `targets` (explicitly requested) vs `dependencies` (collected via traversal)

### Reuse from Existing Code

- `collectDependencies()` in `export-tools.ts` - core traversal logic
- `loadSchema()` in `export-tools.ts` - schema loading from disk
- Response envelope from `response-helpers.ts`
- Tool registration via `registerReadOnlyTool`

### Schema Collection

Only include schemas for entity types that appear in the export:
```typescript
const entityTypes = new Set([
  ...targets.map(e => e.entityType),
  ...dependencies.map(e => e.entityType)
]);
```

---

## File Location

`packages/mcp-server/src/tools/export-tools.ts` - add to existing file alongside `export_entity_markdown`

---

## Testing Plan

1. **Unit tests** in `packages/mcp-server/src/tools/export-tools.test.ts`:
   - Single target, no deps
   - Single target with deps
   - Multiple targets with overlapping deps (de-duplication)
   - Depth limiting
   - Schema inclusion on/off
   - YAML format output

2. **E2E test** via MCP HTTP:
   ```bash
   pnpm mcp-cli export_context -t '[{"entityType":"Feature","entityId":"auth-login"}]'
   ```

---

## Decisions (Finalized)

### Terminology Clarification

| Term | Meaning | Example |
|------|---------|----------|
| **Dependency** | An entity that the target entity depends on (referenced via its fields) | Requirement is a dependency of Feature |
| **Referrer** | An entity that depends on the target (the target is referenced by that entity) | Component is a referrer of Feature |
| **Reference field** | A field with `x-sdd-refTargets` that contains IDs of other entities | `Feature.realizesRequirementIds` |

This tool collects **dependencies** (what the target needs), not **referrers** (what needs the target).

### Finalized Decisions

1. ✅ **Targets as explicit array** - Multiple entities in one export
2. ✅ **JSON/YAML format option** - Both supported
3. ✅ **Include schemas by default** - `includeSchemas: true`
4. ✅ **Dependencies only (not referrers)** - Only traverse what the target references, not what references the target. If Feature references Requirement, include Requirement. Don't include Components that happen to reference Feature.
5. ✅ **No file output** - Standard MCP response envelope, in-memory. Agents handle persistence if needed.
6. ✅ **No entity type filtering (v1)** - Collect all dependency types. If graph explosion becomes a problem, add `includeDependencyTypes` parameter later.

---

*Design spec created: 2025-12-20*  
*Decisions finalized: 2025-12-21*
