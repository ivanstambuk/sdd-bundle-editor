# React Development Best Practices

## ESLint React Hooks Plugin

This project uses `eslint-plugin-react-hooks` to catch common React pitfalls automatically.

**Running ESLint on React Components:**

```bash
# Lint all React components (run from repo root)
ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src --ext .tsx,.ts

# Lint a specific file
ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src/AppShell.tsx
```

**Key Rules Enabled:**

1. **`react-hooks/rules-of-hooks`** (error): Enforces the Rules of Hooks (only call hooks at top level, only in function components)
2. **`react-hooks/exhaustive-deps`** (warning): Ensures all dependencies are listed in useEffect/useCallback/useMemo arrays

---

## Dependency Array Mistakes

**Example - This WILL trigger a warning:**

```typescript
const [selectedEntity, setSelectedEntity] = useState(null);
const [bundle, setBundle] = useState(null);

useEffect(() => {
  if (bundle && selectedEntity) {
    // ... logic using selectedEntity ...
  }
}, [bundle]); // ⚠️ WARNING: Missing dependency: 'selectedEntity'
```

**Fix:**

```typescript
useEffect(() => {
  if (bundle && selectedEntity) {
    // ... logic using selectedEntity ...
  }
}, [bundle, selectedEntity]); // ✅ All dependencies listed
```

---

## When to Ignore (Rare)

Use `// eslint-disable-next-line react-hooks/exhaustive-deps` ONLY if:
- The dependency is a stable reference (e.g., `setX` from useState)
- Adding it would cause infinite loops
- You've verified it's safe to omit

**Always document WHY you're disabling the rule.**

---

## Before Committing React Code

1. Run ESLint: `ESLINT_USE_FLAT_CONFIG=false pnpm exec eslint packages/ui-shell/src --ext .tsx,.ts`
2. Fix all errors
3. Review all warnings carefully
4. Rebuild if you modified ui-shell: `pnpm --filter @sdd-bundle-editor/ui-shell build`

---

## Debugging React State Issues

Common symptoms:
- UI doesn't update after state change
- Stale data displayed
- Changes work on refresh but not on first render

**Use the systematic debugging workflow**: See `.agent/workflows/debug-react-state.md` for a complete step-by-step checklist.

Quick checklist:
1. ✅ Check React DevTools for state updates
2. ✅ Run ESLint with react-hooks plugin enabled
3. ✅ Verify useEffect dependencies match the rule warning
4. ✅ Add console.log at state update point
5. ✅ Check if component is re-rendering (add console.log in render)
6. ✅ Verify data is actually changing (deep comparison)

---

## Development Logging

This project uses a structured logger (`packages/ui-shell/src/utils/logger.ts`) instead of raw `console.log`.

**Creating a logger:**
```typescript
import { createLogger } from './utils/logger';
const log = createLogger('MyComponent');

// Use appropriate log levels
log.debug('Detailed state:', { bundle, entity });  // Verbose debugging
log.info('User action completed', { action });     // Significant events
log.warn('Unusual condition', { state });          // Potential issues
log.error('Operation failed', error);              // Actual errors
```

**Log levels** (in order of severity):
- `debug` - Detailed debugging info (state changes, function calls)
- `info` - Significant events (user actions, data updates)
- `warn` - Unexpected but handled situations
- `error` - Actual errors that need attention

**Runtime control** (in browser console):
```javascript
// Show all logs including debug
localStorage.setItem('sdd:logLevel', 'debug');

// Only important messages (default)
localStorage.setItem('sdd:logLevel', 'info');

// Only warnings and errors
localStorage.setItem('sdd:logLevel', 'warn');

// Disable all logs
localStorage.setItem('sdd:logLevel', 'off');

// Filter by component
localStorage.setItem('sdd:logFilter', 'AppShell');

// View current config
loggerConfig();
```

**Benefits over console.log:**
- ✅ Filterable by level and component
- ✅ Automatically disabled in production
- ✅ Consistent formatting with timestamps
- ✅ Easy to toggle at runtime without code changes
- ✅ Works with browser DevTools filtering
