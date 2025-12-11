import { test, expect } from '@playwright/test';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';
import { setupMockAgent, startAgentConversation, sendAgentMessage, waitForPendingChanges } from './fixtures/agent-test-fixture';

/**
 * E2E Test: Agent Rollback Capability
 * 
 * Tests the "Discard All Changes" button that reverts file changes
 * while keeping the conversation active for retry.
 */
test.describe('Agent Rollback', () => {
    let tempBundleDir: string;

    test.beforeEach(async ({ page }) => {
        tempBundleDir = await createTempBundle('sdd-rollback-');
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('discard button reverts pending changes and keeps conversation active', async ({ page }) => {
        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, tempBundleDir);
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Start conversation using shared helper
        await startAgentConversation(page);

        // Send a message that triggers pending changes
        await page.fill('[data-testid="agent-message-input"]', 'propose change');
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.click('[data-testid="agent-send-btn"]');
        await responsePromise;

        // Wait for pending changes to appear using shared helper
        await waitForPendingChanges(page);

        // Verify the Discard All Changes button is visible
        await expect(page.locator('[data-testid="agent-discard-btn"]')).toBeVisible();
        await expect(page.locator('[data-testid="agent-discard-btn"]')).toContainText('Discard All Changes');

        // Click Discard All Changes
        await page.click('[data-testid="agent-discard-btn"]');

        // Verify pending changes are cleared
        await expect(page.locator('[data-testid="pending-changes-block"]')).not.toBeVisible({ timeout: 5000 });

        // Verify conversation is still active (unlike abort which ends it)
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active');

        // Verify we can still send messages
        await page.fill('[data-testid="agent-message-input"]', 'hello after rollback');
        await expect(page.locator('[data-testid="agent-send-btn"]')).not.toBeDisabled();

        // Capture screenshot
        await page.screenshot({ path: 'artifacts/agent-rollback.png' });
    });

    test('discard button is not visible when no pending changes', async ({ page }) => {
        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, tempBundleDir);
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Start conversation using shared helper
        await startAgentConversation(page);

        // Send a normal message (no pending changes)
        await sendAgentMessage(page, 'hello');

        // Verify discard button is NOT visible (no pending changes)
        await expect(page.locator('[data-testid="agent-discard-btn"]')).not.toBeVisible();
    });
});
