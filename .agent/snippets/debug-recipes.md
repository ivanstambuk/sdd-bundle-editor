# Debug Recipes

Non-trivial debugging approaches and diagnostic patterns.

---

## Finding Recent Session Context

When resuming from a previous session, find context artifacts:

```bash
# Find most recent conversation directories
ls -t /home/ivan/.gemini/antigravity/brain/ | head -5

# View task.md from most recent
cat "$(ls -td /home/ivan/.gemini/antigravity/brain/*/ | head -1)/task.md"
```

---

## Checking for Duplicate Config Lines

After editing config files, verify no duplicates:

```bash
# Check for duplicate keys in playwright.config.ts
grep -n "reuseExistingServer\|stdout\|stderr\|timeout" playwright.config.ts

# Count occurrences - should match expected
grep -c "reuseExistingServer" playwright.config.ts  # Expected: 3 (one per web server)
```

---

## Verifying vitest Mode

Check if packages use watch vs run mode:

```bash
# Find packages still using watch mode
grep -r '"test": "vitest"' packages/*/package.json

# Should return empty if all fixed
# Correct pattern is: "test": "vitest run"
```

---

## MCP Server Debugging

```bash
# Check if MCP server is running
curl http://localhost:3001/health

# List active sessions
curl http://localhost:3001/sessions

# Manual tool call for debugging
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_bundles","arguments":{}}}'
```

---

## Test Webpack Proxy to MCP

**Problem**: Browser requests to `/mcp` not reaching MCP server at 3001.

```bash
# Test if webpack proxy is forwarding /mcp to MCP server
curl -s "http://localhost:5173/mcp" -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  | head -c 500

# If working, you'll see: [HTTP] New session initialization request
# If not working, you'll get connection refused or HTML error page
```

---

## Kill Stale E2E Servers

**Problem**: `reuseExistingServer: true` reuses old server with wrong config.

```bash
# Kill all test servers before debugging
pkill -f "mcp-server" 2>/dev/null
pkill -f webpack 2>/dev/null
pkill -f "ts-node" 2>/dev/null
sleep 2 && echo "Servers killed"
```

---

## Dev Server Port Cleanup

**Problem**: Port conflicts when restarting dev server (ports 3001 or 5173 in use).

```bash
# Quick port cleanup - kills processes on dev ports
fuser -k 3001/tcp 5173/tcp 2>/dev/null
sleep 2
echo "Ports cleared"

# Verify ports are free
lsof -i:3001 -i:5173 || echo "Ports are now free"

# Then restart dev server
./scripts/local/dev.sh
```

**Alternative - full process cleanup:**
```bash
# Kill by process name (more aggressive)
pkill -9 -f "concurrently"
pkill -9 -f "webpack-dev-server"
pkill -9 -f "mcp-server.*http"
sleep 2
./scripts/local/dev.sh
```

---

## Finding Entity Files in Sample Bundle

```bash
# List all entity types
ls /home/ivan/dev/sdd-sample-bundle/bundle/

# List entities of a specific type
ls /home/ivan/dev/sdd-sample-bundle/bundle/requirements/

# Find entity by ID pattern
find /home/ivan/dev/sdd-sample-bundle/bundle -name "*audit*"
```

---

## E2E Test Debugging

```bash
# Run single test with verbose output
pnpm exec playwright test e2e/mcp-server.spec.ts --grep "list_bundles" --reporter=list

# Run with trace on
pnpm exec playwright test --trace on

# View trace from failed test
pnpm exec playwright show-trace test-results/<test-folder>/trace.zip

# Run with headed browser (see what's happening)
pnpm exec playwright test --headed
```

---

## Finding Uncommitted Changes

```bash
# Quick status
git status --short

# See what would be committed
git diff --cached --stat

# See uncommitted changes in specific file
git diff AGENTS.md | head -50
```

---

## DOM Class Verification (Browser DevTools)

**Problem**: CSS styling not applied - need to verify class exists in DOM before debugging CSS.

```javascript
// Check if a specific class exists and how many elements have it
document.querySelectorAll('.rjsf-array-item').length

// Get parent element's class for debugging CSS specificity
document.querySelectorAll('.my-class')[0]?.parentElement?.className

// Find all elements with classes containing a pattern (e.g., 'rjsf')
Array.from(document.querySelectorAll('*'))
  .filter(el => Array.from(el.classList).some(cls => cls.includes('rjsf')))
  .map(el => ({ tag: el.tagName, class: el.className }))

// Find element and get its computed CSS
const el = document.querySelector('.rjsf-array-item');
getComputedStyle(el).border  // Check what CSS is actually applied
```

---

## WSL Browser Debugging Setup

**Problem**: Browser subagent fails with `ECONNREFUSED 127.0.0.1:9222` in WSL.

**Root cause**: Chrome runs on Windows, not accessible from WSL's network namespace.

**Solution**: Start Chrome on Windows with remote debugging:

```cmd
REM Run in Windows CMD or PowerShell (not WSL)
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug-profile"
```

Keep this Chrome window open while using browser_subagent.

**Finding Chrome path from WSL**:
```bash
ls -la "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" 2>/dev/null && echo "Chrome found"
ls -la "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" 2>/dev/null && echo "Edge found"
```

---

## JSON Schema Manipulation with jq

**Problem**: Need to modify schemas outside workspace (e.g., sample bundle) or do complex JSON edits.

### Add property to nested schema path

```bash
# Add x-sdd-indicator to array items
jq '.properties.pros.items += {"x-sdd-indicator": "✅"}' schema.json > tmp.json && mv tmp.json schema.json

# Add to deeply nested path (alternatives pattern)
jq '.properties.alternativesConsidered.items.properties.pros.items += {"x-sdd-indicator": "✅"} | 
    .properties.alternativesConsidered.items.properties.cons.items += {"x-sdd-indicator": "❌"}' \
    schema.json > tmp.json && mv tmp.json schema.json
```

### Add maxLength to a field

```bash
jq '.properties.id += {"maxLength": 60}' schema.json > tmp.json && mv tmp.json schema.json
```

### View specific schema path

```bash
# View just the alternativesConsidered schema
jq '.properties.alternativesConsidered' schema.json

# View with compact output
jq -c '.properties.id' schema.json
```

### Validate JSON syntax

```bash
jq empty schema.json && echo "Valid JSON" || echo "Invalid JSON"
```

### Add bulletList layout to string arrays

```bash
# Add bulletList layout to a simple string array
jq '.properties.assumptions["x-sdd-layout"] = "bulletList"' schema.json > tmp.json && mv tmp.json schema.json

# Add bulletList with indicator to multiple consequence arrays
jq '
  .properties.positiveConsequences["x-sdd-layout"] = "bulletList" |
  .properties.positiveConsequences.items["x-sdd-indicator"] = "✅" |
  .properties.negativeConsequences["x-sdd-layout"] = "bulletList" |
  .properties.negativeConsequences.items["x-sdd-indicator"] = "❌"
' schema.json > tmp.json && mv tmp.json schema.json

# Add hidden displayHint to a field
jq '.properties.isChosen["x-sdd-displayHint"] = "hidden"' schema.json > tmp.json && mv tmp.json schema.json
```

---

## YAML File Editing (Python)

**Problem**: `yq` (snap package) may timeout. Use Python instead.

### Edit YAML field

```bash
python3 -c "
import yaml

with open('entity.yaml', 'r') as f:
    data = yaml.safe_load(f)

# Modify field
data['status'] = 'accepted'

with open('entity.yaml', 'w') as f:
    yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
"
```

### Convert string to array

```bash
python3 -c "
import yaml

with open('entity.yaml', 'r') as f:
    data = yaml.safe_load(f)

# Convert multiline string to array
if isinstance(data.get('nonfunctionalImpact'), str):
    lines = [l.strip() for l in data['nonfunctionalImpact'].strip().split('\n') if l.strip()]
    data['nonfunctionalImpact'] = lines

with open('entity.yaml', 'w') as f:
    yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
"
```


---

## Schema Field Audit

**Problem**: Need to see at a glance which fields have which `x-sdd-*` display hints, layout groups, and ordering.

### View all fields with their display configuration

```bash
# Show all fields with their x-sdd-* properties (sorted by group, then order)
cat schemas/ADR.schema.json | jq '[.properties | to_entries[] | {
  field: .key,
  layoutGroup: .value["x-sdd-layoutGroup"] // "NONE",
  displayLocation: .value["x-sdd-displayLocation"] // "form",
  order: .value["x-sdd-order"] // 999,
  displayHint: .value["x-sdd-displayHint"] // null
}] | sort_by(.layoutGroup, .order)'
```

### Find header-only fields

```bash
# List fields that should only appear in entity header
cat schemas/ADR.schema.json | jq '[.properties | to_entries[] | 
  select(.value["x-sdd-displayLocation"] == "header") | .key]'
```

### Find fields without layout group

```bash
# Find orphan fields (no layout group assignment)
cat schemas/ADR.schema.json | jq '[.properties | to_entries[] | 
  select(.value["x-sdd-layoutGroup"] == null) | .key]'
```

### View specific field's full config

```bash
# Deep-dive into one field's schema
cat schemas/ADR.schema.json | jq '.properties.confidence'
```

---

## Schema Conditional Keyword Audit

**Problem**: JSON Schema `if/then/else` blocks can define additional properties that RJSF merges into the form, bypassing property filtering. This caused the "confidence field duplication" bug.

### Check if schema uses conditional keywords

```bash
# Quick check - does this schema have conditionals?
cat schemas/ADR.schema.json | jq '{
  hasIf: (.if != null),
  hasThen: (.then != null),
  hasElse: (.else != null),
  hasAllOf: (.allOf != null),
  hasAnyOf: (.anyOf != null),
  hasOneOf: (.oneOf != null)
}'
```

### View properties defined in conditional blocks

```bash
# See what fields are in then/else blocks (may bypass UI filtering!)
cat schemas/ADR.schema.json | jq '{
  thenProperties: (.then.properties // {} | keys),
  elseProperties: (.else.properties // {} | keys),
  thenRequired: (.then.required // []),
  elseRequired: (.else.required // [])
}'
```

### Full conditional audit

```bash
# Comprehensive audit - fields in conditionals vs main properties
cat schemas/ADR.schema.json | jq '{
  mainProperties: (.properties | keys),
  conditionalProperties: (
    ((.then.properties // {}) | keys) +
    ((.else.properties // {}) | keys) +
    ((.allOf // []) | map(.properties // {} | keys) | flatten) +
    ((.anyOf // []) | map(.properties // {} | keys) | flatten) +
    ((.oneOf // []) | map(.properties // {} | keys) | flatten)
  ) | unique,
  overlap: (
    (.properties | keys) as $main |
    (
      ((.then.properties // {}) | keys) +
      ((.else.properties // {}) | keys)
    ) | map(select(. as $k | $main | index($k)))
  )
}'
```

**Why this matters**: When filtering schemas for layout groups or header fields, RJSF evaluates `if/then/else` and merges properties from matching conditional blocks. Fields defined in `then.properties` will appear in the form even if excluded from the main `properties` filter.

**Solution in code**: Strip conditional keywords when building filtered schemas:
```typescript
const { if: _if, then: _then, else: _else, allOf, anyOf, oneOf, ...schemaBase } = schema;
```

---

## Browser SHA-256 Hash (Web Crypto API)

**Problem**: Need content-addressable caching in the browser (e.g., PlantUML diagrams).

**Use case**: Generate hash for cache key/ETag matching server-side computation.

```typescript
/**
 * Compute SHA-256 hash of content for cache key
 * Uses Web Crypto API (available in all modern browsers)
 */
async function computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 16); // Truncate to 16 chars to match server
}

// Usage example (PlantUML caching):
const hash = await computeHash(`${theme}:${code.trim()}`);
const response = await fetch(`/api/plantuml/${hash}?code=${encodeURIComponent(code)}&theme=${theme}`);
```

**Server-side equivalent (Node.js)**:
```typescript
const crypto = require('node:crypto');
function computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}
```

**Why save**: Non-obvious async pattern with Web Crypto API, useful for content-addressable caching.

