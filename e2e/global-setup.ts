/**
 * Playwright Global Setup - Verifies MCP backend is ready before tests run.
 * 
 * MCP-First Architecture:
 * All bundle operations now go through the MCP server at http://localhost:3001.
 * Legacy HTTP server has been removed.
 */

import { request } from '@playwright/test';

async function globalSetup() {
    const mcpContext = await request.newContext({
        baseURL: 'http://localhost:3001',
    });

    try {
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
            throw new Error('MCP server not ready after 30s (port 3001)');
        }
    } catch (error) {
        console.error('❌ Global setup error:', error);
        throw error;
    } finally {
        await mcpContext.dispose();
    }
}

export default globalSetup;
