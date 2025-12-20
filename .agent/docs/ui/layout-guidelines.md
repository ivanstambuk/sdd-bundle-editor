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

## Typographic Hierarchy

Use typography to create clear visual hierarchy between labels and values.

### Default Styling (Schema-Driven)

| Element | Default Style | Controlled By |
|---------|---------------|---------------|
| **Labels** | Small (11px), muted gray, UPPERCASE | `x-sdd-labelStyle: "muted"` |
| **Values** | Normal size, primary color, medium weight | `x-sdd-valueStyle: "plain"` |

This creates a pattern where:
- Labels serve as de-emphasized category headers
- Values are the primary focus when viewing

### Style Options

**Label Styles** (`x-sdd-labelStyle`):
| Value | Appearance | Use Case |
|-------|------------|----------|
| `muted` | Small, gray, uppercase | Default for most fields |
| `prominent` | Normal size, bold, primary color | When label needs emphasis |

**Value Styles** (`x-sdd-valueStyle`):
| Value | Appearance | Use Case |
|-------|------------|----------|
| `plain` | No background/border | Clean viewing experience |
| `boxed` | Background + border | Traditional input look, edit mode |

### When to Override

- **Prominent labels**: For section headers within complex nested objects
- **Boxed values**: When you want traditional form appearance in read-only mode

---

## Field Treatment by Type

Different field types warrant different visual treatment in read-only mode:

| Field Type | Treatment | Rationale |
|------------|-----------|-----------|
| **Short strings** (title, name) | Plain text | Reduces visual noise |
| **Numbers** | Plain text | Clear, uncluttered |
| **Dates** | Plain text | Em-dash for empty, formatted for values |
| **Enums** (status, confidence) | Colored badges | Semantic meaning at a glance |
| **Markdown/multiline** | Boxed container | Content boundaries, scroll area |
| **Nested objects** | Card with border | Visual grouping |
| **Arrays** | Varies by layout | chips/bullets/cards |

### Design Rationale

**Plain text for metadata:**
- Reduces visual clutter when viewing
- Creates clear "content vs. container" distinction
- Follows modern design trends (Linear, Notion, Vercel)

**Boxes for rich content:**
- Markdown can contain headers, lists, code blocks
- Scrollable containers need defined boundaries
- Complex nested structures benefit from visual grouping

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
