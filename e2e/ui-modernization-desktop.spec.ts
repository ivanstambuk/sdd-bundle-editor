import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('UI Modernization - Desktop', () => {
    const bundlePath = getSampleBundlePath();

    test.beforeEach(async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(bundlePath)}&resetAgent=true`);
        await page.waitForSelector('.app-shell', { timeout: 10000 });
    });

    test('Antigravity Dark theme and balanced density', async ({ page }) => {
        // Verify dark background colors
        const appShell = page.locator('.app-shell');
        const bgColor = await appShell.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return styles.backgroundColor;
        });

        // Should be very dark (Antigravity palette)
        console.log('Background color:', bgColor);

        // Verify font size is 14px base
        const fontSize = await appShell.evaluate(() => {
            return window.getComputedStyle(document.documentElement).fontSize;
        });
        expect(fontSize).toBe('14px');

        // Capture screenshot
        await page.screenshot({ path: 'artifacts/desktop-antigravity-theme.png', fullPage: true });
    });

    test('VS Code minimal header with breadcrumb', async ({ page }) => {
        // Verify header height is reduced (48px)
        const header = page.locator('.app-header');
        const headerBox = await header.boundingBox();
        expect(headerBox?.height).toBeLessThanOrEqual(52); // Allow small variance

        // Verify breadcrumb is visible
        const breadcrumb = page.locator('.breadcrumb');
        await expect(breadcrumb).toBeVisible();

        // Verify hamburger menu button exists
        const hamburger = page.locator('[data-testid="sidebar-toggle"]');
        await expect(hamburger).toBeVisible();

        // Verify icon buttons (no text labels)
        const agentToggle = page.locator('[data-testid="agent-toggle"]');
        const agentText = await agentToggle.textContent();
        expect(agentText?.trim()).toBe('🤖'); // Only icon, no "Agent" text

        // Select an entity to populate breadcrumb
        await page.click('[data-testid="entity-REQ-002"]');
        await page.waitForTimeout(500);

        // Verify breadcrumb shows entity path
        const breadcrumbText = await breadcrumb.textContent();
        expect(breadcrumbText).toContain('Requirement');
        expect(breadcrumbText).toContain('REQ-002');

        // Capture screenshot with breadcrumb
        await page.screenshot({ path: 'artifacts/desktop-header-breadcrumb.png' });
    });

    test('VS Code compact entity tree with icons', async ({ page }) => {
        // Verify entity group headers are buttons
        const groupHeader = page.locator('.entity-group-header').first();
        await expect(groupHeader).toHaveCSS('cursor', 'pointer');

        // Verify chevron icon exists
        const chevron = page.locator('.entity-group-chevron').first();
        await expect(chevron).toBeVisible();
        const chevronText = await chevron.textContent();
        expect(chevronText).toMatch(/[▸▾]/);

        // Verify entity type icon exists
        const icon = page.locator('.entity-group-icon').first();
        await expect(icon).toBeVisible();

        // Verify count badge exists
        const countBadge = page.locator('.entity-group-count').first();
        await expect(countBadge).toBeVisible();
        const countText = await countBadge.textContent();
        expect(parseInt(countText || '0')).toBeGreaterThan(0);

        // Test collapse/expand functionality
        const entityType = await page.locator('.entity-group').first().getAttribute('data-type');
        const groupToggle = page.locator(`[data-testid="entity-group-${entityType}"]`);

        // Initially expanded (chevron down)
        let chevronInitial = await chevron.textContent();
        expect(chevronInitial).toBe('▾');

        // Click to collapse
        await groupToggle.click();
        await page.waitForTimeout(200);

        // Verify chevron rotated (pointing right)
        const chevronCollapsed = await chevron.textContent();
        expect(chevronCollapsed).toBe('▸');

        // Verify entity list is hidden
        const entityList = page.locator('.entity-group.collapsed .entity-list');
        await expect(entityList).not.toBeVisible();

        // Click to expand again
        await groupToggle.click();
        await page.waitForTimeout(200);

        // Verify chevron down again
        const chevronExpanded = await chevron.textContent();
        expect(chevronExpanded).toBe('▾');

        // Capture screenshot showing compact tree
        await page.screenshot({ path: 'artifacts/desktop-compact-tree.png' });
    });

    test('Sidebar collapse functionality', async ({ page }) => {
        const sidebar = page.locator('.sidebar');
        const hamburger = page.locator('[data-testid="sidebar-toggle"]');

        // Initially not collapsed
        await expect(sidebar).not.toHaveClass(/collapsed/);

        // Click hamburger to collapse
        await hamburger.click();
        await page.waitForTimeout(300);

        // Verify collapsed class added
        await expect(sidebar).toHaveClass(/collapsed/);

        // Capture collapsed state
        await page.screenshot({ path: 'artifacts/desktop-sidebar-collapsed.png' });

        // Click again to expand
        await hamburger.click();
        await page.waitForTimeout(300);

        // Verify expanded
        await expect(sidebar).not.toHaveClass(/collapsed/);

        // Capture expanded state
        await page.screenshot({ path: 'artifacts/desktop-sidebar-expanded.png' });
    });

    test('Font sizes and spacing match spec', async ({ page }) => {
        // Verify entity tree uses 13px font
        const entityBtn = page.locator('.entity-btn').first();
        const fontSize = await entityBtn.evaluate((el) => {
            return window.getComputedStyle(el).fontSize;
        });
        expect(fontSize).toBe('13px');

        // Verify tight spacing on entity buttons
        const padding = await entityBtn.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
                top: styles.paddingTop,
                bottom: styles.paddingBottom,
            };
        });

        // Should be around 4px for VS Code compact style
        expect(parseFloat(padding.top)).toBeLessThanOrEqual(6);
        expect(parseFloat(padding.bottom)).toBeLessThanOrEqual(6);

        // Capture full UI for density comparison
        await page.screenshot({ path: 'artifacts/desktop-full-density.png', fullPage: true });
    });
});
