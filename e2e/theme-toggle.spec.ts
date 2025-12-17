/**
 * E2E tests for theme switching functionality.
 * Tests the light/dark theme toggle and persistence.
 */

import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

const bundleDir = getSampleBundlePath();

test.describe('Theme Toggle', () => {
    test('defaults to dark theme', async ({ page }) => {
        // Clear any existing theme preference
        await page.addInitScript(() => {
            localStorage.removeItem('sdd:theme');
        });

        await page.goto(`/?bundleDir=${bundleDir}`);
        await page.waitForSelector('.app-shell');

        // Theme toggle should show sun emoji (meaning we're in dark mode, can switch to light)
        const themeToggle = page.locator('.theme-toggle');
        await expect(themeToggle).toBeVisible();
        await expect(themeToggle).toContainText('☀️');
    });

    test('toggles to light theme when clicked', async ({ page }) => {
        // Clear any existing theme preference
        await page.addInitScript(() => {
            localStorage.removeItem('sdd:theme');
        });

        await page.goto(`/?bundleDir=${bundleDir}`);
        await page.waitForSelector('.app-shell');

        // Find and click the theme toggle button
        const themeToggle = page.locator('.theme-toggle');
        await expect(themeToggle).toBeVisible();

        // Should show sun emoji in dark mode (to switch to light)
        await expect(themeToggle).toContainText('☀️');

        // Click to switch to light theme
        await themeToggle.click();

        // Verify light theme is applied via data-theme attribute
        const theme = await page.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        expect(theme).toBe('light');

        // Should now show moon emoji (to switch back to dark)
        await expect(themeToggle).toContainText('🌙');
    });

    test('toggles back to dark theme', async ({ page }) => {
        // Clear any existing theme preference
        await page.addInitScript(() => {
            localStorage.removeItem('sdd:theme');
        });

        await page.goto(`/?bundleDir=${bundleDir}`);
        await page.waitForSelector('.app-shell');

        const themeToggle = page.locator('.theme-toggle');

        // Switch to light
        await themeToggle.click();
        await expect(themeToggle).toContainText('🌙');

        // Switch back to dark
        await themeToggle.click();
        await expect(themeToggle).toContainText('☀️');

        // Verify dark theme is set
        const theme = await page.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        expect(theme).toBe('dark');
    });

    test('persists theme preference across page reload', async ({ page }) => {
        // Don't clear localStorage for this test - we want to test persistence
        await page.goto(`/?bundleDir=${bundleDir}`);
        await page.waitForSelector('.app-shell');

        // Switch to light theme
        const themeToggle = page.locator('.theme-toggle');
        await themeToggle.click();
        await expect(themeToggle).toContainText('🌙');

        // Verify localStorage was set
        const storedTheme = await page.evaluate(() => localStorage.getItem('sdd:theme'));
        expect(storedTheme).toBe('light');

        // Reload the page (localStorage should persist)
        await page.reload();
        await page.waitForSelector('.app-shell');

        // Should still be light theme
        const theme = await page.evaluate(() =>
            document.documentElement.getAttribute('data-theme')
        );
        expect(theme).toBe('light');

        // Toggle should show moon emoji
        await expect(page.locator('.theme-toggle')).toContainText('🌙');
    });

    test('captures screenshots of both themes', async ({ page }) => {
        // Clear any existing theme preference
        await page.addInitScript(() => {
            localStorage.removeItem('sdd:theme');
        });

        await page.goto(`/?bundleDir=${bundleDir}`);
        await page.waitForSelector('.app-shell');

        // Wait for basic UI to render
        await page.waitForSelector('.entity-navigator', { timeout: 10000 });

        // Capture dark theme screenshot
        await page.screenshot({
            path: 'artifacts/theme-dark.png',
            fullPage: false
        });

        // Switch to light theme
        await page.locator('.theme-toggle').click();

        // Wait for transition to complete
        await page.waitForTimeout(400);

        // Capture light theme screenshot
        await page.screenshot({
            path: 'artifacts/theme-light.png',
            fullPage: false
        });
    });

    test('theme toggle has correct accessibility attributes', async ({ page }) => {
        // Clear any existing theme preference
        await page.addInitScript(() => {
            localStorage.removeItem('sdd:theme');
        });

        await page.goto(`/?bundleDir=${bundleDir}`);
        await page.waitForSelector('.app-shell');

        const themeToggle = page.locator('.theme-toggle');

        // Check aria-label in dark mode
        const ariaLabel = await themeToggle.getAttribute('aria-label');
        expect(ariaLabel).toBe('Switch to light theme');

        // Check title
        const title = await themeToggle.getAttribute('title');
        expect(title).toBe('Switch to light theme');

        // After toggle, labels should update
        await themeToggle.click();

        const ariaLabelAfter = await themeToggle.getAttribute('aria-label');
        expect(ariaLabelAfter).toBe('Switch to dark theme');
    });
});
