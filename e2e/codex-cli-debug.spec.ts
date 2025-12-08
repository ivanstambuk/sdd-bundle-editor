import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('Codex CLI Integration Debug', () => {
    // This test exercises the Codex CLI configuration flow with corrected arguments
    // The fix was: --ask-for-approval=never is invalid, should use --full-auto

    test('should configure Codex CLI with correct args and document any errors', async ({ page }) => {
        const bundleDir = getSampleBundlePath();

        // 1. Start fresh by calling the abort endpoint directly
        await page.goto('/');

        // Call abort API to reset state
        await page.evaluate(async () => {
            await fetch('/agent/abort', { method: 'POST' });
        });

        // Reload to get fresh state
        await page.reload();
        await page.waitForSelector('.agent-panel', { timeout: 5000 });

        // Screenshot 1: Initial state after reset
        await page.screenshot({ path: 'artifacts/codex_step1_initial.png' });

        // 2. Configure Codex CLI directly via API with CORRECTED args
        const configResult = await page.evaluate(async () => {
            const res = await fetch('/agent/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'cli',
                    options: {
                        command: 'codex',
                        args: ['exec', '--full-auto']  // FIXED: was ['exec', '--sandbox', 'read-only', '--ask-for-approval=never']
                    }
                })
            });
            return { status: res.status, body: await res.json() };
        });
        console.log('Config result:', JSON.stringify(configResult, null, 2));

        // Reload to pick up new config in UI
        await page.reload();
        await page.waitForSelector('.agent-panel', { timeout: 5000 });

        // Screenshot 2: After configuration
        await page.screenshot({ path: 'artifacts/codex_step2_configured.png' });

        // Get status to confirm config
        const configStatus = await page.evaluate(async () => {
            const res = await fetch('/agent/status');
            return res.json();
        });
        console.log('Config status:', JSON.stringify(configStatus, null, 2));

        // 3. Start conversation via API
        const startResult = await page.evaluate(async (bd) => {
            const res = await fetch('/agent/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bundleDir: bd })
            });
            return { status: res.status, body: await res.json() };
        }, bundleDir);
        console.log('Start result:', JSON.stringify(startResult, null, 2));

        // Reload to see conversation status
        await page.reload();
        await page.waitForSelector('.agent-panel', { timeout: 5000 });

        // Screenshot 3: After starting conversation
        await page.screenshot({ path: 'artifacts/codex_step3_started.png' });

        // 4. Try sending a simple message via API
        const messageResult = await page.evaluate(async (bd) => {
            const res = await fetch('/agent/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bundleDir: bd,
                    message: 'Say "Hello from Codex" in your response.'
                })
            });
            return { status: res.status, body: await res.json() };
        }, bundleDir);
        console.log('Message result:', JSON.stringify(messageResult, null, 2));

        // Reload to see the response/error
        await page.reload();
        await page.waitForSelector('.agent-panel', { timeout: 5000 });

        // Screenshot 4: After sending message (shows response or error)
        await page.screenshot({ path: 'artifacts/codex_step4_message_sent.png' });

        // 5. Get final status
        const finalStatus = await page.evaluate(async () => {
            const res = await fetch('/agent/status');
            return res.json();
        });
        console.log('=== FINAL STATUS ===');
        console.log(JSON.stringify(finalStatus, null, 2));

        // Screenshot 5: Final state
        await page.screenshot({ path: 'artifacts/codex_step5_final.png' });

        // Verify no error in final state
        if (finalStatus.state.status === 'error') {
            console.log('=== ERROR DETECTED ===');
            console.log('Error:', finalStatus.state.lastError);
        } else if (finalStatus.state.status === 'active') {
            console.log('=== SUCCESS: Codex CLI working! ===');
            // Log the messages
            for (const msg of finalStatus.state.messages) {
                console.log(`[${msg.role}]: ${msg.content.substring(0, 200)}...`);
            }
        }
    });
});
