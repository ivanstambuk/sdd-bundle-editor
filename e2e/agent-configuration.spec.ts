import { test, expect } from '@playwright/test';

// Run agent tests serially since they share backend server state
test.describe.serial('Agent Configuration', () => {
    test('should configure CLI backend and verify echo response', async ({ page }) => {
        // 1. Navigate
        await page.goto('/');

        // Reset to unconfigured state first
        await page.evaluate(async () => {
            await fetch('/agent/abort', { method: 'POST' });
            await fetch('/agent/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'mock' })
            });
        });
        await page.reload();

        // Screenshot 1: Initial state - unconfigured warning
        await page.waitForSelector('.agent-panel', { timeout: 5000 });
        // Wait for the placeholder to appear (idle state)
        await page.waitForSelector('.agent-placeholder', { timeout: 5000 });
        await page.screenshot({ path: 'artifacts/agent_step1_unconfigured.png' });

        // 2. Open Configuration - the button class is .settings-btn regardless of text
        const configBtn = page.locator('.settings-btn');
        await expect(configBtn).toBeVisible({ timeout: 5000 });
        await configBtn.click();

        // Screenshot 2: Configuration panel (HTTP initially)
        await page.waitForSelector('.agent-settings', { timeout: 5000 });
        await page.screenshot({ path: 'artifacts/agent_step2_config_panel.png' });

        // 3. Select CLI Provider Type
        const typeSelect = page.locator('.agent-settings select').first();
        await expect(typeSelect).toBeVisible();
        await typeSelect.selectOption({ label: 'Local CLI Tool' });

        // Screenshot 3: CLI preset selection
        await page.screenshot({ path: 'artifacts/agent_step3_cli_presets.png' });

        // 4. Select Custom Preset (to allow editing) - use 2nd select within agent-settings
        const presetSelect = page.locator('.agent-settings select').nth(1);
        await expect(presetSelect).toBeVisible();
        await presetSelect.selectOption('custom');

        // 5. Enter Command "echo"
        await page.getByPlaceholder('e.g. codex').fill('echo');

        // Screenshot 4: After filling custom CLI command
        await page.screenshot({ path: 'artifacts/agent_step4_custom_cli.png' });

        // 6. Save
        await page.getByRole('button', { name: 'Save' }).click();

        // Screenshot 5: Configured state - Start button should now be enabled
        await page.waitForTimeout(500); // Wait for state to update
        await page.screenshot({ path: 'artifacts/agent_step5_configured.png' });

        // 7. Start Conversation
        await page.locator('button.start-btn').click();

        // 8. Send "Hello Configuration"
        const inputArea = page.locator('textarea[placeholder="Describe changes..."]');
        await expect(inputArea).toBeVisible();
        await inputArea.fill('Hello Configuration');
        await page.locator('button.send-btn').click();

        // 9. Verify Response "Echo: Hello Configuration"
        await expect(page.locator('.message-content').getByText('Hello Configuration').last()).toBeVisible();

        // Screenshot 6: Conversation active with echo response
        await page.screenshot({ path: 'artifacts/agent_step6_conversation.png' });
    });
});
