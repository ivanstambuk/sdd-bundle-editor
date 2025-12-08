import { test, expect } from '@playwright/test';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';

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

        // Reset agent state to ensure clean state for each test
        await page.goto('/');
        await page.evaluate(async () => {
            await fetch('/agent/abort', { method: 'POST' });
        });
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('discard button reverts pending changes and keeps conversation active', async ({ page }) => {
        // Navigate to bundle with debug mode
        await page.goto(`/?bundleDir=${encodeURIComponent(tempBundleDir)}&debug=true`);

        // Wait for app to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure Mock agent via UI (not API - more reliable with shared server state)
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('select.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Start conversation
        const startBtn = page.locator('[data-testid="agent-start-btn"]');
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active', { timeout: 10000 });

        // Send a message that triggers pending changes
        await page.fill('[data-testid="agent-message-input"]', 'propose change');

        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.click('[data-testid="agent-send-btn"]');
        await responsePromise;

        // Wait for pending changes to appear
        await expect(page.locator('text=Proposed Changes')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="pending-changes-block"]')).toBeVisible({ timeout: 10000 });

        // Verify the Discard All Changes button is visible
        await expect(page.locator('[data-testid="agent-discard-btn"]')).toBeVisible();
        await expect(page.locator('[data-testid="agent-discard-btn"]')).toContainText('Discard All Changes');

        // Click Discard All Changes
        await page.click('[data-testid="agent-discard-btn"]');

        // Verify pending changes are cleared
        await expect(page.locator('[data-testid="pending-changes-block"]')).not.toBeVisible({ timeout: 5000 });

        // Verify conversation is still active (unlike abort which ends it)
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active');

        // Verify we can still send messages (conversation remains active)
        await page.fill('[data-testid="agent-message-input"]', 'hello after rollback');
        await expect(page.locator('[data-testid="agent-send-btn"]')).not.toBeDisabled();

        // Capture screenshot
        await page.screenshot({ path: 'artifacts/agent-rollback.png' });
    });

    test('discard button is not visible when no pending changes', async ({ page }) => {
        // Navigate to bundle with debug mode
        await page.goto(`/?bundleDir=${encodeURIComponent(tempBundleDir)}&debug=true`);

        // Wait for app to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure Mock agent via UI
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('select.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Start conversation
        const startBtn = page.locator('[data-testid="agent-start-btn"]');
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active', { timeout: 10000 });

        // Send a normal message (no pending changes - "hello" doesn't trigger changes in mock backend)
        await page.fill('[data-testid="agent-message-input"]', 'hello');
        await page.click('[data-testid="agent-send-btn"]');

        // Wait for agent response
        await expect(page.locator('.message.role-agent').last()).toContainText('hello', { timeout: 5000 });

        // Verify discard button is NOT visible (no pending changes)
        await expect(page.locator('[data-testid="agent-discard-btn"]')).not.toBeVisible();
    });
});
