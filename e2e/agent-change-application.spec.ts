import { test, expect } from '@playwright/test';
import { createTempBundle, cleanupTempBundle } from './bundle-test-fixture';
import { setupMockAgent, startAgentConversation, waitForPendingChanges, acceptPendingChanges } from './fixtures/agent-test-fixture';

test.describe('Agent Change Application', () => {
    let tempBundleDir: string;

    test.beforeEach(async () => {
        tempBundleDir = await createTempBundle('sdd-test-change-');
    });

    test.afterEach(async () => {
        await cleanupTempBundle(tempBundleDir);
    });

    test('should display and apply pending changes via Mock agent', async ({ page }) => {
        // Use shared fixture for consistent agent setup
        await setupMockAgent(page, tempBundleDir);

        // Wait for navigator to load content
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Expand Feature group (groups are collapsed by default)
        const featureGroup = page.getByTestId('entity-group-Feature');
        await expect(featureGroup).toBeVisible();
        await featureGroup.click();

        // Start conversation using shared helper
        await startAgentConversation(page);

        // Send "propose change" message to trigger mock agent's pending changes
        await page.locator('[data-testid="agent-message-input"]').fill('propose change');

        // Wait for the response to ensure backend processing
        const responsePromise = page.waitForResponse(response =>
            response.url().includes('/agent/message') && response.status() === 200
        );
        await page.locator('[data-testid="agent-send-btn"]').click();
        await responsePromise;

        // Wait for agent message bubble to appear
        await expect(page.locator('.message.role-agent').last()).toContainText('propose');

        // Verify Proposed Changes Block using shared helper
        await waitForPendingChanges(page);
        await expect(page.locator('[data-testid="agent-review-btn"]')).toBeVisible();

        // Capture screenshot before opening modal
        await page.waitForTimeout(300);
        await page.screenshot({ path: 'artifacts/proposed_changes_compact.png' });

        // Open Review Modal
        await page.click('[data-testid="agent-review-btn"]');
        await expect(page.locator('.diff-modal-overlay')).toBeVisible();
        await expect(page.locator('.diff-old-header')).toBeVisible();
        await expect(page.locator('.diff-new-header')).toBeVisible();

        // Capture screenshot of modal
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'artifacts/diff_review_modal.png' });

        // Close modal and Accept changes
        await page.locator('.diff-modal-close').click();
        await expect(page.locator('.diff-modal-overlay')).not.toBeVisible();

        // Accept changes and verify success
        await acceptPendingChanges(page);
    });
});
