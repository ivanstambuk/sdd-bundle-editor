

import { test, expect } from './fixtures';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import * as util from 'node:util';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';
import { setupMockAgent, startAgentConversation, sendAgentMessage, waitForPendingChanges, acceptPendingChanges } from './fixtures/agent-test-fixture';

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
        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, tempDir);
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Check if agent panel is visible
        const agentPanel = page.locator('.agent-panel');
        await expect(agentPanel).toBeVisible({ timeout: 10000 });

        // Start conversation using shared helper (handles auto-start case)
        await startAgentConversation(page);

        // Send "propose change"
        await page.fill('[data-testid="agent-message-input"]', 'propose change');
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        // Wait for agent response
        await expect(page.locator('.message.role-agent').last()).toContainText('propose', { timeout: 10000 });

        // Wait for pending changes using shared helper
        await waitForPendingChanges(page);

        // Accept Changes
        const acceptBtn = page.locator('[data-testid="agent-accept-btn"]');
        await expect(acceptBtn).toBeVisible();
        await acceptBtn.click();

        // Wait for accept to complete
        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // Wait for pending changes to clear
        await expect(page.locator('[data-testid="pending-changes-block"]')).not.toBeVisible({ timeout: 10000 });

        // Verify File on Disk - Mock backend updates FEAT-001 title
        const featureFilePath = path.join(tempDir, 'bundle/features/FEAT-001.yaml');
        const content = await fs.readFile(featureFilePath, 'utf8');
        expect(content).toContain('title: Updated Demo Feature Title');

        // Verify Git Commit
        const { stdout: gitLog } = await execAsync('git log -1 --pretty=%B', { cwd: tempDir });
        expect(gitLog.trim()).toBe('Applied changes via Agent');
    });
});
