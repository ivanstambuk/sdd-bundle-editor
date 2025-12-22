# Project Paths Reference

Quick reference for important paths in the SDD Bundle Editor ecosystem.

## Sample Bundle

The demo/sample bundle lives in a **separate git repository**:

| Path | Description |
|------|-------------|
| `/home/ivan/dev/sdd-sample-bundle` | Root of sample bundle repo |
| `/home/ivan/dev/sdd-sample-bundle/schemas/` | JSON Schema files (`*.schema.json`) |
| `/home/ivan/dev/sdd-sample-bundle/bundle/` | Entity YAML files organized by type |
| `/home/ivan/dev/sdd-sample-bundle/sdd-bundle.yaml` | Bundle configuration |

### Common Schema Paths
```
/home/ivan/dev/sdd-sample-bundle/schemas/Requirement.schema.json
/home/ivan/dev/sdd-sample-bundle/schemas/ADR.schema.json
/home/ivan/dev/sdd-sample-bundle/schemas/Actor.schema.json
/home/ivan/dev/sdd-sample-bundle/schemas/Component.schema.json
/home/ivan/dev/sdd-sample-bundle/schemas/Feature.schema.json
```

### Common Entity Paths
```
/home/ivan/dev/sdd-sample-bundle/bundle/requirements/REQ-*.yaml
/home/ivan/dev/sdd-sample-bundle/bundle/adrs/ADR-*.yaml
/home/ivan/dev/sdd-sample-bundle/bundle/actors/ACT-*.yaml
```

## Editor Repository

| Path | Description |
|------|-------------|
| `/home/ivan/dev/sdd-bundle-editor` | Root of editor repo |
| `packages/ui-shell/` | Main UI components |
| `packages/core-model/` | Bundle loading/parsing |
| `packages/core-lint/` | Validation rules |
| `packages/mcp-server/` | MCP server for AI agents |
| `apps/web/` | Web application entry point |
| `e2e/` | End-to-end tests (Playwright) |

## MCP Server Configuration

```
/home/ivan/dev/sdd-bundle-editor/packages/mcp-server/bundles.example.yaml
```

This file configures which bundles the MCP server can access.
