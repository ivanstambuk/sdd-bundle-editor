# Bypassing RJSF Internal Schema Caching

**Context:** React JSON Schema Form (RJSF) instances utilize AJV validators underneath to evaluate incoming entity data against JSON schemas. By default, AJV aggressively caches previously compiled schemas globally, indexed by their `$id` payload properties. 
If an AI agent or developer edits the actual `schema.json` block on disk dynamically (such as during hot module reloads) but does not change the `$id` field itself, the Dev Server frontend UI will remain stuck rendering the old schema definition and validation rules natively, even if HTTP responses from the backend successfully deliver the updated structure. 

## The Fix Pattern (AJV Pointer Identifications)

When applying `schema` mappings manually using `customizeValidator()` outside of generic component hierarchies, ensure the validator wrapper evaluates the schema object pointer internally. 

### Correct Pattern:
Use a `useMemo` block intrinsically tied to the `schema` variable identifier whenever passing the payload downstream into `<Form>`. The underlying `JSON.parse` executing in the background fetch will provide a fresh heap object ID, destroying the cache mapping appropriately constraints.

```tsx
// Inside Component Logic
const schema = bundle.schemas?.[entity.entityType];

// Wrap AJV validation construction alongside the schema identity scope
const validator = useMemo(() => customizeValidator({
  ajvOptionsOverrides: {
    keywords: ['x-sdd-displayHint', 'x-sdd-layout'] // etc
  },
}), [schema]);

// Bind to physical Form component explicitly
<Form
  schema={schema}
  validator={validator}
/>
```

This ensures the UI instantly redraws new required fields, descriptions, and dynamic schema layout extensions without mandating hard browser refresh workflows or full caching re-runs from scratch.
