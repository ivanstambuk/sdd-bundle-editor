# Implementation Plan: Entity Details Enhancement

## Overview
Add three new panels to the Entity Details view:
1. **Dependency Graph** - Visual relationship graph
2. **Schema Preview** - View JSON Schema
3. **Raw YAML** - View/copy raw YAML

## Current State Analysis
- Entity Details (`EntityDetails.tsx`) currently shows:
  - Entity type badge and ID
  - Collapsible "Uses" section (outgoing references)
  - Collapsible "Used By" section (incoming references)
  - RJSF form with entity properties

## Design Decisions

### UI Layout
All three features will be **collapsible sections** following the existing pattern:
- Collapsed by default (consistent with Uses/Used By)
- Same styling as existing reference sections
- Ordered after the form: Schema Preview → Raw YAML → Dependency Graph

### Why this order?
- Schema Preview: Quick reference while viewing form fields
- Raw YAML: Useful for debugging/copying
- Dependency Graph: Visual, takes more space, least frequently needed

---

## Feature 1: Schema Preview

### Purpose
Show the JSON Schema for the current entity type so users can understand:
- Available fields and their types
- Validation rules (required, patterns, enums)
- Reference targets (x-refTargets)

### Implementation
1. Add collapsible section after RJSF form
2. Use `<pre>` with `JSON.stringify(schema, null, 2)` for formatted display
3. Add syntax highlighting (optional, can use simple CSS)

### Files to Modify
- `packages/ui-shell/src/components/EntityDetails.tsx`

### Estimated Effort: Small (30 min)

---

## Feature 2: Raw YAML

### Purpose
Show the raw YAML of the entity for:
- Debugging (see exact stored values)
- External editing (copy to clipboard)
- Understanding the source data

### Implementation
1. Add `js-yaml` dependency for serialization
2. Add collapsible section with YAML output
3. Add "Copy to Clipboard" button
4. Style with monospace font and dark code block

### Files to Modify
- `packages/ui-shell/package.json` (add js-yaml dependency)
- `packages/ui-shell/src/components/EntityDetails.tsx`

### Estimated Effort: Small (45 min)

---

## Feature 3: Dependency Graph

### Purpose
Visualize entity relationships to:
- Understand impact of changes
- Navigate related entities
- See the full dependency tree

### Implementation Options

#### Option A: Simple Tree View (Recommended)
- Pure CSS/HTML tree structure
- No external library needed
- Shows 1 level of in/out references
- Clickable nodes for navigation

#### Option B: React Flow
- Professional graph visualization
- Draggable nodes
- Larger bundle size (~150kb)
- More complex to implement

#### Option C: D3.js Force Graph
- Highly customizable
- Force-directed layout
- Steeper learning curve

### Recommendation: Option A (Simple Tree View)
- Fits existing UI patterns
- No additional dependencies
- Fast to implement
- Can upgrade to Option B later if needed

### Implementation (Option A)
1. Add collapsible section "Dependency Graph"
2. Render tree: Entity → Uses → [list] and → Used By → [list]
3. Clickable entity nodes (reuse existing navigation)
4. Visual distinction for entity types (badges)

### Files to Modify
- `packages/ui-shell/src/components/EntityDetails.tsx`
- `packages/ui-shell/src/styles.css` (tree styles)

### Estimated Effort: Medium (1 hour)

---

## Implementation Order

1. **Schema Preview** - Simplest, no dependencies
2. **Raw YAML** - Requires js-yaml, but straightforward
3. **Dependency Graph** - Most complex, but uses existing data

## Total Estimated Time: ~2.5 hours

---

## Acceptance Criteria

### Schema Preview
- [ ] Collapsible section shows JSON Schema
- [ ] Pretty-printed with indentation
- [ ] Shows "No schema available" fallback

### Raw YAML
- [ ] Collapsible section shows YAML
- [ ] Copy button copies to clipboard
- [ ] Success feedback on copy

### Dependency Graph
- [ ] Tree structure shows Uses and Used By
- [ ] Clickable nodes navigate to entity
- [ ] Entity type badges for visual distinction
- [ ] Works with 0, 1, and many references
