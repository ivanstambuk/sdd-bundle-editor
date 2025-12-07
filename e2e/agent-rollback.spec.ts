import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * E2E Test: Agent Rollback Capability
 * 
 * Tests the "Discard All Changes" button that reverts file changes
 * while keeping the conversation active for retry.
 */
test.describe('Agent Rollback', () => {
    let tempBundleDir: string;

    test.beforeEach(async () => {
        // Create a temporary directory for the bundle
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sdd-test-'));
        tempBundleDir = path.join(tmpDir, 'basic-bundle');

        // Copy the example bundle to the temp directory
        const sourceDir = path.resolve(__dirname, '../examples/basic-bundle');
        await fs.promises.cp(sourceDir, tempBundleDir, { recursive: true });

        // Initialize git repo for the commit/rollback features to work
        try {
            execSync('git init', { cwd: tempBundleDir });
            execSync('git config user.email "test@example.com"', { cwd: tempBundleDir });
            execSync('git config user.name "Test User"', { cwd: tempBundleDir });
            execSync('git add .', { cwd: tempBundleDir });
            execSync('git commit -m "Initial commit"', { cwd: tempBundleDir });
        } catch (e) {
            console.error('Failed to init git in temp dir', e);
        }

        console.log(`Created temp bundle at: ${tempBundleDir}`);
    });

    test.afterEach(async () => {
        // Clean up temp directory
        if (tempBundleDir) {
            await fs.promises.rm(path.dirname(tempBundleDir), { recursive: true, force: true });
        }
    });

    test('discard button reverts pending changes and keeps conversation active', async ({ page }) => {
        // Enable debug mode for testing
        await page.goto(`/?bundleDir=${encodeURIComponent(tempBundleDir)}&debug=true`);
        await page.waitForLoadState('networkidle');

        // Configure Mock agent
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('select.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Wait for config to save
        await page.waitForTimeout(500);

        // Start conversation
        await page.click('[data-testid="agent-start-btn"]');
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active');

        // Send a message that triggers pending changes
        await page.fill('[data-testid="agent-message-input"]', 'propose change');
        await page.click('[data-testid="agent-send-btn"]');

        // Wait for pending changes to appear
        await expect(page.locator('[data-testid="pending-changes-block"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('pending_changes');

        // Verify the Discard All Changes button is visible
        await expect(page.locator('[data-testid="agent-discard-btn"]')).toBeVisible();
        await expect(page.locator('[data-testid="agent-discard-btn"]')).toContainText('Discard All Changes');

        // Click Discard All Changes
        await page.click('[data-testid="agent-discard-btn"]');

        // Verify pending changes are cleared
        await expect(page.locator('[data-testid="pending-changes-block"]')).not.toBeVisible({ timeout: 3000 });

        // Verify conversation is still active (unlike abort which ends it)
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active');

        // Verify we can still send messages (conversation remains active)
        await page.fill('[data-testid="agent-message-input"]', 'hello after rollback');
        await expect(page.locator('[data-testid="agent-send-btn"]')).not.toBeDisabled();

        // Capture screenshot
        await page.screenshot({ path: 'artifacts/agent-rollback.png' });
    });

    test('discard button is not visible when no pending changes', async ({ page }) => {
        // Enable debug mode for testing
        await page.goto(`/?bundleDir=${encodeURIComponent(tempBundleDir)}&debug=true`);
        await page.waitForLoadState('networkidle');

        // Configure Mock agent
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('select.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');
        await page.waitForTimeout(500);

        // Start conversation
        await page.click('[data-testid="agent-start-btn"]');
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active');

        // Send a normal message (no pending changes)
        await page.fill('[data-testid="agent-message-input"]', 'hello');
        await page.click('[data-testid="agent-send-btn"]');

        // Wait for response
        await page.waitForTimeout(1000);

        // Verify discard button is NOT visible (no pending changes)
        await expect(page.locator('[data-testid="agent-discard-btn"]')).not.toBeVisible();
    });
});
