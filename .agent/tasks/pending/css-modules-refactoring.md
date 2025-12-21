# CSS Modules Refactoring Plan

## Problem Statement

The current `styles.css` file has grown to ~6,000 lines, causing:
- **Cascade conflicts**: Changes to one component unexpectedly affect others
- **Maintainability issues**: Hard to find and understand styles
- **No isolation**: Global scope means everything affects everything
- **Debugging difficulty**: Tracing which styles apply where is time-consuming

## Solution: CSS Modules + Organized Architecture

### Target Architecture

```
src/
├── styles/
│   ├── globals.css           # Resets, base typography, truly global styles
│   ├── tokens.css            # CSS custom properties (colors, spacing, radii, etc.)
│   ├── theme-light.css       # Light theme overrides
│   ├── theme-dark.css        # Dark theme overrides (current default)
│   └── utilities.css         # Optional utility classes (.visually-hidden, etc.)
│
├── components/
│   ├── EntityNavigator/
│   │   ├── EntityNavigator.tsx
│   │   └── EntityNavigator.module.css
│   ├── EntityDetails/
│   │   ├── EntityDetails.tsx
│   │   └── EntityDetails.module.css
│   ├── YamlViewer/
│   │   ├── YamlViewer.tsx
│   │   └── YamlViewer.module.css
│   └── ... (each component gets its own module)
```

### Why CSS Modules?

1. **Scoped by default** - Class names are hashed, no global conflicts
2. **Co-location** - Styles live next to their component
3. **Zero config** - Vite supports `.module.css` files natively
4. **Gradual migration** - Can migrate one component at a time
5. **TypeScript support** - Can generate type declarations for class names

---

## Implementation Phases

### Phase 1: Foundation Setup (1 session)

**Goal**: Establish the architecture without breaking existing styles.

1. **Create directory structure**:
   ```
   src/styles/tokens.css      # Extract CSS custom properties
   src/styles/globals.css     # Extract resets and base styles
   src/styles/themes.css      # Extract theme variables
   ```

2. **Extract CSS custom properties** from `styles.css`:
   - All `--color-*` variables
   - All `--spacing-*` variables
   - All `--font-*` variables
   - All `--radius-*` variables
   - All `--shadow-*` variables

3. **Update imports** in `main.tsx`:
   ```tsx
   import './styles/tokens.css';
   import './styles/globals.css';
   import './styles/themes.css';
   import './styles.css';  // Keep remaining styles for now
   ```

4. **Validation**: Verify app looks identical after extraction.

### Phase 2: Pilot Migration - YamlViewer (1 session)

**Goal**: Prove the pattern works with a simple, self-contained component.

1. **Create `YamlViewer.module.css`**:
   - Extract `.yaml-viewer`, `.json-viewer`, `.copy-button`, `.yaml-block`, `.json-block` styles
   - Convert to CSS Module syntax

2. **Update `YamlViewer.tsx`**:
   ```tsx
   import styles from './YamlViewer.module.css';
   
   // Use: className={styles.viewer} instead of className="yaml-viewer"
   ```

3. **Remove migrated styles** from `styles.css`.

4. **Validation**: Verify Raw YAML tab renders correctly.

### Phase 3: Core Layout Components (2-3 sessions)

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
