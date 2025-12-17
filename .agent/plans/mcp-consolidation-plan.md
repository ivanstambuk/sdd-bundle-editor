# MCP Consolidation Plan

**Goal**: Remove duplicate HTTP bundle endpoints from `apps/server` and make the UI default to MCP.

**Current State**: The frontend has two parallel APIs:
- `bundleApi.ts` → Legacy HTTP (`apps/server` on port 3000)
- `mcpBundleApi.ts` → MCP HTTP transport (`packages/mcp-server` on port 3001)

The UI defaults to legacy; MCP requires `?useMcp=true`.

---

## Phase 1: Make MCP the Default (Low Risk)

**Changes:**

1. **`useBundleState.ts`**: Flip default to MCP, keep legacy as fallback
   ```typescript
   function shouldUseMcpApi(): boolean {
       // Check for explicit legacy mode
       if (params.get('useMcp') === 'false') return false;
       // Default to MCP (was: false)
       return true;
   }
   ```

2. **`webpack.config.js`**: Update proxy to include MCP endpoint
   ```javascript
   proxy: [
       {
           context: ['/mcp', '/health'],  // MCP endpoint
           target: 'http://localhost:3001',
           changeOrigin: true,
       },
       // Keep legacy for fallback
       {
           context: ['/bundle', '/bundle/validate', '/bundle/save'],
           target: 'http://localhost:3000',
           changeOrigin: true,
       },
   ],
   ```

3. **`playwright.config.ts`**: Already starts both servers ✓

**Verification:**
- [ ] `pnpm test:e2e` passes (uses both servers)
- [ ] Manual test: UI loads via MCP by default
- [ ] Manual test: `?useMcp=false` falls back to legacy

**Commit**: `feat: default UI to MCP API with legacy fallback`

---

## Phase 2: Update E2E Tests for MCP-First

**Changes:**

1. **E2E tests**: Update to verify MCP mode indicator
   - Add assertion for `isMcpMode: true` in bundle state
   - Or check for visual indicator if we add one

2. **Test fixture adaptations**:
   - Tests using `getSampleBundlePath()` should work unchanged
   - MCP server uses same bundle path

**Verification:**
- [ ] All 53 E2E tests pass
- [ ] MCP server logs show tool calls from UI

**Commit**: `test: update E2E tests for MCP-first architecture`

---

## Phase 3: Update Dev Tooling

**Changes:**

1. **`package.json` (root)**: Update `dev` script to prioritize MCP
   ```json
   "dev": "concurrently -n mcp,web,legacy \"pnpm --filter @sdd-bundle-editor/mcp-server start:http\" \"pnpm --filter @sdd-bundle-editor/web dev\" \"pnpm --filter @sdd-bundle-editor/server dev\"",
   ```

2. **Add `dev:mcp-only` script** for MCP-only development:
   ```json
   "dev:mcp-only": "concurrently -n mcp,web \"pnpm --filter @sdd-bundle-editor/mcp-server start:http\" \"pnpm --filter @sdd-bundle-editor/web dev\""
   ```

3. **Update `AGENTS.md`**: Document MCP-first architecture

**Verification:**
- [ ] `pnpm dev:mcp-only` starts successfully
- [ ] UI works without legacy server running

**Commit**: `chore: add MCP-only dev mode`

---

## Phase 4: Remove Legacy Bundle Endpoints (Breaking)

⚠️ **This is the breaking change phase**

**Changes:**

1. **`apps/server/src/index.ts`**: Remove duplicate routes
   - DELETE: `GET /bundle`
   - DELETE: `POST /bundle/validate`  
   - DELETE: `POST /bundle/save`
   - KEEP: `GET /health` (needed for Playwright)

2. **`apps/server/src/index.test.ts`**: Remove tests for deleted endpoints

3. **`packages/ui-shell/src/api/bundleApi.ts`**: Mark as deprecated or remove
   - Option A: Delete file, update exports
   - Option B: Keep as deprecated wrapper that throws helpful error

4. **`packages/ui-shell/src/hooks/useBundleState.ts`**: Remove fallback logic
   ```typescript
   // Remove: if (useMcp.current) { ... try legacy fallback }
   // Simplify to MCP-only
   ```

5. **`apps/web/webpack.config.js`**: Remove legacy proxy routes
   ```javascript
   proxy: [
       {
           context: ['/mcp', '/health'],
           target: 'http://localhost:3001',
           changeOrigin: true,
       },
   ],
   ```

6. **`playwright.config.ts`**: Remove legacy server or keep for health check
   ```javascript
   webServer: [
       {
           // MCP server only (primary)
           command: '...',
           url: 'http://localhost:3001/health',
       },
       {
           // Web dev server
           command: '...',
           url: 'http://localhost:5173',
       },
       // REMOVED: Legacy HTTP server
   ],
   ```

**Verification:**
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes (unit tests)
- [ ] `pnpm test:e2e` passes
- [ ] UI works with only MCP server running
- [ ] No console errors about legacy endpoints

**Commit**: `feat!: remove legacy HTTP bundle endpoints, MCP-only architecture`

---

## Phase 5: Cleanup and Documentation

**Changes:**

1. **Consider removing `apps/server` entirely**:
   - If only `/health` remains, merge it into MCP server
   - Or keep as minimal proxy for future non-MCP endpoints

2. **Update documentation**:
   - `README.md`: Update architecture diagram
   - `AGENTS.md`: Update server commands
   - `packages/mcp-server/README.md`: Add UI integration section

3. **Remove dead code**:
   - `bundleApi.ts` (if not already deleted)
   - Any remaining `/bundle` references
   - Unused type imports

4. **Update `IMPLEMENTATION_TRACKER.md`**:
   - Mark "MCP-First UI" as complete
   - Add "Legacy HTTP Removal" as done

**Commit**: `docs: update architecture for MCP-only`

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| MCP server not running | Clear error message + health check |
| Fallback needed for edge cases | Phase 1-2 keep fallback; only Phase 4 removes it |
| E2E test failures | Run full suite after each phase |
| Production deployments | Ensure MCP server is part of deployment |

---

## Recommended Order

1. **Phase 1** (30 min): Safe, reversible, adds value
2. **Phase 3** (15 min): Dev experience improvement
3. **Phase 2** (20 min): Test verification
4. **-- Checkpoint: Verify everything works with MCP as default --**
5. **Phase 4** (1 hour): Breaking change, careful testing
6. **Phase 5** (30 min): Cleanup

**Total estimated time**: ~2.5 hours

---

## Files to Modify

### Phase 1
- `packages/ui-shell/src/hooks/useBundleState.ts`
- `apps/web/webpack.config.js`

### Phase 3
- `package.json` (root)
- `AGENTS.md`

### Phase 4
- `apps/server/src/index.ts`
- `apps/server/src/index.test.ts`
- `packages/ui-shell/src/api/bundleApi.ts`
- `packages/ui-shell/src/api/index.ts`
- `packages/ui-shell/src/hooks/useBundleState.ts`
- `apps/web/webpack.config.js`
- `playwright.config.ts`

### Phase 5
- `README.md`
- `AGENTS.md`
- `IMPLEMENTATION_TRACKER.md`
