---
description: Prime agent with project context for efficient task execution
---

# /init - Session Initialization

// turbo-all

Prime the AI agent with project context at session start. This reduces context-fetching overhead for subsequent tasks.

---

## 1. Read Core Documentation

Read `AGENTS.md` for operational guidelines and quick reference.

Then read `.agent/docs/pitfalls/common-pitfalls.md` for common mistakes to avoid.

---

## 2. Check Available Workflows and Snippets

```bash
ls -la .agent/workflows/
ls -la .agent/snippets/
```

Skim the available workflows so you know what's available (e.g., `/retro`, `/handover`, `/debug-e2e`).

---

## 3. Review Project Structure

```bash
ls -la packages/
ls -la apps/
ls -la e2e/
```

Understand the monorepo layout: core packages, apps, and test directories.

---

## 4. Check for Uncommitted Changes

```bash
git status
```

If there's WIP from a previous session, note it and ask the user if they want to continue or start fresh.

---

## 5. Check Dependency Freshness

```bash
pnpm outdated 2>/dev/null || echo "Run 'pnpm install' first"
```

Review the output for outdated dependencies, especially:
- **Critical**: `@modelcontextprotocol/sdk` (MCP SDK - may contain important fixes/features)
- **Important**: `zod`, `ajv`, `react`, `typescript`
- **Low priority**: Dev dependencies, testing tools

If major/minor updates are available for critical packages, **suggest upgrading** with:
```markdown
⚠️ **Outdated Dependencies Detected:**
- `@modelcontextprotocol/sdk`: X.X.X → Y.Y.Y (current → latest)

Would you like me to upgrade these before we proceed?
```

---

## 6. Confirm Sample Bundle Path

```bash
echo "Sample bundle: ${SDD_SAMPLE_BUNDLE_PATH:-/home/ivan/dev/sdd-sample-bundle}"
ls -la ${SDD_SAMPLE_BUNDLE_PATH:-/home/ivan/dev/sdd-sample-bundle}/ 2>/dev/null || echo "Sample bundle not found at default path"
```

Note the sample bundle location for E2E tests and CLI validation.

---

## 7. Run Quick Test Baseline (Optional)

```bash
pnpm test:smoke
```

Verify everything works before starting. Skip if you need to start immediately.

---

## 8. Read MCP Documentation (If MCP Work Expected)

If the task involves MCP server changes, read `packages/mcp-server/README.md` for tool documentation.

---

## 9. Review Knowledge Items

Check the KI summaries provided at conversation start. Read relevant KI artifacts if they match the expected work area.

---

## After Initialization

Provide a brief summary:

```markdown
## Context Loaded ✓

- **AGENTS.md**: Read (X common pitfalls noted)
- **Workflows**: [list available]
- **Git status**: [clean / uncommitted changes]
- **Dependencies**: [all up-to-date / X packages outdated]
- **Sample bundle**: [path confirmed]
- **Test baseline**: [passed / skipped]

Ready for your task!
```

Then wait for the user's instructions.

