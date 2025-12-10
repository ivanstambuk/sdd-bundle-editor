---
description: How to implement a vision roadmap phase
---

# Phase Implementation Workflow

## Pre-flight Checks
1. Identify phase number from `docs/VISION_ROADMAP.md`
2. **Determine scope**: Is this phase bundle-only or does it require code changes?
   - Phases 1-8: Sample bundle updates only
   - Phase 9+: May require editor code changes
3. Review entity definitions in `docs/vision.md`

## Bundle-Only Phases (1-8 pattern)
// turbo-all

1. Create JSON schema(s) in `/home/ivan/dev/sdd-sample-bundle/schemas/`
2. Update `bundle-type.sdd-core.json` with:
   - New entity definitions
   - New relation definitions
3. Update `sdd-bundle.yaml` manifest:
   - Add to `schemas.documents`
   - Add to `layout.documents`
4. Create directories for new entities: `mkdir -p bundle/<entity-name>/`
5. Create sample YAML data files
6. Run verification:
   ```bash
   pnpm build
   node packages/cli/dist/index.js validate --bundle-dir /home/ivan/dev/sdd-sample-bundle --output json
   ```
7. Commit with conventional commit message:
   ```bash
   git add -A && git commit -m "feat(phaseN): <description>"
   ```

## Code-Change Phases (9+)
1. Create implementation plan FIRST
2. Get user approval before proceeding
3. Follow normal development workflow

## Verification Checklist
- [ ] `pnpm build` passes
- [ ] CLI validation returns `[]` (no errors)
- [ ] New entities visible in UI (`pnpm dev`)
- [ ] Changes committed to sample bundle
