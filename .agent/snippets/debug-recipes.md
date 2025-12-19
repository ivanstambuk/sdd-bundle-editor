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

