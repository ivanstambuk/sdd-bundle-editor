---
description: Conduct a structured retrospective to identify delivery improvements
---

# Retrospective Workflow

Use this workflow when:
- The user says `/retro` or "retrospective"
- You've spent significant time (>30 min) on a task that could have been faster
- Multiple iterations were needed to fix something
- Before context exhaustion (proactively)
- At the end of a long session

## Step 1: Identify Friction Points

Review the session and identify what caused delays or extra iterations:

```markdown
## Friction Points Identified

| Issue | Time Lost | Root Cause |
|-------|-----------|------------|
| [e.g., Tests hung in watch mode] | ~10 min | vitest default config |
| [e.g., Entity ID not found] | ~15 min | Hardcoded ID in test |
| [e.g., Forgot to rebuild] | ~5 min | No pre-build in E2E |
```

## Step 2: Generate Improvement Suggestions

For each friction point, propose a solution with impact assessment:

```markdown
## Improvement Suggestions

### 🔴 Priority 1: High Impact, Easy to Implement

#### 1. [Improvement Name]
**Problem**: [What went wrong]
**Solution**: [Specific fix]
**Files to Change**: [List of files]
**Effort**: [5 min / 15 min / 30 min / 1 hour]
**Impact**: [Saves X min per session / Prevents Y type of bugs]

### 🟡 Priority 2: Medium Impact, Moderate Effort

#### 2. [Improvement Name]
...

### 🟢 Priority 3: Nice-to-Have, Future Optimization

#### 3. [Improvement Name]
...
```

## Step 3: Quick Wins Summary

Create a table sorted by effort/impact ratio:

```markdown
## Quick Wins for Next Session

| Action | Effort | Impact | Priority |
|--------|--------|--------|----------|
| [Fix X] | 5 min | Saves 10 min/session | 🔴 Do Now |
| [Add Y] | 15 min | Prevents flaky tests | 🔴 Do Now |
| [Update Z] | 30 min | Better DX | 🟡 Soon |
```

## Step 4: Propose Changes

Ask the user which improvements to implement:

```markdown
## Proposed Actions

I've identified [N] improvements. Ranked by impact:

1. **[Most impactful]** - [One-line description]
2. **[Second most]** - [One-line description]
3. **[Third most]** - [One-line description]

Would you like me to implement:
- [ ] All of them now
- [ ] Just Priority 1 (quick wins)
- [ ] Specific items (list numbers)
- [ ] Save to PENDING_IMPROVEMENTS.md for next session
```

## Step 5: Document for Future

If approved, also update relevant documentation:
- `AGENTS.md` - Add to Common Pitfalls if it's a recurring issue
- `.agent/workflows/` - Create new workflow if it's a repeatable process
- `IMPLEMENTATION_TRACKER.md` - Add as a task if it needs tracking

---

## Categories to Check

When doing a retrospective, scan for issues in these categories:

### Build & Test
- [ ] Tests running in wrong mode (watch vs run)
- [ ] Missing pre-build steps
- [ ] Flaky tests with timing issues
- [ ] Hardcoded values that should be dynamic

### Shell & Commands
- [ ] Commands hanging without output
- [ ] Missing output limiting (| tail -N)
- [ ] Commands that need explicit flags

### Code Patterns
- [ ] Type mismatches caught late
- [ ] Missing error handling
- [ ] Implicit dependencies

### Documentation
- [ ] Missing "gotchas" in AGENTS.md
- [ ] Outdated instructions
- [ ] Missing workflow for common tasks

### Session Management
- [ ] Context not preserved between sessions
- [ ] Unclear handover information
- [ ] Repeated work across sessions
