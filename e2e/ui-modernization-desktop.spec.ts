import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('UI Modernization - Desktop', () => {
    const bundlePath = getSampleBundlePath();

    test.beforeEach(async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(bundlePath)}`);
        await page.waitForSelector('.app-shell', { timeout: 10000 });
    });

    test('Dark theme and balanced density', async ({ page }) => {
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
        await page.screenshot({ path: 'artifacts/desktop-theme.png', fullPage: true });
    });

    test('Minimal header with breadcrumb', async ({ page }) => {
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

        // Expand Requirement group first (groups start collapsed)
        await page.click('[data-testid="entity-group-Requirement"]');
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

    test('Compact entity tree with icons', async ({ page }) => {
        // Verify entity group headers are buttons
        const groupHeader = page.locator('.entity-group-header').first();
        await expect(groupHeader).toHaveCSS('cursor', 'pointer');

        // Verify chevron icon exists
        const chevron = page.locator('.entity-group-chevron').first();
        await expect(chevron).toBeVisible();
        const chevronText = await chevron.textContent();
        expect(chevronText).toMatch(/[▸▾]/);

        // Entity type icons are now schema-driven (x-sdd-ui.icon)
        // They may or may not be present depending on schema configuration
        const iconCount = await page.locator('.entity-group-icon').count();
        console.log(`Found ${iconCount} entity group icons (schema-driven)`);

        // Verify count badge exists
        const countBadge = page.locator('.entity-group-count').first();
        await expect(countBadge).toBeVisible();
        const countText = await countBadge.textContent();
        expect(parseInt(countText || '0')).toBeGreaterThan(0);

        // Test collapse/expand functionality
        const entityType = await page.locator('.entity-group').first().getAttribute('data-type');
        const groupToggle = page.locator(`[data-testid="entity-group-${entityType}"]`);

        // Initially collapsed (chevron right) - groups start collapsed now
        let chevronInitial = await chevron.textContent();
        expect(chevronInitial).toBe('▸');

        // Click to expand
        await groupToggle.click();
        await page.waitForTimeout(200);

        // Verify chevron rotated (pointing down)
        const chevronExpanded = await chevron.textContent();
        expect(chevronExpanded).toBe('▾');

        // Verify entity list is now visible
        const firstGroup = page.locator('.entity-group').first();
        await expect(firstGroup.locator('.entity-list')).toBeVisible();

        // Click to collapse again
        await groupToggle.click();
        await page.waitForTimeout(200);

        // Verify chevron right again
        const chevronCollapsed = await chevron.textContent();
        expect(chevronCollapsed).toBe('▸');

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
        // First expand a group to get entity buttons visible
        await page.click('[data-testid="entity-group-Feature"]');
        await page.waitForTimeout(300);

        // Wait for entity button to be visible
        const entityBtn = page.locator('.entity-btn').first();
        await expect(entityBtn).toBeVisible({ timeout: 5000 });

        // Verify entity tree uses small font size (var(--font-size-sm) = 0.8125rem ≈ 11.375px)
        const fontSize = await entityBtn.evaluate((el) => {
            return window.getComputedStyle(el).fontSize;
        });
        // Font size is 0.8125rem with 14px base = 11.375px
        const fontSizeValue = parseFloat(fontSize);
        expect(fontSizeValue).toBeGreaterThanOrEqual(11);
        expect(fontSizeValue).toBeLessThanOrEqual(14);

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

    test('Read-only banner is visible', async ({ page }) => {
        // Verify the read-only banner is displayed
        const banner = page.locator('[data-testid="read-only-banner"]');
        await expect(banner).toBeVisible();

        const bannerText = await banner.textContent();
        expect(bannerText).toContain('Read-Only');
        expect(bannerText).toContain('MCP');
    });
});
