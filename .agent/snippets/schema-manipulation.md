# Schema Manipulation Snippets

> Python patterns for batch-editing JSON schemas

## Basic Field Update

Add or modify a property on a single field:

```python
import json

with open('/path/to/schemas/Entity.schema.json', 'r') as f:
    schema = json.load(f)

props = schema['properties']
props['fieldName']['x-sdd-keyword'] = 'value'

with open('/path/to/schemas/Entity.schema.json', 'w') as f:
    json.dump(schema, f, indent=2)

print("Done!")
```

## Add Keyword to Multiple Fields

```python
import json

with open('/path/to/schemas/Entity.schema.json', 'r') as f:
    schema = json.load(f)

props = schema['properties']

# Add prominence to multiple fields
field_prominence = {
    'problem': ('primary', 'The Problem', '❓'),
    'context': ('secondary', 'The Context', '🧭'),
    'decision': ('hero', 'The Decision', '✅'),
}

for field, (level, label, icon) in field_prominence.items():
    if field in props:
        props[field]['x-sdd-prominence'] = level
        props[field]['x-sdd-prominenceLabel'] = label
        props[field]['x-sdd-prominenceIcon'] = icon

with open('/path/to/schemas/Entity.schema.json', 'w') as f:
    json.dump(schema, f, indent=2)

print("Done!")
```

## Remove Keyword from Field

```python
import json

with open('/path/to/schemas/Entity.schema.json', 'r') as f:
    schema = json.load(f)

props = schema['properties']

# Remove a keyword if it exists
if 'x-sdd-layoutGroup' in props['fieldName']:
    del props['fieldName']['x-sdd-layoutGroup']

with open('/path/to/schemas/Entity.schema.json', 'w') as f:
    json.dump(schema, f, indent=2)
```

## Add Enum Styles

```python
import json

with open('/path/to/schemas/Entity.schema.json', 'r') as f:
    schema = json.load(f)

props = schema['properties']

props['status']['x-sdd-enumStyles'] = {
    'draft': {'color': 'neutral'},
    'proposed': {'color': 'info'},
    'accepted': {'color': 'success'},
    'deprecated': {'color': 'warning'},
    'superseded': {'color': 'error'}
}

with open('/path/to/schemas/Entity.schema.json', 'w') as f:
    json.dump(schema, f, indent=2)
```

## Move Fields to Header

```python
import json

with open('/path/to/schemas/Entity.schema.json', 'r') as f:
    schema = json.load(f)

props = schema['properties']

header_fields = ['createdDate', 'lastModifiedDate', 'lastModifiedBy', 'status', 'confidence']

for field in header_fields:
    if field in props:
        props[field]['x-sdd-displayLocation'] = 'header'
        # Remove from layout group since it's in header now
        if 'x-sdd-layoutGroup' in props[field]:
            del props[field]['x-sdd-layoutGroup']

with open('/path/to/schemas/Entity.schema.json', 'w') as f:
    json.dump(schema, f, indent=2)
```

## List All Fields with a Keyword

```python
import json

with open('/path/to/schemas/Entity.schema.json', 'r') as f:
    schema = json.load(f)

props = schema['properties']

for field, config in props.items():
    if 'x-sdd-prominence' in config:
        print(f"{field}: {config['x-sdd-prominence']}")
```

---

## Tips

1. **Always use `indent=2`** for readable output
2. **Check if key exists** before deleting: `if 'key' in props[field]: del props[field]['key']`
3. **Print confirmation** at the end so you know it worked
4. **Use absolute paths** to the schema file
