import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';
// NOTE: This test intentionally uses custom setup to test CLI-specific configuration flow
// Other agent tests should prefer using the shared fixture from ./fixtures/agent-test-fixture

// Run agent tests serially since they share backend server state
test.describe.serial('Agent Configuration', () => {
    test('should configure CLI backend and verify echo response', async ({ page }) => {
        const bundleDir = getSampleBundlePath();

        // Navigate with resetAgent=true to ensure fresh state
        await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true&resetAgent=true`);

        // Wait for app to load
        await page.waitForSelector('.app-shell', { timeout: 10000 });

        // Screenshot 1: Initial state - unconfigured warning
        await page.waitForSelector('.agent-panel', { timeout: 5000 });
        // Wait for the placeholder to appear (idle state)
        await page.waitForSelector('.agent-placeholder', { timeout: 5000 });
        await page.screenshot({ path: 'artifacts/agent_step1_unconfigured.png' });

        // 2. Open Configuration - use data-testid
        const configBtn = page.locator('[data-testid="agent-settings-btn"]');
        await expect(configBtn).toBeVisible({ timeout: 5000 });
        await configBtn.click();

        // Screenshot 2: Configuration panel (HTTP initially)
        await page.waitForSelector('.agent-settings', { timeout: 5000 });
        await page.screenshot({ path: 'artifacts/agent_step2_config_panel.png' });

        // 3. Select CLI Provider Type
        const typeSelect = page.locator('.agent-settings select').first();
        await expect(typeSelect).toBeVisible();
        await typeSelect.selectOption({ label: 'Local CLI Tool' });

        // Wait for the UI to update and show CLI-specific fields
        await expect(page.getByText('Preset:')).toBeVisible({ timeout: 5000 });

        // Screenshot 3: CLI preset selection
        await page.screenshot({ path: 'artifacts/agent_step3_cli_presets.png' });

        // 4. Select Custom Preset (to allow editing) - use 2nd select within agent-settings
        const presetSelect = page.locator('.agent-settings select').nth(1);
        await expect(presetSelect).toBeVisible({ timeout: 5000 });
        await presetSelect.selectOption('custom');

        // 5. Enter Command "echo"
        await page.getByPlaceholder('e.g. codex').fill('echo');

        // Screenshot 4: After filling custom CLI command
        await page.screenshot({ path: 'artifacts/agent_step4_custom_cli.png' });

        // 6. Save - config save now auto-starts conversation
        await page.locator('[data-testid="agent-save-config-btn"]').click();

        // Wait for conversation to be active (auto-started after save)
        await expect(page.locator('[data-testid="agent-status-badge"]')).toContainText('active', { timeout: 10000 });

        // Screenshot 5: Configured state - now active
        await page.screenshot({ path: 'artifacts/agent_step5_configured.png' });

        // 8. Send "Hello Configuration"
        const inputArea = page.locator('[data-testid="agent-message-input"]');
        await expect(inputArea).toBeVisible();
        await inputArea.fill('Hello Configuration');
        await page.locator('[data-testid="agent-send-btn"]').click();

        // 9. Verify Response "Echo: Hello Configuration"
        await expect(page.locator('.message-content').getByText('Hello Configuration').last()).toBeVisible({ timeout: 10000 });

        // Screenshot 6: Conversation active with echo response
        await page.screenshot({ path: 'artifacts/agent_step6_conversation.png' });
    });
});
