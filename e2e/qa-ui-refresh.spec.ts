
import { test, expect } from '@playwright/test';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

test.describe('QA UI Refresh on Agent Accept', () => {
    let tempBundleDir: string;

    test.beforeEach(async () => {
        // Create a temporary directory for the bundle
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sdd-test-qa-'));
        tempBundleDir = path.join(tmpDir, 'basic-bundle');

        // Copy the example bundle to the temp directory
        const sourceDir = path.resolve(__dirname, '../examples/basic-bundle');
        await fs.promises.cp(sourceDir, tempBundleDir, { recursive: true });

        // Initialize git repo for the commit feature to work
        try {
            execSync('git init', { cwd: tempBundleDir });
            execSync('git config user.email "test@example.com"', { cwd: tempBundleDir });
            execSync('git config user.name "Test User"', { cwd: tempBundleDir });
            execSync('git add .', { cwd: tempBundleDir });
            execSync('git commit -m "Initial commit"', { cwd: tempBundleDir });
        } catch (e) {
            console.error('Failed to init git in temp dir', e);
        }
    });

    test.afterEach(async () => {
        if (tempBundleDir) {
            try {
                await fs.promises.rm(path.dirname(tempBundleDir), { recursive: true, force: true });
            } catch (err) {
                console.error('Failed to cleanup temp dir:', err);
            }
        }
    });

    test('should refresh entity details in UI after agent changes are accepted', async ({ page }) => {
        const encodedPath = encodeURIComponent(tempBundleDir);
        await page.goto(`/?bundleDir=${encodedPath}&debug=true`);

        // 1. Wait for bundle to load and select the FEAT-001 entity
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Click on FEAT-001 in the entity navigator (using entity-btn class)
        await page.locator('.entity-btn', { hasText: 'FEAT-001' }).click();

        // Verify initial state using the title input field
        const titleInput = page.locator('#root_title');
        await expect(titleInput).toHaveValue('Basic Demo Feature');

        // 2. Configure Mock Agent
        await page.locator('[data-testid="agent-settings-btn"]').click();
        await page.locator('select.form-control').first().selectOption({ value: 'mock' });
        await page.locator('[data-testid="agent-save-config-btn"]').click();

        // Wait for settings to close and configuration to apply
        await page.waitForTimeout(500);

        // 3. Start conversation - button should now be enabled
        const startBtn = page.locator('[data-testid="agent-start-btn"]');
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();

        // Wait for active state
        await page.waitForSelector('[data-testid="agent-message-input"]', { timeout: 10000 });

        // 4. Send message to trigger mock backend to propose a change
        await page.locator('[data-testid="agent-message-input"]').fill('propose change');

        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        // 5. Wait for pending changes block
        await expect(page.locator('[data-testid="pending-changes-block"]')).toBeVisible({ timeout: 15000 });

        // 6. Click Accept to apply changes
        await page.locator('[data-testid="agent-accept-btn"]').click();

        // 7. Verify UI refresh: the title input should now show the updated value
        // Monitor browser console for AppShell logs
        page.on('console', msg => console.log('BROWSER:', msg.text()));

        // Wait for bundle reload to complete - give more time for the refresh cycle
        await page.waitForTimeout(3000);

        // Debug: Check current value
        const currentValue = await titleInput.inputValue();
        console.log('Current title value after accept:', currentValue);

        // The key verification: selectedEntity should be updated with fresh data after bundle fetch
        // Mock backend changes title to "Updated Demo Feature Title"
        await expect(titleInput).toHaveValue('Updated Demo Feature Title', { timeout: 10000 });

        // Screenshot for visual verification
        await page.screenshot({ path: 'artifacts/qa_ui_refresh_verified.png' });
    });
});
