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

## WSL2 Browser Subagent Setup (Complete Guide)

**Problem**: Browser subagent fails with `ECONNREFUSED 127.0.0.1:9222` in WSL2.

**Root cause**: In WSL2's default NAT networking mode, `localhost` inside WSL refers to WSL's own loopback, not Windows' localhost where Chrome is listening.

### Prerequisites

1. **Windows 11 22H2 or later** (for mirrored networking support)
2. **PowerShell execution policy** must allow scripts:
   ```powershell
   # Run in Windows PowerShell as Administrator
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Step 1: Enable Mirrored Networking

Edit or create `C:\Users\<YourUsername>\.wslconfig`:

```ini
[wsl2]
memory=8GB
processors=8
swap=8GB
networkingMode=mirrored
```

**Important**: `localhostForwarding=true` is redundant with mirrored networking (WSL will warn you).

After editing, restart WSL:
```powershell
# Run in Windows PowerShell
wsl --shutdown
wsl
```

### Step 2: Remove Any Old Port Proxies

If you previously set up port proxies, remove them (run as admin):
```powershell
# Run in Windows PowerShell as Administrator
netsh interface portproxy delete v4tov4 listenport=9222 listenaddress=0.0.0.0
```

Verify no proxies exist:
```powershell
netsh interface portproxy show v4tov4
# Should show empty table
```

### Step 3: Start Chrome with Remote Debugging

Use the restart script:
```bash
./scripts/wsl/restart-chrome.sh
```

Or manually:
```bash
cd /mnt/c && /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "
    Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Start-Process -FilePath 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Temp\ag-cdp','--no-first-run','--no-default-browser-check','--remote-allow-origins=*'
"
```

**Chrome flags explained**:
- `--remote-debugging-port=9222`: Enable CDP on port 9222
- `--user-data-dir=C:\Temp\ag-cdp`: Separate profile from your regular Chrome
- `--no-first-run`: Skip first-run welcome/sign-in screens
- `--no-default-browser-check`: Skip default browser prompt
- `--remote-allow-origins=*`: Allow CDP connections from any origin (required)

### Step 4: Install Antigravity Browser Extension

The browser subagent requires the **Antigravity Browser Extension** to be installed in the debug Chrome instance.

1. Open Chrome Web Store: https://chromewebstore.google.com/detail/antigravity-browser-exten/eeijfnjmjelapkebgockoeaadonbchdd
2. Click "Add to Chrome"
3. If you get "Download interrupted" errors, try:
   - Closing and reopening Chrome via the restart script
   - Using a different network connection

### Step 5: Verify Setup

```bash
# Test CDP is accessible from WSL
curl -s http://localhost:9222/json/version
# Should return: {"Browser": "Chrome/...", "Protocol-Version": "1.3", ...}

# Test browser subagent (from agent chat)
# The agent should be able to navigate to pages and take screenshots
```

---

## WSL Chrome Restart (When browser_subagent Gets Stuck)

**Problem**: Browser subagent hangs on page load, "target closed" errors, or "page not found" from browser tools.

**Root cause**: Chrome loses connection or enters bad state. Need full restart.

**Solution: Use the restart script**:
```bash
./scripts/wsl/restart-chrome.sh
```

The script:
1. Kills only Chrome instances with 'ag-cdp' in their command line (preserves your regular browser)
2. Starts fresh Chrome with all required flags
3. Verifies CDP is accessible

**Verify Chrome is accessible**:
```bash
curl -s http://localhost:9222/json/version
# Should return: {"Browser": "Chrome/...", "Protocol-Version": "1.3", ...}
```

---

## WSL2 Browser Debugging Troubleshooting

### Problem: curl returns exit code 7 (ECONNREFUSED)

**Cause**: WSL can't reach Windows' localhost.

**Fix**: Ensure mirrored networking is enabled in `.wslconfig` and WSL was restarted.

### Problem: curl returns exit code 52 (empty reply) or 56 (connection reset)

**Cause**: Chrome is starting or there's a port proxy interfering.

**Fix**: 
1. Remove any port proxies (see Step 2 above)
2. Wait a few seconds for Chrome to fully start
3. Try the restart script

### Problem: Chrome opens with sign-in/first-run screens

**Cause**: Missing `--no-first-run` flag or corrupted profile.

**Fix**: 
1. Close Chrome
2. Delete the profile: `Remove-Item -Recurse -Force 'C:\Temp\ag-cdp'` (PowerShell)
3. Restart Chrome via the script

### Problem: Chrome only listening on IPv6 `[::1]:9222`

**Cause**: Sometimes Chrome only binds to IPv6.

**Fix**: Restart Chrome - it usually binds to both IPv4 and IPv6 on fresh start.

### Problem: Antigravity extension download fails

**Cause**: Fresh Chrome profile may have network issues.

**Fix**: Try closing and reopening Chrome, or temporarily use your regular Chrome profile to install the extension, then copy it to the debug profile.

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

---

## Bundle Validation After Programmatic Modifications

**Problem**: After modifying sample bundle files via shell scripts or Python, validation errors may go unnoticed until the UI is loaded.

**ALWAYS run validation after programmatic bundle changes:**

```bash
# Quick validation via MCP server (requires dev server running)
curl -s http://localhost:3001/mcp -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"validate_bundle","arguments":{"bundlePath":"/home/ivan/dev/sdd-sample-bundle"}}}' | jq '.result.content[0].text' | head -50

# Alternative: Start dev server and check UI diagnostics panel
./scripts/local/dev.sh
# Then open http://localhost:5173 and check for red error badges
```

**Common validation errors after bulk edits:**

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `must match format "date"` | Schema expects `date` but data has `date-time` | Update schema to `format: "date-time"` or fix data |
| `Broken reference` | Added field references entity ID that doesn't exist | Create the missing entity or fix the reference |
| `is required` | Added field to `required` array but data lacks it | Add field to data files or remove from required |

**Preventive pattern**: Before committing programmatic changes:
```bash
# 1. Run your modification script
python3 update_entities.py

# 2. Validate immediately
curl -s http://localhost:3001/mcp -X POST ... | jq '.result'

# 3. Only commit if validation passes
git add -A && git commit -m "fix: ..."
```

---

## Schema Relationship Reference Audit

**Problem**: Need to audit all entity-to-entity relationships defined via `x-sdd-refTargets` across all schemas.

**Use case**: Before refactoring or migrating relationship fields, understand the current state.

### List all reference fields in a schema directory

```bash
# Audit all x-sdd-refTargets fields across all schemas
for schema in /home/ivan/dev/sdd-sample-bundle/schemas/*.json; do
  echo "=== $(basename $schema) ==="
  jq -r '
    .properties // {} | to_entries[] | 
    select(.value["x-sdd-refTargets"] != null or (.value.items // {})["x-sdd-refTargets"] != null) |
    {field: .key, targets: (.value["x-sdd-refTargets"] // .value.items["x-sdd-refTargets"]), title: (.value.title // .value.items.title // "no title")}
  ' "$schema" 2>/dev/null
done
```

### Filter by target entity type

```bash
# Find all fields that reference Feature
for schema in /home/ivan/dev/sdd-sample-bundle/schemas/*.json; do
  jq -r --arg target "Feature" '
    .properties // {} | to_entries[] | 
    select(
      (.value["x-sdd-refTargets"] // []) + ((.value.items // {})["x-sdd-refTargets"] // []) 
      | any(. == $target)
    ) |
    "\(input_filename | split("/")[-1]): \(.key)"
  ' "$schema" 2>/dev/null
done
```

### Count relationships by direction

```bash
# Summarize: which entity types point to which (for migration planning)
for schema in /home/ivan/dev/sdd-sample-bundle/schemas/*.json; do
  from=$(basename "$schema" .schema.json)
  jq -r --arg from "$from" '
    .properties // {} | to_entries[] | 
    ((.value["x-sdd-refTargets"] // []) + ((.value.items // {})["x-sdd-refTargets"] // [])) |
    .[] | 
    "\($from) → \(.)"
  ' "$schema" 2>/dev/null
done | sort | uniq -c | sort -rn
```

**Why save**: Complex jq pattern used to audit 60+ relationships across 20+ schemas during the Target-Holds-Reference migration planning.

---

## Flexbox Child Width Debugging

**Problem**: Input fields or text content inside flexbox containers are truncated/cut off instead of expanding to fill available width.

**Root cause**: Flexbox children don't automatically expand. Need `flex: 1`, `min-width: 0`, and often `width: 100%` on wrapper.

### Diagnose width issues via browser console

```javascript
// Run in browser console - replace INPUT_ID with actual element ID
(() => {
  const input = document.getElementById('root_assumptions_0'); // or any input
  if (!input) return { error: 'Input not found - check ID' };
  
  const style = window.getComputedStyle(input);
  const parentStyle = window.getComputedStyle(input.parentElement);
  const grandParentStyle = window.getComputedStyle(input.parentElement.parentElement);
  
  return {
    inputWidth: style.width,           // Is this too small?
    inputFlex: style.flex,             // Should be "1" or "1 1 auto"
    parentWidth: parentStyle.width,    // Is parent full width?
    parentFlex: parentStyle.flex,      // Should be "1"
    grandParentWidth: grandParentStyle.width,
    grandParentDisplay: grandParentStyle.display  // Should be "flex"
  };
})();
```

### CSS fix pattern for flexbox child expansion

```css
/* Parent container - already flex */
.flexContainer {
    display: flex;
}

/* REQUIRED: Child must flex AND have min-width: 0 */
.flexContainer > * {
    flex: 1;
    min-width: 0;  /* Allows shrinking below content size */
}

/* REQUIRED: Content wrapper needs explicit width */
.contentWrapper {
    width: 100%;  /* Forces inputs/text to expand */
}
```

**Why both are needed**:
- `flex: 1` tells the child to grow
- `min-width: 0` overrides default `min-width: auto` which prevents shrinking
- `width: 100%` on wrapper ensures nested content (inputs) fills available space

**Debug checklist**:
1. Is parent `display: flex`?
2. Does child have `flex: 1`?
3. Does child have `min-width: 0`?
4. Does content wrapper have `width: 100%`?

**Example real fix** (RjsfStyles.module.css):
```css
.bulletItem > * {
    flex: 1;
    min-width: 0;
}

.arrayItemContent {
    width: 100%;
}
```

---

## Interactive Element CSS Verification

**Problem**: Hover tooltips, click handlers, or other interactive behaviors don't work even though the HTML attributes are correct.

**Root cause**: CSS properties like `pointer-events: none` can block interaction events from reaching elements.

**Use case**: This exact pattern caught the relationship graph tooltip bug where `title` attributes were present but hover never triggered.

### Verify element can receive interactions

```javascript
// Run in browser console - finds elements and checks interaction-blocking CSS
(() => {
  const selector = '[title]'; // Or any selector for interactive elements
  const elements = document.querySelectorAll(selector);
  
  return Array.from(elements).slice(0, 5).map(el => {
    const style = window.getComputedStyle(el);
    return {
      text: el.textContent?.substring(0, 30),
      title: el.getAttribute('title'),
      // CRITICAL: Must be 'auto' or 'all' for tooltips/clicks to work
      pointerEvents: style.pointerEvents,
      cursor: style.cursor,
      visibility: style.visibility,
      display: style.display
    };
  });
})();
```

### Quick check for specific element

```javascript
// Check a labeled edge or similar element
(() => {
  const el = document.querySelector('[class*="label"][title]');
  if (!el) return 'No element found with title attribute';
  const style = window.getComputedStyle(el);
  return {
    canReceiveHover: style.pointerEvents !== 'none',
    pointerEvents: style.pointerEvents,
    hasTitle: el.hasAttribute('title'),
    title: el.getAttribute('title')
  };
})();
```

### Common blocking patterns and fixes

| CSS Property | Blocking Value | Fix |
|--------------|----------------|-----|
| `pointer-events` | `none` | Change to `auto` |
| `visibility` | `hidden` | Change to `visible` |
| `display` | `none` | Change to block/flex/etc |
| `opacity` | `0` | Still receives events, but check if parent blocks |

**Real-world fix example** (LabeledEdge.module.css):
```css
/* BEFORE: Blocks hover, tooltip never appears */
.label {
    pointer-events: none;
}

/* AFTER: Allows hover, tooltip works */
.label {
    pointer-events: auto;
    cursor: default;
}
```

**Why save**: This pattern immediately identified the tooltip bug that visual inspection and DOM attribute checks missed.

---

## CSS Class Usage Audit

**Problem**: CSS files accumulate dead code when components are deleted but their styles remain.

**Use case**: Found ~1150 lines of unused CSS when AgentPanel component was deleted but styles remained. This pattern helps detect such orphaned styles.

### Audit all CSS classes in styles.css

```bash
# Find CSS class selectors and check if used in source files
grep -oh '\.[a-z][a-zA-Z0-9_-]*' apps/web/src/styles.css | \
  sed 's/^\.//' | sort -u | while read cls; do
    if ! grep -rq "\"$cls\"\|'$cls'\|className.*$cls\|\`.*$cls" \
      packages/ui-shell/src apps/web/src \
      --include="*.tsx" --include="*.ts" 2>/dev/null; then
      echo "UNUSED: .$cls"
    fi
done | head -50
```

### Audit specific section (e.g., agent- prefixed classes)

```bash
# Check if any agent-related classes are used
grep -oh '\.agent-[a-zA-Z0-9_-]*' apps/web/src/styles.css | \
  sed 's/^\.//' | sort -u | while read cls; do
    if grep -rq "$cls" packages/ui-shell/src --include="*.tsx" 2>/dev/null; then
      echo "USED: .$cls"
    else
      echo "UNUSED: .$cls"
    fi
done
```

### Quick check for orphaned dist files

```bash
# Find dist files without corresponding source files
for f in packages/ui-shell/dist/components/*.js; do
  base=$(basename "$f" .js)
  if ! ls packages/ui-shell/src/components/"$base".tsx 2>/dev/null; then
    echo "ORPHAN: $f"
  fi
done
```

**Why save**: Periodic CSS audits can prevent 50%+ bloat accumulation. Use before major releases.
