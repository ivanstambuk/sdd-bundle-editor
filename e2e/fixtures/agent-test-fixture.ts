/**
 * Shared test fixtures for agent E2E tests.
 * 
 * These helpers ensure consistent agent setup across all E2E tests,
 * preventing issues with unconfigured backends or inconsistent state.
 */

import { Page, expect } from '@playwright/test';

/**
 * Sets up a mock agent for E2E testing.
 * 
 * This function:
 * 1. Navigates with debug=true and resetAgent=true URL params
 * 2. Waits for the app to load
 * 3. Configures the mock agent backend
 * 
 * NOTE: After saving config, the conversation auto-starts, so the agent
 * transitions to 'active' state automatically.
 * 
 * @param page - Playwright page object
 * @param bundleDir - Path to the bundle directory to load
 * 
 * @example
 * ```typescript
 * test('my agent test', async ({ page }) => {
 *     await setupMockAgent(page, BUNDLE_DIR);
 *     // Agent is now active and ready for messages
 *     await sendAgentMessage(page, 'Hello');
 * });
 * ```
 */
export async function setupMockAgent(page: Page, bundleDir: string): Promise<void> {
    // Navigate with debug mode and reset flag
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true&resetAgent=true`);
    await page.waitForSelector('.app-shell', { timeout: 10000 });

    // Configure mock agent via UI - this auto-starts the conversation after save
    await page.click('[data-testid="agent-settings-btn"]');
    await page.selectOption('.form-control', 'mock');
    await page.click('[data-testid="agent-save-config-btn"]');

    // Wait for conversation to be active (config save auto-starts conversation)
    await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout: 10000 });
}

/**
 * Ensures agent conversation is in active state.
 * 
 * If conversation is already active (e.g., after setupMockAgent auto-start),
 * this function is a no-op. Otherwise, it clicks the start button.
 * 
 * @param page - Playwright page object
 * @param timeout - Timeout for waiting for active status (default 10000ms)
 */
export async function startAgentConversation(page: Page, timeout = 10000): Promise<void> {
    // Check if already active (setupMockAgent auto-starts conversation now)
    const statusBadge = page.locator('[data-testid="agent-status-badge"]');
    const currentStatus = await statusBadge.textContent();

    if (currentStatus === 'active') {
        // Already active, nothing to do
        return;
    }

    // Need to start conversation
    const startBtn = page.locator('[data-testid="agent-start-btn"]');
    if (await startBtn.isVisible()) {
        await startBtn.click();
        await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout });
    }
}

/**
 * Sends a message to the agent and waits for response.
 * 
 * @param page - Playwright page object
 * @param message - Message to send
 * @param waitForResponse - Whether to wait for agent response (default true)
 */
export async function sendAgentMessage(
    page: Page,
    message: string,
    waitForResponse = true
): Promise<void> {
    await page.fill('[data-testid="agent-message-input"]', message);
    await page.click('[data-testid="agent-send-btn"]');

    if (waitForResponse) {
        await page.waitForSelector('.message.role-agent', { timeout: 10000 });
    }
}

/**
 * Waits for pending changes to appear after sending a message that triggers them.
 * 
 * @param page - Playwright page object
 * @param timeout - Timeout in milliseconds (default 15000)
 */
export async function waitForPendingChanges(page: Page, timeout = 15000): Promise<void> {
    await page.waitForSelector('[data-testid="pending-changes-block"]', { timeout });
}

/**
 * Accepts the current pending changes.
 * 
 * After accepting, pending changes block disappears and status returns to 'active'.
 * (Mock agent shows 'committed' briefly then returns to 'active')
 * 
 * @param page - Playwright page object
 */
export async function acceptPendingChanges(page: Page): Promise<void> {
    await page.click('[data-testid="agent-accept-btn"]');
    // Wait for pending changes to be cleared (indicates accept was processed)
    await expect(page.locator('[data-testid="pending-changes-block"]')).not.toBeVisible({ timeout: 30000 });
}

/**
 * Clicks New Chat and handles the confirmation dialog if pending changes exist.
 * 
 * NOTE: After New Chat completes, the agent transitions to 'active' status
 * (a fresh conversation), NOT 'idle'. This is because startNewChat() in 
 * useAgentState.ts calls reset() then immediately start().
 * 
 * @param page - Playwright page object
 * @param expectConfirmDialog - Whether to expect and accept a confirmation dialog
 */
export async function clickNewChat(page: Page, expectConfirmDialog = false): Promise<void> {
    if (expectConfirmDialog) {
        page.once('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            await dialog.accept();
        });
    }

    await page.click('[data-testid="agent-new-chat-btn"]');

    // After New Chat, status becomes 'active' (new conversation started)
    await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout: 10000 });
}
