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
 * After calling this, the agent is in 'idle' state and ready to start conversations.
 * 
 * @param page - Playwright page object
 * @param bundleDir - Path to the bundle directory to load
 * 
 * @example
 * ```typescript
 * test('my agent test', async ({ page }) => {
 *     await setupMockAgent(page, BUNDLE_DIR);
 *     await page.click('[data-testid="agent-start-btn"]');
 *     // ... rest of test
 * });
 * ```
 */
export async function setupMockAgent(page: Page, bundleDir: string): Promise<void> {
    // Navigate with debug mode and reset flag
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true&resetAgent=true`);
    await page.waitForSelector('.app-shell', { timeout: 10000 });

    // Configure mock agent via UI
    await page.click('[data-testid="agent-settings-btn"]');
    await page.selectOption('.form-control', 'mock');
    await page.click('[data-testid="agent-save-config-btn"]');

    // Wait for agent status to be ready
    await page.waitForSelector('[data-testid="agent-status-badge"]', { timeout: 5000 });
}

/**
 * Starts an agent conversation after mock agent is set up.
 * 
 * @param page - Playwright page object
 * @param timeout - Timeout for waiting for active status (default 10000ms)
 */
export async function startAgentConversation(page: Page, timeout = 10000): Promise<void> {
    await page.click('[data-testid="agent-start-btn"]');
    await page.waitForSelector('[data-testid="agent-status-badge"]:has-text("active")', { timeout });
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
 * @param page - Playwright page object
 */
export async function acceptPendingChanges(page: Page): Promise<void> {
    await page.click('[data-testid="agent-accept-btn"]');
    // Wait for status to indicate committed
    await expect(page.locator('[data-testid="agent-status-badge"]')).toHaveText(/committed/i, { timeout: 30000 });
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
