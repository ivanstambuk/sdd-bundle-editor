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

## Recording Names Convention
Use descriptive names: `{component}_{action}_{state}`
- `date_widget_validation`
- `markdown_field_before_fix`
- `entity_header_alignment_after`
