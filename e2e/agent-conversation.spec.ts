
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Agent Conversation', () => {
    test('should start conversation and send message', async ({ page }) => {
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err}`));
        page.on('requestfailed', req => console.log(`[BROWSER REQ FAIL] ${req.url()} ${req.failure()?.errorText}`));
        page.on('response', res => {
            console.log(`[BROWSER RESP] ${res.url()} ${res.status()}`);
        });

        // 1. Navigate to the app
        await page.goto('/');

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

            // 5. Verify message appears in history
            await expect(page.locator('.message-content').getByText('Test message from E2E')).toBeVisible();

        } finally {
            // 6. Capture screenshot
            await page.screenshot({ path: 'artifacts/agent_conversation.png' });
        }
    });
});
