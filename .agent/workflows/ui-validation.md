---
description: Validate UI changes using browser agent before and after modifications
---

# UI Validation Workflow

**MANDATORY for all UI-related changes** including:
- CSS modifications
- Schema display hints (`x-sdd-*` keywords)
- React component styling
- Layout changes
- New widgets or templates

## Standard Process

### 0. Pre-flight: MANDATORY Server Restart
**CRITICAL**: The webpack-dev-server can become unresponsive after extended use, causing browser timeouts.
**ALWAYS restart the server before browser validation** - this is not optional.

```bash
# Step 1: Kill any existing dev server processes
// turbo
./scripts/local/restart-dev.sh
```

```bash
# Step 2: Wait for server to be fully ready (with health check loop)
// turbo
for i in {1..30}; do
  curl -s --max-time 2 http://localhost:5173/ > /dev/null && echo "✓ Server ready" && break
  echo "Waiting for server... ($i/30)"
  sleep 1
done
```

```bash
# Step 3: Add buffer time for webpack compilation to complete
// turbo
sleep 3

# Step 4: Final health check before proceeding
curl -s --max-time 5 http://localhost:5173/ > /dev/null && echo "✓ Ready for browser validation"
```

**DO NOT proceed to browser_subagent until the final health check passes.**

⚠️ **Why mandatory restart?** The dev server accumulates state (HMR connections, file watchers, memory)
that can cause it to stop responding. A fresh restart ensures reliable browser agent execution.

### 1. Before Making Changes
Use browser agent to capture the **current state**:
```
Task: Navigate to http://localhost:5173, locate the affected component/field, 
and take a screenshot to document the current state before changes.
```

### 2. Make the Changes
- Edit CSS, components, or schema as needed
- Wait for hot-reload to apply changes

### 3. After Making Changes  
Use browser agent to **validate the fix**:
```
Task: Navigate to http://localhost:5173, locate the same component/field,
take a screenshot, and verify:
- The intended change is visible
- No visual regressions in surrounding elements
- Alignment, spacing, and colors are correct
- The fix addresses the original issue
```

### 4. Compare and Commit
- Review before/after screenshots
- Only commit if validation passes
- Include validation findings in commit message if relevant

## Example Browser Agent Tasks

### Validate a Style Change
```
Navigate to http://localhost:5173 and:
1. Expand ADR section in sidebar
2. Click on ADR-storage-choice
3. Take a screenshot of the [specific field/area]
4. Observe vertical alignment, font size, spacing
5. Report any visual issues
```

### Validate After Schema Hint Change
```
Navigate to http://localhost:5173 and verify:
1. The field [X] now displays with [expected behavior]
2. Other fields are not affected
3. Take screenshot for documentation
```

## Key Principles

1. **Trust but verify** - Don't assume CSS changes look correct
2. **Document visually** - Screenshots provide evidence of fixes
3. **Check edge cases** - Empty values, long text, different entity types
4. **Compare before/after** - Visual regression detection

## CRITICAL: Self-Validation Rule

**NEVER ask the user to refresh and validate UI changes before validating yourself via browser agent.**

After ANY CSS, layout, or visual change:
1. ALWAYS run browser_subagent to verify the change worked correctly
2. ALWAYS check for regressions (overlapping elements, spacing issues, alignment)
3. ONLY after successful self-validation, confirm to the user what was fixed
4. If issues are found, fix them and re-validate before reporting to user

Violations of this rule waste user time and create poor user experience.

## Recording Names Convention
Use descriptive names: `{component}_{action}_{state}`
- `date_widget_validation`
- `markdown_field_before_fix`
- `entity_header_alignment_after`

## UI Design Proposals

**When proposing UI changes with multiple options:**

1. **Generate visual mockups** using image generation (Gemini 3 Pro) for each option
2. **Show all options in chat** with clear labels (Option 1, Option 2, etc.)
3. **Wait for user decision** before implementing
4. This applies to:
   - Layout changes (horizontal vs vertical, grid vs list)
   - Color schemes
   - Typography choices
   - Component styling variations
   - Any visual design decision with multiple viable approaches

This enables informed decision-making based on actual visual representation rather than text descriptions.
