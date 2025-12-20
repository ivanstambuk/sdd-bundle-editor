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

### Prominence Headers vs Regular Labels

Fields can be displayed with either a **prominence header** (styled section header with icon) or a **regular label** (muted uppercase text). Understanding when to use each is crucial.

#### How Headers Are Triggered

A prominence header appears when **BOTH** conditions are met:
1. `x-sdd-prominence` is set to `hero`, `primary`, or `secondary`
2. `x-sdd-prominenceLabel` is provided

```json
// ✅ Gets a prominence header
"decision": {
  "x-sdd-prominence": "hero",
  "x-sdd-prominenceLabel": "The Decision",  // Required for header
  "x-sdd-prominenceIcon": "✅"              // Optional icon
}

// ❌ Gets regular label (no prominenceLabel)
"decidedDate": {
  "x-sdd-prominence": "tertiary"
  // No prominenceLabel → uses regular muted label
}
```

#### Works for Any Field Type

Prominence headers are **not limited to markdown**. They can be used for any field type:

| Field Type | Can Use Header? | Typical Use |
|------------|-----------------|-------------|
| Markdown | ✅ Yes | Narrative sections (problem, context, decision) |
| Plain string | ✅ Yes | Important single-line content |
| Arrays | ✅ Yes | Section headers for lists |
| Nested objects | ✅ Yes | Complex grouped content |
| Numbers/dates | ⚠️ Possible but unusual | Generally use regular labels |

#### Decision Table: Header vs Label

| Field Character | Use Header? | Use Label? | Rationale |
|-----------------|-------------|------------|-----------|
| **Narrative/rich content** (markdown paragraphs) | ✅ | | Signals "this is a section" |
| **Story flow items** (problem → context → decision) | ✅ | | Creates scannable narrative |
| **Major array sections** (alternatives, consequences) | ✅ | | Groups related items visually |
| **Short metadata** (title, name, ID) | | ✅ | Too much visual weight for small values |
| **Dates/timestamps** | | ✅ | Simple values, not sections |
| **Status/enum badges** | | ✅ | Badges have their own visual treatment |
| **Simple inputs** (numbers, short text) | | ✅ | Don't need section treatment |

#### Example: ADR Field Breakdown

| Field | Type | Header? | Why |
|-------|------|---------|-----|
| `title` | string | ❌ Label | Short metadata value |
| `status` | enum | ❌ Label | Uses badge styling |
| `decidedDate` | date | ❌ Label | Simple metadata |
| `problem` | markdown | ✅ Header | Narrative section |
| `context` | markdown | ✅ Header | Narrative section |
| `decision` | markdown | ✅ Header | Narrative section (hero) |
| `alternativesConsidered` | array | ✅ Header | Major array section |
| `assumptions` | array | ❌ Label | Supporting list, not a section |
| `tags` | array | ❌ Label | Chip display, not a section |

#### Rule of Thumb

**Use prominence headers when:**
- Content is substantial (multiple paragraphs, rich formatting)
- It's part of a narrative flow (question → background → answer)
- You want to say "this is a major section of the entity"

**Use regular labels when:**
- Values are short (single line, few words)
- It's metadata (dates, status, confidence)
- The field has its own visual treatment (badges, chips)

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
