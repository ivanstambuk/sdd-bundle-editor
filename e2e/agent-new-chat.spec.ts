import { test, expect } from '@playwright/test';

const BUNDLE_DIR = process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';

test.describe('Agent New Chat', () => {
    test('should show "New Chat" button only when conversation is active', async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(BUNDLE_DIR)}`);
        await page.waitForSelector('[data-testid="agent-toggle"]');

        // Open agent panel
        await page.click('[data-testid="agent-toggle"]');

        // Initially, new chat button should NOT be visible (status is idle)
        await expect(page.locator('[data-testid="agent-new-chat-btn"]')).not.toBeVisible();

        // Start conversation
        await page.click('[data-testid="agent-start-btn"]');
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")');

        // Now new chat button SHOULD be visible
        await expect(page.locator('[data-testid="agent-new-chat-btn"]')).toBeVisible();
    });

    test('should reset conversation when "New Chat" is clicked (no pending changes)', async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(BUNDLE_DIR)}`);
        await page.waitForSelector('[data-testid="agent-toggle"]');

        // Open agent panel and start conversation
        await page.click('[data-testid="agent-toggle"]');
        await page.click('[data-testid="agent-start-btn"]');
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")');

        // Send a message
        await page.fill('[data-testid="agent-message-input"]', 'Hello agent');
        await page.click('[data-testid="agent-send-btn"]');

        // Wait for agent response
        await page.waitForSelector('.message.role-agent', { timeout: 10000 });

        // Click "New Chat"
        await page.click('[data-testid="agent-new-chat-btn"]');

        // Should return to idle state
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("idle")');

        // New chat button should disappear
        await expect(page.locator('[data-testid="agent-new-chat-btn"]')).not.toBeVisible();

        // Start conversation button should be visible again
        await expect(page.locator('[data-testid="agent-start-btn"]')).toBeVisible();
    });

    test('should show confirmation dialog when pending changes exist', async ({ page }) => {
        await page.goto(`/?bundleDir=${encodeURIComponent(BUNDLE_DIR)}`);
        await page.waitForSelector('[data-testid="agent-toggle"]');

        // Open agent panel and start conversation
        await page.click('[data-testid="agent-toggle"]');
        await page.click('[data-testid="agent-start-btn"]');
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")');

        // Send a message that creates pending changes
        await page.fill('[data-testid="agent-message-input"]', 'Change the bundle title to "Test Bundle Updated"');
        await page.click('[data-testid="agent-send-btn"]');

        // Wait for pending changes
        await page.waitForSelector('[data-testid="pending-changes-block"]', { timeout: 15000 });

        // Set up dialog handler to accept
        page.once('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            expect(dialog.message()).toContain('pending changes');
            await dialog.accept();
        });

        // Click "New Chat"
        await page.click('[data-testid="agent-new-chat-btn"]');

        // Should return to idle state after confirmation
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("idle")');
    });
});
