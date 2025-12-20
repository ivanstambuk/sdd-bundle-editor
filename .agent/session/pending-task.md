# Pending Task: Schema Relationship Migration

## Objective

Execute the full schema relationship migration to follow the **Target-Holds-Reference** convention.

## Context

- **Convention documented**: `.agent/docs/schema/schema-authoring-guide.md` (see "Relationship Direction Convention" section)
- **Migration plan**: `.gemini/design-specs/schema-relationship-migration.md`
- **Design spec for export_context**: `.gemini/design-specs/export-context-tool.md`

## Task

1. Read the migration plan at `.gemini/design-specs/schema-relationship-migration.md`
2. Execute ALL migrations in the "Needs Migration" section (not batched - do everything in one go)
3. For each migration:
   - Add new field to target schema (use `jq` - files are in external bundle)
   - Update entity YAML files to move data (use Python with PyYAML)
   - Remove old field from source schema
4. Test: restart dev server, verify relationships display correctly in UI
5. Commit after completion

## Key Files

- **Schemas**: `/home/ivan/dev/sdd-sample-bundle/schemas/*.json`
- **Entities**: `/home/ivan/dev/sdd-sample-bundle/bundle/*/`

## After Migration

Implement the `export_context` MCP tool per `.gemini/design-specs/export-context-tool.md`

---

*Task created: 2025-12-21T00:13*
