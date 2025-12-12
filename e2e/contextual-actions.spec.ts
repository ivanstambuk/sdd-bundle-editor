import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('Contextual Actions', () => {
    // Use the sample bundle path for consistent state
    const bundleDir = getSampleBundlePath();

    test('toggle agent panel with keyboard shortcut', async ({ page }) => {
        // 1. Load the editor
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);
        await page.waitForSelector('.app-shell');

        // 2. Initial state: Agent panel should be open by default
        const agentPanel = page.locator('.right-sidebar');
        await expect(agentPanel).toBeVisible();

        // 3. Press Ctrl+J to toggle off
        await page.keyboard.press('Control+j');
        await expect(agentPanel).not.toBeVisible();

        // 4. Press Ctrl+J to toggle on
        await page.keyboard.press('Control+j');
        await expect(agentPanel).toBeVisible();
    });

    test('fix with agent button appears for errors', async ({ page }) => {
        // 1. Mock validation response to inject an error
        await page.route('**/bundle/validate', async route => {
            const json = {
                diagnostics: [
                    {
                        severity: 'error',
                        message: 'Simulated validation error for testing',
                        entityType: 'Feature',
                        entityId: 'FEAT-001',
                        path: 'title',
                        code: 'test-error'
                    }
                ]
            };
            await route.fulfill({ json });
        });

        // 2. Load editor with real bundle
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

        // 3. Wait for real bundle to load
        await expect(page.locator('.status-loading')).not.toBeVisible();
        await expect(page.locator('[data-testid="entity-group-Feature"]')).toBeVisible();

        // Expand Feature group and navigate to FEAT-001
        await page.click('[data-testid="entity-group-Feature"]');
        await page.click('[data-testid="entity-FEAT-001"]');

        // 5. Verify no fix button initially
        const fixButton = page.getByTestId('fix-with-agent-btn');
        await expect(fixButton).not.toBeVisible();

        // 6. Trigger Compile to get diagnostics
        await page.click('[data-testid="compile-btn"]');

        // 7. Verify Fix button appears
        await expect(fixButton).toBeVisible();
        await expect(fixButton).toContainText('Fix with Agent');

        // 8. Click and verify
        await fixButton.click();
        const agentPanel = page.locator('.right-sidebar');
        await expect(agentPanel).toBeVisible();

        // Check panel is open
        await expect(agentPanel).toBeVisible();
    });
});
