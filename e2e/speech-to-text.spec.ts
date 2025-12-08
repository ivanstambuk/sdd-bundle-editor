
import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('Speech to Text', () => {
    // Reduce timeout for debugging (but enough for sluggish CI)
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        // Listen for console logs
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        // Mock SpeechRecognition before page loads
        await page.addInitScript(() => {
            console.log('Injecting MockSpeechRecognition');
            class MockSpeechRecognition extends EventTarget {
                continuous = false;
                interimResults = false;
                lang = '';

                constructor() {
                    super();
                    console.log('MockSpeechRecognition instantiated');
                }

                start() {
                    console.log('MockSpeechRecognition.start() called');
                    this.dispatchEvent(new Event('start'));
                    if (this.onstart) this.onstart(new Event('start'));

                    // Simulate speech happening after a short delay
                    setTimeout(() => {
                        console.log('Simulating result');
                        this.simulateResult('Hello Playwright');
                    }, 500); // Increased delay slightly
                }

                stop() {
                    console.log('MockSpeechRecognition.stop() called');
                    this.dispatchEvent(new Event('end'));
                    if (this.onend) this.onend(new Event('end'));
                }

                abort() {
                    this.dispatchEvent(new Event('end'));
                    if (this.onend) this.onend(new Event('end'));
                }

                simulateResult(transcript: string) {
                    const event = {
                        resultIndex: 0,
                        results: {
                            length: 1,
                            0: {
                                isFinal: true,
                                0: { transcript }
                            }
                        }
                    };
                    if (this.onresult) {
                        (this.onresult as any)(event);
                    } else {
                        console.log('No onresult handler set');
                    }
                }

                onresult: any = null;
                onstart: any = null;
                onend: any = null;
                onerror: any = null;
            }

            // @ts-ignore
            window.SpeechRecognition = MockSpeechRecognition;
            // @ts-ignore
            window.webkitSpeechRecognition = MockSpeechRecognition;
        });

        const bundlePath = getSampleBundlePath();
        await page.goto(`/?bundleDir=${bundlePath}&debug=true`);

        // Ensure Agent Panel is open
        const agentPanel = page.locator('.agent-panel');
        if (!(await agentPanel.isVisible())) {
            const settingsBtn = page.locator('[data-testid="agent-settings-btn"]'); // This button is creating confusion, it's inside placeholder?
            // No, the toggle button in header is what we want.
            // Title "Toggle Agent Panel (Ctrl+J)"
            const toggleBtn = page.getByTitle('Toggle Agent Panel (Ctrl+J)');
            if (await toggleBtn.isVisible()) {
                await toggleBtn.click();
            }
        }
        await expect(agentPanel).toBeVisible({ timeout: 10000 });

        // If 'Start Conversation' button is present, click it.
        // It might be inside .placeholder-actions
        const startBtn = page.getByTestId('agent-start-btn');
        if (await startBtn.isVisible()) {
            console.log('Starting conversation...');
            await startBtn.click();
            // Wait for status to become active
            await expect(page.getByTestId('agent-status-badge')).toHaveText('active', { timeout: 15000 });
        } else {
            // Maybe already active? Verify
            console.log('Start button not visible, checking status...');
            const statusBadge = page.getByTestId('agent-status-badge');
            if (await statusBadge.isVisible()) {
                console.log('Current Status:', await statusBadge.innerText());
            } else {
                console.log('Status badge NOT visible');
            }
        }
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
