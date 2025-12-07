import { test, expect } from '@playwright/test';

test('capture UI screenshots', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Entities')).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-initial.png', fullPage: true });

    await page.getByRole('button', { name: 'FEAT-001' }).click();
    await expect(page.locator('.entity-id').filter({ hasText: 'FEAT-001' })).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-entity-details.png', fullPage: true });

    await page.getByRole('button', { name: 'Compile Spec' }).click();
    await expect(page.getByText('No diagnostics.')).toBeVisible();
    await page.screenshot({ path: '/home/ivan/dev/sdd-bundle-editor/test-results/ui-diagnostics.png', fullPage: true });
});
