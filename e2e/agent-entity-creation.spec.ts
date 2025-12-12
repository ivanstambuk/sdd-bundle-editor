import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';
import { setupMockAgent, startAgentConversation, waitForPendingChanges } from './fixtures/agent-test-fixture';

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

    test.beforeEach(async ({ page }) => {
        tempBundleDir = await createTempBundle('sdd-entity-creation-');
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('new entity appears in sidebar after creation via mock agent', async ({ page }) => {
        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, tempBundleDir);
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Verify initial state - only FEAT-001 should exist (expand Feature group first)
        const featureGroup = page.locator('[data-testid="entity-group-Feature"]');
        await featureGroup.click();
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-001' })).toBeVisible();
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-999' })).not.toBeVisible();

        // Start conversation using shared helper
        await startAgentConversation(page);

        // Request entity modification (mock backend modifies FEAT-001 title)
        await page.locator('[data-testid="agent-message-input"]').fill('propose change');
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        // Wait for pending changes using shared helper
        await waitForPendingChanges(page);

        // Accept changes
        await page.locator('[data-testid="agent-accept-btn"]').click();
        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // Wait for bundle reload
        await page.waitForTimeout(2000);

        // Verify the modification worked (FEAT-001 should still be visible)
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-001' })).toBeVisible();

        // Click on FEAT-001 and verify title was updated
        await page.locator('.entity-btn', { hasText: 'FEAT-001' }).click();
        const titleInput = page.locator('#root_title');
        await expect(titleInput).toHaveValue('Updated Demo Feature Title', { timeout: 10000 });
    });

    test('entity file is created in correct bundle directory structure', async ({ page }) => {
        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, tempBundleDir);
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Start conversation and apply changes
        await startAgentConversation(page);

        await page.locator('[data-testid="agent-message-input"]').fill('propose change');
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        await waitForPendingChanges(page);
        await page.locator('[data-testid="agent-accept-btn"]').click();

        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // Verify file is in the CORRECT location (bundle/features/, not feature/)
        const correctPath = path.join(tempBundleDir, 'bundle', 'features', 'FEAT-001.yaml');
        const wrongPath = path.join(tempBundleDir, 'feature', 'FEAT-001.yaml');

        // Correct path should exist
        const correctExists = await fs.access(correctPath).then(() => true).catch(() => false);
        expect(correctExists).toBe(true);

        // Wrong directory should NOT exist  
        const wrongExists = await fs.access(wrongPath).then(() => true).catch(() => false);
        expect(wrongExists).toBe(false);
    });
});
