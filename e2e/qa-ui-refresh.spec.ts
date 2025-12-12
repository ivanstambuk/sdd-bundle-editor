import { test, expect } from '@playwright/test';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';
import { setupMockAgent, startAgentConversation, waitForPendingChanges } from './fixtures/agent-test-fixture';

test.describe('QA UI Refresh on Agent Accept', () => {
    let tempBundleDir: string;

    test.beforeEach(async ({ page }) => {
        tempBundleDir = await createTempBundle('sdd-qa-refresh-');
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('should refresh entity details in UI after agent changes are accepted', async ({ page }) => {
        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, tempBundleDir);
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Expand Feature group and click on FEAT-001 in the entity navigator
        const featureGroup = page.locator('[data-testid="entity-group-Feature"]');
        await featureGroup.click();
        await page.locator('.entity-btn', { hasText: 'FEAT-001' }).click();

        // Verify initial state using the title input field
        const titleInput = page.locator('#root_title');
        await expect(titleInput).toHaveValue('Basic Demo Feature', { timeout: 10000 });

        // Start conversation using shared helper
        await startAgentConversation(page);

        // Send message to trigger mock backend to propose a change
        await page.locator('[data-testid="agent-message-input"]').fill('propose change');
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        // Wait for pending changes using shared helper
        await waitForPendingChanges(page);

        // Click Accept to apply changes
        await page.locator('[data-testid="agent-accept-btn"]').click();

        // Wait for accept to complete
        await page.waitForResponse(response =>
            response.url().includes('/agent/accept') && response.status() === 200,
            { timeout: 30000 }
        );

        // Verify UI refresh: the title input should now show the updated value
        // Wait for bundle reload to complete
        await page.waitForTimeout(2000);

        // Mock backend changes title to "Updated Demo Feature Title"
        await expect(titleInput).toHaveValue('Updated Demo Feature Title', { timeout: 10000 });

        // Screenshot for visual verification
        await page.screenshot({ path: 'artifacts/qa_ui_refresh_verified.png' });
    });
});
