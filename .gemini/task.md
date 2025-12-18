# Task: Split setupPrompts() into Prompt Modules

## Context

The `SddMcpServer.setupPrompts()` method in `packages/mcp-server/src/server.ts` has grown to ~1200 lines (lines 1909-3101), making it difficult to navigate and maintain. It currently contains 11 prompt definitions all in a single method.

## Current Structure

```
setupPrompts() {
    // Lines 1914-2025:  implement-requirement
    // Lines 2026-2136:  explain-entity  
    // Lines 2137-2250:  audit-profile
    // Lines 2251-2401:  trace-dependency
    // Lines 2402-2510:  coverage-analysis
    // Lines 2511-2602:  suggest-relations
    // Lines 2603-2703:  generate-tests
    // Lines 2704-2789:  summarize-bundle
    // Lines 2790-2881:  diff-bundles
    // Lines 2882-2994:  create-roadmap
    // Lines 2995-3101:  bundle-health
}
```

## Proposed Architecture

### Option A: Category-Based Modules (Recommended)

Group prompts by purpose:

```
packages/mcp-server/src/
├── prompts/
│   ├── index.ts              # Re-exports all, setupPrompts orchestrator
│   ├── implementation.ts     # implement-requirement, create-roadmap
│   ├── analysis.ts           # coverage-analysis, trace-dependency, suggest-relations
│   ├── documentation.ts      # explain-entity, summarize-bundle, diff-bundles
│   ├── quality.ts            # audit-profile, bundle-health, generate-tests
│   └── types.ts              # Shared prompt types
```

### Option B: One File Per Prompt

Maximizes isolation but creates many small files:

```
packages/mcp-server/src/
├── prompts/
│   ├── index.ts
│   ├── implement-requirement.ts
│   ├── explain-entity.ts
│   ├── audit-profile.ts
│   └── ... (8 more files)
```

## Implementation Steps

### Step 1: Create prompts/types.ts

Define shared types:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoadedBundle } from "../types.js";

export interface PromptContext {
    server: McpServer;
    getBundle: (bundleId?: string) => LoadedBundle | undefined;
    getBundleIds: () => string[];
}

export type PromptRegistrar = (ctx: PromptContext) => void;
```

### Step 2: Create prompts/index.ts

Orchestrator that coordinates all prompts:

```typescript
import { PromptContext } from "./types.js";
import { registerImplementationPrompts } from "./implementation.js";
import { registerAnalysisPrompts } from "./analysis.js";
// ... other imports

export function setupAllPrompts(ctx: PromptContext): void {
    registerImplementationPrompts(ctx);
    registerAnalysisPrompts(ctx);
    // ...
}
```

### Step 3: Create Category Files

Example `prompts/implementation.ts`:

```typescript
import { z } from "zod";
import { PromptContext } from "./types.js";
import { summarizeEntity, formatEntitiesForPrompt } from "../entity-utils.js";

export function registerImplementationPrompts(ctx: PromptContext): void {
    // implement-requirement prompt
    ctx.server.prompt(
        "implement-requirement",
        // ... full prompt implementation
    );

    // create-roadmap prompt
    ctx.server.prompt(
        "create-roadmap",
        // ...
    );
}
```

### Step 4: Update server.ts

Replace the massive setupPrompts method:

```typescript
import { setupAllPrompts } from "./prompts/index.js";

private setupPrompts() {
    setupAllPrompts({
        server: this.server,
        getBundle: (id) => this.getBundle(id),
        getBundleIds: () => this.getBundleIds(),
    });
}
```

### Step 5: Verify & Test

1. Build: `pnpm --filter @sdd-bundle-editor/mcp-server build`
2. Test: `pnpm test:smoke`
3. Manual test prompts in MCP Inspector

## Category Groupings (Recommended)

| Module | Prompts | Rationale |
|--------|---------|-----------|
| `implementation.ts` | implement-requirement, create-roadmap | Planning & execution |
| `analysis.ts` | trace-dependency, coverage-analysis, suggest-relations | Understanding relationships |
| `documentation.ts` | explain-entity, summarize-bundle, diff-bundles | Generating docs/explanations |
| `quality.ts` | audit-profile, bundle-health, generate-tests | Quality assurance |

## Success Criteria

- [ ] server.ts setupPrompts() reduced to <20 lines
- [ ] All 11 prompts still work identically
- [ ] `pnpm test:smoke` passes
- [ ] No TypeScript errors
- [ ] Each prompt module is self-contained with its dependencies

## Estimated Effort

- 45-60 minutes
- Low risk (pure refactoring, no behavior change)

## Dependencies

- `entity-utils.ts` already extracted (completed)
- No external package changes needed
