# MCP Tool Patterns

Reusable patterns for implementing MCP tools in this project.

## Tool Registration Factory Pattern

Use the factory helpers in `tools/registry.ts` for consistent tool registration:

```typescript
import { registerReadOnlyTool, registerMutatingTool, registerExternalTool } from "./registry.js";

// Read-only tool (idempotent, no side effects)
registerReadOnlyTool(
    server,
    "tool_name",
    "Tool description for AI consumption",
    {
        param1: z.string().describe("Description for AI"),
        param2: z.number().optional().default(10).describe("Optional with default"),
    },
    async ({ param1, param2 }) => {
        // Implementation
        return toolSuccess("tool_name", { result }, { bundleId, diagnostics: [] });
    }
);

// Mutating tool (modifies bundle state)
registerMutatingTool(
    server,
    "modify_tool",
    "Description",
    { /* schema */ },
    async (params) => { /* ... */ }
);

// External tool (uses MCP sampling or other external services)
registerExternalTool(
    server,
    "llm_tool",
    "Description",
    { /* schema */ },
    async (params) => { /* ... */ }
);
```

## Response Envelope Pattern

Always use the standardized response helpers:

```typescript
import { toolSuccess, toolError } from "../response-helpers.js";

// Success with data
return toolSuccess("tool_name", {
    entities: [...],
    count: 10,
}, {
    bundleId: effectiveBundleId,
    meta: { total: 100, hasMore: true },
    diagnostics: [],
});

// Error response
return toolError("tool_name", "NOT_FOUND", "Entity not found", {
    entityType: "Requirement",
    entityId: "REQ-001",
});
```

## Bundle Resolution Pattern

Standard pattern for resolving bundleId with single-bundle mode support:

```typescript
const { bundleId } = params;
const loaded = getBundle(bundleId);

if (!loaded) {
    if (!bundleId && !isSingleBundleMode()) {
        return toolError(TOOL_NAME, "BAD_REQUEST", 
            "Multiple bundles loaded. Please specify bundleId.", 
            { availableBundles: getBundleIds() }
        );
    }
    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
}

const effectiveBundleId = loaded.id;
const bundle = loaded.bundle;
```

## Pagination Pattern

Standard pagination with meta response:

```typescript
// Input schema
limit: z.number().min(1).max(100).default(50).describe("Max results to return"),
offset: z.number().min(0).default(0).describe("Pagination offset"),

// Implementation
const allResults = [...]; // full result set
const total = allResults.length;
const paged = allResults.slice(offset, offset + limit);

return toolSuccess(TOOL_NAME, {
    results: paged,
}, {
    bundleId,
    meta: {
        total,
        returned: paged.length,
        hasMore: offset + paged.length < total,
        offset,
        limit,
    },
    diagnostics: [],
});
```

## Entity Type Validation Pattern

```typescript
const entityMap = bundle.entities.get(entityType);
if (!entityMap) {
    const validTypes = Array.from(bundle.entities.keys());
    return toolError(TOOL_NAME, "NOT_FOUND", 
        `Unknown entity type: ${entityType}`, 
        { availableTypes: validTypes }
    );
}
```

## Adding a New Tool

1. Create or update the appropriate category file in `tools/`
2. Use the registry factory helpers for consistent annotations
3. Follow the bundle resolution and error handling patterns
4. Add to the `tools/index.ts` if creating a new category
5. Add E2E test in `e2e/mcp-server.spec.ts`
6. Document in `README.md`
