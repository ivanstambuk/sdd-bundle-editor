
import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';
import { injectMockSpeechRecognition } from './utils/browser-mocks';

test.describe('Speech to Text', () => {
    // Reduce timeout for debugging (but enough for sluggish CI)
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Listen for console logs
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        // Mock SpeechRecognition before page loads
        await injectMockSpeechRecognition(page);

        const bundlePath = getSampleBundlePath();

        // Use resetAgent=true to ensure fresh state
        await page.goto(`/?bundleDir=${bundlePath}&debug=true&resetAgent=true`);

        // Ensure Agent Panel is open
        const agentPanel = page.locator('.agent-panel');
        if (!(await agentPanel.isVisible())) {
            const toggleBtn = page.getByTitle('Toggle Agent Panel (Ctrl+J)');
            if (await toggleBtn.isVisible()) {
                await toggleBtn.click();
            }
        }
        await expect(agentPanel).toBeVisible({ timeout: 10000 });

        // Deterministic Start: We KNOW it is idle because of resetAgent=true
        console.log('Starting conversation...');
        await page.getByTestId('agent-start-btn').click();

        // Wait for status to become active
        await expect(page.getByTestId('agent-status-badge')).toHaveText('active', { timeout: 15000 });
    });

    test('should activate microphone state and transcribe text', async ({ page }) => {
        // Wait for agent panel to be active and input to be present
        const micBtn = page.getByTestId('agent-mic-btn');
        const input = page.getByTestId('agent-message-input');

        // Initial state
        await expect(micBtn).toBeVisible();
        await expect(micBtn).not.toHaveClass(/active/);
        await expect(input).toHaveValue('');

        // Click microphone
        await micBtn.click();

        // Verify active state
        await expect(micBtn).toHaveClass(/active/);
        await expect(input).toHaveClass(/listening/);

        // Wait for mock result to be populated (simulated in addInitScript)
        await expect(input).toHaveValue('Hello Playwright');

        // Click again to stop
        await micBtn.click();

        // Verify stopped state (Wait for onend to fire which sets state to false)
        // Note: In our mock, stop() dispatches 'end' immediately, and component updates state.
        await expect(micBtn).not.toHaveClass(/active/);
        await expect(input).not.toHaveClass(/listening/);

        // Text should remain
        await expect(input).toHaveValue('Hello Playwright');
    });

    // Test appending to existing text
    test('should append to existing text', async ({ page }) => {
        const micBtn = page.locator('.mic-btn');
        const input = page.getByTestId('agent-message-input');

        // Type some text first
        await input.fill('Existing text.');

        // Activate mic
        await micBtn.click();

        // Wait for transcription (Mock sends "Hello Playwright")
        // Logic adds space if previous text exists
        await expect(input).toHaveValue('Existing text. Hello Playwright');
    });
});
