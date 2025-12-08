
import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

// Run agent tests serially since they share backend server state
test.describe.serial('Agent Conversation', () => {
    test('should start conversation and send message', async ({ page }) => {
        const bundleDir = getSampleBundlePath();

        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err}`));
        page.on('requestfailed', req => console.log(`[BROWSER REQ FAIL] ${req.url()} ${req.failure()?.errorText}`));

        // 1. Navigate to the app with bundleDir
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

        // Wait for app to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure echo CLI backend via UI (not API - more reliable)
        await page.click('[data-testid="agent-settings-btn"]');

        // Select CLI type
        const typeSelect = page.locator('.agent-settings select').first();
        await typeSelect.selectOption({ label: 'Local CLI Tool' });

        // Wait for preset options
        await page.waitForSelector('.agent-settings select:nth-of-type(2)', { timeout: 5000 });

        // Select custom preset
        const presetSelect = page.locator('.agent-settings select').nth(1);
        await presetSelect.selectOption('custom');

        // Enter echo command
        await page.getByPlaceholder('e.g. codex').fill('echo');

        // Save
        await page.click('[data-testid="agent-save-config-btn"]');

        // Wait for config to take effect
        await page.waitForTimeout(500);

        try {
            // 2. Click "Start Conversation" button
            const startBtn = page.locator('[data-testid="agent-start-btn"]');
            await expect(startBtn).toBeEnabled({ timeout: 5000 });
            await startBtn.click();

            // 3. Verify conversation started (input area visible)
            const inputArea = page.locator('[data-testid="agent-message-input"]');
            try {
                await expect(inputArea).toBeVisible({ timeout: 10000 });
            } catch (e) {
                const errorText = await page.locator('.status-error').innerText().catch(() => 'No error displayed');
                console.log(`[TEST FAIL] Input not visible. UI Error: ${errorText}`);
                throw e;
            }

            // 4. Send a message
            await inputArea.fill('Test message from E2E');
            await page.locator('[data-testid="agent-send-btn"]').click();

            // 5. Verify message appears in history
            await expect(page.locator('.message-content').getByText('Test message from E2E').first()).toBeVisible({ timeout: 10000 });

        } finally {
            // 6. Capture screenshot
            await page.screenshot({ path: 'artifacts/agent_conversation.png' });
        }
    });
});
