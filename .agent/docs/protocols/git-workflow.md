# Git Workflow Protocol

## Commit After Functional Increments

After completing a self-contained, functional increment:

1. **Verify**: Ensure `pnpm test` passes (and `pnpm test:e2e` for UI changes)
2. **Stage**: `git add -A` (or stage specific files if preferred)
3. **Commit**: Use a descriptive commit message following conventional commits:
   - `feat: <description>` for new features
   - `fix: <description>` for bug fixes
   - `refactor: <description>` for code improvements
   - `test: <description>` for test-only changes
   - `docs: <description>` for documentation updates
4. **Don't wait**: Commit incrementally rather than accumulating large changesets

**Why this matters**: Frequent commits make it easier to review changes, revert if needed, and maintain a clear history. Don't accumulate multiple unrelated changes before committing.
