# SDD Schema Conventions

This document defines the conventions for creating and maintaining entity schemas in SDD bundles.

## Display Hints

The `displayHint` property controls how fields are rendered in the UI.

### `displayHint: "chips"`
**Use for:** Array fields containing short labels/tags

```json
"tags": {
  "type": "array",
  "items": { "type": "string" },
  "displayHint": "chips",
  "description": "Categorization labels"
}
```

**Rendering:** Inline horizontal pill badges instead of full-row items

### `displayHint: "multiline"`
**Use for:** String fields that typically contain paragraphs or multi-line text

```json
"description": {
  "type": "string",
  "displayHint": "multiline",
  "description": "Detailed explanation"
}
```

**Rendering:** Textarea instead of single-line input

**Common multiline fields:** description, rationale, context, summary, content, notes

---

## Object Properties with Booleans

When an object contains boolean properties (like quality attributes), each property should have a `description` explaining its meaning.

```json
"qualityAttributes": {
  "type": "object",
  "description": "Quality aspects of the requirement",
  "properties": {
    "atomic": {
      "type": "boolean",
      "description": "Requirement addresses a single, indivisible concern"
    },
    "verifiable": {
      "type": "boolean",
      "description": "Has objective criteria to determine satisfaction"
    }
  }
}
```

**Rendering:** Checkbox with label + info tooltip showing description

---

## Enum Fields

### Naming Convention

| Rule | Good | Bad |
|------|------|-----|
| No abbreviations | `functional` | `FR` |
| Full words | `security` | `SEC` |
| Lowercase | `draft` | `Draft` |
| Hyphens for multi-word | `non-functional` | `non_functional` |
| Human readable | `user-experience` | `UX` |

### Enum Descriptions

Use `enumDescriptions` object to provide tooltip descriptions for each enum value:

```json
"state": {
  "type": "string",
  "enum": ["draft", "proposed", "accepted", "deprecated", "rejected"],
  "description": "Requirement lifecycle state",
  "enumDescriptions": {
    "draft": "Initial state, not yet reviewed",
    "proposed": "Submitted for review and approval",
    "accepted": "Approved and ready for implementation",
    "deprecated": "No longer applicable, superseded",
    "rejected": "Reviewed and declined"
  }
}
```

**Rendering:** Dropdown with info tooltips for each option

---

## Reference Fields

Reference fields use `format: "sdd-ref"` and are hidden in the Details tab (shown in Dependency Graph instead).

### Single Reference
```json
"parentId": {
  "type": "string",
  "format": "sdd-ref",
  "x-refTargets": ["Requirement"],
  "displayName": "Parent Requirement"
}
```

### Array of References
```json
"realizesFeatureIds": {
  "type": "array",
  "items": {
    "type": "string",
    "format": "sdd-ref",
    "x-refTargets": ["Feature"]
  },
  "displayName": "Realizes Features"
}
```

---

## Summary of Custom Schema Properties

| Property | Purpose | Example |
|----------|---------|---------|
| `displayHint` | UI rendering hint | `"chips"`, `"multiline"` |
| `displayName` | Human-readable field name | `"Realizes Features"` |
| `enumDescriptions` | Tooltips for enum values | `{ "draft": "..." }` |
| `x-refTargets` | Valid entity types for reference | `["Feature", "Requirement"]` |
