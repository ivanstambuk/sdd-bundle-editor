import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test('analyze UI screenshots', async ({ page }) => {
    const bundleDir = getSampleBundlePath();

    // Navigate and wait for load
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);
    await page.waitForLoadState('networkidle');

    // Wait for entities to load
    await expect(page.getByText('Entities')).toBeVisible({ timeout: 10000 });

    // Capture initial state
    await page.screenshot({
        path: '/home/ivan/dev/sdd-bundle-editor/docs/screenshots/ui-analysis-1-initial.png',
        fullPage: true
    });

    // Click on a Requirement entity
    const reqGroup = page.locator('.entity-group-header', { hasText: 'Requirement' });
    if (await reqGroup.isVisible()) {
        await reqGroup.click();
        await page.waitForTimeout(300);
    }

    // Click first requirement
    const firstReq = page.locator('.entity-btn', { hasText: /REQ-/ }).first();
    if (await firstReq.isVisible()) {
        await firstReq.click();
        await page.waitForTimeout(500);
    }

    // Capture with entity selected
    await page.screenshot({
        path: '/home/ivan/dev/sdd-bundle-editor/docs/screenshots/ui-analysis-2-entity.png',
        fullPage: true
    });

    // Log info about key elements for analysis
    const banner = page.locator('.info-banner');
    const bannerBox = await banner.boundingBox();
    console.log('Info banner bounding box:', bannerBox);

    const header = page.locator('.app-header');
    const headerBox = await header.boundingBox();
    console.log('Header bounding box:', headerBox);

    const sidebar = page.locator('.sidebar');
    const sidebarBox = await sidebar.boundingBox();
    console.log('Sidebar bounding box:', sidebarBox);

    // Check MCP status
    const mcpStatus = await page.locator('[data-testid="mcp-status"]').textContent();
    console.log('MCP Status:', mcpStatus);
});
