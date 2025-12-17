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
    await page.click('[data-testid="entity-item-Feature-FEAT-demo-basic"]');
    await expect(page.locator('.entity-id').filter({ hasText: 'FEAT-demo-basic' })).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-entity-details.png', fullPage: true });

    await page.click('[data-testid="compile-btn"]');
    await expect(page.locator('.diagnostics-panel')).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-diagnostics.png', fullPage: true });

    // Capture Requirement with Markdown content
    await page.click('[data-testid="entity-group-Requirement"]');
    await page.click('[data-testid="entity-item-Requirement-REQ-secure-auth"]');
    await page.waitForTimeout(500); // Wait for form to render
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-markdown-requirement.png', fullPage: true });
});
