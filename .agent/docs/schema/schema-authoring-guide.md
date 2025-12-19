# SDD Schema Authoring Guide

> Reference documentation for creating schemas that work with the SDD Bundle Editor

This document defines all custom JSON Schema extension keywords (`x-sdd-*`) recognized by the SDD Bundle Editor. When creating new entity type schemas, use these properties to control how fields are displayed and validated.

---

## Quick Start

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MyEntity",
  "type": "object",
  "required": ["id", "name"],
  "properties": {
    "id": {
      "type": "string",
      "x-sdd-entityType": "MyEntity",
      "x-sdd-idTemplate": "ME-{slug}",
      "maxLength": 60
    },
    "name": {
      "type": "string",
      "maxLength": 120
    }
  }
}
```

---

## Extension Keywords Reference

### Identity & References

| Keyword | Type | Applies To | Description |
|---------|------|------------|-------------|
| `x-sdd-entityType` | `string` | ID field | Entity type this ID belongs to (e.g., `"Feature"`) |
| `x-sdd-idTemplate` | `string` | ID field | Template for generating IDs (e.g., `"FTR-{slug}"`) |
| `x-sdd-idScope` | `"bundle"` \| `"global"` | ID field | Scope for ID uniqueness. Default: `"bundle"` |
| `x-sdd-refTargets` | `string[]` | Reference field | Entity types this reference can point to |

**Example - ID field:**
```json
"id": {
  "type": "string",
  "pattern": "^FTR-[a-z][a-z0-9-]*$",
  "x-sdd-entityType": "Feature",
  "x-sdd-idTemplate": "FTR-{slug}",
  "x-sdd-idScope": "bundle"
}
```

**Example - Reference field:**
```json
"ownerActorId": {
  "type": "string",
  "format": "sdd-ref",
  "x-sdd-refTargets": ["Actor"]
}
```

**Example - Multi-reference array:**
```json
"relatedFeatureIds": {
  "type": "array",
  "items": {
    "type": "string",
    "format": "sdd-ref",
    "x-sdd-refTargets": ["Feature"]
  },
  "title": "relates to"
}
```

---

### Display Hints

| Keyword | Values | Applies To | Description |
|---------|--------|------------|-------------|
| `x-sdd-displayHint` | `"multiline"` | string | Render as textarea |
| `x-sdd-displayHint` | `"markdown"` | string | Render with Markdown preview |
| `x-sdd-displayHint` | `"chips"` | array | Render as inline tag chips |
| `x-sdd-indicator` | any emoji/string | array items | Show indicator before each item |

**Example - Multiline text:**
```json
"description": {
  "type": "string",
  "maxLength": 2000,
  "x-sdd-displayHint": "multiline"
}
```

**Example - Markdown content:**
```json
"context": {
  "type": "string",
  "x-sdd-displayHint": "markdown"
}
```

**Example - Tags as chips:**
```json
"tags": {
  "type": "array",
  "items": { "type": "string" },
  "x-sdd-displayHint": "chips"
}
```

**Example - Array items with indicators:**
```json
"pros": {
  "type": "array",
  "items": {
    "type": "string",
    "x-sdd-indicator": "✅"
  }
},
"cons": {
  "type": "array",
  "items": {
    "type": "string",
    "x-sdd-indicator": "❌"
  }
}
```

---

### Widget Override

| Keyword | Values | Description |
|---------|--------|-------------|
| `x-sdd-widget` | `"textarea"` | Force textarea widget |
| `x-sdd-widget` | `"MarkdownWidget"` | Force Markdown editor/viewer |

**Note:** Prefer `x-sdd-displayHint` over `x-sdd-widget` when possible.

---

### Enum Descriptions

| Keyword | Type | Description |
|---------|------|-------------|
| `x-sdd-enumDescriptions` | `Record<string, string>` | Descriptions for each enum value (shown as tooltips) |

**Example:**
```json
"status": {
  "type": "string",
  "enum": ["draft", "proposed", "accepted", "deprecated"],
  "x-sdd-enumDescriptions": {
    "draft": "Initial working state, not yet proposed",
    "proposed": "Submitted for review",
    "accepted": "Approved and in effect",
    "deprecated": "No longer recommended, superseded"
  }
}
```

---

### Entity Type Metadata

| Keyword | Type | Description |
|---------|------|-------------|
| `x-sdd-ui` | object | UI-level metadata for the entity type |
| `x-sdd-ui.title` | string | Human-readable singular name |
| `x-sdd-ui.displayNamePlural` | string | Human-readable plural name |
| `x-sdd-ui.icon` | string (emoji) | Icon for sidebar/badges |

**Example (at schema root):**
```json
{
  "title": "ADR",
  "x-sdd-ui": {
    "title": "Architecture Decision Record",
    "displayNamePlural": "Architecture Decision Records",
    "icon": "📝"
  }
}
```

---

## Standard JSON Schema Properties

These standard JSON Schema properties also affect rendering:

| Property | Effect |
|----------|--------|
| `title` | Used as field label (overrides property name) |
| `description` | Shown as tooltip (ⓘ icon) |
| `maxLength` | Auto-sizes field width (≤30: small, 31-80: medium, 81-150: large, >150: full) |
| `enum` | Renders as dropdown select |
| `format: "date"` | Renders date picker |
| `format: "sdd-ref"` | Marks as entity reference (hidden in Details, shown in Dependency Graph) |

---

## Patterns Recognized by the Editor

### Alternatives Pattern

When an array contains objects with an `isChosen: boolean` field, the editor automatically:
- Adds "✓ CHOSEN" / "REJECTED" badges
- Highlights the chosen alternative with green border
- Hides redundant fields based on selection state

**Example:**
```json
"alternativesConsidered": {
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "isChosen": { "type": "boolean" },
      "reasonRejected": { "type": "string" }
    }
  }
}
```

> **Note:** This pattern is currently detected by schema structure, not explicitly declared. A future `x-sdd-layout: "alternatives"` option may be added for explicit control.

---

## Complete Example

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Feature",
  "description": "A product feature or capability",
  "type": "object",
  "required": ["id", "name", "status"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^FTR-[a-z][a-z0-9-]*$",
      "x-sdd-entityType": "Feature",
      "x-sdd-idTemplate": "FTR-{slug}",
      "maxLength": 60
    },
    "name": {
      "type": "string",
      "maxLength": 120,
      "title": "Feature Name"
    },
    "status": {
      "type": "string",
      "enum": ["planned", "in-progress", "completed"],
      "x-sdd-enumDescriptions": {
        "planned": "Scheduled for future development",
        "in-progress": "Currently being implemented",
        "completed": "Fully implemented and released"
      }
    },
    "description": {
      "type": "string",
      "maxLength": 2000,
      "x-sdd-displayHint": "markdown"
    },
    "acceptanceCriteria": {
      "type": "array",
      "items": {
        "type": "string",
        "x-sdd-indicator": "☑️"
      }
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "x-sdd-displayHint": "chips"
    },
    "ownerActorId": {
      "type": "string",
      "format": "sdd-ref",
      "x-sdd-refTargets": ["Actor"],
      "title": "owned by"
    }
  },
  "x-sdd-ui": {
    "title": "Feature",
    "displayNamePlural": "Features",
    "icon": "🎯"
  }
}
```

---

## Adding New Extension Keywords

When adding new `x-sdd-*` keywords:

1. **Register in validator** - Add to `EntityDetails.tsx` keywords array
2. **Document here** - Add to this reference
3. **Follow naming** - Use `x-sdd-` prefix, camelCase name
4. **Keep generic** - Avoid entity-specific logic in the editor

