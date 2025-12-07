import { test, expect } from '@playwright/test';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { execSync } = require('child_process');

test.describe('Agent Change Application', () => {
    let tempBundleDir: string;

    test.beforeEach(async () => {
        // Create a temporary directory for the bundle
        const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sdd-test-'));
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

        console.log(`Created temp bundle at: ${tempBundleDir}`);
    });

    test.afterEach(async () => {
        // Cleanup temp directory
        if (tempBundleDir) {
            try {
                // Delete parent tmp dir
                await fs.promises.rm(path.dirname(tempBundleDir), { recursive: true, force: true });
                console.log(`Cleaned up temp bundle at: ${tempBundleDir}`);
            } catch (err) {
                console.error('Failed to cleanup temp dir:', err);
            }
        }
    });

    test('should display and apply pending changes via Mock agent', async ({ page }) => {
        // 1. Navigate to the app with debug mode AND pointing to the temp bundle
        // Encode the path for URL safety
        const encodedPath = encodeURIComponent(tempBundleDir);
        await page.goto(`/?debug=true&bundleDir=${encodedPath}`);

        // 2. Open Agent Panel (it might be hidden initially? check layout)
        // ... (rest of the test logic remains similar, but now using clean state)

        // Wait for navigator to load content
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Debug screenshot
        // await page.screenshot({ path: 'artifacts/debug_initial_load.png' });

        const header = page.locator('h3', { hasText: 'Feature' }).first();
        // Just ensure it exists
        await expect(header).toBeVisible();
        await header.click();

        // 3. Configure Agent to "Mock"
        const configBtn = page.locator('button.settings-btn');
        await configBtn.click();

        // Switch to Mock Agent (Debug)
        const typeSelect = page.locator('select.form-control').first();
        await typeSelect.selectOption({ value: 'mock' });

        // Save config (force to avoid detachment race conditions)
        await page.locator('button:has-text("Save")').click({ force: true });

        // Click Start Conversation
        await page.locator('button.start-btn').click();

        // Wait for active state (textarea)
        await page.waitForSelector('textarea');

        // 4. Send a message to trigger changes
        await page.fill('textarea', 'propose change');

        // Wait for the response to ensure backend processing
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.click('button.send-btn');
        await responsePromise;

        // Wait for agent message bubble to appear (confirms state update in UI)
        await expect(page.locator('.message.role-agent').last()).toContainText('propose');

        // 5. Verify Diff View
        await expect(page.locator('text=Proposed Changes')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.diff-old')).toContainText('Original');
        await expect(page.locator('.diff-new')).toContainText('New');

        // 6. Click Accept (force)
        await page.locator('button:has-text("Accept & Apply")').click({ force: true });

        // 7. Verify Success
        // Mock backend returns to 'committed' status after applying
        await expect(page.locator('.status-badge')).toHaveText(/committed/i, { timeout: 30000 });
    });
});
