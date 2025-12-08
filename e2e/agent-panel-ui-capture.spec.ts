import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

/**
 * Test to capture Agent Panel UI state after redesign
 * This demonstrates the polished chat-like interface
 */
test.describe.serial('Agent Panel UI Capture - After Redesign', () => {
    test('capture redesigned agent panel', async ({ page }) => {
        const bundleDir = getSampleBundlePath();

        // Navigate to the app with debug mode enabled (to allow Echo CLI)
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true`);

        // Wait for the app to load
        await expect(page.locator('.app-shell')).toBeVisible();
        await page.waitForTimeout(1000);

        // Ensure agent is configured so the Start button is enabled
        await page.evaluate(async () => {
            await fetch('/agent/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'cli',
                    options: { command: 'echo', args: ['hello'] }
                })
            });
        });
        await page.reload();
        await page.waitForTimeout(1000); // Wait for hydration

        // Capture initial state showing the idle agent panel
        await page.screenshot({ path: 'artifacts/agent-panel-after-idle.png', fullPage: true });

        // Click "Start Conversation" button
        const startBtn = page.locator('button:has-text("Start Conversation")');
        if (await startBtn.isVisible()) {
            await startBtn.click();
            await page.waitForTimeout(500);

            // Capture active state with the new chat interface
            await page.screenshot({ path: 'artifacts/agent-panel-after-active.png', fullPage: true });

            // Type a message
            const textarea = page.locator('.agent-panel textarea');
            await textarea.fill('What is this project about? Please give me a detailed overview.');

            // Capture with message typed
            await page.screenshot({ path: 'artifacts/agent-panel-after-typing.png', fullPage: true });

            // Send the message
            const sendBtn = page.locator('.send-btn');
            await sendBtn.click();

            // Wait for response (Codex CLI takes time)
            await page.waitForTimeout(15000);

            // Capture the response - this should show the beautiful new layout
            await page.screenshot({ path: 'artifacts/agent-panel-after-response.png', fullPage: true });

            // Also capture just the right sidebar
            const rightSidebar = page.locator('.right-sidebar');
            if (await rightSidebar.isVisible()) {
                await rightSidebar.screenshot({ path: 'artifacts/agent-panel-after-sidebar.png' });
            }

            console.log('Screenshots captured successfully!');
        } else {
            // Agent not configured - capture that state
            await page.screenshot({ path: 'artifacts/agent-panel-not-configured.png', fullPage: true });
        }
    });
});
