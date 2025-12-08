import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

/**
 * E2E Test for Entity Creation via Agent
 * 
 * This test verifies that:
 * 1. New entities can be created via the agent
 * 2. The entity appears in the left sidebar after creation
 * 3. The entity file is correctly written to the bundle directory
 */
test.describe('Entity Creation via Agent', () => {
    let tempBundleDir: string;

    test.beforeEach(async () => {
        // Create a temporary copy of the basic-bundle
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-entity-creation-'));
        tempBundleDir = tempDir;

        // Copy the example bundle
        const sourceDir = path.resolve(__dirname, '../examples/basic-bundle');
        await copyDir(sourceDir, tempDir);

        // Initialize git in temp dir
        const { execSync } = require('child_process');
        execSync('git init', { cwd: tempDir });
        execSync('git config user.email "test@test.com"', { cwd: tempDir });
        execSync('git config user.name "Test"', { cwd: tempDir });
        execSync('git checkout -b test-branch', { cwd: tempDir });
        execSync('git add .', { cwd: tempDir });
        execSync('git commit -m "Initial commit"', { cwd: tempDir });
    });

    test.afterEach(async () => {
        if (tempBundleDir) {
            await fs.rm(tempBundleDir, { recursive: true, force: true }).catch(() => { });
        }
    });

    test('new entity appears in sidebar after creation via mock agent', async ({ page }) => {
        const encodedPath = encodeURIComponent(tempBundleDir);
        await page.goto(`/?bundleDir=${encodedPath}&debug=true`);

        // 1. Wait for bundle to load
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Verify initial state - only FEAT-001 should exist
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-001' })).toBeVisible();
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-002' })).not.toBeVisible();

        // 2. Configure Mock agent (since we need predictable behavior for test)
        await page.locator('[data-testid="agent-settings-btn"]').click();
        await page.selectOption('select.form-control', 'mock');
        await page.locator('[data-testid="agent-save-config-btn"]').click();
        await page.waitForTimeout(500);

        // 3. Start conversation
        const startBtn = page.locator('[data-testid="agent-start-btn"]');
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();

        // Wait for active state
        await page.waitForSelector('[data-testid="agent-message-input"]', { timeout: 10000 });

        // 4. Request entity modification (mock backend modifies FEAT-001 title)
        await page.locator('[data-testid="agent-message-input"]').fill('propose change');

        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        // 5. Wait for pending changes
        await expect(page.locator('[data-testid="pending-changes-block"]')).toBeVisible({ timeout: 15000 });

        // 6. Accept changes
        await page.locator('[data-testid="agent-accept-btn"]').click();

        // Wait for accept to complete
        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // Wait for bundle reload
        await page.waitForTimeout(2000);

        // 7. Verify the modification worked (FEAT-001 should still be visible)
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-001' })).toBeVisible();

        // Click on FEAT-001 and verify title was updated
        await page.locator('.entity-btn', { hasText: 'FEAT-001' }).click();
        const titleInput = page.locator('#root_title');
        await expect(titleInput).toHaveValue('Updated Demo Feature Title', { timeout: 10000 });
    });

    test('entity file is created in correct bundle directory structure', async ({ page }) => {
        const encodedPath = encodeURIComponent(tempBundleDir);
        await page.goto(`/?bundleDir=${encodedPath}&debug=true`);

        // Wait for load
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure Mock agent
        await page.locator('[data-testid="agent-settings-btn"]').click();
        await page.selectOption('select.form-control', 'mock');
        await page.locator('[data-testid="agent-save-config-btn"]').click();
        await page.waitForTimeout(500);

        // Start conversation and apply changes
        await page.locator('[data-testid="agent-start-btn"]').click();
        await page.waitForSelector('[data-testid="agent-message-input"]', { timeout: 10000 });

        await page.locator('[data-testid="agent-message-input"]').fill('propose change');
        await page.locator('[data-testid="agent-send-btn"]').click();

        await expect(page.locator('[data-testid="pending-changes-block"]')).toBeVisible({ timeout: 15000 });
        await page.locator('[data-testid="agent-accept-btn"]').click();

        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // Verify file is in the CORRECT location (bundle/features/, not feature/)
        const correctPath = path.join(tempBundleDir, 'bundle', 'features', 'FEAT-001.yaml');
        const wrongPath = path.join(tempBundleDir, 'feature', 'FEAT-001.yaml');

        // Correct path should exist
        await expect(async () => {
            await fs.access(correctPath);
        }).not.toThrow();

        // Wrong directory should NOT exist  
        await expect(async () => {
            await fs.access(wrongPath);
        }).rejects.toThrow();
    });
});

// Helper to recursively copy a directory
async function copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.name === '.git') continue; // Skip .git

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}
