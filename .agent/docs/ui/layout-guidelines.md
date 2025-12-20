# UI Layout Guidelines

> Guidelines for organizing complex entity forms to reduce visual clutter and improve usability

## When to Use Sub-tabs (Layout Groups)

Use sub-tabs to break up complex entity forms. This:
- Reduces cognitive load
- Improves discoverability of fields
- Makes the form feel less overwhelming

### Threshold Guidelines

| Field Count | Recommendation |
|-------------|----------------|
| 1-7 fields | No sub-tabs needed |
| 8-15 fields | Consider sub-tabs if fields group naturally |
| 16+ fields | **Always use sub-tabs** |

### How to Group Fields

Organize fields by their **purpose**, not by data type:

**Good groupings:**
- **Overview**: Primary identification and status fields (id, title, status, owner)
- **Content**: The main narrative fields (problem, context, decision)
- **Related**: References to other entities (dependencies, related features)
- **Metadata**: Dates, audit fields, configuration (created, modified)

**Bad groupings:**
- Grouping by data type (all strings, all dates, all references)
- Too many small groups (3 fields per tab is awkward)
- Inconsistent grouping across similar entity types

### Implementation

1. Define groups at schema root:
```json
{
  "x-sdd-layoutGroups": {
    "overview": { "title": "Overview", "order": 1 },
    "content": { "title": "Content", "order": 2 },
    "meta": { "title": "Metadata", "order": 3 }
  }
}
```

2. Assign each field to a group:
```json
"status": {
  "type": "string",
  "x-sdd-layoutGroup": "overview"
}
```

---

## Visual Hierarchy

### Prominence Levels

Use `x-sdd-prominence` to guide the user's eye to the most important content:

| Level | When to Use | Visual Treatment |
|-------|-------------|------------------|
| `hero` | THE answer/decision | Green gradient, prominent |
| `primary` | THE question/problem | Accent border, emphasized |
| `secondary` | Standard content | Default styling |
| `tertiary` | Supporting details | Muted, smaller |

**ADR Example:**
- `decision` → hero (what we decided)
- `problem` → primary (what we're solving)
- `context`, `alternatives` → secondary
- `decidedDate` → tertiary

### Field Ordering

Use `x-sdd-order` to control the sequence:
- Status/summary fields: 1-10
- Title/identification: 10-20
- Tertiary metadata: 20-30  
- Primary content: 30-40
- Hero content: 50+

**Tip**: Leave gaps (5, 10, 15...) so you can insert new fields later.

### Narrative Fields Pattern

For entities that tell a story (ADRs, Design Documents, Analysis Records), use prominence headers to create a clear narrative flow:

| Level | Role | Icon | Example |
|-------|------|------|---------|
| `hero` | The Answer | ✅ | Decision, Conclusion |
| `primary` | The Question | ❓ | Problem, Challenge |
| `secondary` with header | The Background | 🧭 | Context, Background |

**Standard narrative icons:**
- ❓ Problem/Question - "What are we solving?"
- 🧭 Context/Background - "Orient yourself here"
- ✅ Decision/Answer - "What did we decide?"

**Example ADR configuration:**
```json
"problem": {
  "x-sdd-prominence": "primary",
  "x-sdd-prominenceLabel": "The Problem",
  "x-sdd-prominenceIcon": "❓",
  "x-sdd-order": 30
},
"context": {
  "x-sdd-prominence": "secondary",
  "x-sdd-prominenceLabel": "The Context",
  "x-sdd-prominenceIcon": "📘",
  "x-sdd-order": 35
},
"decision": {
  "x-sdd-prominence": "hero",
  "x-sdd-prominenceLabel": "The Decision",
  "x-sdd-prominenceIcon": "✅",
  "x-sdd-order": 50
}
```

**Why this pattern works:**
- Creates scannable structure ("I can quickly find the decision")
- Tells a story (problem → context → decision)
- Consistent across similar entity types

---

## Header Metadata

Move "system" fields to the entity header instead of the form body:

### Candidates for Header Display

| Field Type | Why Header? |
|------------|-------------|
| `createdDate` | Audit trail, not user-edited |
| `lastModifiedDate` | Audit trail |
| `lastModifiedBy` | Attribution |

### Implementation

```json
"createdDate": {
  "format": "date",
  "x-sdd-displayLocation": "header"
}
```

### Keep in Form

Fields that require user attention should stay in the main form:
- Status (user makes decisions)
- Confidence (user rates)
- Entity-specific dates (e.g., `decidedDate` for ADRs)

---

## Enum Styling

Use `x-sdd-enumStyles` for status fields that benefit from color coding:

| Color | Meaning | Examples |
|-------|---------|----------|
| `success` | Positive, complete | accepted, high, done |
| `info` | In progress, neutral-positive | proposed, medium |
| `warning` | Caution, degraded | deprecated, low |
| `error` | Negative, blocked | superseded, critical |
| `neutral` | Default, inactive | draft, pending |

**Apply to:**
- Status fields (draft → accepted → deprecated)
- Confidence/priority fields (low → medium → high)
- Lifecycle states

---

## Anti-patterns

### ❌ Too Many Sub-tabs
Having 8+ sub-tabs defeats the purpose. Consolidate.

### ❌ Inconsistent Hierarchy
If ADRs use `hero` for decisions, other entity types with decisions should too.

### ❌ Cluttered Header
The header should have 3-4 metadata items max. More defeats the purpose.

### ❌ Overusing Prominence
If everything is `hero` or `primary`, nothing stands out. Reserve for 1-2 fields.

---

## Quick Reference

```json
{
  "x-sdd-layoutGroups": { ... },           // Sub-tab definitions
  "properties": {
    "field": {
      "x-sdd-layoutGroup": "overview",     // Assign to sub-tab
      "x-sdd-order": 10,                   // Display order
      "x-sdd-prominence": "primary",       // Visual weight
      "x-sdd-prominenceLabel": "Title",    // Section header
      "x-sdd-prominenceIcon": "?",         // Icon for header
      "x-sdd-enumStyles": { ... },         // Colored badges
      "x-sdd-displayLocation": "header"    // Move to header
    }
  }
}
```

---

## See Also

- [Schema Authoring Guide](../schema/schema-authoring-guide.md) - Full reference for `x-sdd-*` keywords
- [UI Changes Protocol](../protocols/ui-changes.md) - Testing requirements for UI changes
