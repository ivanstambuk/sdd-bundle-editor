
import { test, expect } from '@playwright/test';
import * as path from 'path';

// Run agent tests serially since they share backend server state
test.describe.serial('Agent Conversation', () => {
    test('should start conversation and send message', async ({ page }) => {
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err}`));
        page.on('requestfailed', req => console.log(`[BROWSER REQ FAIL] ${req.url()} ${req.failure()?.errorText}`));
        page.on('response', res => {
            console.log(`[BROWSER RESP] ${res.url()} ${res.status()}`);
        });

        // 1. Navigate to the app
        await page.goto('/');

        // Reset state and configure echo backend
        await page.evaluate(async () => {
            await fetch('/agent/abort', { method: 'POST' });
            await fetch('/agent/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'cli',
                    options: { command: 'echo', args: [] }
                })
            });
        });
        await page.reload();

        // Wait for idle state
        await page.waitForSelector('.agent-placeholder', { timeout: 5000 });

        try {

            // 2. Click "Start Conversation" button (now styled)
            const startBtn = page.locator('button.start-btn');
            await expect(startBtn).toBeVisible();
            await expect(startBtn).toHaveClass(/btn-primary/); // Check styling

            await startBtn.click();

            // 3. Verify conversation started (input area visible)
            const inputArea = page.locator('textarea[placeholder="Describe changes..."]');
            try {
                await expect(inputArea).toBeVisible({ timeout: 5000 });
            } catch (e) {
                const errorText = await page.locator('.status-error').innerText().catch(() => 'No error displayed');
                console.log(`[TEST FAIL] Input not visible. UI Error: ${errorText}`);
                throw e;
            }

            // 4. Send a message
            await inputArea.fill('Test message from E2E');
            await page.locator('button.send-btn').click();

            // 5. Verify message appears in history (use first() since echo response also contains the text)
            await expect(page.locator('.message-content').getByText('Test message from E2E').first()).toBeVisible();

        } finally {
            // 6. Capture screenshot
            await page.screenshot({ path: 'artifacts/agent_conversation.png' });
        }
    });
});
