# SDD Bundle Editor – Implementation Tracker

This file tracks **active and planned** implementation work only.

For completed work and architecture, see:
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Core concepts, package structure, design decisions
- **[AGENTS.md](./AGENTS.md)** – Developer/agent operational guide
- **[packages/mcp-server/README.md](./packages/mcp-server/README.md)** – MCP server documentation

---

## Completed Work Summary

The following major milestones have been completed:

| Phase | Description |
|-------|-------------|
| 0-7 | Monorepo, core packages, CLI, backend, UI, testing |
| 8.1 | Conversational agent interface with speech-to-text |
| 8.3 | Change proposal/application workflow |
| 8.4 | Read-only UI mode |
| 8.6 | Testing and documentation |
| 8.8 | MCP server with tools and resources |
| 8.9 | Conformance testing (Profile rules, audit templates) |
| Infra | External bundle repository migration |

**Current state**: Full read-only UI with MCP-based AI integration. All modifications via `apply_changes` MCP tool.

---

## In Progress

### Agent Backend Implementations

- [x] `CliAgentBackend` – Spawns CLI agent process (stdin/stdout)
- [x] `HttpAgentBackend` – Calls external HTTP API (DeepSeek, OpenAI, etc.)
- [ ] `VsCodeAgentBackend` – Communicates with VS Code's integrated agent
- [ ] `McpAgentBackend` – Uses MCP for agent communication

---

## Future Work

### Richer Example Bundles
- [ ] Protocol spec bundle (e.g., EC-OPRF/FHE-style)
- [ ] Feature-based project bundle (e.g., EUDIW simulator)

### VS Code Integration
- [ ] VS Code extension for tighter agent integration than web UI

### MCP Enhancements
- [ ] Additional prompts for specialized workflows
- [ ] Cross-bundle relationship analysis
- [ ] Resource template completions (autocomplete for bundleId, entityType, id)
- [ ] Prompt argument completions using `completable()` wrapper

### UI Refactoring
- [ ] Extract `ProminenceHeader` component from CustomFieldTemplate
  - CustomFieldTemplate is ~100 lines and growing
  - Separate component for hero/primary/secondary headers
- [ ] Extract `EntityHeaderBadges` and `EntityHeaderMetadata` components
  - Currently inline in EntityDetails return
  - Would improve testability and separation
- [ ] Create `formatDateForDisplay()` utility
  - Date formatting is currently inline in header rendering
  - Reusable across UI components
- [ ] Extract `SyntaxHighlighter` component
  - Prism.js highlighting duplicated in 3 components (EntityDetails, EntityTypeDetails, BundleOverview)
  - Single component: `<SyntaxHighlighter language="yaml|json" content={content} />`
  - Centralizes Prism config, language imports, memoization

### Schema Validation
- [ ] Redundant bidirectional link detection
  - Rule: If A→B exists, B→A is redundant
  - Validate at bundle load time
  - Warn in MCP diagnostics or bundle validation
  - See "No Redundant Forward Links" rule in schema-authoring-guide.md
