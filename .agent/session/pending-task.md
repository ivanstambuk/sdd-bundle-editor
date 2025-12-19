# Pending Task: Implement MCP Completions

**Created**: 2025-12-19
**Status**: Ready to Start
**Priority**: Medium

---

## Task: Implement MCP Completions for Resource Templates and Prompts

### Context

The SDD Bundle MCP Server needs to implement the `completion/complete` capability to provide
autocompletion suggestions for:

1. **Resource template variables**: `bundleId`, `entityType`, `entityId`
2. **Prompt arguments**: `bundleId`, `entityType`, `entityId`, etc.

### MCP Completions Standard

- **Specification**: 2025-11-25 (Current, stable)
- **SDK Version**: @modelcontextprotocol/sdk v1.25.1 (already upgraded)
- **Capability**: Server must declare `{ completions: {} }` in capabilities

### Protocol Summary

Request (`completion/complete`):
```json
{
  "ref": { "type": "ref/resource", "uri": "bundle://{bundleId}/entity/{type}/{id}" },
  "argument": { "name": "bundleId", "value": "sdd" },
  "context": { "arguments": {} }
}
```

Response:
```json
{
  "completion": {
    "values": ["sdd-sample-bundle", "another-bundle"],
    "total": 2,
    "hasMore": false
  }
}
```

### Where to Implement

1. **Resource templates** in `packages/mcp-server/src/server.ts`:
   - `bundle://{bundleId}/manifest`
   - `bundle://{bundleId}/entity/{type}/{id}`
   - `bundle://{bundleId}/schema/{type}`

2. **Prompts** in `packages/mcp-server/src/prompts/*.ts`:
   - All prompts have `bundleId` argument (11 prompts across 4 files)
   - Some have `entityType`, `entityId` arguments

### SDK API (from v1.25.1)

The `ResourceTemplate` class accepts a `complete` option:
```typescript
new ResourceTemplate("bundle://{bundleId}/entity/{type}/{id}", {
    list: undefined,
    complete: {
        bundleId: () => Array.from(bundles.keys()),
        type: ({ bundleId }) => {
            const loaded = bundles.get(bundleId);
            return loaded ? Array.from(loaded.bundle.entities.keys()) : [];
        },
        id: ({ bundleId, type }) => {
            const loaded = bundles.get(bundleId);
            return loaded ? Array.from(loaded.bundle.entities.get(type)?.keys() || []) : [];
        }
    }
})
```

For prompts, use `completable()` wrapper (check SDK docs for exact API).

### Testing

Use MCP Inspector to test completions:
```bash
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js /home/ivan/dev/sdd-sample-bundle
```

### Files to Modify

- `packages/mcp-server/src/server.ts` - Resource templates
- `packages/mcp-server/src/prompts/analysis.ts` - 3 prompts
- `packages/mcp-server/src/prompts/documentation.ts` - 3 prompts
- `packages/mcp-server/src/prompts/quality.ts` - 3 prompts
- `packages/mcp-server/src/prompts/implementation.ts` - 2 prompts

### Definition of Done

- [x] Server declares `completions` capability (automatic via SDK when complete callbacks registered)
- [x] Resource templates provide completions for bundleId, type, id
- [x] Prompts provide completions for their arguments
- [ ] Tested with MCP Inspector
- [x] All existing tests still pass

### Reference Documentation

- MCP Completion Spec: https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion
- MCP Server README: `packages/mcp-server/README.md`
- Run `/init` first to load project context
