/**
 * Playwright Global Setup - Verifies backend is ready before tests run.
 * 
 * The UI is now read-only - agent endpoints have been removed.
 * We only need to verify the server is up and responding.
 */

import { request } from '@playwright/test';

async function globalSetup() {
    const requestContext = await request.newContext({
        baseURL: 'http://localhost:3000',
    });

    try {
        // Wait for server to be ready
        let serverReady = false;
        for (let i = 0; i < 30; i++) {
            try {
                const health = await requestContext.get('/health');
                if (health.ok()) {
                    serverReady = true;
                    break;
                }
            } catch {
                // Server not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (serverReady) {
            console.log('✅ Global setup: Backend server is ready');
        } else {
            console.warn('⚠️ Backend server not ready after 30s');
        }
    } catch (error) {
        console.warn('⚠️ Global setup error (non-fatal):', error);
    } finally {
        await requestContext.dispose();
    }
}

export default globalSetup;
