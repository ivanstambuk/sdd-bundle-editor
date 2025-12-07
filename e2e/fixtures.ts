
import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export const test = base.extend<{ saveLogs: void }>({
    saveLogs: [async ({ page }, use, testInfo) => {
        const logs: string[] = [];

        // Capture console logs
        page.on('console', msg => {
            const text = msg.text();
            logs.push(`[CONSOLE] ${msg.type()}: ${text}`);
            // Also pipe specific important logs to stdout for realtime visibility if needed
            if (msg.type() === 'error' || msg.type() === 'warning') {
                // console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
            }
        });

        // Capture page errors (unhandled exceptions)
        page.on('pageerror', err => {
            logs.push(`[PAGE ERROR] ${err.message}\n${err.stack}`);
        });

        // Capture failed network requests (server errors)
        page.on('response', response => {
            if (response.status() >= 400) {
                logs.push(`[NETWORK] ${response.status()} ${response.request().method()} ${response.url()}`);
            }
        });

        await use();

        // On failure, write logs to file
        if (testInfo.status !== 'passed') {
            const logFileName = `failure_logs_${testInfo.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
            const logPath = path.join(testInfo.outputDir, logFileName);

            // Ensure output directory exists (Playwright usually creates it)
            if (!fs.existsSync(testInfo.outputDir)) {
                fs.mkdirSync(testInfo.outputDir, { recursive: true });
            }

            fs.writeFileSync(logPath, logs.join('\n'));
            console.log(`Saved failure logs to: ${logPath}`);
        }
    }, { auto: true }],
});

export { expect } from '@playwright/test';
