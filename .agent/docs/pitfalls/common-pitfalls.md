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

### 3. Using `browser_subagent` tool in WSL
- **Symptom**: `ECONNREFUSED 127.0.0.1:9222`
- **Root cause**: Chrome runs in Windows, not accessible from WSL's network namespace
- **Fix for WSL**:
  1. Start Chrome on Windows with remote debugging:
     ```cmd
     "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug-profile"
     ```
  2. Keep Chrome window open while using browser_subagent
- **Alternative**: Use Playwright E2E tests (`pnpm test:e2e`)

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

## UI / React JSON Schema Form (RJSF)

### 7. Assuming ArrayFieldItemTemplate wraps items when ArrayFieldTemplate is provided
- **Symptom**: Custom CSS class on ArrayFieldItemTemplate not appearing in DOM
- **Root cause**: RJSF does NOT use ArrayFieldItemTemplate when you provide ArrayFieldTemplate
- **Fix**: Wrap items manually in ArrayFieldTemplate:
  ```tsx
  const CustomArrayFieldTemplate = (props) => {
    const { items, schema } = props;
    const hasComplexItems = schema?.items?.type === 'object';
    
    return (
      <div className="my-array">
        {items.map((item, index) => (
          <div key={item.key || index} className={hasComplexItems ? 'card-item' : 'simple-item'}>
            {item.children}
          </div>
        ))}
      </div>
    );
  };
  ```

### 8. Debugging CSS without checking DOM structure
- **Symptom**: CSS styling not applied, wasting time adjusting CSS
- **Root cause**: The expected class may not exist in the DOM at all
- **Fix**: Always verify DOM structure first using browser JS:
  ```javascript
  // Check if class exists
  document.querySelectorAll('.my-class').length
  
  // Find all RJSF-related classes
  Array.from(document.querySelectorAll('*'))
    .filter(el => Array.from(el.classList).some(cls => cls.includes('rjsf')))
    .map(el => el.className)
  ```

### 25. RJSF renders fields not in filtered schema properties
- **Symptom**: Fields appear in form even though they're excluded from the filtered schema (e.g., header-only fields showing in all tabs)
- **Root causes** (TWO issues):
  1. RJSF v5 renders `formData` fields regardless of schema - filter formData too
  2. JSON Schema `if/then/else` blocks define additional properties that RJSF merges into the form

#### Part 1: Filter formData to match schema
```tsx
const filterFormDataToSchema = (
  data: Record<string, any>,
  schemaToMatch: Record<string, unknown> | null | undefined
): Record<string, any> => {
  if (!data || !schemaToMatch || !schemaToMatch.properties) return data;
  const schemaProps = schemaToMatch.properties as Record<string, any>;
  const filtered: Record<string, any> = {};
  for (const key of Object.keys(schemaProps)) {
    if (key in data) {
      filtered[key] = data[key];
    }
  }
  return filtered;
};
```

#### Part 2: Strip conditional schema keywords
**Critical**: The spread operator `{...schema, properties: filtered}` copies `if/then/else` blocks. RJSF evaluates these and merges their properties back in!

```tsx
// WRONG - copies conditional blocks that bypass filtering
return { ...schema, properties: filteredProps };

// CORRECT - strip conditional keywords first
const { if: _if, then: _then, else: _else, allOf, anyOf, oneOf, ...schemaBase } = schema as any;
return { ...schemaBase, properties: filteredProps };
```

#### Debugging tip
Check if schema uses conditionals before debugging RJSF issues:
```bash
cat schema.json | jq '{hasThen: (.then != null), thenProps: (.then.properties // {} | keys)}'
```

- **Note**: Both fixes implemented in EntityDetails.tsx for layout-grouped and non-grouped forms

---

## MCP Server

### 9. MCP response envelope structure confusion
- **Symptom**: `result.data.find is not a function` or similar errors
- **Root cause**: MCP tools return `{ok, tool, data: {actual_payload}}`
- **Fix**: Access `result.data.data.bundles`, not `result.data.bundles`

### 10. Webpack proxy not forwarding MCP requests
- **Symptom**: MCP requests fail in browser but work via curl to 3001
- **Root cause**: `getMcpServerUrl()` returns absolute URL instead of relative
- **Fix**: Return empty string for browser context, use relative `/mcp` path

### 11. MCP sampling without capability check
- **Symptom**: Tool hangs indefinitely with thin HTTP clients
- **Root cause**: `createMessage()` called without checking if client supports sampling
- **Fix**: Check capabilities first:
  ```typescript
  const caps = this.server.server.getClientCapabilities();
  if (!caps?.sampling) {
      return toolError(TOOL_NAME, "UNSUPPORTED_CAPABILITY", "...");
  }
  ```

### 12. Adding mimeType to MCP tool text content
- **Symptom**: TypeScript error: "mimeType does not exist in type"
- **Root cause**: MCP SDK `TextContent` type only has `{type, text, annotations?}`
- **Fix**: `mimeType` only works on resources and embedded resources, not tool text content

### 13. Inconsistent resource error format
- **Symptom**: Agents struggle to parse resource errors
- **Root cause**: Resources using `{error, message}` instead of tool format
- **Fix**: Use `{ok: false, error: {code, message, details}}` for all responses (use `resourceError()` helper)

### 14. MCP SDK requires index signature on response types
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

### 15. Using `z.object({}).strict()` for empty schema in registerTool
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

### 16. Upgrading @types/node to v25+ breaks build
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

### 17. New bundle type properties not appearing in UI
- **Symptom**: Added new property to bundle-type.json (e.g., `color`), but property is undefined in UI
- **Root cause**: The data flow is: `JSON file → core-model → MCP server → UI`. TypeScript types gate what properties flow through. If the property isn't in the type definition, it won't be passed.
- **Fix**: When adding a new property to bundle type definition:
  1. **Update shared-types**: Add property to `packages/shared-types/src/bundle-types.ts` (the SINGLE SOURCE OF TRUTH)
  2. **Rebuild**: Run `pnpm build` (shared-types → core-model → ui-shell)
  3. **Restart MCP server**: The server loads bundle at startup
  4. **Update bundle JSON**: Add property to actual `bundle-type.*.json` file
  ```typescript
  // packages/shared-types/src/bundle-types.ts - THE SINGLE SOURCE OF TRUTH
  export interface BundleTypeEntityConfig {
    entityType: string;
    // ... existing fields ...
    color?: string;  // Add here - automatically available in core-model AND ui-shell
  }
  ```
- **Note**: Both `core-model` and `ui-shell` import these types from `shared-types`, so you only need to update one place
- **Related pitfall**: Property naming must match exactly (e.g., `multiplicity` not `cardinality`)

### 18. Hardcoding UI behavior based on field names
- **Symptom**: UI logic checks for specific field names (e.g., `if (fieldName === 'pros')`) or CSS selectors target field names (`[for*="reasonRejected"]`)
- **Root cause**: Violates "Editor is Dumb, AI is Smart" principle - the editor should be schema-driven, not aware of specific domain concepts
- **Anti-pattern**:
  ```tsx
  // BAD: Hardcoded field name detection
  const isProsField = fieldId.endsWith('_pros');
  const indicator = isProsField ? '✅' : '❌';
  ```
- **Fix**: Define behavior in schema using `x-sdd-*` extension properties:
  ```json
  // GOOD: Schema-driven
  "pros": {
    "items": { "x-sdd-indicator": "✅" }
  }
  ```
  Then read from schema:
  ```tsx
  const indicator = schema?.items?.['x-sdd-indicator'] || null;
  ```
- **Design process**: When adding new UI features, FIRST design the schema hint, THEN implement the reader

### 19. Trying to use file editing tools on external bundles
- **Symptom**: `view_file` or `replace_file_content` fails or is blocked on sample bundle files
- **Root cause**: External bundles (e.g., `/home/ivan/dev/sdd-sample-bundle`) are OUTSIDE the IDE workspace - file editing tools only work within the workspace
- **Fix**: Use CLI commands (`jq`, `python`, `cat`) to read/edit external bundle files:
  ```bash
  # Read schema
  cat /home/ivan/dev/sdd-sample-bundle/schemas/ADR.schema.json
  
  # Edit schema with jq
  jq '.properties.field["x-sdd-layout"] = "bulletList"' schema.json > tmp.json && mv tmp.json schema.json
  
  # Edit YAML entity with Python (yq may timeout due to snap issues)
  python3 -c "
  import yaml
  with open('entity.yaml', 'r') as f: data = yaml.safe_load(f)
  data['status'] = 'accepted'
  with open('entity.yaml', 'w') as f: yaml.dump(data, f, allow_unicode=True, sort_keys=False)
  "
  ```
- **Important**: This applies to ALL bundles the editor works with - bundles are external data, never part of the editor's source workspace
- **Related**: See debug-recipes.md for jq and Python YAML patterns


## Pitfall 21: Not Validating UI Changes with Browser Agent

**Symptom**: CSS or component changes that look correct in code but have visual issues (misalignment, wrong colors, broken layouts).

**Root Cause**: Relying only on code review without visual verification.

**Solution**: **ALWAYS** use browser agent to validate UI changes:

1. **Before**: Take screenshot of current state
2. **Make changes**: Edit CSS/components/schema
3. **After**: Take screenshot and verify fix visually
4. **Compare**: Ensure no regressions

See `/ui-validation` workflow for detailed process.

**Key insight**: The browser agent is superior to Playwright screenshots for this use case because it provides interactive validation and can navigate to specific components dynamically.

---

## Development Workflow

### 22. MCP server not picking up bundle JSON changes
- **Symptom**: Changed `bundle-type.*.json` (e.g., added categories) but UI still shows old data
- **Root cause**: MCP server loads bundles at startup and caches them. Unlike source code (hot-reloaded by webpack), bundle data is loaded once.
- **Fix**: Restart the dev server after changing bundle JSON:
  ```bash
  # Kill and restart dev server
  fuser -k 3001/tcp 5173/tcp 2>/dev/null
  sleep 2
  ./scripts/local/dev.sh
  ```
- **Why this happens**: The MCP server is designed for production where bundles don't change at runtime. In development, schema/bundle changes are less frequent than code changes.
- **Pro tip**: Use `./scripts/local/restart-dev.sh` for quick restarts

### 23. Wrong pnpm build filter syntax
- **Symptom**: `pnpm build --filter @sdd-bundle-editor/ui-shell` passes `--filter` to tsc, causing errors
- **Root cause**: Filter flag must come before the script name
- **Fix**: Use one of these patterns:
  ```bash
  # Option 1: cd into package (recommended)
  cd packages/ui-shell && pnpm build
  
  # Option 2: Correct filter syntax (filter BEFORE command)
  pnpm --filter @sdd-bundle-editor/ui-shell build
  
  # Option 3: Build all packages
  pnpm build
  ```

### 24. Calling browser_subagent before verifying server is running
- **Symptom**: Browser subagent times out, shows "connection timeout", opens about:blank, wastes time retrying
- **Root cause**: The browser subagent has no context about whether the dev server is running. It cannot effectively debug connection issues.
- **Fix**: Always verify server health BEFORE calling browser_subagent:
  ```bash
  # Quick health check (run in main session, not subagent)
  curl -s --max-time 5 http://localhost:5173/ > /dev/null && echo "✓ Ready" || echo "✗ Not ready"
  ```
- **If not ready**: Start/restart server and wait for it:
  ```bash
  ./scripts/local/restart-dev.sh
  # Poll until ready
  for i in {1..30}; do curl -s --max-time 2 http://localhost:5173/ > /dev/null && break; sleep 1; done
  ```
- **Key insight**: The main session can run shell commands to check server status. The browser subagent cannot. Do the check in the main session before delegating to subagent.
