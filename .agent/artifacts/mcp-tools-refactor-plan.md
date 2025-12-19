# MCP Tools Refactor Plan

**Created**: 2025-12-19
**Estimated Time**: 2-3 hours
**Prerequisites**: Run `pnpm build` to ensure all packages are built

## Overview

This plan covers 4 improvements identified in the retrospective:
1. Extract tools to modular files (~1.5 hours)
2. Add tool registration factory pattern (~30 min)
3. Save reusable snippets (~10 min)
4. Document in tracker (~10 min)

---

## Phase 1: Extract Tools to Modular Files

### Goal
Split the monolithic `setupTools()` method in `server.ts` (2000+ lines) into modular tool files, following the pattern already established for prompts in `prompts/`.

### Current Structure
```
packages/mcp-server/src/
├── server.ts           # Contains ALL 15 tools inline
├── prompts/            # ✅ Already modularized
│   ├── index.ts
│   ├── types.ts
│   ├── implementation.ts
│   ├── analysis.ts
│   └── ...
└── response-helpers.ts
```

### Target Structure
```
packages/mcp-server/src/
├── server.ts           # Delegates to tools/index.ts
├── tools/
│   ├── index.ts        # Exports setupAllTools(server)
│   ├── types.ts        # Common types, ToolContext interface
│   ├── registry.ts     # Tool registration factory helpers
│   ├── bundle-tools.ts # list_bundles, get_bundle_schema, get_bundle_snapshot
│   ├── entity-tools.ts # read_entity, read_entities, list_entities, list_entity_summaries
│   ├── schema-tools.ts # get_entity_schema, get_entity_relations
│   ├── context-tools.ts # get_context, get_conformance_context
│   ├── search-tools.ts # search_entities
│   ├── validation-tools.ts # validate_bundle
│   ├── mutation-tools.ts # apply_changes
│   └── sampling-tools.ts # critique_bundle
└── ...
```

### Step 1.1: Create tools/types.ts

```typescript
// packages/mcp-server/src/tools/types.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Bundle } from "@sdd-bundle-editor/core-model";

export interface LoadedBundle {
    id: string;
    bundle: Bundle;
    path: string;
    tags?: string[];
    description?: string;
    diagnostics: Array<{
        severity: 'error' | 'warning' | 'info';
        code?: string;
        message: string;
        entityType?: string;
        entityId?: string;
    }>;
}

/**
 * Context passed to tool registration functions.
 * Provides access to server, bundles, and helper methods.
 */
export interface ToolContext {
    server: McpServer;
    bundles: Map<string, LoadedBundle>;
    getBundle: (bundleId?: string) => LoadedBundle | undefined;
    getBundleIds: () => string[];
    isSingleBundleMode: () => boolean;
}
```

### Step 1.2: Create tools/registry.ts (Factory Helpers)

```typescript
// packages/mcp-server/src/tools/registry.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { READ_ONLY_TOOL, MUTATING_TOOL, EXTERNAL_SAMPLING_TOOL } from "../tool-annotations.js";

type ZodRawShape = Record<string, z.ZodTypeAny>;

/**
 * Helper to register a read-only tool with standard annotations.
 */
export function registerReadOnlyTool<T extends ZodRawShape>(
    server: McpServer,
    name: string,
    description: string,
    inputSchema: T,
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<unknown>
) {
    server.registerTool(name, {
        description,
        inputSchema,
        annotations: READ_ONLY_TOOL,
    }, handler);
}

/**
 * Helper to register a mutating tool with standard annotations.
 */
export function registerMutatingTool<T extends ZodRawShape>(
    server: McpServer,
    name: string,
    description: string,
    inputSchema: T,
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<unknown>
) {
    server.registerTool(name, {
        description,
        inputSchema,
        annotations: MUTATING_TOOL,
    }, handler);
}

/**
 * Helper to register an external sampling tool with standard annotations.
 */
export function registerExternalTool<T extends ZodRawShape>(
    server: McpServer,
    name: string,
    description: string,
    inputSchema: T,
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<unknown>
) {
    server.registerTool(name, {
        description,
        inputSchema,
        annotations: EXTERNAL_SAMPLING_TOOL,
    }, handler);
}
```

### Step 1.3: Create tools/bundle-tools.ts

Extract these tools from server.ts:
- `list_bundles`
- `get_bundle_schema`
- `get_bundle_snapshot`

```typescript
// packages/mcp-server/src/tools/bundle-tools.ts
import { z } from "zod";
import { ToolContext } from "./types.js";
import { registerReadOnlyTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

export function registerBundleTools(ctx: ToolContext) {
    const { server, bundles, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: list_bundles
    registerReadOnlyTool(
        server,
        "list_bundles",
        "List all loaded specification bundles...",
        {},  // No-args
        async () => {
            const TOOL_NAME = "list_bundles";
            const bundleList = Array.from(bundles.values()).map(b => ({
                id: b.id,
                name: b.bundle.manifest.metadata.name,
                bundleType: b.bundle.manifest.metadata.bundleType,
                tags: b.tags || [],
                description: b.description,
                path: b.path,
                entityTypes: Array.from(b.bundle.entities.keys()),
                entityCount: Array.from(b.bundle.entities.values()).reduce((sum, m) => sum + m.size, 0),
            }));
            return toolSuccess(TOOL_NAME, { bundles: bundleList }, {
                meta: { count: bundleList.length },
                diagnostics: [],
            });
        }
    );

    // Tool: get_bundle_schema
    registerReadOnlyTool(
        server,
        "get_bundle_schema",
        "Get the bundle type definition (metaschema)...",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
        },
        async ({ bundleId }) => {
            const TOOL_NAME = "get_bundle_schema";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }
            // ... rest of implementation
        }
    );

    // Tool: get_bundle_snapshot - similar pattern
    // ...
}
```

### Step 1.4: Create remaining tool files

Follow the same pattern for:
- `entity-tools.ts` → read_entity, read_entities, list_entities, list_entity_summaries
- `schema-tools.ts` → get_entity_schema, get_entity_relations
- `context-tools.ts` → get_context, get_conformance_context
- `search-tools.ts` → search_entities
- `validation-tools.ts` → validate_bundle
- `mutation-tools.ts` → apply_changes
- `sampling-tools.ts` → critique_bundle

### Step 1.5: Create tools/index.ts

```typescript
// packages/mcp-server/src/tools/index.ts
import { ToolContext } from "./types.js";
import { registerBundleTools } from "./bundle-tools.js";
import { registerEntityTools } from "./entity-tools.js";
import { registerSchemaTools } from "./schema-tools.js";
import { registerContextTools } from "./context-tools.js";
import { registerSearchTools } from "./search-tools.js";
import { registerValidationTools } from "./validation-tools.js";
import { registerMutationTools } from "./mutation-tools.js";
import { registerSamplingTools } from "./sampling-tools.js";

export type { ToolContext } from "./types.js";
export { registerReadOnlyTool, registerMutatingTool, registerExternalTool } from "./registry.js";

/**
 * Register all MCP tools.
 */
export function setupAllTools(ctx: ToolContext) {
    registerBundleTools(ctx);
    registerEntityTools(ctx);
    registerSchemaTools(ctx);
    registerContextTools(ctx);
    registerSearchTools(ctx);
    registerValidationTools(ctx);
    registerMutationTools(ctx);
    registerSamplingTools(ctx);
}
```

### Step 1.6: Update server.ts

Replace the 1500+ lines of `setupTools()` with:

```typescript
import { setupAllTools, ToolContext } from "./tools/index.js";

// In the class:
private setupTools() {
    const ctx: ToolContext = {
        server: this.server,
        bundles: this.bundles,
        getBundle: (id) => this.getBundle(id),
        getBundleIds: () => this.getBundleIds(),
        isSingleBundleMode: () => this.isSingleBundleMode(),
    };
    setupAllTools(ctx);
}
```

### Step 1.7: Verify

```bash
pnpm --filter @sdd-bundle-editor/mcp-server build
pnpm --filter @sdd-bundle-editor/mcp-server test
pnpm test:smoke
```

---

## Phase 2: Tool Registration Factory (Done in Phase 1)

The factory helpers were already created in `tools/registry.ts`:
- `registerReadOnlyTool()` - Applies READ_ONLY_TOOL annotations
- `registerMutatingTool()` - Applies MUTATING_TOOL annotations
- `registerExternalTool()` - Applies EXTERNAL_SAMPLING_TOOL annotations

---

## Phase 3: Save Reusable Snippets

### Step 3.1: Create MCP Patterns Snippet File

```bash
mkdir -p .agent/snippets
```

Create `.agent/snippets/mcp-patterns.md`:

```markdown
# MCP Server Patterns

Reusable patterns for MCP server development.

## structuredContent Response Pattern

Tool responses should include both human-readable and machine-parsable formats:

```typescript
export function toolSuccess(
    tool: string,
    data: unknown,
    options?: { bundleId?: string; meta?: Record<string, unknown>; diagnostics?: Diagnostic[] }
): ToolResponse {
    const response = {
        ok: true,
        tool,
        data,
        bundleId: options?.bundleId,
        meta: options?.meta ?? {},
        diagnostics: options?.diagnostics ?? [],
    };

    return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        structuredContent: response,  // Machine-parsable!
    };
}
```

## registerTool with Annotations

Always use `registerTool()` (not deprecated `tool()`) with config object:

```typescript
this.server.registerTool(
    "my_tool",
    {
        description: "Tool description for agents",
        inputSchema: {
            param1: z.string().describe("Parameter description"),
            param2: z.number().optional().describe("Optional param"),
        },
        annotations: READ_ONLY_TOOL,  // or MUTATING_TOOL, EXTERNAL_SAMPLING_TOOL
    },
    async ({ param1, param2 }) => {
        // Implementation
    }
);
```

## No-Args Tool Schema

For tools with no parameters, use empty object `{}`:

```typescript
this.server.registerTool(
    "list_bundles",
    {
        description: "List all bundles",
        inputSchema: {},  // NOT z.object({}).strict()
        annotations: READ_ONLY_TOOL,
    },
    async () => {
        // Implementation
    }
);
```

## Response Interface with Index Signature

MCP SDK requires index signature for compatibility:

```typescript
export interface ToolResponse {
    content: Array<{ type: "text"; text: string }>;
    structuredContent: Record<string, unknown>;
    isError?: boolean;
    [x: string]: unknown;  // Required for MCP SDK compatibility
}
```

## Tool Annotations Reference

```typescript
export const READ_ONLY_TOOL = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
};

export const MUTATING_TOOL = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
};

export const EXTERNAL_SAMPLING_TOOL = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,  // LLM responses vary
    openWorldHint: true,    // Invokes external LLM
};
```
```

---

## Phase 4: Update Documentation

### Step 4.1: Update MCP Server README

Add section about modular tool structure:

```markdown
## Architecture

### Tool Organization

Tools are organized into modular files by category:

| File | Tools | Description |
|------|-------|-------------|
| `bundle-tools.ts` | list_bundles, get_bundle_schema, get_bundle_snapshot | Bundle-level operations |
| `entity-tools.ts` | read_entity, read_entities, list_entities, list_entity_summaries | Entity CRUD |
| `schema-tools.ts` | get_entity_schema, get_entity_relations | Schema introspection |
| `context-tools.ts` | get_context, get_conformance_context | Context gathering |
| `search-tools.ts` | search_entities | Search operations |
| `validation-tools.ts` | validate_bundle | Validation |
| `mutation-tools.ts` | apply_changes | Mutations |
| `sampling-tools.ts` | critique_bundle | LLM sampling |
```

---

## Verification Checklist

After completing all phases:

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (all unit tests)
- [ ] `pnpm test:e2e` passes (E2E tests)
- [ ] `pnpm dev:mcp-only` starts successfully
- [ ] All 15 tools still work (test via MCP Inspector or curl)
- [ ] server.ts is now < 500 lines
- [ ] tools/ directory contains 9 files

---

## Commit Strategy

Make atomic commits after each phase:

1. `refactor(mcp-server): extract tool types and registry helpers`
2. `refactor(mcp-server): extract bundle tools to modular file`
3. `refactor(mcp-server): extract entity tools to modular file`
4. `refactor(mcp-server): extract remaining tools to modular files`
5. `docs: add MCP patterns snippet and update README`

---

## Rollback Plan

If something breaks:
- The current working code is in commit `cdac971` (before refactor)
- Use `git checkout cdac971 -- packages/mcp-server/src/server.ts` to restore
