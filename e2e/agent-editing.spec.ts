

import { test, expect } from './fixtures';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import * as util from 'node:util';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';

const execAsync = util.promisify(exec);

// Run serially to avoid conflict with shared server state
test.describe.serial('Agent Editing Flow', () => {
    let tempDir: string;

    test.beforeAll(async () => {
        tempDir = await createTempBundle('sdd-agent-editing-');
        console.log(`Test bundle dir: ${tempDir}`);
    });

    test.afterAll(async () => {
        await cleanupTempBundle(tempDir);
    });

    test('should propose and apply changes', async ({ page }) => {
        // Navigate to app with custom bundleDir and reset logic
        await page.goto(`/?bundleDir=${encodeURIComponent(tempDir)}&debug=true&resetAgent=true`);

        // Wait for app to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Check if agent panel is visible
        const agentPanel = page.locator('.agent-panel');
        await expect(agentPanel).toBeVisible({ timeout: 10000 });

        // Configure Mock agent via UI (not API - more reliable)
        await page.click('[data-testid="agent-settings-btn"]');
        await page.selectOption('.form-control', 'mock');
        await page.click('[data-testid="agent-save-config-btn"]');

        // Start Conversation
        const startBtn = page.locator('[data-testid="agent-start-btn"]');
        await expect(startBtn).toBeEnabled({ timeout: 5000 });
        await startBtn.click();

        // Wait for input to be visible
        const inputArea = page.locator('[data-testid="agent-message-input"]');
        await expect(inputArea).toBeVisible({ timeout: 10000 });

        // Send "propose change"
        await inputArea.fill('propose change');

        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        // Wait for agent response
        await expect(page.locator('.message.role-agent').last()).toContainText('propose', { timeout: 10000 });

        // We expect to see "Proposed Changes" in the Agent Panel
        await expect(page.locator('text=Proposed Changes')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="pending-changes-block"]')).toBeVisible({ timeout: 10000 });

        // Accept Changes
        const acceptBtn = page.locator('[data-testid="agent-accept-btn"]');
        await expect(acceptBtn).toBeVisible();
        await acceptBtn.click();

        // Wait for accept to complete
        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // Verify status changed to committed
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('committed', { timeout: 10000 });

        // Verify File on Disk - Mock backend updates FEAT-001 title
        const featureFilePath = path.join(tempDir, 'bundle/features/FEAT-001.yaml');
        const content = await fs.readFile(featureFilePath, 'utf8');
        expect(content).toContain('title: Updated Demo Feature Title');

        // Verify Git Commit
        const { stdout: gitLog } = await execAsync('git log -1 --pretty=%B', { cwd: tempDir });
        expect(gitLog.trim()).toBe('Applied changes via Agent');
    });
});
