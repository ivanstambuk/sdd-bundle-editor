/**
 * AgentPanel Page Object
 * 
 * Encapsulates all interactions with the Agent Panel UI.
 * Provides a clean API for tests to interact with the agent.
 * 
 * @example
 * ```typescript
 * const agent = new AgentPanel(page);
 * await agent.configure('mock');
 * await agent.sendMessage('Hello');
 * await agent.waitForResponse();
 * await agent.acceptChanges();
 * ```
 */

import { Page, Locator, expect } from '@playwright/test';
import { setupApiLogging, debugLog } from '../utils/debug';

export class AgentPanel {
    readonly page: Page;

    // Main selectors
    readonly statusBadge: Locator;
    readonly settingsBtn: Locator;
    readonly startBtn: Locator;
    readonly abortBtn: Locator;
    readonly newChatBtn: Locator;
    readonly messageInput: Locator;
    readonly sendBtn: Locator;

    // Change-related selectors
    readonly pendingChangesBlock: Locator;
    readonly acceptBtn: Locator;
    readonly discardBtn: Locator;
    readonly reviewBtn: Locator;

    // Settings selectors
    readonly configTypeSelect: Locator;
    readonly saveConfigBtn: Locator;

    constructor(page: Page) {
        this.page = page;

        // Initialize locators
        this.statusBadge = page.locator('[data-testid="agent-status-badge"]');
        this.settingsBtn = page.locator('[data-testid="agent-settings-btn"]');
        this.startBtn = page.locator('[data-testid="agent-start-btn"]');
        this.abortBtn = page.locator('[data-testid="agent-abort-btn"]');
        this.newChatBtn = page.locator('[data-testid="agent-new-chat-btn"]');
        this.messageInput = page.locator('[data-testid="agent-message-input"]');
        this.sendBtn = page.locator('[data-testid="agent-send-btn"]');

        this.pendingChangesBlock = page.locator('[data-testid="pending-changes-block"]');
        this.acceptBtn = page.locator('[data-testid="agent-accept-btn"]');
        this.discardBtn = page.locator('[data-testid="agent-discard-btn"]');
        this.reviewBtn = page.locator('[data-testid="agent-review-btn"]');

        this.configTypeSelect = page.locator('select.form-control');
        this.saveConfigBtn = page.locator('[data-testid="agent-save-config-btn"]');
    }

    /**
     * Navigate to the app with agent reset and debug mode enabled.
     * Optionally sets up API logging if DEBUG_E2E=true.
     */
    async navigate(bundleDir: string): Promise<void> {
        setupApiLogging(this.page);

        debugLog(`Navigating to bundle: ${bundleDir}`);
        await this.page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}&debug=true&resetAgent=true`);
        await this.page.waitForSelector('.app-shell', { timeout: 10000 });
    }

    /**
     * Get the current agent status.
     */
    async getStatus(): Promise<string> {
        return await this.statusBadge.textContent() ?? 'unknown';
    }

    /**
     * Check if agent is in a specific status.
     */
    async isStatus(status: 'idle' | 'active' | 'pending_changes' | 'thinking' | 'error'): Promise<boolean> {
        const current = await this.getStatus();
        return current === status;
    }

    /**
     * Configure the agent backend type.
     * After save, the conversation auto-starts.
     * 
     * @param type - Agent type: 'mock', 'http', 'cli'
     */
    async configure(type: 'mock' | 'http' | 'cli'): Promise<void> {
        debugLog(`Configuring agent: ${type}`);

        await this.settingsBtn.click();
        await this.configTypeSelect.selectOption(type);
        await this.saveConfigBtn.click();

        // Config save auto-starts conversation
        await this.waitForStatus('active');
    }

    /**
     * Wait for a specific agent status.
     */
    async waitForStatus(status: string, timeout = 10000): Promise<void> {
        await this.page.waitForSelector(
            `[data-testid="agent-status-badge"]:has-text("${status}")`,
            { timeout }
        );
    }

    /**
     * Start a conversation (if not already active).
     */
    async startConversation(): Promise<void> {
        const status = await this.getStatus();
        if (status === 'active') {
            debugLog('Conversation already active');
            return;
        }

        debugLog('Starting conversation');
        await this.startBtn.click();
        await this.waitForStatus('active');
    }

    /**
     * Send a message to the agent.
     * 
     * @param message - Message to send
     * @param waitForResponse - Whether to wait for agent response (default true)
     */
    async sendMessage(message: string, waitForResponse = true): Promise<void> {
        debugLog(`Sending message: ${message}`);

        await this.messageInput.fill(message);
        await this.sendBtn.click();

        if (waitForResponse) {
            await this.waitForResponse();
        }
    }

    /**
     * Wait for an agent response message to appear.
     */
    async waitForResponse(timeout = 10000): Promise<void> {
        await this.page.waitForSelector('.message.role-agent', { timeout });
    }

    /**
     * Check if there are pending changes.
     */
    async hasPendingChanges(): Promise<boolean> {
        return await this.pendingChangesBlock.isVisible();
    }

    /**
     * Wait for pending changes to appear.
     */
    async waitForPendingChanges(timeout = 15000): Promise<void> {
        debugLog('Waiting for pending changes');
        await this.pendingChangesBlock.waitFor({ state: 'visible', timeout });
    }

    /**
     * Accept pending changes.
     */
    async acceptChanges(): Promise<void> {
        debugLog('Accepting changes');
        await this.acceptBtn.click();
        await expect(this.pendingChangesBlock).not.toBeVisible({ timeout: 30000 });
    }

    /**
     * Discard pending changes (rollback).
     */
    async discardChanges(): Promise<void> {
        debugLog('Discarding changes');
        await this.discardBtn.click();
        await expect(this.pendingChangesBlock).not.toBeVisible({ timeout: 5000 });
    }

    /**
     * Open the diff review modal.
     */
    async openReviewModal(): Promise<void> {
        debugLog('Opening review modal');
        await this.reviewBtn.click();
        await expect(this.page.locator('.diff-modal-overlay')).toBeVisible();
    }

    /**
     * Close the diff review modal.
     */
    async closeReviewModal(): Promise<void> {
        await this.page.locator('.diff-modal-close').click();
        await expect(this.page.locator('.diff-modal-overlay')).not.toBeVisible();
    }

    /**
     * Start a new chat (handles confirmation dialog if needed).
     */
    async newChat(expectConfirmDialog = false): Promise<void> {
        debugLog(`Starting new chat (confirm=${expectConfirmDialog})`);

        if (expectConfirmDialog) {
            this.page.once('dialog', async dialog => {
                expect(dialog.type()).toBe('confirm');
                await dialog.accept();
            });
        }

        await this.newChatBtn.click();
        await this.waitForStatus('active');
    }

    /**
     * Abort the current conversation.
     */
    async abort(): Promise<void> {
        debugLog('Aborting conversation');
        await this.abortBtn.click();
        await this.waitForStatus('idle');
    }

    /**
     * Get all messages in the conversation.
     */
    async getMessages(): Promise<{ role: string; content: string }[]> {
        const messages = await this.page.locator('.message').all();
        const result: { role: string; content: string }[] = [];

        for (const msg of messages) {
            const classList = await msg.getAttribute('class') ?? '';
            const role = classList.includes('role-user') ? 'user'
                : classList.includes('role-agent') ? 'agent'
                    : classList.includes('role-system') ? 'system'
                        : 'unknown';
            const content = await msg.locator('.message-content').textContent() ?? '';
            result.push({ role, content: content.trim() });
        }

        return result;
    }

    /**
     * Check if the message input is ready for typing.
     */
    async isInputReady(): Promise<boolean> {
        return await this.messageInput.isVisible() && await this.messageInput.isEnabled();
    }
}
