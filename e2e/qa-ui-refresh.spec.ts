import { test, expect } from '@playwright/test';

test.describe('Agent UI Refresh QA', () => {
    test('should automatically update entity details after agent edit', async ({ page }) => {
        // Capture browser console logs to debug AppShell behavior
        page.on('console', msg => console.log(`[Browser] ${msg.text()} `));

        // 1. Load the app
        await page.goto('/');

        // 2. Select a feature (FEAT-001)
        await page.click('text=Feature');
        await page.click('text=FEAT-001');

        // 3. Verify initial title
        const titleInput = page.locator('label:has-text("title")').locator('..').locator('input');
        const initialTitle = await titleInput.inputValue();
        console.log('Initial Title:', initialTitle);

        // 4. Open Agent Panel
        await page.keyboard.press('Control+j');
        const agentInput = page.locator('textarea[placeholder="Type a message..."]');
        await expect(agentInput).toBeVisible();

        // 5. Send rename command
        const newTitle = `Auto Renamed Feature ${Date.now()} `;
        await agentInput.fill(`rename feature FEAT-001 to "${newTitle}"`);
        await page.click('button[aria-label="Send message"]');

        // 6. Wait for response and "Propose Changes"
        // The previous test logic might be flaky if we rely on exact text, let's look for the diff view or accept button.
        // Assuming the agent proposes changes...
        const acceptButton = page.locator('button:has-text("Accept")');
        await expect(acceptButton).toBeVisible({ timeout: 30000 });

        // 7. Click Accept
        await acceptButton.click();

        // 8. Wait for "Applied" confirmation
        await expect(page.locator('text=Changes have been successfully applied')).toBeVisible();

        // 9. Close Agent Panel (optional, but good for visibility)
        // await page.keyboard.press('Escape'); 

        // 10. ASSERT: Verify the title input in the main view has updated WITHOUT manual refresh
        // We wait up to 5s for the update to reflect
        await expect(titleInput).toHaveValue(newTitle, { timeout: 10000 });
    });
});
