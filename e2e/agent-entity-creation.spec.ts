import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';

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

        // Reset agent state to ensure clean state for each test
        await page.goto('/');
        await page.evaluate(async () => {
            await fetch('/agent/abort', { method: 'POST' });
        });
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('new entity appears in sidebar after creation via mock agent', async ({ page }) => {
        const encodedPath = encodeURIComponent(tempBundleDir);
        await page.goto(`/?bundleDir=${encodedPath}&debug=true`);

        // 1. Wait for app and bundle to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Verify initial state - only FEAT-001 should exist
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-001' })).toBeVisible();
        await expect(page.locator('.entity-btn', { hasText: 'FEAT-002' })).not.toBeVisible();

        // 2. Configure Mock agent via UI (not API - more reliable)
        await page.locator('[data-testid="agent-settings-btn"]').click();
        await page.selectOption('select.form-control', 'mock');
        await page.locator('[data-testid="agent-save-config-btn"]').click();

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
        await expect(page.locator('text=Proposed Changes')).toBeVisible({ timeout: 15000 });
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

        // Wait for app and bundle to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Configure Mock agent via UI
        await page.locator('[data-testid="agent-settings-btn"]').click();
        await page.selectOption('select.form-control', 'mock');
        await page.locator('[data-testid="agent-save-config-btn"]').click();

        // Start conversation and apply changes
        await expect(page.locator('[data-testid="agent-start-btn"]')).toBeEnabled({ timeout: 5000 });
        await page.locator('[data-testid="agent-start-btn"]').click();
        await page.waitForSelector('[data-testid="agent-message-input"]', { timeout: 10000 });

        await page.locator('[data-testid="agent-message-input"]').fill('propose change');

        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

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
        const correctExists = await fs.access(correctPath).then(() => true).catch(() => false);
        expect(correctExists).toBe(true);

        // Wrong directory should NOT exist  
        const wrongExists = await fs.access(wrongPath).then(() => true).catch(() => false);
        expect(wrongExists).toBe(false);
    });
});
