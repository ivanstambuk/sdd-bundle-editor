
import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('UI Alignment Capture', () => {
    test('capture agent panel alignment across different pages', async ({ page }) => {
        const bundleDir = getSampleBundlePath();

        // Go to home with debug mode to ensure agent panel is enabled/visible
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true`);
        await expect(page.locator('.app-shell')).toBeVisible();

        // 1. Capture Feature Page
        const featureLink = page.getByRole('button', { name: 'FEAT-001' });
        try {
            await expect(featureLink).toBeVisible({ timeout: 10000 });
            await featureLink.click();
            await page.waitForTimeout(1000); // Wait for page transition
            await page.screenshot({ path: 'artifacts/alignment-01-feature.png' });
        } catch (e) {
            console.log('Feature not found or timed out', e);
        }

        // 2. Capture Requirement Page
        const reqLink = page.getByRole('button', { name: 'REQ-001', exact: true });
        try {
            await expect(reqLink).toBeVisible({ timeout: 5000 });
            await reqLink.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'artifacts/alignment-02-requirement.png' });
        } catch (e) { console.log('REQ not found', e); }

        // 3. Capture ADR Page
        const adrLink = page.getByRole('button', { name: 'ADR-001', exact: true });
        try {
            await expect(adrLink).toBeVisible({ timeout: 5000 });
            await adrLink.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'artifacts/alignment-03-adr.png' });
        } catch (e) { console.log('ADR not found', e); }

        // 4. Capture Task Page
        const taskLink = page.getByRole('button', { name: 'TASK-001', exact: true });
        try {
            await expect(taskLink).toBeVisible({ timeout: 5000 });
            await taskLink.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'artifacts/alignment-04-task.png' });
        } catch (e) { console.log('Task not found', e); }
    });
});
