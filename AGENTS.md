# AI Agent Guidelines

> Notes for AI agents working in this repo

This is a pnpm-based TypeScript monorepo that follows `sdd-bundle-editor-spec.md`.  
Please keep the structure and internal dependencies consistent with what is already in place.

---

## Core Architecture Principle

**"Editor is Dumb, AI is Smart"**

- AI agents own data transformations via MCP tools (especially `apply_changes`)
- UI is read-only display layer
- No imperative "create-requirement" buttons, AI proposes changes based on context
- MCP server is the single source of truth for bundle modifications

---

## Quick Reference

| Topic | Documentation |
|-------|---------------|
| **Project Structure & Build** | [.agent/docs/architecture/project-structure.md](.agent/docs/architecture/project-structure.md) |
| **React Development** | [.agent/docs/architecture/react-patterns.md](.agent/docs/architecture/react-patterns.md) |
| **Git Workflow** | [.agent/docs/protocols/git-workflow.md](.agent/docs/protocols/git-workflow.md) |
| **UI Changes Protocol** | [.agent/docs/protocols/ui-changes.md](.agent/docs/protocols/ui-changes.md) |
| **Testing Guide** | [.agent/docs/testing/testing-guide.md](.agent/docs/testing/testing-guide.md) |
| **Common Pitfalls** | [.agent/docs/pitfalls/common-pitfalls.md](.agent/docs/pitfalls/common-pitfalls.md) |
| **MCP Tool Patterns** | [.agent/snippets/mcp-patterns.md](.agent/snippets/mcp-patterns.md) |

---

## Test Commands

| Script | Purpose |
|--------|---------|
| `pnpm test` | Run all unit tests (fast, ~15s) |
| `pnpm test:smoke` | Quick validation: MCP + core E2E (~30s) |
| `pnpm test:e2e` | Full E2E test suite (~3-5 min) |
| `pnpm test:visual` | Visual regression tests |
| `pnpm build` | Build all packages |
| `pnpm dev` | Start MCP + web + ui-shell watch |

---

## MCP Server Quick Reference

**Starting the MCP Server:**
```bash
# Stdio mode (for Claude Desktop, VS Code Copilot)
node packages/mcp-server/dist/index.js /path/to/bundle

# HTTP mode (for web clients, testing)
node packages/mcp-server/dist/index.js --http --port 3001 /path/to/bundle
```

**Key Tools:**

| Tool | Description |
|------|-------------|
| `list_bundles` | List all loaded bundles |
| `read_entity` | Read entity by type and ID |
| `apply_changes` | Atomic batch changes (create/update/delete) |
| `validate_bundle` | Validate and return diagnostics |
| `critique_bundle` | LLM-based spec quality critique |

See `packages/mcp-server/README.md` for full documentation.

---

## Workflows

Available via slash commands:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `/init` | Start of session | Prime agent with project context |
| `/handover` | End of session | Generate handover summary |
| `/retro` | After milestones | Run structured retrospective |
| `/browser-testing` | Visual validation | AI-driven browser testing |
| `/debug-e2e` | Test failures | Debug E2E with verbose logging |
| `/debug-react-state` | State issues | Systematic React debugging |
| `/e2e-tests` | New tests | How to write E2E tests |

See `.agent/workflows/` for detailed instructions.

---

## Session Context Files

| File | Purpose |
|------|---------|
| `.agent/session/pending-task.md` | Handover task for next session (delete when complete!) |
| `PENDING_IMPROVEMENTS.md` | Current session's task list |
| `IMPLEMENTATION_TRACKER.md` | Long-term backlog and roadmap |
| `.gemini/task.md` | Agent's internal task tracking |
| `.gemini/walkthrough.md` | Step-by-step implementation notes |

**At session end, ALWAYS:**
1. Update `PENDING_IMPROVEMENTS.md` with completed/remaining items
2. Commit all working changes
3. Clean up any temp files or artifacts
4. **Delete `.agent/session/pending-task.md` if the task was completed**

---

## Critical Rules

1. **Build after TypeScript changes**: Run `pnpm build` after modifying any `packages/*` source
2. **Never use `browser_subagent`**: Use Playwright E2E tests instead
3. **CSS-first for UI**: Add CSS classes before JSX, use design system variables
4. **Commit incrementally**: Don't accumulate large changesets
5. **Test before commit**: Run `pnpm test` (and `pnpm test:e2e` for UI changes)

---

## Reusable Patterns & Snippets

Reusable code patterns are stored in `.agent/snippets/`:

| Snippet | Description |
|---------|-------------|
| `mcp-patterns.md` | MCP tool registration patterns |

When you discover a reusable pattern, add it to snippets for future sessions.
