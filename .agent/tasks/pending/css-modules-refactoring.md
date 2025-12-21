# CSS Modules Refactoring Plan

## Status: Phase 1 Complete ✅

**Last Updated**: 2025-12-21

Phase 1 (Foundation Setup) has been completed. The styles directory structure is in place with tokens, themes, and globals extracted.

---

## Problem Statement

The current `styles.css` file has grown to ~5,700 lines (reduced from ~5,900), causing:
- **Cascade conflicts**: Changes to one component unexpectedly affect others
- **Maintainability issues**: Hard to find and understand styles
- **No isolation**: Global scope means everything affects everything
- **Debugging difficulty**: Tracing which styles apply where is time-consuming

## Solution: CSS Modules + Organized Architecture

### Current Architecture (Phase 1 Complete)

```
apps/web/src/
├── styles/                   # ✅ CREATED
│   ├── index.css             # Main entry point
│   ├── tokens.css            # CSS custom properties
│   ├── themes.css            # Light/dark theme overrides  
│   ├── globals.css           # Resets, base typography
│   └── utilities.css         # Utility classes
│
├── components/               # For future CSS Modules
│   └── CodeBlock.module.css  # Example CSS Module (unused placeholder)
│
├── styles.css                # Legacy component styles (~5,700 lines)
│
packages/ui-shell/src/
├── components/               # React components (NO CSS Modules - see note below)
│   ├── EntityNavigator.tsx
│   ├── EntityDetails.tsx
│   └── SyntaxHighlighter.tsx
```

### ⚠️ Monorepo Architecture Constraint

**CSS Modules cannot be in `packages/ui-shell`** because:
1. ui-shell uses `tsc` (TypeScript compiler only, no bundler)
2. CSS Module processing requires webpack/vite
3. apps/web runs webpack which processes CSS

**Implications for Phase 2+:**
- Option A: Create wrapper components in apps/web that apply CSS Modules
- Option B: Move display-only components from ui-shell to apps/web
- Option C: Configure ui-shell to use a bundler (significant effort)
- Option D: Use CSS-in-JS for true component co-location (different tradeoffs)

### Why CSS Modules?

1. **Scoped by default** - Class names are hashed, no global conflicts
2. **Co-location** - Styles live next to their component
3. **Zero config** - Webpack/Vite supports `.module.css` files natively
4. **Gradual migration** - Can migrate one component at a time
5. **TypeScript support** - Can generate type declarations for class names


---

## Implementation Phases

### Phase 1: Foundation Setup ✅ COMPLETE

**Status**: Completed on 2025-12-21

**What was done**:
1. ✅ Created `apps/web/src/styles/` directory structure
2. ✅ Extracted CSS custom properties to `tokens.css` (~100 lines)
3. ✅ Extracted light theme overrides to `themes.css` (~80 lines)  
4. ✅ Extracted base reset/typography to `globals.css` (~60 lines)
5. ✅ Created `utilities.css` with common utility classes
6. ✅ Created `index.css` as main entry point with proper import order
7. ✅ Updated `index.tsx` to import from new structure
8. ✅ Removed duplicated styles from legacy `styles.css`
9. ✅ Validated visually - no regressions in dark/light themes

**Result**: Legacy `styles.css` reduced from ~5,895 to ~5,686 lines

### Phase 2: Architectural Decision Required

**Status**: Blocked pending architecture decision

**Discovery**: CSS Modules cannot be used in `packages/ui-shell` because:
- ui-shell uses `tsc` only (no bundler)
- CSS Module imports fail at webpack build time
- CSS Module files in ui-shell/dist/ are not processed

**Options to Evaluate**:

| Option | Pros | Cons |
|--------|------|------|
| **A: Wrapper components in apps/web** | No ui-shell changes | Extra indirection, duplication |
| **B: Move components to apps/web** | Clean co-location | Major refactor, breaks package boundary |
| **C: Add bundler to ui-shell** | True co-location | Significant build complexity |
| **D: CSS-in-JS (styled-components, etc)** | True co-location + runtime theming | New dependency, learning curve |
| **E: Keep global CSS** | No changes needed | Original problem remains |

**Recommendation**: Discuss with user before proceeding. The effort vs benefit tradeoff needs to be evaluated.

### Phase 3: Core Layout Components (IF Phase 2 proceeds)

**Priority order** (least dependencies first):


1. **HeaderMetadata** (simple, isolated)
2. **EntityHeader** (entity header bar)
3. **EntityTabs** (tab navigation)
4. **EntityNavigator** (sidebar)
5. **EntityDetails** (main content area)
6. **BundleOverview** (bundle-level views)

For each component:
1. Create `ComponentName.module.css` 
2. Extract relevant styles from `styles.css`
3. Update component to use CSS Modules
4. Remove old styles from `styles.css`
5. Validate visually

### Phase 4: Form System (2-3 sessions)

The RJSF form styles are complex and interdependent:

1. **Create form style modules**:
   ```
   src/rjsf/
   ├── templates/
   │   ├── RjsfFormWrapper.module.css
   │   ├── RjsfFieldTemplate.module.css
   │   ├── RjsfArrayFieldTemplate.module.css
   │   └── RjsfObjectFieldTemplate.module.css
   ├── widgets/
   │   ├── DateWidget.module.css
   │   ├── MarkdownWidget.module.css
   │   └── ...
   ```

2. **Special handling for RJSF integration**:
   - Some RJSF classes are injected by the library
   - May need to use `:global()` selector for RJSF-controlled classes
   - Document which classes are library-controlled vs custom

### Phase 5: Cleanup and Documentation (1 session)

1. **Remove empty/orphaned styles** from remaining `styles.css`
2. **Document the architecture** in `.agent/docs/css-architecture.md`
3. **Add CSS linting rules** (optional: stylelint)
4. **Create component style template** for new components

---

## Migration Strategy per Component

For each component migration, follow this checklist:

```markdown
### [ComponentName] Migration Checklist

- [ ] Identify all CSS classes used by component
- [ ] Create `ComponentName.module.css`
- [ ] Copy relevant styles from `styles.css`
- [ ] Convert class names (remove component prefix if redundant)
- [ ] Update component imports and className usage
- [ ] Handle any child component dependencies
- [ ] Remove old styles from `styles.css`
- [ ] Visual validation via browser agent
- [ ] Commit with descriptive message
```

---

## CSS Module Syntax Reference

### Basic Usage

```css
/* YamlViewer.module.css */
.viewer {
  padding: var(--spacing-sm);
}

.copyButton {
  align-self: flex-end;
}

/* For elements not controlled by React */
:global(.prism-code) {
  background: var(--color-bg-secondary);
}
```

```tsx
// YamlViewer.tsx
import styles from './YamlViewer.module.css';

export function YamlViewer() {
  return (
    <div className={styles.viewer}>
      <button className={styles.copyButton}>Copy</button>
      <pre className="prism-code">{/* global class for Prism */}</pre>
    </div>
  );
}
```

### Composing Styles

```css
/* Can compose from other modules */
.specialViewer {
  composes: viewer;
  border: 2px solid var(--color-accent);
}
```

### Conditional Classes

```tsx
import cn from 'classnames'; // or clsx

<div className={cn(styles.field, {
  [styles.required]: isRequired,
  [styles.error]: hasError
})} />
```

---

## Known Challenges

1. **RJSF Integration**: The form library injects its own classes - need careful handling
2. **Syntax Highlighting**: Prism.js uses global classes - use `:global()` sparingly
3. **Theme Variables**: Keep design tokens in `tokens.css`, import in modules
4. **Testing**: May need to update any CSS-dependent tests

---

## Success Criteria

- [ ] `styles.css` reduced to <500 lines (only legacy/third-party)
- [ ] Each component's styles are co-located
- [ ] No unintended visual regressions
- [ ] Changing one component's styles doesn't affect others
- [ ] New developers can find component styles easily
- [ ] Architecture documented in `.agent/docs/`

---

## Estimated Effort

| Phase | Sessions | Description |
|-------|----------|-------------|
| 1 | 1 | Foundation (tokens, globals) |
| 2 | 1 | Pilot (YamlViewer) |
| 3 | 2-3 | Core layout components |
| 4 | 2-3 | Form system |
| 5 | 1 | Cleanup & docs |
| **Total** | **7-9** | Full migration |

---

## Trigger Command

To start this refactoring:
```
/task css-modules-refactoring
```

Or begin with Phase 1 foundation work in a new chat session.
