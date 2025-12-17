# Pending Test Infrastructure Improvements

## Session Handover Prompt

Copy this into a new chat session:

```
@[AGENTS.md] @[PENDING_IMPROVEMENTS.md]

Continue the test infrastructure improvements from the previous session. The goal is to make tests faster, more reliable, and better documented.

## Already Completed
1. ✅ Fixed vitest to use `vitest run` (non-watch mode) in all 7 packages
2. ✅ Added `test:watch` for explicit watch mode
3. ✅ Added `test:smoke` and `test:e2e:smoke` scripts to root package.json
4. ✅ Added `TEST_ENTITIES` constants and `getFirstEntityId` helper to bundle-test-fixture.ts
5. ✅ Added pre-build step for MCP server in playwright.config.ts
6. ✅ Fixed flaky ui-modernization-desktop.spec.ts tests (dynamic entity selection, robust chevron test)

## Remaining Tasks

### High Priority
1. **Fix duplicate lines in playwright.config.ts** - The last edit may have introduced duplicate config lines. Verify and fix.

2. **Add response envelope type checking** - Create TypeScript types for MCP tool responses in e2e/mcp-server.spec.ts:
   ```typescript
   interface ToolResponse<T> {
     ok: boolean;
     tool: string;
     bundleId?: string;
     data: T;
     meta?: Record<string, unknown>;
     diagnostics?: unknown[];
   }
   ```

3. **Update AGENTS.md** with new sections:
   - Session context location (task.md, walkthrough.md paths)
   - Common pitfalls section
   - Auto-cleanup reminder on completion
   - Document the new test scripts

### Medium Priority
4. **Verify all tests pass** after the package.json changes:
   - `pnpm test` (should complete quickly, no watch mode)
   - `pnpm test:e2e` (full E2E suite)

5. **Commit all improvements** with message:
   `chore: improve test infrastructure (vitest run mode, smoke tests, fixtures)`

## Files Modified (uncommitted)
- package.json (root)
- packages/*/package.json (7 packages - vitest run mode)
- e2e/bundle-test-fixture.ts (TEST_ENTITIES, getFirstEntityId)
- playwright.config.ts (pre-build step)

## Verification
Run `git diff --stat` to see all changes, then run tests before committing.
```

---

## Detailed Task Breakdown

### Task 1: Fix playwright.config.ts
The last edit may have introduced duplicate `reuseExistingServer`, `stdout`, `stderr`, `timeout` lines in the MCP server config block. Check lines 43-60 and remove duplicates.

### Task 2: Add Response Envelope Types
In `e2e/mcp-server.spec.ts`, add at the top after imports:

```typescript
/**
 * Standard MCP tool response envelope
 */
interface ToolResponse<T = Record<string, unknown>> {
    ok: boolean;
    tool: string;
    bundleId?: string;
    data: T;
    meta?: Record<string, unknown>;
    diagnostics?: unknown[];
}

/**
 * Error response envelope
 */
interface ErrorResponse {
    ok: false;
    tool: string;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
```

Update `callMcpTool` return type to use these interfaces.

### Task 3: AGENTS.md Updates
Add these new sections to AGENTS.md:

```markdown
---

### Session Context Location

When resuming from a previous session, context artifacts are stored in:
```
/home/ivan/.gemini/antigravity/brain/<conversation-id>/
├── task.md           # Current task checklist
├── walkthrough.md    # Implementation notes
└── implementation_plan.md  # Detailed plan
```

Find the latest conversation:
```bash
ls -t /home/ivan/.gemini/antigravity/brain/ | head -5
```

---

### Common Pitfalls

1. **Forgot to rebuild after TS changes**
   ```bash
   pnpm --filter @sdd-bundle-editor/mcp-server build
   ```

2. **Tests hang in watch mode** - Fixed! Now use:
   - `pnpm test` - One-shot run (no watch)
   - `pnpm test:watch` - Explicit watch mode

3. **Hardcoded entity IDs in tests** - Use:
   - `TEST_ENTITIES.REQUIREMENT` for known IDs
   - `getFirstEntityId(page, 'Requirement')` for dynamic selection

4. **Shell commands produce no output** - Add `2>&1 | tail -50` to limit output

5. **MCP server dist/ stale** - E2E tests now pre-build automatically

---

### Auto-Cleanup on Session Completion

Before ending a session:
1. Run `pnpm test` to verify no regressions
2. Run `pnpm test:e2e` for UI changes
3. Commit with descriptive message
4. Clean up any temp files in artifacts/

---

### Test Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all unit tests (one-shot) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:e2e` | Run full E2E suite |
| `pnpm test:e2e:smoke` | Quick E2E smoke test (3 tests) |
| `pnpm test:smoke` | MCP unit + E2E smoke (fastest full check) |
| `pnpm test:visual` | Visual regression tests |
```

---

## Quick Reference

### Files to Check/Edit
- `/home/ivan/dev/sdd-bundle-editor/playwright.config.ts` - Fix duplicates
- `/home/ivan/dev/sdd-bundle-editor/e2e/mcp-server.spec.ts` - Add types
- `/home/ivan/dev/sdd-bundle-editor/AGENTS.md` - Add documentation

### Verification Commands
```bash
# Check for duplicate config
grep -n "reuseExistingServer" playwright.config.ts

# Verify tests work in run mode
pnpm test

# Quick smoke test
pnpm test:smoke

# See uncommitted changes
git status
```
