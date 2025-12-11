import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';
import { setupMockAgent, startAgentConversation, sendAgentMessage } from './fixtures/agent-test-fixture';

// Run agent tests serially since they share backend server state
test.describe.serial('Agent Conversation', () => {
    test('should start conversation and send message', async ({ page }) => {
        const bundleDir = getSampleBundlePath();

        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err}`));

        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, bundleDir);

        // Wait for entity groups to load
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        try {
            // Start conversation using shared helper
            await startAgentConversation(page);

            // Verify conversation started (input area visible)
            await expect(page.locator('[data-testid="agent-message-input"]')).toBeVisible({ timeout: 10000 });

            // Send a message using shared helper
            await sendAgentMessage(page, 'Test message from E2E');

            // Verify message appears in history
            await expect(page.locator('.message-content').getByText('Test message from E2E').first()).toBeVisible({ timeout: 10000 });

        } finally {
            // Capture screenshot
            await page.screenshot({ path: 'artifacts/agent_conversation.png' });
        }
    });
});
