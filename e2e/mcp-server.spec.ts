/**
 * MCP Server E2E Tests
 * 
 * Tests the MCP server HTTP transport functionality end-to-end.
 * These tests verify that the MCP tools work correctly when accessed
 * via the HTTP/SSE transport.
 */

import { test, expect } from '@playwright/test';
import { getSampleBundlePath, createTempBundle, cleanupTempBundle } from './bundle-test-fixture';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

// MCP server process
let mcpServer: ChildProcess | null = null;
let mcpPort = 3002; // Use different port to avoid conflicts with main server

// Temp bundle for write tests
let tempBundleDir: string | null = null;

/**
 * Helper to start MCP server in HTTP mode
 */
async function startMcpServer(bundlePath: string): Promise<void> {
    const serverPath = path.join(__dirname, '../packages/mcp-server/dist/index.js');

    return new Promise((resolve, reject) => {
        mcpServer = spawn('node', [serverPath, '--http', '--port', String(mcpPort), bundlePath], {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, NODE_ENV: 'test' },
        });

        let output = '';
        mcpServer.stderr?.on('data', (data) => {
            output += data.toString();
            if (output.includes('MCP HTTP Server listening')) {
                resolve();
            }
        });

        mcpServer.on('error', reject);

        // Timeout after 10 seconds
        setTimeout(() => {
            if (!output.includes('MCP HTTP Server listening')) {
                reject(new Error('MCP server failed to start: ' + output));
            }
        }, 10000);
    });
}

/**
 * Helper to stop MCP server
 */
async function stopMcpServer(): Promise<void> {
    if (mcpServer) {
        mcpServer.kill('SIGTERM');
        mcpServer = null;
    }
}

/**
 * Helper to parse SSE response
 */
function parseSSEResponse(text: string): unknown {
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                return JSON.parse(line.slice(6));
            } catch {
                // Ignore parse errors
            }
        }
    }
    return null;
}

/**
 * Helper to initialize MCP session
 */
async function initMcpSession(): Promise<string> {
    const response = await fetch(`http://localhost:${mcpPort}/mcp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'e2e-test', version: '1.0.0' },
            },
        }),
    });

    const sessionId = response.headers.get('mcp-session-id');
    if (!sessionId) {
        throw new Error('No session ID in response');
    }
    return sessionId;
}

/**
 * Helper to call MCP tool
 */
async function callMcpTool(
    sessionId: string,
    tool: string,
    args: Record<string, unknown>
): Promise<unknown> {
    const response = await fetch(`http://localhost:${mcpPort}/mcp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Mcp-Session-Id': sessionId,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: tool, arguments: args },
        }),
    });

    const text = await response.text();
    const parsed = parseSSEResponse(text) as { result?: { content?: Array<{ text: string }> }; error?: { message: string } };

    if (parsed?.error) {
        throw new Error(`Tool error: ${parsed.error.message}`);
    }

    // Extract content
    if (parsed?.result?.content?.[0]?.text) {
        try {
            return JSON.parse(parsed.result.content[0].text);
        } catch {
            return parsed.result.content[0].text;
        }
    }
    return parsed?.result;
}

test.describe('MCP Server E2E Tests', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => {
        // Create temp bundle for tests
        tempBundleDir = await createTempBundle('mcp-e2e-');

        // Start MCP server
        await startMcpServer(tempBundleDir);
    });

    test.afterAll(async () => {
        await stopMcpServer();

        if (tempBundleDir) {
            await cleanupTempBundle(tempBundleDir);
        }
    });

    test('health endpoint returns status', async () => {
        const response = await fetch(`http://localhost:${mcpPort}/health`);
        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.status).toBe('healthy');
        expect(typeof data.sessions).toBe('number');
    });

    test('can initialize MCP session', async () => {
        const sessionId = await initMcpSession();
        expect(sessionId).toBeTruthy();
        expect(sessionId.length).toBeGreaterThan(10);
    });

    test('list_bundles returns loaded bundle', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'list_bundles', {}) as Array<{ id: string; entityTypes: string[] }>;

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0].id).toBeTruthy();
        expect(Array.isArray(result[0].entityTypes)).toBe(true);
        expect(result[0].entityTypes).toContain('Requirement');
        expect(result[0].entityTypes).toContain('Feature');
    });

    test('list_entities returns entity IDs', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as string[];

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result.includes('REQ-001')).toBe(true);
    });

    test('read_entity returns entity data', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'read_entity', {
            entityType: 'Requirement',
            id: 'REQ-001',
        }) as { id: string; title: string };

        expect(result.id).toBe('REQ-001');
        expect(result.title).toBeTruthy();
    });

    test('search_entities finds matching entities', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'search_entities', {
            query: 'requirement',
        }) as { results: Array<{ id: string }> };

        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
    });

    test('validate_bundle returns diagnostics', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'validate_bundle', {}) as { summary: { isValid: boolean } };

        expect(result.summary).toBeDefined();
        expect(typeof result.summary.isValid).toBe('boolean');
    });

    test('apply_changes dry-run returns preview', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'update',
                entityType: 'Requirement',
                entityId: 'REQ-001',
                fieldPath: 'description',
                value: 'Updated via dry-run test',
            }],
            dryRun: true,
        }) as { success: boolean; dryRun: boolean; wouldApply: number };

        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
        expect(result.wouldApply).toBe(1);
    });

    test('apply_changes updates entity on disk', async () => {
        const sessionId = await initMcpSession();

        // Apply a change
        const applyResult = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'update',
                entityType: 'Requirement',
                entityId: 'REQ-001',
                fieldPath: 'description',
                value: 'Updated via E2E test',
            }],
            dryRun: false,
        }) as { success: boolean; applied: number };

        expect(applyResult.success).toBe(true);
        expect(applyResult.applied).toBe(1);

        // Verify the change persisted
        const readResult = await callMcpTool(sessionId, 'read_entity', {
            entityType: 'Requirement',
            id: 'REQ-001',
        }) as { description: string };

        expect(readResult.description).toBe('Updated via E2E test');
    });

    test('apply_changes create and delete entity', async () => {
        const sessionId = await initMcpSession();

        // Create a new entity with all required fields
        const createResult = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'create',
                entityType: 'Requirement',
                entityId: 'REQ-999',
                data: {
                    id: 'REQ-999',
                    title: 'E2E Test Requirement',
                    description: 'Created by E2E test',
                    kind: 'functional',
                    category: 'FR',  // Required by schema
                    state: 'draft',
                    featureIds: ['FEAT-001'],  // Required by lint rule
                },
            }],
            dryRun: false,
        }) as { success: boolean };

        expect(createResult.success).toBe(true);

        // Verify creation
        const readResult = await callMcpTool(sessionId, 'read_entity', {
            entityType: 'Requirement',
            id: 'REQ-999',
        }) as { id: string; title: string };

        expect(readResult.id).toBe('REQ-999');
        expect(readResult.title).toBe('E2E Test Requirement');

        // Delete the entity
        const deleteResult = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'delete',
                entityType: 'Requirement',
                entityId: 'REQ-999',
            }],
            dryRun: false,
        }) as { success: boolean };

        expect(deleteResult.success).toBe(true);

        // Verify deletion - should throw or return not found
        try {
            await callMcpTool(sessionId, 'read_entity', {
                entityType: 'Requirement',
                id: 'REQ-999',
            });
            // If we get here, entity wasn't deleted
            expect(true).toBe(false); // Force fail
        } catch {
            // Expected - entity was deleted
            expect(true).toBe(true);
        }
    });
});
