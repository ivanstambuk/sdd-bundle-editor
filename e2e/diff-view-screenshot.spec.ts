import { test, expect } from '@playwright/test';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';

test.describe('Agent Diff View Screenshot', () => {
    let tempDir: string;
    let bundlePath: string;

    test.beforeAll(async () => {
        bundlePath = await createTempBundle('sdd-diff-view-');
        tempDir = bundlePath;
        console.log('Created temp bundle at:', bundlePath);
    });

    test.afterAll(async () => {
        await cleanupTempBundle(tempDir);
    });

    test('should capture improved diff view', async ({ page }) => {
        // Navigate to the app with the test bundle (debug=true required for Mock agent)
        const encodedPath = encodeURIComponent(bundlePath);
        await page.goto(`/?bundleDir=${encodedPath}&debug=true`);

        // Wait for app and bundle to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure mock agent via UI (not API - more reliable)
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Start conversation
        await expect(page.locator('[data-testid="agent-start-btn"]')).toBeEnabled({ timeout: 5000 });
        await page.click('[data-testid="agent-start-btn"]');

        // Wait for the input to be enabled
        await expect(page.locator('[data-testid="agent-message-input"]')).toBeEnabled({ timeout: 10000 });

        // Send a message that will trigger a change proposal
        await page.fill('[data-testid="agent-message-input"]', 'propose change');

        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.click('[data-testid="agent-send-btn"]');
        await responsePromise;

        // Wait for the "Proposed Changes" section to appear
        await expect(page.locator('text=Proposed Changes')).toBeVisible({ timeout: 15000 });

        // Wait a bit for animations to complete
        await page.waitForTimeout(500);

        // Capture screenshot of the entire agent panel with the diff view
        const agentPanel = page.locator('.agent-panel');
        await agentPanel.screenshot({ path: 'artifacts/improved_diff_view.png' });

        console.log('Screenshot captured to artifacts/improved_diff_view.png');
    });
});
