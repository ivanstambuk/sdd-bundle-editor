
import { test, expect } from '@playwright/test';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';

test.describe('QA UI Refresh on Agent Accept', () => {
    let tempBundleDir: string;

    test.beforeEach(async ({ page }) => {
        tempBundleDir = await createTempBundle('sdd-qa-refresh-');
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('should refresh entity details in UI after agent changes are accepted', async ({ page }) => {
        const encodedPath = encodeURIComponent(tempBundleDir);
        await page.goto(`/?bundleDir=${encodedPath}&debug=true&resetAgent=true`);

        // 1. Wait for app and bundle to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Click on FEAT-001 in the entity navigator
        await page.locator('.entity-btn', { hasText: 'FEAT-001' }).click();

        // Verify initial state using the title input field
        const titleInput = page.locator('#root_title');
        await expect(titleInput).toHaveValue('Basic Demo Feature', { timeout: 10000 });

        // 2. Configure Mock Agent via UI (not API - more reliable)
        await page.locator('[data-testid="agent-settings-btn"]').click();
        await page.locator('select.form-control').first().selectOption({ value: 'mock' });
        await page.locator('[data-testid="agent-save-config-btn"]').click();

        // 3. Start conversation
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

        await expect(page.locator('[data-testid="pending-changes-block"]')).toBeVisible({ timeout: 30000 });

        // 6. Click Accept to apply changes
        await page.locator('[data-testid="agent-accept-btn"]').click();

        // 7. Wait for accept to complete
        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // 8. Verify UI refresh: the title input should now show the updated value
        // Wait for bundle reload to complete
        await page.waitForTimeout(2000);

        // Mock backend changes title to "Updated Demo Feature Title"
        await expect(titleInput).toHaveValue('Updated Demo Feature Title', { timeout: 10000 });

        // Screenshot for visual verification
        await page.screenshot({ path: 'artifacts/qa_ui_refresh_verified.png' });
    });
});
