/**
 * Playwright Global Setup - Pre-configures the mock agent before tests run.
 * 
 * This ensures consistent agent state at the start of the test suite.
 * Individual tests can still reset/reconfigure as needed.
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

        if (!serverReady) {
            console.warn('⚠️ Backend server not ready after 30s - skipping mock agent pre-configuration');
            return;
        }

        // Reset agent state to ensure clean slate
        const resetResponse = await requestContext.post('/agent/reset');
        if (!resetResponse.ok()) {
            console.warn('⚠️ Failed to reset agent state in global setup');
            return;
        }

        // Pre-configure mock agent backend
        const configResponse = await requestContext.post('/agent/config', {
            data: {
                type: 'mock',
                options: {}
            }
        });

        if (configResponse.ok()) {
            console.log('✅ Global setup: Mock agent pre-configured');
        } else {
            console.warn('⚠️ Failed to pre-configure mock agent in global setup');
        }
    } catch (error) {
        console.warn('⚠️ Global setup error (non-fatal):', error);
    } finally {
        await requestContext.dispose();
    }
}

export default globalSetup;
