# UI Changes Protocol

## Interaction Protocol for UI Features

For any new feature or change that impacts the User Interface (UI), the following protocol is **MANDATORY**:

1. **Playwright Test Required**: You MUST write or update a Playwright E2E test (`e2e/*.spec.ts`) that covers the new feature.
   - **Simulate Interaction**: The test must simulate real user interactions (clicks, typing) to verify behavior.
   - **Verify Appearance**: Use assertions to verify element visibility, styling classes, and state changes.

2. **Screenshot Capture**: The test MUST capture a screenshot of the relevant UI state.
   - Use `await page.screenshot({ path: 'artifacts/<feature_name>.png' });`.
   - Save screenshots to the artifacts directory so they can be embedded in reports.

3. **Agent Verification**:
   - **Run the Test**: You MUST run `pnpm test:e2e` and confirm it passes.
   - **Inspect Results**: Verify the screenshot exists and embed it in your `walkthrough.md` or completion report to demonstrate the result to the user.

4. **No Skipping**: Do NOT skip these tests or ask the user to test manually. You must validate the feature yourself before successful hand-off.

---

## Post-UI-Change Verification (MANDATORY)

After ANY change to UI components or CSS, you MUST:

1. **Test with `pnpm dev` (NOT just E2E)**:
   - E2E tests use Playwright's managed servers which may mask issues
   - Run `SDD_SAMPLE_BUNDLE_PATH=/path/to/bundle pnpm dev` and verify manually
   - This catches issues in the normal development workflow

2. **Run Visual Regression Tests**:
   ```bash
   pnpm test:visual
   ```
   If baselines need updating after intentional changes:
   ```bash
   pnpm test:visual:update
   ```

3. **Verify Layout Measurements**:
   - For layout changes, use `boundingBox()` to verify dimensions
   - Check that elements span expected widths/heights
   - Verify grid/flex layouts work correctly

**Why this matters**: E2E tests can pass while the UI is visually broken. The managed Playwright servers may start additional services that mask missing dependencies.

---

## CSS-First Rule for UI Components

When adding new UI elements with layout implications:

1. **NEVER use inline styles for layout properties** (grid, flex, position, width, height, margin, padding)
2. **Always add CSS classes to `styles.css` FIRST** before adding the JSX
3. **Verify grid integration**:
   - Check `grid-template-rows` / `grid-template-columns` match the DOM structure
   - New full-width elements need `grid-column: 1 / -1`
4. **Use design system variables**: Always use `--color-*`, `--spacing-*`, `--font-size-*` variables
5. **Test with dark theme**: The app uses a dark theme by default; light colors will clash

**Example of what NOT to do**:
```tsx
// ❌ BAD: Inline styles bypass CSS grid and design system
<div style={{ background: '#f0f9ff', padding: '8px 16px' }}>
```

**Example of correct approach**:
```tsx
// ✅ GOOD: CSS class in styles.css with proper grid integration
<div className="info-banner">
```

```css
/* styles.css */
.info-banner {
  grid-column: 1 / -1;  /* Span full width */
  background: var(--color-bg-tertiary);
  padding: var(--spacing-sm) var(--spacing-md);
}
```

---

## Debug-First Workflow for UI/CSS Issues

When a visual bug is reported (spacing, alignment, colors, layout issues), follow this **measure-before-guessing** approach:

1. **Create a Reproduction Test FIRST**:
   - Write an E2E test that reproduces the issue
   - Inject test HTML if needed (don't depend on API responses)
   - Use `boundingBox()` to measure actual pixel values
   - Log computed styles (`getComputedStyle()`) for affected elements

   ```typescript
   // Example: Measure spacing between list items
   const box1 = await items.nth(0).boundingBox();
   const box2 = await items.nth(1).boundingBox();
   const gap = box2.y - (box1.y + box1.height);
   console.log(`Gap: ${gap}px`); // Quantify the issue!
   ```

2. **Run Test to Establish Baseline**:
   - Get actual measurements before making changes
   - Compare actual vs expected values
   - This identifies WHERE the extra space is coming from

3. **Check for CSS Cascade Issues**:
   - Parent styles can affect children unexpectedly
   - Watch for: `white-space: pre-wrap`, `display: flex`, `gap`, `line-height`
   - Use browser DevTools or test to inspect computed styles

4. **Make Targeted CSS Changes**:
   - Only after you understand the root cause
   - Use `!important` sparingly; prefer more specific selectors

5. **Re-run Test to Verify Fix**:
   - Test MUST pass before considering the issue fixed
   - Capture screenshot for visual verification

**Why this matters**: CSS bugs often have non-obvious causes (cascade, inheritance, whitespace). Measuring first prevents wasted time on incorrect fixes.

**Reference implementation**: See `e2e/css-spacing-validation.spec.ts` for a reusable test suite with helpers for measuring gaps (`measureGaps()`) and injecting test HTML (`injectTestMessage()`).
