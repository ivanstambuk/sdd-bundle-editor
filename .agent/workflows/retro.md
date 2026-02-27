---
description: Session retrospective, process improvements, and handover — combined
---

# /retro — Retrospective & Session Handover

**This workflow replaces `/handover`.** Run at the end of every session or after completing a significant milestone.

Use when:
- The user says `/retro`, `/handover`, "retrospective", or "session handover"
- You've spent significant time (>30 min) on a task that could have been faster
- Multiple iterations were needed to fix something
- Before context exhaustion (proactively)
- At the end of a long session

---

## Step 1: Verification & Git
// turbo
- Run `git status` to check for uncommitted changes.
- Commit all meaningful work if not already done.
- Format: `feat(sdd): T-XXX title` or `fix:` / `chore:` / `docs:`

---

## Step 2: Identify Friction Points

Review the session and identify what caused delays or extra iterations:

```markdown
## Friction Points Identified

| Issue | Time Lost | Root Cause |
|-------|-----------|------------|
| [e.g., Tests hung in watch mode] | ~10 min | vitest default config |
| [e.g., Entity ID not found] | ~15 min | Hardcoded ID in test |
| [e.g., Forgot to rebuild] | ~5 min | No pre-build in E2E |
```

---

## Step 3: Generate Improvements

For each friction point, propose a solution:

```markdown
## Process Improvements

### 🔴 Priority 1: High Impact, Easy to Implement

#### 1. [Improvement Name]
**Problem**: [What went wrong]
**Solution**: [Specific fix]
**Files to Change**: [List of files]
**Effort**: [5 min / 15 min / 30 min]

### 🟡 Priority 2: Medium Impact
...
```

---

## Step 3.5: Architectural & Code Improvements

**⚠️ ARCHITECTURAL-FIRST PRINCIPLE**: Recommend the correct solution, NOT the laziest one.

```markdown
## Architectural Improvements

### Patterns & Abstractions
| Pattern | Current State | Suggested Improvement | Benefit |
|---------|---------------|----------------------|---------|
| [e.g., Error handling] | Ad-hoc try/catch | Centralized Result type | Consistent error flow |

### Refactoring Opportunities
- [ ] **[Component/Module]**: [What could be simplified]

### Missing Abstractions
- [ ] **[Abstraction Name]**: [What's missing that would help]
```

Questions to ask yourself:
1. **Did I repeat similar code?** → Extract to shared utility
2. **Did I struggle to understand flow?** → Add types or documentation
3. **Did I have to look up the same thing twice?** → Create helper or constant
4. **Was error handling inconsistent?** → Standardize pattern
5. **Did tests require too much setup?** → Extract fixture helpers

---

## Step 3.6: Snippet Extraction

Identify patterns worth saving for reuse (must meet at least one):
- Took >1 attempt to create correctly
- Used 2+ times in this session
- Complex enough to think about again
- Project-specific convention

```markdown
## Snippets to Extract

| Snippet | Category | Destination |
|---------|----------|-------------|
| [MCP envelope unwrapper] | TypeScript | .agent/snippets/response-patterns.md |
| [Dynamic entity selection] | E2E Test | .agent/snippets/test-patterns.md |
```

---

## Step 3.7: Fixable Issues (NOT Pitfalls!)

For each issue: **"Can I fix this now?"**
- **YES** → Fix it now as a Quick Win
- **NO** (external dependency, major refactor) → Document as pitfall

**NEVER document a pitfall for something you CAN fix.**

---

## Step 4: All Improvements — Flat List

**⚠️ DO NOT SORT OR FILTER** — present everything, let the user decide.

```markdown
## All Improvements Identified

| # | Improvement | Type | Effort | Description |
|---|-------------|------|--------|-------------|
| 1 | [Item name] | Process | ~X min | [What it fixes] |
| 2 | [Item name] | Code | ~X min | [What it fixes] |
| 3 | [Item name] | Docs | ~X min | [What it fixes] |
```

---

## Step 5: Propose & Implement

**CRITICAL RULES:**
1. List ALL items — no filtering, no priority sorting
2. Only two options: "Implement ALL" or "Specific items"
3. Use numbered list (NOT checkboxes — causes strikethrough rendering)

```markdown
## Proposed Actions

I've identified [N] improvements:

1. **[Item]** - [description] (~X min)
2. **[Item]** - [description] (~X min)

**Total estimated time**: ~X minutes

Would you like me to:
1. **Implement ALL now** (recommended)
2. **Specific items only** — tell me which numbers
```

When implementing: actually write the code/tests/docs. Do NOT just add tasks to a tracker.

Update relevant files:
- `.agent/snippets/` — Add code patterns
- `AGENTS.md` — Add rules or gotchas
- `.agent/workflows/` — Add workflows for repeatable processes
- `packages/*/README.md` — Document patterns
- `IMPLEMENTATION_TRACKER.md` — Mark progress

---

## Step 6: Kill Stale Playwright & Clean Recordings
// turbo
```bash
PW_PIDS=$(pgrep -f "ms-playwright/chromium.*ag-cdp" 2>/dev/null)
if [ -n "$PW_PIDS" ]; then
  COUNT=$(echo "$PW_PIDS" | wc -l)
  echo "⚠️  Killing $COUNT stale Playwright Chrome processes"
  kill $PW_PIDS 2>/dev/null; sleep 1; kill -9 $PW_PIDS 2>/dev/null
  echo "✅ Playwright Chrome cleaned"
else
  echo "✅ No stale Playwright Chrome processes"
fi
rm -rf ~/.gemini/antigravity/browser_recordings/* 2>/dev/null && echo "🧹 Cleaned browser recordings" || true
```
Playwright renderers survive the agent session and burn 15-30% CPU per tab. Browser recordings can grow to 30GB+. Both safe to clean at session end.

---

## Step 7: Session Handover (replaces `/handover`)

**This step replaces the old `/handover` workflow.** Always run as part of retro — never separately.

### 7a. Update IMPLEMENTATION_TRACKER.md
// turbo
- Mark completed tickets as `[DONE]`
- Update Phase statuses (e.g., `(In Progress)` → `(Completed YYYY-MM-DD)`)
- Add a "Last Session" summary at the top if the file has one

### 7b. Handle pending-task.md

**File**: `.agent/session/pending-task.md`

**If the current task is COMPLETE:**
```bash
rm -f .agent/session/pending-task.md
```
The `/init` workflow will read `IMPLEMENTATION_TRACKER.md` to find the next task.

**If work is INCOMPLETE** (stopping mid-task), create/update `pending-task.md`:
> ⚠️ HARD CAP: 100 LINES MAXIMUM

```markdown
# Session Context
<!-- MAX 100 LINES -->

## Current State

- **Focus**: [1-2 sentences: what we're working on]
- **Next**: [the ONE thing to do when resuming]
- **Status**: [In Progress / Blocked / Ready]
- **Phase**: [Phase N, Task N.X]

## Key Files

- `path/to/file1.tsx` — [why relevant]
- `path/to/file2.ts` — [why relevant]
(max 7 files)

## Context Notes

Things git commits don't capture:
- [Decision made and why]
- [Gotcha discovered]
- [Thing tried that didn't work]

## Quick Start

```bash
cd ~/dev/sdd-bundle-editor && pnpm dev
# MCP server on :3003, web on :5174
# Then: [what to test/verify]
```
```

### 7c. Commit & Push All Session Work
// turbo
```bash
git add -A && git status
git commit -m "docs: session handover + retro improvements

Retro:
- [improvements implemented]

Handover:
- [next task or 'all tasks complete']" && git push
```

### 7d. Final Report to User

```
✅ Session closed.
- IMPLEMENTATION_TRACKER.md updated
- Retro improvements: [N implemented]
- Pending task: [deleted ✅ / updated at .agent/session/pending-task.md]

Next session: Run /init to resume.
```

---

## Categories to Check

### Build & Test
- [ ] Tests running in wrong mode (watch vs run)
- [ ] Missing pre-build steps
- [ ] Flaky tests with timing issues
- [ ] Hardcoded values that should be dynamic

### MCP & Schema
- [ ] MCP tools returning unexpected shapes
- [ ] Schema out of sync with bundle-type.json
- [ ] Missing resource completions
- [ ] Tool error messages helpful to AI clients?

### Code Patterns
- [ ] Type mismatches caught late
- [ ] Missing error handling
- [ ] Repeated code that could be extracted
- [ ] Inconsistent patterns across similar components

### Architecture & Design
- [ ] Missing abstractions (had to write boilerplate)
- [ ] Tight coupling between packages
- [ ] Inconsistent API response formats
- [ ] Complex code that could be simplified

### Browser Testing
- [ ] Chrome CDP connection issues → `systemctl --user restart chrome-cdp.service`
- [ ] Tab accumulation → clean with Step 6
- [ ] Wrong port usage

### Documentation
- [ ] Missing gotchas in AGENTS.md
- [ ] Outdated port references
- [ ] Missing workflow for newly repeatable tasks
- [ ] IMPLEMENTATION_TRACKER.md stale?

### CSS Regressions
- [ ] `pointer-events: none` blocking hover/click?
- [ ] Layout-breaking CSS changes?
- [ ] When fixing a CSS bug → add regression test:
  ```typescript
  // Example regression test
  import { readFileSync } from 'fs';
  const css = readFileSync(resolve(__dirname, './Component.module.css'), 'utf-8');
  it('pointer-events should allow interactions', () => {
      expect(css).toMatch(/pointer-events\s*:\s*auto/);
  });
  ```

---

**Verification Checklist**:
- [ ] All completed tickets marked `[DONE]` in IMPLEMENTATION_TRACKER.md
- [ ] `pending-task.md` updated or deleted
- [ ] Stale Playwright processes killed, recordings cleared
- [ ] All changes committed and pushed