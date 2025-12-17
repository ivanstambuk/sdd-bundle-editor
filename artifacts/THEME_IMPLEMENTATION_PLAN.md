# Theme Implementation Plan: Light/Dark Mode Toggle

## 1. CSS Audit Results

### ✅ **Good News: Well-Structured Design System**

The existing CSS uses CSS custom properties extensively in `:root`. This is the ideal foundation for theming.

### Current Theme Variables (`:root`)

| Category | Variables |
|----------|-----------|
| **Backgrounds** | `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-bg-hover` |
| **Text** | `--color-text-primary`, `--color-text-secondary`, `--color-text-muted` |
| **Accent** | `--color-accent`, `--color-accent-hover`, `--color-accent-light` |
| **Semantic** | `--color-success`, `--color-success-bg`, `--color-warning`, `--color-warning-bg`, `--color-error`, `--color-error-bg` |
| **Borders** | `--color-border`, `--color-border-light` |
| **Entity Types** | `--color-feature`, `--color-requirement`, `--color-task`, `--color-adr`, `--color-profile`, `--color-fixture` |


### ⚠️ **Hard-Coded Colors to Fix**

Found **~20 instances** of hard-coded colors that need to be converted to CSS variables:

| Location | Color | Purpose | Fix |
|----------|-------|---------|-----|
| Line 1799, 2052, 2280 | `#6366f1` | Gradient secondary color | Add `--color-accent-secondary` |
| Lines 2142, 2164, 2148 | `#e2e8f0`, `white` | Code block text | Add `--color-code-text` |
| Line 2152 | `#0f172a` | Code block background | Add `--color-code-bg` |
| Lines 2707, 2728, 2991, 3001 | `#fca5a5` | Diff old/removed text | Add `--color-diff-old` |
| Lines 2711, 2733, 2996, 3015 | `#86efac` | Diff new/added text | Add `--color-diff-new` |
| Lines 3002, 2727, 2732 | `#ef4444`, `rgba(62,27,27)` | Diff old background | Add `--color-diff-old-bg` |
| Lines 3016, 2732, 2995 | `#22c55e`, `rgba(27,62,32)` | Diff new background | Add `--color-diff-new-bg` |
| Lines 3437-3438 | `#22c55e` | Checkbox checked | Use `--color-success` |
| Line 3432 | `rgba(255,255,255,0.5)` | Checkbox hover border | Add `--color-border-focus` |

### ✅ **Inline Styles (Low Risk)**

Found 5 inline `style={}` usages — all are for **dynamic values** (width, height), not colors. No action needed.


---

## 2. Light Theme Palette

Based on the existing **Tokyo Night**-inspired dark theme, here's a complementary light palette:

### Proposed Light Theme

```css
[data-theme="light"] {
  /* Colors - Light Theme (inspired by GitHub/VS Code Light) */
  
  /* Backgrounds */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f6f8fa;
  --color-bg-tertiary: #f0f2f5;
  --color-bg-hover: #e8eaed;
  
  /* Text */
  --color-text-primary: #1f2328;
  --color-text-secondary: #656d76;
  --color-text-muted: #8b949e;
  
  /* Accent */
  --color-accent: #0969da;
  --color-accent-hover: #0550ae;
  --color-accent-light: rgba(9, 105, 218, 0.12);
  
  /* Semantic - slightly darker for light backgrounds */
  --color-success: #1a7f37;
  --color-success-bg: rgba(26, 127, 55, 0.1);
  --color-warning: #9a6700;
  --color-warning-bg: rgba(154, 103, 0, 0.1);
  --color-error: #cf222e;
  --color-error-bg: rgba(207, 34, 46, 0.1);
  
  /* Borders */
  --color-border: #d1d9e0;
  --color-border-light: #e1e4e8;
  
  /* Entity type colors - Adjusted for light mode contrast */
  --color-feature: #8250df;
  --color-requirement: #0969da;
  --color-task: #bf5700;
  --color-adr: #1a7f37;
  --color-profile: #cf222e;
  --color-fixture: #9a6700;
  
  /* Code blocks */
  --color-code-bg: #f6f8fa;
  --color-code-text: #24292f;
  
  /* Diffs */
  --color-diff-old: #82071e;
  --color-diff-old-bg: rgba(255, 129, 130, 0.3);
  --color-diff-new: #116329;
  --color-diff-new-bg: rgba(46, 160, 67, 0.2);
  --color-diff-old-border: #cf222e;
  --color-diff-new-border: #1a7f37;
  
  /* Shadows - softer for light bg */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.12);
}
```

### Color Comparison Table

| Variable | Dark Theme | Light Theme |
|----------|------------|-------------|
| `--color-bg-primary` | `#1a1b26` (near-black) | `#ffffff` (white) |
| `--color-bg-secondary` | `#16161e` (darker) | `#f6f8fa` (off-white) |
| `--color-text-primary` | `#c0caf5` (lavender) | `#1f2328` (near-black) |
| `--color-accent` | `#7aa2f7` (bright blue) | `#0969da` (GitHub blue) |
| `--color-success` | `#9ece6a` (bright green) | `#1a7f37` (dark green) |
| `--color-error` | `#f7768e` (salmon) | `#cf222e` (dark red) |


---

## 3. Implementation Steps

### Phase 1: CSS Preparation (30 min)

1. **Add new CSS variables for hard-coded colors**
   - Add `--color-code-bg`, `--color-code-text`, `--color-diff-*` to `:root`
   - Replace all hard-coded hex colors with the new variables

2. **Add `--color-accent-secondary`** for gradient support
   - Current: `linear-gradient(135deg, var(--color-accent), #6366f1)`
   - Fixed: `linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))`

### Phase 2: Light Theme CSS Block (15 min)

3. **Add `[data-theme="light"]` selector** with all variable overrides
   - Copy the dark values as baseline
   - Apply the light palette values

### Phase 3: Theme Toggle Component (30 min)

4. **Create `ThemeToggle.tsx` component**
   ```tsx
   // packages/ui-shell/src/components/ThemeToggle.tsx
   export const ThemeToggle: React.FC = () => {
     const [theme, setTheme] = useState<'dark' | 'light'>(() => {
       // Priority: localStorage > system preference > dark
       const stored = localStorage.getItem('sdd:theme');
       if (stored === 'light' || stored === 'dark') return stored;
       if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
       return 'dark';
     });
     
     useEffect(() => {
       document.documentElement.setAttribute('data-theme', theme);
       localStorage.setItem('sdd:theme', theme);
     }, [theme]);
     
     return (
       <button 
         className="btn-icon theme-toggle"
         onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
         title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
       >
         {theme === 'dark' ? '☀️' : '🌙'}
       </button>
     );
   };
   ```

5. **Add `ThemeToggle` to header** in `AppShell.tsx`
   - Place in `header-right` alongside other icon buttons

### Phase 4: System Preference Detection (10 min)

6. **Add listener for system theme changes**
   ```tsx
   useEffect(() => {
     const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
     const handler = (e: MediaQueryListEvent) => {
       if (!localStorage.getItem('sdd:theme')) {
         setTheme(e.matches ? 'dark' : 'light');
       }
     };
     mediaQuery.addEventListener('change', handler);
     return () => mediaQuery.removeEventListener('change', handler);
   }, []);
   ```

### Phase 5: Testing & Polish (30 min)

7. **Create E2E test for theme switching**
   - `e2e/theme-toggle.spec.ts`
   - Test toggle click changes theme
   - Test persistence across page reload
   - Capture screenshots in both themes

8. **Visual review and adjustments**
   - Run through all UI sections in light mode
   - Adjust any colors that lack sufficient contrast
   - Test entity type badge colors for accessibility


---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/styles.css` | Add new variables, add `[data-theme="light"]` block, replace hard-coded colors |
| `packages/ui-shell/src/components/ThemeToggle.tsx` | **New file** - toggle component |
| `packages/ui-shell/src/components/AppShell.tsx` | Add `ThemeToggle` to header |
| `packages/ui-shell/src/index.ts` | Export `ThemeToggle` |
| `e2e/theme-toggle.spec.ts` | **New file** - E2E test |


---

## 5. Estimated Effort

| Phase | Time |
|-------|------|
| CSS Preparation | 30 min |
| Light Theme CSS | 15 min |
| Toggle Component | 30 min |
| System Preference | 10 min |
| Testing & Polish | 30 min |
| **Total** | **~2 hours** |


---

## 6. Decisions for User Review

1. **Color palette**: The proposed light theme uses GitHub/VS Code-inspired colors. Would you prefer a different aesthetic (e.g., warmer, cooler, more vibrant)?

2. **Default theme**: Should the app default to:
   - ⬜ System preference (recommended)
   - ⬜ Always dark
   - ⬜ Always light

3. **Toggle placement**: Suggested location is the header right side (next to hamburger menu). Alternative: settings panel, footer, or floating button.

4. **Transition animation**: Add a smooth CSS transition when switching themes? (e.g., `transition: background-color 0.3s ease`)

---

## 7. Next Steps

**Ready to implement?** Just say "proceed" and I'll start with Phase 1 (CSS preparation) immediately.
