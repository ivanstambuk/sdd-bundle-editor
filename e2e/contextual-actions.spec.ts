import { test, expect } from '@playwright/test';

test.describe('Contextual Actions', () => {
    // Use a targeted bundle to ensure consistent state
    const bundleDir = 'examples/basic-bundle';

    test('toggle agent panel with keyboard shortcut', async ({ page }) => {
        // 1. Load the editor
        await page.goto(`/?bundleDir=${bundleDir}`);
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
        await page.goto(`/?bundleDir=${bundleDir}`);

        // 3. Wait for real bundle to load
        await expect(page.locator('.status-loading')).not.toBeVisible();
        await expect(page.locator('.entity-group-header:has-text("Feature")')).toBeVisible();

        // 4. Navigate to FEAT-001
        await page.click('[data-type="Feature"] .entity-item:has-text("FEAT-001")');

        // 5. Verify no fix button initially
        const fixButton = page.getByTestId('fix-with-agent-btn');
        await expect(fixButton).not.toBeVisible();

        // 6. Trigger Compile to get diagnostics
        await page.click('button:has-text("Compile Spec")');

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
