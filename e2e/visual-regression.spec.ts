/**
 * Visual Regression Test
 * 
 * Captures baseline screenshots and compares against future runs.
 * This catches visual bugs that functional tests might miss.
 * 
 * Usage:
 *   # First run creates baselines
 *   pnpm exec playwright test e2e/visual-regression.spec.ts --update-snapshots
 *   
 *   # Subsequent runs compare against baselines
 *   pnpm exec playwright test e2e/visual-regression.spec.ts
 */

import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('Visual Regression Tests', () => {
    const bundleDir = getSampleBundlePath();

    test('initial load matches baseline', async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible({ timeout: 10000 });

        // Wait for animations to settle
        await page.waitForTimeout(500);

        // Compare against baseline screenshot
        await expect(page).toHaveScreenshot('initial-load.png', {
            maxDiffPixelRatio: 0.01, // Allow 1% difference for anti-aliasing
            threshold: 0.2, // Color difference threshold
        });
    });

    test('entity selection matches baseline', async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible({ timeout: 10000 });

        // Expand Requirement group and select first entity
        const reqGroup = page.locator('.entity-group-header', { hasText: 'Requirement' });
        if (await reqGroup.isVisible()) {
            await reqGroup.click();
            await page.waitForTimeout(300);
        }

        const firstReq = page.locator('.entity-btn', { hasText: /REQ-/ }).first();
        if (await firstReq.isVisible()) {
            await firstReq.click();
            await page.waitForTimeout(500);
        }

        await expect(page).toHaveScreenshot('entity-selected.png', {
            maxDiffPixelRatio: 0.01,
            threshold: 0.2,
        });
    });

    test('sidebar collapsed matches baseline', async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible({ timeout: 10000 });

        // Collapse sidebar
        await page.locator('[data-testid="sidebar-toggle"]').click();
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot('sidebar-collapsed.png', {
            maxDiffPixelRatio: 0.01,
            threshold: 0.2,
        });
    });

    test('info banner layout is correct', async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);
        await page.waitForLoadState('networkidle');

        // Verify info banner spans full width and has correct layout
        const banner = page.locator('.info-banner');
        await expect(banner).toBeVisible();

        const bannerBox = await banner.boundingBox();
        const viewportSize = page.viewportSize();

        // Banner should span full viewport width (minus any scroll bar)
        expect(bannerBox).not.toBeNull();
        expect(bannerBox!.width).toBeGreaterThan(viewportSize!.width * 0.95);

        // Banner should be at the top (y position near 0)
        expect(bannerBox!.y).toBeLessThan(10);

        // Banner height should be reasonable (between 20-60px)
        expect(bannerBox!.height).toBeGreaterThan(20);
        expect(bannerBox!.height).toBeLessThan(60);
    });
});
