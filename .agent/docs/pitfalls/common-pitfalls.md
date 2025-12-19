# Common Pitfalls

> Avoid these mistakes to save time!

## Build & TypeScript

### 1. Forgetting to rebuild after TypeScript changes
- **Symptom**: Code changes don't take effect
- **Fix**: Run `pnpm build` or specific package build

### 2. Missing `--passWithNoTests` in packages without tests
- **Symptom**: `pnpm test` fails with "No test files found"
- **Fix**: Already fixed in all package.json files

---

## Testing

### 3. Using `browser_subagent` tool
- **Symptom**: `ECONNREFUSED 127.0.0.1:9222`
- **Fix**: Use Playwright E2E tests instead (CDP not available)

### 4. Hardcoding entity IDs in tests
- **Symptom**: Tests break when sample bundle changes
- **Fix**: Use `TEST_ENTITIES` constants or `getFirstEntityId()` helper

### 5. Running `vitest` without `run` flag
- **Symptom**: Tests hang waiting for input
- **Fix**: All package.json scripts now use `vitest run`

### 6. Editing sample bundle directly
- **Symptom**: Tests pollute the external bundle
- **Fix**: Use `createTempBundle()` for write operations

---

## MCP Server

### 7. MCP response envelope structure confusion
- **Symptom**: `result.data.find is not a function` or similar errors
- **Root cause**: MCP tools return `{ok, tool, data: {actual_payload}}`
- **Fix**: Access `result.data.data.bundles`, not `result.data.bundles`

### 8. Webpack proxy not forwarding MCP requests
- **Symptom**: MCP requests fail in browser but work via curl to 3001
- **Root cause**: `getMcpServerUrl()` returns absolute URL instead of relative
- **Fix**: Return empty string for browser context, use relative `/mcp` path

### 9. MCP sampling without capability check
- **Symptom**: Tool hangs indefinitely with thin HTTP clients
- **Root cause**: `createMessage()` called without checking if client supports sampling
- **Fix**: Check capabilities first:
  ```typescript
  const caps = this.server.server.getClientCapabilities();
  if (!caps?.sampling) {
      return toolError(TOOL_NAME, "UNSUPPORTED_CAPABILITY", "...");
  }
  ```

### 10. Adding mimeType to MCP tool text content
- **Symptom**: TypeScript error: "mimeType does not exist in type"
- **Root cause**: MCP SDK `TextContent` type only has `{type, text, annotations?}`
- **Fix**: `mimeType` only works on resources and embedded resources, not tool text content

### 11. Inconsistent resource error format
- **Symptom**: Agents struggle to parse resource errors
- **Root cause**: Resources using `{error, message}` instead of tool format
- **Fix**: Use `{ok: false, error: {code, message, details}}` for all responses (use `resourceError()` helper)

### 12. MCP SDK requires index signature on response types
- **Symptom**: TypeScript error "Index signature for type 'string' is missing"
- **Root cause**: MCP SDK expects `{[x: string]: unknown}` on tool return types for compatibility
- **Fix**: Add `[x: string]: unknown;` to response interfaces:
  ```typescript
  export interface ToolResponse {
      content: Array<{ type: "text"; text: string }>;
      structuredContent: Record<string, unknown>;
      isError?: boolean;
      [x: string]: unknown;  // MCP SDK compatibility
  }
  ```

### 13. Using `z.object({}).strict()` for empty schema in registerTool
- **Status**: ✅ Fixed in SDK v1.25.1
- **Old symptom**: TypeScript error "not assignable to parameter of type 'ZodRawShapeCompat'"
- **Old root cause**: SDK expected raw shape objects, not wrapped Zod objects
- **Current behavior**: SDK v1.25.1+ properly supports `z.object({}).strict()`:
  ```typescript
  const STRICT_EMPTY_SCHEMA = z.object({}).strict();
  
  server.registerTool("my_tool", {
      description: "...",
      inputSchema: STRICT_EMPTY_SCHEMA,  // Now works!
      annotations: READ_ONLY_TOOL,
  }, callback);
  ```
- **Note**: Raw JSON Schema objects (e.g., `{type: "object", additionalProperties: false}`) still don't work - the SDK only recognizes Zod schemas.

---

## Dependencies

### 14. Upgrading @types/node to v25+ breaks build
- **Symptom**: TypeScript error: "'ReactMarkdown' cannot be used as a JSX component"
- **Root cause**: `@types/node` v25 has JSX type changes incompatible with `@types/react` v18
- **Fix**: Upgrade React types first, then Node types:
  ```bash
  # Correct order:
  pnpm add -wD @types/react@19 @types/react-dom@19  # First
  pnpm add -wD @types/node@25                        # Then
  ```
- **Anti-pattern**: Using `pnpm update @types/node --latest` can corrupt lockfile with transitive dependencies. Use explicit version installs instead.

---

## Bundle Type Definition

### 15. New bundle type properties not appearing in UI
- **Symptom**: Added new property to bundle-type.json (e.g., `color`), updated ui-shell types, but property is undefined in UI
- **Root cause**: The data flow is: `JSON file → core-model → MCP server → UI`. The MCP server passes the `bundleTypeDefinition` object using TypeScript types from `core-model`, not raw JSON. If the property isn't in core-model's type, it won't be passed through.
- **Fix**: When adding a new property to bundle type definition:
  1. **First**: Add to `packages/core-model/src/types.ts` (`BundleTypeEntityConfig` or `BundleTypeRelationConfig`)
  2. **Then**: Add to `packages/ui-shell/src/types.ts` (`UiEntityTypeConfig` or `UiRelationConfig`)
  3. **Then**: Add to the actual bundle JSON schema file
  4. **Rebuild and restart MCP server** (the server loads bundle at startup)
  ```typescript
  // core-model/src/types.ts - THE SOURCE OF TRUTH
  export interface BundleTypeEntityConfig {
    entityType: EntityType;
    // ... existing fields ...
    color?: string;  // Add here FIRST
  }
  ```
- **Related pitfall**: Also applies to relation properties (e.g., we had `cardinality` in ui-shell but schema used `multiplicity`)

