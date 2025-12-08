
import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

// Run agent tests serially since they share backend server state
test.describe.serial('Agent Conversation', () => {
    test.beforeEach(async ({ page }) => {
        // No manual reset needed here, we'll use resetAgent=true in the test
    });

    test('should start conversation and send message', async ({ page }) => {
        const bundleDir = getSampleBundlePath();

        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err}`));

        // Navigate to the app with bundleDir and debug mode (for mock agent)
        // Use resetAgent=true to ensure clean backend state
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true&resetAgent=true`);

        // Wait for app to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure Mock agent via UI (simpler than CLI for testing)
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        try {
            // Start Conversation
            const startBtn = page.locator('[data-testid="agent-start-btn"]');
            await expect(startBtn).toBeEnabled({ timeout: 5000 });
            await startBtn.click();

            // Verify conversation started (input area visible)
            const inputArea = page.locator('[data-testid="agent-message-input"]');
            await expect(inputArea).toBeVisible({ timeout: 10000 });

            // Send a message
            await inputArea.fill('Test message from E2E');
            await page.locator('[data-testid="agent-send-btn"]').click();

            // Verify message appears in history
            await expect(page.locator('.message-content').getByText('Test message from E2E').first()).toBeVisible({ timeout: 10000 });

        } finally {
            // Capture screenshot
            await page.screenshot({ path: 'artifacts/agent_conversation.png' });
        }
    });
});
