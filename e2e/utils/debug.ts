/**
 * E2E Debug utilities.
 * 
 * When DEBUG_E2E=true is set, enables verbose logging during test runs.
 */

import { Page } from '@playwright/test';

/**
 * Check if debug mode is enabled.
 */
export const isDebugMode = (): boolean => {
    return process.env.DEBUG_E2E === 'true';
};

/**
 * Log a message if debug mode is enabled.
 */
export function debugLog(message: string, ...args: unknown[]): void {
    if (isDebugMode()) {
        console.log(`[E2E Debug] ${message}`, ...args);
    }
}

/**
 * Set up API call logging for a page.
 * When DEBUG_E2E=true, logs all API requests and responses.
 * 
 * @param page - Playwright page object
 */
export function setupApiLogging(page: Page): void {
    if (!isDebugMode()) return;

    page.on('request', request => {
        const url = request.url();
        if (url.includes('localhost:3000')) {
            console.log(`[API →] ${request.method()} ${url}`);
        }
    });

    page.on('response', response => {
        const url = response.url();
        if (url.includes('localhost:3000')) {
            const status = response.status();
            const statusIcon = status >= 400 ? '❌' : '✓';
            console.log(`[API ←] ${statusIcon} ${status} ${url}`);
        }
    });

    page.on('requestfailed', request => {
        const url = request.url();
        if (url.includes('localhost:3000')) {
            console.log(`[API ✗] FAILED ${url}: ${request.failure()?.errorText}`);
        }
    });
}

/**
 * Log current page state for debugging.
 * 
 * @param page - Playwright page object
 * @param label - Label for the log
 */
export async function logPageState(page: Page, label: string): Promise<void> {
    if (!isDebugMode()) return;

    const url = page.url();
    const title = await page.title();
    console.log(`[E2E Debug] ${label}: url=${url} title="${title}"`);
}
