import { test, expect } from '@playwright/test';
import { cpSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

test.describe('Agent Diff View Screenshot', () => {
    let tempDir: string;
    let bundlePath: string;

    test.beforeAll(() => {
        tempDir = mkdtempSync(join(tmpdir(), 'sdd-test-'));
        bundlePath = join(tempDir, 'basic-bundle');
        cpSync('examples/basic-bundle', bundlePath, {
            recursive: true,
            filter: (src) => !src.includes('.git')
        });
        console.log('Created temp bundle at:', bundlePath);
    });

    test.afterAll(() => {
        try {
            rmSync(tempDir, { recursive: true, force: true });
            console.log('Cleaned up temp bundle at:', bundlePath);
        } catch (err) {
            console.error('Failed to clean up temp bundle:', err);
        }
    });

    test('should capture improved diff view', async ({ page }) => {
        // Navigate to the app with the test bundle
        const encodedPath = encodeURIComponent(bundlePath);
        await page.goto(`/?bundleDir=${encodedPath}`);

        // Wait for bundle to load - check for entity groups
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure mock agent
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Wait for settings to close
        await expect(page.locator('[data-testid="agent-start-btn"]')).toBeVisible();

        // Start conversation
        await page.click('[data-testid="agent-start-btn"]');

        // Wait for the input to be enabled
        await expect(page.locator('[data-testid="agent-message-input"]')).toBeEnabled({ timeout: 5000 });

        // Send a message that will trigger a change proposal
        await page.fill('[data-testid="agent-message-input"]', 'propose change');
        await page.click('[data-testid="agent-send-btn"]');

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
