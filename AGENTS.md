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
| **Terminology** | [.agent/docs/terminology.md](.agent/docs/terminology.md) |
| **Project Structure & Build** | [.agent/docs/architecture/project-structure.md](.agent/docs/architecture/project-structure.md) |
| **React Development** | [.agent/docs/architecture/react-patterns.md](.agent/docs/architecture/react-patterns.md) |
| **Schema Authoring** | [.agent/docs/schema/schema-authoring-guide.md](.agent/docs/schema/schema-authoring-guide.md) |
| **UI Layout Guidelines** | [.agent/docs/ui/layout-guidelines.md](.agent/docs/ui/layout-guidelines.md) |
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
2. **MANDATORY UI validation before completion**: For ANY visual change, you MUST:
   - ✅ Verify dev server is running (`curl -s http://localhost:5173/`)
   - ✅ Use `browser_subagent` to navigate to the affected component
   - ✅ Take a screenshot PROVING the change works
   - ✅ Report with visual evidence, not assumptions
   - ❌ Never skip this because it "seems simple"
   - ❌ Never batch multiple changes without validating each
3. **CSS-first for UI**: Add CSS classes before JSX, use design system variables
4. **Commit incrementally**: Don't accumulate large changesets
5. **Test before commit**: Run `pnpm test` (and `pnpm test:e2e` for UI changes)
6. **Generate visual mockups for UI proposals**: When proposing UI changes with multiple options, proactively generate image mockups using the image generation tool (Gemini 3 Pro) to show each option visually before implementation. This enables informed decision-making.
7. **Test-Driven Bug Fixing**: When fixing a bug, ALWAYS write unit tests to prevent regressions:
   - **For utility functions/data logic**: Write tests that would have caught the bug
   - **For CSS layout fixes**: Write tests that assert the critical CSS property (e.g., `display: grid` not `flex`). Read the CSS file and check properties. See `RjsfStyles.test.ts` for the pattern.
   - Fix the bug
   - Verify tests pass
   - This prevents regressions and documents expected behavior
8. **Implement Now, Don't Defer**: When the user expresses interest in a feature or asks "what do you think about X?", **always offer to implement it now**. NEVER suggest "add to IMPLEMENTATION_TRACKER for later". The tracker is for the user's own backlog management, not for agent-suggested deferrals. If you think the feature is complex, break it into phases and offer to start with phase 1.
9. **Notify User After Every Response**: At the END of every message you send, you MUST trigger a notification:
   ```bash
   /usr/local/bin/codex-notify '{"type": "agent-turn-complete", "last-assistant-message": "[Gemini] Brief summary of what was done"}'
   ```
   This alerts the user that you've completed your response. **No exceptions** - always notify at the end of every turn.


---

## UI Change Proposal Workflow

When proposing any UI change with multiple viable approaches:

1. **Generate visual mockups** for each option using image generation
2. **Label clearly** (Option 1, Option 2, etc.) with brief descriptions
3. **Show in chat** so user can compare visually
4. **Wait for user decision** before implementing
5. **After implementation**, use browser_subagent with before/after screenshots to validate

**Applies to:**
- Layout changes (horizontal vs vertical, grid vs list)
- Typography choices (font sizes, weights, colors)
- Color schemes and theming
- Component styling variations
- Field treatment options (plain vs boxed, badges vs text)

---

## Architectural-First Option Presentation

When presenting multiple implementation options to the user, **always apply architectural-first reasoning**:

1. **Analyze each option** against key architectural concerns:
   - **SSOT (Single Source of Truth)**: Which option maintains clearer data ownership?
   - **Separation of Concerns**: Which keeps responsibilities properly divided?
   - **Pattern Consistency**: Which follows established patterns in the codebase?
   - **Propagation/Reuse**: Which option benefits from existing infrastructure?

2. **Present a comparison table** showing how options fare on each concern

3. **Make a clear recommendation** for which option is architecturally better, with justification

4. **Then ask for user input**, but lead with the better choice

**Example format:**
```
| Concern               | Option A | Option B |
|-----------------------|----------|----------|
| Pattern Consistency   | ⚠️       | ✅       |
| SSOT                  | ⚠️       | ✅       |
| Separation of Concerns| ❌       | ✅       |

**Recommendation**: Option B is architecturally better because...

Would you like me to implement Option B?
```

**Do NOT** present options neutrally without a recommendation. The user relies on your architectural judgment.

### ⚠️ Anti-Patterns to AVOID

| Don't Do This | Why It's Wrong | Do This Instead |
|---------------|----------------|-----------------|
| Recommend "keep current" because it's already implemented | This is the **lazy path** disguised as pragmatism | Recommend the architecturally correct option |
| Suggest "document as pitfall" for fixable issues | Pitfalls are for external/unfixable problems only | Fix the underlying issue |
| Default to "less refactoring" as a recommendation criterion | Implementation effort is NOT an architectural concern | Focus on SSOT, separation of concerns, pattern consistency |
| Say "Option B for now, Option A later" | Deferred architectural debt compounds | Recommend Option A, let user decide on timing |

**The user is paying for architectural judgment, not path-of-least-resistance suggestions.**


---

## Reusable Patterns & Snippets

Reusable code patterns are stored in `.agent/snippets/`:

| Snippet | Description |
|---------|-------------|
| `mcp-patterns.md` | MCP tool registration patterns |
| `debug-recipes.md` | Debugging patterns, jq/JS snippets |

When you discover a reusable pattern, add it to snippets for future sessions.

---

## CSS Modern Patterns

### Using :has() for Conditional Styling

**Problem**: Need to hide a pseudo-element (::before, ::after) when a specific child element is present.

**Solution**: Use the `:has()` CSS selector (supported in all modern browsers as of 2023):

```css
/* Default: show bullet point */
.listItem::before {
    content: '•';
    color: var(--color-accent);
}

/* Hide bullet when custom marker span is present */
.listItem:has(.customMarker)::before {
    content: none;
}
```

**Why not use classes?** Dynamic classes (like `.hasCustomIndicator`) require JavaScript to add/remove them, and don't work with CSS Modules well. `:has()` works purely in CSS based on DOM structure.

**Other uses for :has()**:
- Style parent based on child state: `.field:has(input:focus) { border-color: blue; }`
- Hide empty containers: `.list:has(:empty) { display: none; }`
- Conditional layout: `.card:has(img) { grid-template-columns: 1fr 2fr; }`
