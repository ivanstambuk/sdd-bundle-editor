import { test, expect } from '@playwright/test';

const BUNDLE_DIR = process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';

test.describe('Agent New Chat', () => {
    test('should show "New Chat" button only when conversation is active', async ({ page }) => {
        // Use debug=true and resetAgent=true to ensure mock agent is configured
        await page.goto(`/?bundleDir=${encodeURIComponent(BUNDLE_DIR)}&debug=true&resetAgent=true`);
        await page.waitForSelector('.app-shell', { timeout: 10000 });

        // Configure mock agent before starting
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Initially, new chat button should NOT be visible (status is idle)
        await expect(page.locator('[data-testid="agent-new-chat-btn"]')).not.toBeVisible();

        // Start conversation
        await page.click('[data-testid="agent-start-btn"]');
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout: 10000 });

        // Now new chat button SHOULD be visible
        await expect(page.locator('[data-testid="agent-new-chat-btn"]')).toBeVisible();
    });

    test('should reset conversation when "New Chat" is clicked (no pending changes)', async ({ page }) => {
        // Use debug=true and resetAgent=true to ensure mock agent is configured
        await page.goto(`/?bundleDir=${encodeURIComponent(BUNDLE_DIR)}&debug=true&resetAgent=true`);
        await page.waitForSelector('.app-shell', { timeout: 10000 });

        // Configure mock agent before starting
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Start conversation
        await page.click('[data-testid="agent-start-btn"]');
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout: 10000 });

        // Send a message
        await page.fill('[data-testid="agent-message-input"]', 'Hello agent');
        await page.click('[data-testid="agent-send-btn"]');

        // Wait for agent response
        await page.waitForSelector('.message.role-agent', { timeout: 10000 });

        // Verify user message exists before reset
        await expect(page.locator('.message.role-user').first()).toContainText('Hello agent');

        // Click "New Chat" - this starts a new conversation (not idle)
        await page.click('[data-testid="agent-new-chat-btn"]');

        // After New Chat, conversation resets and starts fresh - status should be "active"
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout: 10000 });

        // Wait for the reset to complete - the old "Hello agent" message should be gone
        await expect(page.locator('.message.role-user:has-text("Hello agent")')).not.toBeVisible({ timeout: 10000 });

        // Message input should still be visible (conversation is active)
        await expect(page.locator('[data-testid="agent-message-input"]')).toBeVisible();
    });

    test('should show confirmation dialog when pending changes exist', async ({ page }) => {
        // Use debug=true and resetAgent=true to ensure mock agent is configured
        await page.goto(`/?bundleDir=${encodeURIComponent(BUNDLE_DIR)}&debug=true&resetAgent=true`);
        await page.waitForSelector('.app-shell', { timeout: 10000 });

        // Configure mock agent before starting
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Start conversation
        await page.click('[data-testid="agent-start-btn"]');
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout: 10000 });

        // Send a message that creates pending changes (mock agent responds with changes for 'propose' keyword)
        await page.fill('[data-testid="agent-message-input"]', 'propose change');
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

        // After confirmation and reset, New Chat starts a fresh conversation (status becomes "active")
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout: 15000 });

        // Pending changes should be cleared
        await expect(page.locator('[data-testid="pending-changes-block"]')).not.toBeVisible({ timeout: 5000 });

        // Message input should be visible (conversation is active and ready for input)
        await expect(page.locator('[data-testid="agent-message-input"]')).toBeVisible();
    });
});
