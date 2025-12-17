---
description: Generate session handover summary for next agent
---

# Session Handover Workflow

Use this workflow when:
- The user says `/handover`, "session handover", or "handoff"
- You're ending a session and need to preserve context
- Context is getting exhausted and work needs to continue later

## Handover Process

### Step 1: Generate Handover Summary

Output this as a **single Markdown code block** in your chat message:

```markdown
# Session Handoff

## 1. Core Context
- **Project**: SDD Bundle Editor (Monorepo: React UI, Fastify Backend, TypeScript Core)
- **Goal**: [Current high-level goal, e.g. "Polishing Agent Panel UI"]
- **Repository State**: `[Clean/Dirty]` (Branch: `[main/feature]`)
- **Context Source**: Read @[AGENTS.md] for protocols and `IMPLEMENTATION_TRACKER.md` for backlog.

## 2. Recent Changes (This Session)
- **Implemented**:
  - [Feature A]: [Brief description]
  - [Feature B]: [Brief description]
- **Fixed**:
  - [Bug X]: [Description]
- **Verified**:
  - [Test Suite]: `pnpm test` [Pass/Fail]
  - [E2E Tests]: `pnpm test:e2e` [Pass/Fail]
  - [Visuals]: Screenshots in `artifacts/` [Check/Skip]

## 3. Current State & Pending Scope
- **Active Task**: [What was in progress?]
- **Pending / Next Up**:
  - [Task 1]
  - [Task 2]
- **Known Issues**:
  - [Issue Description]

## 4. Operational Notes (For Next Agent)
- **Environment**: Node 18+, pnpm, Linux.
- **Gotchas**:
  - [e.g. "Do not use browser_subagent"]
  - [e.g. "Run pnpm build after TS changes"]
- **Wasted Time / Lessons**:
  - [e.g. "Spent time debugging X, solution was Y"]

## 5. Immediate Action Items
1. [First thing to do in next session]
2. [Second thing]
```

### Step 2: Run Retrospective

After the handover code block, run the `/retro` workflow to identify improvements:

```markdown
## Quick Wins for Next Session

| Action | Effort | Impact | Priority |
|--------|--------|--------|----------|
| [Fix X] | 5 min | Saves 10 min/session | 🔴 Do Now |
| [Add Y] | 15 min | Prevents flaky tests | 🟡 Soon |

Would you like me to implement these now or save for next session?
```

### Step 3: Cleanup Check

Before ending, verify:
- [ ] `pnpm test` passes
- [ ] `pnpm test:e2e` passes (if UI changes)
- [ ] All changes committed
- [ ] No temp files in `artifacts/` that should be deleted

---

## Quick Handover (Minimal Format)

If time is short, use this minimal format:

```markdown
# Quick Handoff

**Goal**: [What we were working on]
**Status**: [Done/In Progress/Blocked]
**Next**: [Immediate next step]
**Files**: [Key files to look at]
**Command**: [Command to run to continue]
```

---

## Session Context Recovery

When starting a NEW session and resuming work, context artifacts from previous sessions are in:

```
/home/ivan/.gemini/antigravity/brain/<conversation-id>/
├── task.md           # Current task checklist
├── walkthrough.md    # Implementation notes  
└── implementation_plan.md  # Detailed plan
```

Find the most recent:
```bash
ls -t /home/ivan/.gemini/antigravity/brain/ | head -5
```

---

## Important Notes

1. **DO NOT create a `session_handover.md` file** - Output the handover as a code block in chat
2. **Always run `/retro`** after the handover to capture improvement opportunities
3. **Wait for user approval** before implementing any retrospective improvements
4. **Commit before handover** if there are uncommitted changes
