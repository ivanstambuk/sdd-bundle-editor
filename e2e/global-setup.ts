/**
 * Playwright Global Setup - Verifies backends are ready before tests run.
 * 
 * Phase 4.4 MCP-First Architecture:
 * - Legacy HTTP server at http://localhost:3000 (fallback)
 * - MCP server at http://localhost:3001 (primary for UI)
 * 
 * The UI is now read-only and uses MCP protocol for data loading.
 */

import { request } from '@playwright/test';

async function globalSetup() {
    const legacyContext = await request.newContext({
        baseURL: 'http://localhost:3000',
    });
    const mcpContext = await request.newContext({
        baseURL: 'http://localhost:3001',
    });

    try {
        // Wait for legacy server to be ready
        let legacyReady = false;
        for (let i = 0; i < 30; i++) {
            try {
                const health = await legacyContext.get('/health');
                if (health.ok()) {
                    legacyReady = true;
                    break;
                }
            } catch {
                // Server not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (legacyReady) {
            console.log('✅ Global setup: Legacy HTTP server is ready (port 3000)');
        } else {
            console.warn('⚠️ Legacy HTTP server not ready after 30s (port 3000)');
        }

        // Wait for MCP server to be ready
        let mcpReady = false;
        for (let i = 0; i < 30; i++) {
            try {
                const health = await mcpContext.get('/health');
                if (health.ok()) {
                    mcpReady = true;
                    break;
                }
            } catch {
                // MCP server not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (mcpReady) {
            console.log('✅ Global setup: MCP server is ready (port 3001)');
        } else {
            console.warn('⚠️ MCP server not ready after 30s (port 3001)');
            console.warn('   UI will fall back to legacy HTTP API');
        }
    } catch (error) {
        console.warn('⚠️ Global setup error (non-fatal):', error);
    } finally {
        await legacyContext.dispose();
        await mcpContext.dispose();
    }
}

export default globalSetup;

