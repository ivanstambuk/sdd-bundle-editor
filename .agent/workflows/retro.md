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

**⚠️ ARCHITECTURAL-FIRST PRINCIPLE**: When proposing improvements, always recommend the architecturally correct solution, NOT the laziest one. Do NOT recommend "keep current" just because it's less work. See AGENTS.md for full guidelines.

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

## Step 2.6: Snippet Extraction

**IMPORTANT**: Identify non-trivial code patterns created during this session that should be saved for reuse.

**Criteria for extraction** (must meet at least one):
- Took >1 attempt to create correctly
- Used 2+ times in this session
- Complex enough that you'd have to think about it again
- Project-specific (not general language knowledge)

**NOT worth extracting**:
- Simple one-liners (grep, sed basics)
- Standard language patterns you already know
- One-off debugging commands

```markdown
## Snippets to Extract

| Snippet | Category | Destination |
|---------|----------|-------------|
| [MCP envelope unwrapper] | TypeScript | .agent/snippets/response-patterns.md |
| [Dynamic entity selection] | E2E Test | .agent/snippets/test-patterns.md |
| [Session context finder] | Debug | .agent/snippets/debug-recipes.md |

### Snippet Details

**[Snippet Name]**
```typescript
// The actual code pattern
```
**Why save**: [Took multiple attempts / Used repeatedly / Non-obvious]
```

## Step 2.7: Fixable Issues (NOT Pitfalls!)

**CRITICAL**: For each issue identified, ask: **"Can I fix this now?"**

- If **YES** → Add to Quick Wins as a code/config fix
- If **NO** (external dependency, requires major refactor) → Document as pitfall

**NEVER document a pitfall for something you CAN fix.** Examples:

| Issue | Can Fix? | Action |
|-------|----------|--------|
| Schema and bundle-type.json out of sync | YES | Fix the code to use single source of truth |
| dev.sh doesn't clean up ports | YES | Add port cleanup to dev.sh |
| External API has wrong response format | NO | Document as pitfall (we don't control it) |
| Need to run `pnpm build` before test | YES | Add pre-build step to test script |

**Pitfalls are a LAST RESORT** for things truly outside your control.

```markdown
## Anti-Patterns (Only if Unfixable)

| Don't Do This | Because | Can We Fix It? | Fix or Pitfall |
|---------------|---------|----------------|----------------|
| [Bad pattern] | [Reason] | YES/NO | [If YES: "Fix: ..." / If NO: "Pitfall: ..."] |
```


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

**CRITICAL RULES:**
1. **Offer ALL identified items** - Every item from Quick Wins table MUST appear in proposed actions
2. **Primary option is "implement ALL now"** - User wants to fix everything by default
3. **NO BACKLOG OPTION** - Never offer to add items to IMPLEMENTATION_TRACKER. Either implement now or skip.
4. **When user says "do all" → IMPLEMENT, don't add tasks**

Ask the user which improvements to implement:

```markdown
## Proposed Actions

I've identified [N] improvements. Here's everything:

### All Items (implement now)
1. **[Item 1]** - [One-line description] (~X min)
2. **[Item 2]** - [One-line description] (~X min)
3. **[Item 3]** - [One-line description] (~X min)
...

**Total estimated time**: ~X minutes

Would you like me to:
- [ ] **Implement ALL now** (recommended)
- [ ] Skip all
- [ ] Specific items only: [list numbers]
```

**IMPORTANT**: 
- Do NOT offer "add to IMPLEMENTATION_TRACKER" as an option
- Do NOT offer partial categories (e.g., "process only", "snippets only")
- The ONLY options are: implement all, skip all, or specific item numbers
- If user says "do all" or similar → implement the actual code/tests/docs NOW

## Step 5: Implement Everything

When implementing, actually write the code/tests/docs. Do NOT just add tasks to a tracker.

Examples of what "implement now" means:
- **Test task** → Write the actual test file with test cases
- **Snippet task** → Add the snippet to debug-recipes.md
- **Doc task** → Write the documentation content
- **Refactor task** → Do the refactoring

Update relevant files:
- `.agent/snippets/` - Add code patterns
- `AGENTS.md` - Add pitfalls if recurring
- `.agent/workflows/` - Add workflows if repeatable
- `packages/*/README.md` - Document patterns

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
