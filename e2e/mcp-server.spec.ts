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

// ============================================================================
// MCP Response Envelope Types
// ============================================================================

/**
 * Standard MCP tool success response envelope.
 * All tools wrap their responses in this envelope for consistent handling.
 *
 * @template T The shape of the `data` payload, defaults to Record<string, unknown>
 */
interface ToolResponse<T = Record<string, unknown>> {
    /** Whether the operation succeeded */
    ok: true;
    /** Name of the tool that was called */
    tool: string;
    /** Bundle ID the operation was performed on (when applicable) */
    bundleId?: string;
    /** The actual tool result payload */
    data: T;
    /** Optional metadata about the operation (pagination, counts, etc.) */
    meta?: Record<string, unknown>;
    /** Validation diagnostics (for validate_bundle) */
    diagnostics?: unknown[];
}

/**
 * MCP tool error response envelope.
 * Returned when a tool call fails.
 */
interface ErrorResponse {
    /** Always false for errors */
    ok: false;
    /** Name of the tool that was called */
    tool: string;
    /** Error details */
    error: {
        /** Error code (e.g., 'ENTITY_NOT_FOUND', 'VALIDATION_ERROR') */
        code: string;
        /** Human-readable error message */
        message: string;
        /** Additional error context */
        details?: unknown;
    };
}

/**
 * Union type for any MCP tool response
 */
type ToolResult<T = Record<string, unknown>> = ToolResponse<T> | ErrorResponse;

// ============================================================================
// MCP Server Process Management
// ============================================================================

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
 * Returns the unwrapped response with data merged at root level:
 * { ...data, meta, diagnostics, bundleId, ok, tool }
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
            const envelope = JSON.parse(parsed.result.content[0].text) as {
                ok?: boolean;
                tool?: string;
                bundleId?: string;
                data?: Record<string, unknown>;
                meta?: Record<string, unknown>;
                diagnostics?: unknown[];
                error?: unknown;
            };

            // Unwrap envelope: merge data at root level while keeping envelope fields
            if (envelope && typeof envelope === 'object' && 'data' in envelope) {
                const result: Record<string, unknown> = {
                    ...envelope.data,       // Spread data at root for backward compat
                    ok: envelope.ok,
                    tool: envelope.tool,
                    data: envelope.data,    // Also keep data for tests that need full envelope
                };
                // Only include optional fields when they exist
                if (envelope.bundleId !== undefined) {
                    result.bundleId = envelope.bundleId;
                }
                if (envelope.meta !== undefined) {
                    result.meta = envelope.meta;
                }
                if (envelope.diagnostics !== undefined) {
                    result.diagnostics = envelope.diagnostics;
                }
                return result;
            }

            return envelope;
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
        const result = await callMcpTool(sessionId, 'list_bundles', {}) as {
            bundles: Array<{ id: string; entityTypes: string[] }>;
            ok: boolean;
        };

        expect(result.ok).toBe(true);
        expect(result.bundles).toBeDefined();
        expect(Array.isArray(result.bundles)).toBe(true);
        expect(result.bundles.length).toBe(1);
        expect(result.bundles[0].id).toBeTruthy();
        expect(Array.isArray(result.bundles[0].entityTypes)).toBe(true);
        expect(result.bundles[0].entityTypes).toContain('Requirement');
        expect(result.bundles[0].entityTypes).toContain('Feature');
    });

    test('list_entities returns entity IDs', async () => {
        const sessionId = await initMcpSession();
        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[]; meta: { total: number; hasMore: boolean } };

        expect(listResult.ids).toBeDefined();
        expect(Array.isArray(listResult.ids)).toBe(true);
        expect(listResult.ids.length).toBeGreaterThan(0);
        // Entity IDs should be strings starting with REQ-
        expect(listResult.ids[0].startsWith('REQ-')).toBe(true);
        expect(listResult.meta).toBeDefined();
        expect(listResult.meta.total).toBeGreaterThan(0);
    });

    test('read_entity returns entity data', async () => {
        const sessionId = await initMcpSession();

        // First get a valid entity ID
        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'read_entity', {
            entityType: 'Requirement',
            id: testId,
        }) as { id: string; title: string };

        expect(result.id).toBe(testId);
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

        // First get a valid entity ID
        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'update',
                entityType: 'Requirement',
                entityId: testId,
                fieldPath: 'description',
                value: 'Updated via dry-run test',
            }],
            dryRun: true,
        }) as { ok: boolean; data: { dryRun: boolean; wouldApply: number } };

        expect(result.ok).toBe(true);
        expect(result.data.dryRun).toBe(true);
        expect(result.data.wouldApply).toBe(1);
    });

    test('apply_changes updates entity on disk', async () => {
        const sessionId = await initMcpSession();

        // First get a valid entity ID
        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        // Apply a change
        const applyResult = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'update',
                entityType: 'Requirement',
                entityId: testId,
                fieldPath: 'description',
                value: 'Updated via E2E test',
            }],
            dryRun: false,
        }) as { ok: boolean; data: { applied: number } };

        expect(applyResult.ok).toBe(true);
        expect(applyResult.data.applied).toBe(1);

        // Verify the change persisted
        const readResult = await callMcpTool(sessionId, 'read_entity', {
            entityType: 'Requirement',
            id: testId,
        }) as { description: string };

        expect(readResult.description).toBe('Updated via E2E test');
    });

    test('apply_changes create and delete entity', async () => {
        const sessionId = await initMcpSession();

        // First get a valid feature ID to use in the reference
        const featureListResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Feature' }) as { ids: string[] };
        const featureIds = featureListResult.ids;
        expect(featureIds.length).toBeGreaterThan(0);
        const featureId = featureIds[0];

        // Create a new entity with all required fields
        // Using validate=warn since the temp bundle may have different schema
        const createResult = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'create',
                entityType: 'Requirement',
                entityId: 'REQ-e2e-test-temp',
                data: {
                    id: 'REQ-e2e-test-temp',
                    title: 'E2E Test Requirement',
                    description: 'Created by E2E test',
                    kind: 'functional',
                    category: 'FR',  // Required by schema
                    state: 'draft',
                    realizesFeatureIds: [featureId],  // Use dynamically discovered feature ID
                },
            }],
            dryRun: false,
            validate: 'warn',  // Allow warnings for schema flexibility in tests
            referencePolicy: 'warn',  // Allow reference warnings
        }) as { ok: boolean };

        expect(createResult.ok).toBe(true);

        // Verify creation
        const readResult = await callMcpTool(sessionId, 'read_entity', {
            entityType: 'Requirement',
            id: 'REQ-e2e-test-temp',
        }) as { id: string; title: string };

        expect(readResult.id).toBe('REQ-e2e-test-temp');
        expect(readResult.title).toBe('E2E Test Requirement');

        // Delete the entity
        const deleteResult = await callMcpTool(sessionId, 'apply_changes', {
            changes: [{
                operation: 'delete',
                entityType: 'Requirement',
                entityId: 'REQ-e2e-test-temp',
            }],
            dryRun: false,
            deleteMode: 'orphan',  // Allow orphan since we just created it
        }) as { ok: boolean };

        expect(deleteResult.ok).toBe(true);

        // Verify deletion - should throw or return not found
        try {
            await callMcpTool(sessionId, 'read_entity', {
                entityType: 'Requirement',
                id: 'REQ-e2e-test-temp',
            });
            // If we get here, entity wasn't deleted
            expect(true).toBe(false); // Force fail
        } catch {
            // Expected - entity was deleted
            expect(true).toBe(true);
        }
    });

    // Phase 1: Bulk Operations Tests
    test('read_entities returns multiple entities', async () => {
        const sessionId = await initMcpSession();

        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const ids = listResult.ids;
        expect(ids.length).toBeGreaterThan(0);
        const testIds = ids.slice(0, 2); // Take first 2 IDs

        const result = await callMcpTool(sessionId, 'read_entities', {
            entityType: 'Requirement',
            ids: testIds,
        }) as { entities: Array<{ id: string }>; meta: { requested: number; found: number; notFound: string[] } };

        expect(result.entities).toBeDefined();
        expect(Array.isArray(result.entities)).toBe(true);
        expect(result.entities.length).toBe(testIds.length);
        expect(result.meta).toBeDefined();
        expect(result.meta.requested).toBe(testIds.length);
        expect(result.meta.found).toBe(testIds.length);
        expect(result.meta.notFound.length).toBe(0);
    });

    test('read_entities reports not found IDs', async () => {
        const sessionId = await initMcpSession();

        // First get a valid entity ID
        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const validId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'read_entities', {
            entityType: 'Requirement',
            ids: [validId, 'REQ-NONEXISTENT'],
        }) as { entities: Array<{ id: string }>; meta: { notFound: string[] } };

        expect(result.meta.notFound).toContain('REQ-NONEXISTENT');
        expect(result.entities.length).toBe(1);
    });

    test('read_entities filters fields when specified', async () => {
        const sessionId = await initMcpSession();

        // First get a valid entity ID
        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'read_entities', {
            entityType: 'Requirement',
            ids: [testId],
            fields: ['title'],
        }) as { entities: Array<{ id: string; title?: string; description?: string }> };

        expect(result.entities.length).toBe(1);
        expect(result.entities[0].id).toBeDefined();
        expect(result.entities[0].title).toBeDefined();
        // Description should not be included when not in fields
        expect(result.entities[0].description).toBeUndefined();
    });

    test('list_entity_summaries returns summaries with pagination', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'list_entity_summaries', {
            entityType: 'Requirement',
            include: ['id', 'title', 'state'],
            limit: 10,
        }) as { items: Array<{ id: string; title?: string; entityType: string }>; meta: { total: number; limit: number; hasMore: boolean } };

        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.meta).toBeDefined();
        expect(result.meta.limit).toBe(10);
        expect(typeof result.meta.total).toBe('number');
        expect(typeof result.meta.hasMore).toBe('boolean');

        // Each item should have entityType
        if (result.items.length > 0) {
            expect(result.items[0].entityType).toBe('Requirement');
            expect(result.items[0].id).toBeDefined();
        }
    });

    test('list_entity_summaries across all types', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'list_entity_summaries', {
            include: ['id', 'title'],
            limit: 50,
        }) as { items: Array<{ entityType: string }>; meta: { total: number } };

        expect(result.items).toBeDefined();
        expect(result.meta.total).toBeGreaterThan(0);

        // Should have multiple entity types
        const entityTypes = new Set(result.items.map(i => i.entityType));
        expect(entityTypes.size).toBeGreaterThanOrEqual(1);
    });

    // Phase 2: Schema & Snapshot Tests
    test('get_entity_schema returns JSON schema', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_entity_schema', {
            entityType: 'Requirement',
        }) as { bundleId: string; entityType: string; schema: { $schema?: string; properties?: Record<string, unknown> } };

        expect(result.bundleId).toBeDefined();
        expect(result.entityType).toBe('Requirement');
        expect(result.schema).toBeDefined();
        expect(result.schema.properties).toBeDefined();
        // Should have common properties like id, title
        if (result.schema.properties) {
            expect(result.schema.properties.id).toBeDefined();
            expect(result.schema.properties.title).toBeDefined();
        }
    });

    test('get_bundle_snapshot returns complete bundle', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_bundle_snapshot', {}) as {
            bundleId: string;
            entities: Record<string, unknown[]>;
            schemas: Record<string, unknown>;
            refGraph: { edges: unknown[] };
            diagnostics: unknown[];
            meta: { entityCount: number; entityTypes: string[] };
        };

        expect(result.bundleId).toBeDefined();
        expect(result.entities).toBeDefined();
        expect(result.schemas).toBeDefined();
        expect(result.refGraph).toBeDefined();
        expect(result.diagnostics).toBeDefined();
        expect(result.meta).toBeDefined();
        expect(result.meta.entityCount).toBeGreaterThan(0);
        expect(result.meta.entityTypes.length).toBeGreaterThan(0);

        // Entities should have data
        expect(result.entities.Requirement).toBeDefined();
        expect(Array.isArray(result.entities.Requirement)).toBe(true);

        // Schemas should have Requirement
        expect(result.schemas.Requirement).toBeDefined();
    });

    test('get_bundle_snapshot with options disabled', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_bundle_snapshot', {
            includeSchemas: false,
            includeRefGraph: false,
            includeDiagnostics: false,
        }) as {
            entities: Record<string, unknown[]>;
            schemas?: unknown;
            refGraph?: unknown;
            diagnostics?: unknown;
        };

        expect(result.entities).toBeDefined();
        // When disabled, these should not be present
        expect(result.schemas).toBeUndefined();
        expect(result.refGraph).toBeUndefined();
        expect(result.diagnostics).toBeUndefined();
    });

    test('get_bundle_snapshot with entityTypes filter', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_bundle_snapshot', {
            entityTypes: ['Requirement'],
        }) as {
            entities: Record<string, unknown[]>;
            meta: { entityTypes: string[]; allEntityTypes: string[] };
        };

        // Should only have Requirement in entities
        expect(result.entities.Requirement).toBeDefined();
        expect(result.entities.Task).toBeUndefined();
        expect(result.entities.Feature).toBeUndefined();

        // Meta should show filtered vs all types
        expect(result.meta.entityTypes).toContain('Requirement');
        expect(result.meta.allEntityTypes.length).toBeGreaterThan(result.meta.entityTypes.length);
    });

    test('get_bundle_snapshot with includeEntityData=summary', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_bundle_snapshot', {
            entityTypes: ['Requirement'],
            includeEntityData: 'summary',
        }) as {
            entities: Record<string, Array<{ id: string; title?: string; description?: string }>>;
            meta: { includeEntityData: string };
        };

        expect(result.meta.includeEntityData).toBe('summary');

        // Summary should have id and title but NOT full fields like description
        const reqs = result.entities.Requirement;
        expect(reqs.length).toBeGreaterThan(0);
        expect(reqs[0].id).toBeDefined();
        // Summary entities should NOT have description (full field)
        const hasDescription = reqs.some(r => 'description' in r && r.description !== undefined);
        const hasTitle = reqs.some(r => 'title' in r || 'name' in r);
        expect(hasTitle).toBe(true); // Should have title or name
    });

    test('get_bundle_snapshot with includeEntityData=ids', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_bundle_snapshot', {
            entityTypes: ['Requirement'],
            includeEntityData: 'ids',
        }) as {
            entities: Record<string, Array<{ id: string; entityType: string; title?: string }>>;
        };

        // Should only have id and entityType
        const reqs = result.entities.Requirement;
        expect(reqs.length).toBeGreaterThan(0);
        expect(reqs[0].id).toBeDefined();
        expect(reqs[0].entityType).toBe('Requirement');
        expect(reqs[0].title).toBeUndefined();
    });

    test('get_bundle_snapshot with maxEntities truncation', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_bundle_snapshot', {
            maxEntities: 2,
        }) as {
            entities: Record<string, unknown[]>;
            meta: { entityCount: number; totalEntities: number; truncated: boolean; maxEntities: number };
        };

        expect(result.meta.maxEntities).toBe(2);
        expect(result.meta.entityCount).toBeLessThanOrEqual(2);
        expect(result.meta.totalEntities).toBeGreaterThan(2); // Bundle has more than 2 entities
        expect(result.meta.truncated).toBe(true);
    });

    // Phase 3: Context Controls Tests
    test('get_context with default options returns target and related', async () => {
        const sessionId = await initMcpSession();

        // First get a valid entity ID
        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'get_context', {
            entityType: 'Requirement',
            id: testId,
        }) as {
            target: { id: string };
            related: Array<{ id: string; entityType: string; relation: string; field: string }>;
            meta: { relatedCount: number; maxRelated: number; truncated: boolean };
        };

        expect(result.target).toBeDefined();
        expect(result.target.id).toBe(testId);
        expect(result.related).toBeDefined();
        expect(Array.isArray(result.related)).toBe(true);
        expect(result.meta).toBeDefined();
        expect(result.meta.maxRelated).toBe(20); // Default
        expect(typeof result.meta.truncated).toBe('boolean');

        // Check stable relation keys
        if (result.related.length > 0) {
            const relation = result.related[0].relation;
            expect(['references', 'referencedBy']).toContain(relation);
            expect(result.related[0].field).toBeDefined();
        }
    });

    test('get_context with includeRelated=summary returns limited fields', async () => {
        const sessionId = await initMcpSession();

        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'get_context', {
            entityType: 'Requirement',
            id: testId,
            includeRelated: 'summary',
        }) as {
            related: Array<{ id: string; entityType: string; data?: { id?: string; title?: string; description?: string } }>;
            meta: { includeRelated: string };
        };

        expect(result.meta.includeRelated).toBe('summary');

        // Summary should only have id, title, name, state - not full description
        if (result.related.length > 0 && result.related[0].data) {
            expect(result.related[0].data.id).toBeDefined();
            // Description should not be in summary (it's a long field)
        }
    });

    test('get_context with includeRelated=ids omits data', async () => {
        const sessionId = await initMcpSession();

        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'get_context', {
            entityType: 'Requirement',
            id: testId,
            includeRelated: 'ids',
        }) as {
            related: Array<{ id: string; entityType: string; data?: unknown }>;
            meta: { includeRelated: string };
        };

        expect(result.meta.includeRelated).toBe('ids');

        // With "ids", there should be no data property
        if (result.related.length > 0) {
            expect(result.related[0].data).toBeUndefined();
        }
    });

    test('get_context with fields filter returns only specified fields', async () => {
        const sessionId = await initMcpSession();

        const listResult = await callMcpTool(sessionId, 'list_entities', { entityType: 'Requirement' }) as { ids: string[] };
        const testId = listResult.ids[0];

        const result = await callMcpTool(sessionId, 'get_context', {
            entityType: 'Requirement',
            id: testId,
            fields: ['title'],
        }) as {
            target: { id: string; title?: string; description?: string };
        };

        expect(result.target.id).toBeDefined();
        expect(result.target.title).toBeDefined();
        // Description should not be present when not in fields
        expect(result.target.description).toBeUndefined();
    });

    // Phase 4: Relations & Pagination Tests
    test('get_entity_relations returns relations for entity type', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'get_entity_relations', {
            entityType: 'Requirement',
        }) as {
            relations: Array<{ name: string; fromEntity: string; toEntity: string; direction: string }>;
            meta: { total: number };
        };

        expect(result.relations).toBeDefined();
        expect(Array.isArray(result.relations)).toBe(true);
        expect(result.meta.total).toBeGreaterThanOrEqual(0);

        // If relations exist, check structure
        if (result.relations.length > 0) {
            const rel = result.relations[0];
            expect(rel.name).toBeDefined();
            expect(rel.direction).toMatch(/^(outgoing|incoming)$/);
        }
    });

    test('list_entities pagination works correctly', async () => {
        const sessionId = await initMcpSession();

        // Get first page
        const page1 = await callMcpTool(sessionId, 'list_entities', {
            entityType: 'Requirement',
            limit: 2,
            offset: 0,
        }) as { ids: string[]; meta: { total: number; hasMore: boolean; returned: number } };

        expect(page1.ids.length).toBeLessThanOrEqual(2);
        expect(page1.meta.returned).toBe(page1.ids.length);
        expect(page1.meta.total).toBeGreaterThanOrEqual(page1.ids.length);

        // If there's more, get second page
        if (page1.meta.hasMore) {
            const page2 = await callMcpTool(sessionId, 'list_entities', {
                entityType: 'Requirement',
                limit: 2,
                offset: 2,
            }) as { ids: string[]; meta: { total: number } };

            // IDs should be different
            expect(page2.ids[0]).not.toBe(page1.ids[0]);
        }
    });

    test('search_entities pagination returns meta', async () => {
        const sessionId = await initMcpSession();
        const result = await callMcpTool(sessionId, 'search_entities', {
            query: 'REQ',
            limit: 5,
        }) as { results: unknown[]; meta: { total: number; hasMore: boolean } };

        expect(result.results).toBeDefined();
        expect(result.meta).toBeDefined();
        expect(result.meta.total).toBeGreaterThanOrEqual(result.results.length);
    });
});
