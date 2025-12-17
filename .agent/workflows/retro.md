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

## Step 2: Generate Process Improvements

For each friction point, propose a solution with impact assessment:

```markdown
## Process Improvements

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

## Step 2.5: Architectural & Code Improvements

**IMPORTANT**: Beyond process fixes, identify **code and architecture improvements** that would make future development easier. These should be:
- **Generic** (not task-specific)
- **Reusable** (benefits multiple future features)
- **Foundational** (improves reasoning about the code)

```markdown
## Architectural Improvements

### Patterns & Abstractions
| Pattern | Current State | Suggested Improvement | Benefit |
|---------|---------------|----------------------|---------|
| [e.g., Error handling] | Ad-hoc try/catch | Centralized Result type | Consistent error flow |
| [e.g., API responses] | Varied formats | Standardized envelope | Predictable parsing |

### Refactoring Opportunities
- [ ] **[Component/Module]**: [What could be simplified or extracted]
  - Current: [How it works now]
  - Proposed: [How it should work]
  - Impact: [Why this helps future development]

### Code Modernization
- [ ] **[Area]**: [What could be updated]
  - E.g., "Replace callback pattern with async/await"
  - E.g., "Extract shared types to dedicated package"
  - E.g., "Add discriminated unions for state management"

### Missing Abstractions
- [ ] **[Abstraction Name]**: [What's missing that would help]
  - E.g., "Shared test fixtures for entity creation"
  - E.g., "Response builder for consistent API formats"
  - E.g., "Schema-driven form field sizing (already done!)"
```

### Questions to Ask Yourself:

1. **Did I repeat similar code?** → Extract to shared utility
2. **Did I struggle to understand flow?** → Add types or documentation
3. **Did I have to look up the same thing twice?** → Create helper or constant
4. **Was error handling inconsistent?** → Standardize pattern
5. **Did tests require too much setup?** → Extract fixture helpers
6. **Was the API response format surprising?** → Normalize response shapes

## Step 3: Quick Wins Summary

Create a table sorted by effort/impact ratio (include both process AND architectural items):

```markdown
## Quick Wins for Next Session

| Action | Type | Effort | Impact | Priority |
|--------|------|--------|--------|----------|
| [Fix X] | Process | 5 min | Saves 10 min/session | 🔴 Do Now |
| [Add Y] | Code | 15 min | Prevents flaky tests | 🔴 Do Now |
| [Refactor Z] | Architecture | 30 min | Better DX | 🟡 Soon |
| [Extract W] | Abstraction | 1 hour | Reuse across features | 🟢 Backlog |
```

## Step 4: Propose Changes

Ask the user which improvements to implement:

```markdown
## Proposed Actions

I've identified [N] improvements ([X] process, [Y] architectural). Ranked by impact:

### Process Fixes (Quick Wins)
1. **[Most impactful]** - [One-line description]
2. **[Second most]** - [One-line description]

### Architectural Improvements (Invest for Future)
1. **[Most valuable]** - [One-line description]
2. **[Second most]** - [One-line description]

Would you like me to implement:
- [ ] All process fixes now
- [ ] Process + one architectural item
- [ ] Specific items (list numbers)
- [ ] Add architectural items to IMPLEMENTATION_TRACKER.md
```

## Step 5: Document for Future

If approved, also update relevant documentation:
- `AGENTS.md` - Add to Common Pitfalls if it's a recurring issue
- `.agent/workflows/` - Create new workflow if it's a repeatable process
- `IMPLEMENTATION_TRACKER.md` - Add architectural improvements as tasks
- `packages/*/README.md` - Document new patterns or abstractions

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
- [ ] Repeated code that could be extracted
- [ ] Inconsistent patterns across similar components

### Architecture & Design
- [ ] Missing abstractions (had to write boilerplate)
- [ ] Tight coupling (change in one place requires changes elsewhere)
- [ ] Inconsistent API response formats
- [ ] Missing shared types or interfaces
- [ ] Complex code that could be simplified
- [ ] Features that would benefit from extraction to separate package

### Documentation
- [ ] Missing "gotchas" in AGENTS.md
- [ ] Outdated instructions
- [ ] Missing workflow for common tasks
- [ ] Undocumented patterns or conventions

### Session Management
- [ ] Context not preserved between sessions
- [ ] Unclear handover information
- [ ] Repeated work across sessions
