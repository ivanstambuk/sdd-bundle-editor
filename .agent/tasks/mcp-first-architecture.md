# Task: MCP-First Architecture Migration

## Overview

Migrate SDD Bundle Editor from HTTP API + Git-based agent flow to MCP-first architecture where:
- UI is **read-only** (browse entities, view details, diagnostics)
- All **writes** happen via MCP tools called by external LLMs (Claude, Copilot)
- **No Git integration** – validation happens before write, user commits externally
- Single MCP server serves both UI (via HTTP/SSE) and external agents (via stdio)

## Status: ✅ Phases 1, 2, 3, 4, 6, 7 Complete

---

## Phase 1: Add `apply_changes` MCP Tool ✅

### 1.1 Implement `apply_changes` tool in MCP server
- [x] Add tool to `packages/mcp-server/src/server.ts`
- [x] Support operations: `create`, `update`, `delete`
- [x] Accept array of changes (batch)
- [x] Validate-before-write pattern:
  - Load bundle
  - Clone to in-memory working copy
  - Apply all changes
  - Validate full bundle
  - If valid: write files
  - If invalid: return diagnostics with `changeIndex` attribution
- [x] Support `dryRun: true` for preview
- [x] Add optional `commitMessage` param (no-op for now, may be used later)

### 1.2 Update `core-model` if needed
- [x] Ensure `applyChangesToBundle` works in pure-memory mode
- [x] Ensure `saveEntity` can create directories for new entities
- [x] Add `deleteEntity` function

### 1.3 Unit tests for apply_changes
- [ ] Test valid batch apply
- [ ] Test validation failure attribution
- [ ] Test dryRun mode
- [ ] Test cascade errors (delete entity referenced elsewhere)

---

## Phase 2: Add HTTP (SSE) Transport to MCP Server ✅

### 2.1 Add SSE transport option
- [x] Add `--http` flag to MCP server CLI
- [x] Implement SSE transport alongside stdio (Streamable HTTP transport)
- [x] Expose at `/mcp` endpoint
- [x] Support both transports simultaneously (stdio for Claude, HTTP for UI)

### 2.2 Update MCP server startup
- [x] `packages/mcp-server/src/index.ts` - add HTTP mode
- [x] `packages/mcp-server/src/http-transport.ts` - HTTP transport implementation
- [x] Document new startup modes in README


---

## Phase 3: Remove Agent Routes & Git Integration ✅

### 3.1 Remove git-utils dependency from server
- [x] Remove `assertCleanNonMainBranch` calls
- [x] Remove `commitChanges` calls
- [x] Remove git rollback logic
- [x] Keep `git-utils` package (but no longer used by server)
- [x] Keep `getGitStatus()` for optional UI info display

### 3.2 Delete agent routes
- [x] Delete `apps/server/src/routes/agent.ts`
- [x] Delete `apps/server/src/routes/agent.test.ts`
- [x] Delete `apps/server/src/services/agent/` directory
- [x] Remove agent route registration from `apps/server/src/index.ts`

### 3.3 Clean up dependencies
- [x] Remove unused imports
- [x] Server still builds and runs

---

## Phase 4: Simplify UI to Read-Only ✅

### 4.1 Remove Agent Panel
- [x] Delete `packages/ui-shell/src/components/AgentPanel.tsx`
- [x] Delete `packages/ui-shell/src/components/AgentPanel.test.tsx`
- [x] Delete `packages/ui-shell/src/hooks/useAgentState.ts`
- [x] Update `AppShell.tsx` to remove agent state
- [x] Remove agent panel toggle from UI
- [x] Remove agent configuration UI

### 4.2 Remove write-related UI
- [x] Remove "Accept Changes" button
- [x] Remove "Reject Changes" button
- [x] Remove pending changes display
- [x] Remove agent message input
- [x] Add read-only banner explaining MCP usage

### 4.3 Keep read-only features
- [x] Entity Navigator (browse)
- [x] Entity Details (view)
- [x] Diagnostics display
- [x] Domain knowledge panel
- [x] Breadcrumb navigation

### 4.4 Update UI to use MCP over HTTP
- [ ] Replace `/bundle` fetch with MCP `list_bundles` + `read_entity`
- [ ] Replace `/bundle/validate` with MCP `validate_bundle`
- [ ] Update API client to speak MCP protocol

---

## Phase 5: Add MCP Test CLI (⏳ Pending)

### 5.1 Create test client
- [ ] New package or script: `packages/mcp-server/scripts/mcp-cli.ts`
- [ ] Connect to MCP server via stdio
- [ ] Interactive REPL or command-line tool calls
- [ ] Support: `apply_changes`, `read_entity`, etc.

### 5.2 Example usage
```bash
# Test apply_changes
pnpm mcp-cli apply_changes --changes '[{"operation":"update",...}]'

# Test with dryRun
pnpm mcp-cli apply_changes --dryRun --changes '[...]'
```

---

## Phase 6: Update E2E Tests ✅

### 6.1 Remove agent-related tests
- [x] Delete `e2e/agent-*.spec.ts` files (8 files)
- [x] Delete `e2e/contextual-actions.spec.ts`
- [x] Delete `e2e/qa-ui-refresh.spec.ts`
- [x] Delete `e2e/diff-view-screenshot.spec.ts`
- [x] Delete `e2e/css-spacing-validation.spec.ts`
- [x] Delete `e2e/ui-alignment-capture.spec.ts`
- [x] Delete `e2e/codex-cli-debug.spec.ts`
- [x] Delete `e2e/speech-to-text.spec.ts`

### 6.2 Update remaining tests
- [x] `e2e/basic-bundle.spec.ts` - updated
- [x] `e2e/screenshot-capture.spec.ts` - updated
- [x] `e2e/ui-modernization-desktop.spec.ts` - updated
- [x] `e2e/global-setup.ts` - removed agent setup

### 6.3 Add MCP-based tests
- [ ] Test MCP tool calls via HTTP
- [ ] Test `apply_changes` end-to-end

---

## Phase 7: Update Documentation ✅

### 7.1 Update AGENTS.md
- [x] Remove git discipline section
- [x] Update development workflow
- [x] Document MCP-first architecture
- [x] Add MCP Server section with tools table
- [x] Simplify E2E testing patterns (read-only UI)

### 7.2 Update README.md
- [x] Update architecture description
- [x] Update API endpoints (remove agent routes)
- [x] Document MCP server usage for writes
- [x] Add HTTP mode documentation

### 7.3 Update ARCHITECTURE.md
- [x] Reflect new MCP-first design
- [x] Remove agent flow diagrams
- [x] Add MCP integration section
- [x] Update UI Layout diagram

### 7.4 Update sdd-bundle-editor-spec.md
- [x] Remove git requirements section
- [x] Update AI integration section to MCP tools

---

## Acceptance Criteria

- [x] `pnpm build` succeeds
- [ ] `pnpm test` passes (unit tests) - pending unit test updates
- [x] `pnpm test:e2e` passes (updated E2E tests) - 10/10 passing
- [x] MCP server starts with HTTP transport
- [x] `apply_changes` tool works via MCP Inspector
- [x] UI loads entities in read-only mode
- [ ] External LLM (Claude/Copilot) can modify bundle via MCP
- [x] No git operations in server codebase

---

## Completed in This Session

| Phase | Items Completed |
|-------|-----------------|
| Phase 1 | `apply_changes` tool, `deleteEntity` function |
| Phase 2 | HTTP/SSE transport with `--http` flag, Streamable HTTP |
| Phase 3 | Removed all agent routes, git integration from server |
| Phase 4 | Simplified UI to read-only, removed AgentPanel |
| Phase 6 | Updated E2E tests, 10/10 passing |
| Phase 7 | Updated AGENTS.md, README.md, ARCHITECTURE.md, spec.md |

## Remaining Work

| Phase | Remaining Items |
|-------|-----------------|
| Phase 1.3 | Unit tests for apply_changes |
| Phase 4.4 | UI to use MCP protocol directly |
| Phase 5 | MCP test CLI (full phase) |
| Phase 6.3 | MCP-based E2E tests |

---

## Notes

- This is a **breaking change** – removes agent API entirely
- Users will need MCP client (Claude Desktop, Copilot) for writes
- Bundle files remain in Git repos (user manages commits)
- MCP server becomes the single source of truth for bundle operations
