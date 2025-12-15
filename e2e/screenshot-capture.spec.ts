import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test('capture UI screenshots', async ({ page }) => {
    const bundleDir = getSampleBundlePath();

    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Entities')).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-initial.png', fullPage: true });

    // Expand Feature group first (groups start collapsed)
    await page.click('[data-testid="entity-group-Feature"]');
    await page.click('[data-testid="entity-FEAT-001"]');
    await expect(page.locator('.entity-id').filter({ hasText: 'FEAT-001' })).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-entity-details.png', fullPage: true });

    await page.click('[data-testid="compile-btn"]');
    await expect(page.locator('.diagnostics-panel')).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-diagnostics.png', fullPage: true });

    // Capture ADR form - expand ADR group first
    await page.click('[data-testid="entity-group-ADR"]');
    await page.click('[data-testid="entity-ADR-0001"]');
    await page.waitForTimeout(500); // Wait for form to render
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-adr-form.png', fullPage: true });
});
