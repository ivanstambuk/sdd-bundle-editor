/**
 * MCP-based Bundle API
 * 
 * Replaces the legacy HTTP-based bundle API with MCP tool calls.
 * This communicates directly with the MCP server via HTTP transport.
 */

import type { UiBundleSnapshot, UiDiagnostic, UiEntity, UiRefEdge } from '../types';
import {
    McpClient,
    createMcpClient,
    unwrapMcpEnvelope,
    type McpBundle,
    type McpEnvelope,
    type McpValidationResult
} from './mcpClient';

export interface BundleResponse {
    bundle: UiBundleSnapshot;
    diagnostics: UiDiagnostic[];
}

export interface ValidateResponse {
    diagnostics: UiDiagnostic[];
}

/**
 * MCP-based Bundle API client.
 * Uses MCP tools instead of legacy HTTP bundle endpoints.
 */
export class McpBundleApi {
    private client: McpClient;
    private bundleId: string | null = null;

    constructor(mcpServerUrl?: string) {
        this.client = createMcpClient(mcpServerUrl);
    }

    /**
     * Load a bundle using MCP tools.
     * Uses get_bundle_snapshot for efficient single-call loading.
     */
    async load(bundleDir: string): Promise<BundleResponse> {
        // Step 1: List bundles to find the one matching our bundleDir
        // MCP response structure: { ok: boolean, tool: string, data: { bundles: [...] } }
        const bundlesResult = await this.client.callTool<{
            ok: boolean;
            tool: string;
            data: { bundles: McpBundle[] };
        }>('list_bundles', {});

        const bundlesData = bundlesResult.data?.data?.bundles;
        if (bundlesResult.isError || !bundlesData || bundlesData.length === 0) {
            throw new Error('No bundles loaded in MCP server');
        }

        const bundlesList = bundlesData;

        // Find bundle by path (bundleDir) or use first/only bundle
        let targetBundle = bundlesList.find(b => b.path === bundleDir);
        if (!targetBundle) {
            // In single-bundle mode, just use the first bundle
            targetBundle = bundlesList[0];
        }

        this.bundleId = targetBundle.id;

        // Step 2: Get complete bundle snapshot in a single call
        // MCP response structure: { ok: boolean, tool: string, data: { bundleId, entities, ... } }
        type SnapshotData = {
            bundleId: string;
            manifest: unknown;
            bundleTypeDefinition: unknown;
            entities: Record<string, Array<Record<string, unknown>>>;
            schemas: Record<string, unknown>;
            refGraph: { edges: Array<{ fromEntityType: string; fromId: string; fromField: string; toEntityType: string; toId: string }> };
            diagnostics: Array<{ severity: 'error' | 'warning'; message: string; entityType?: string; entityId?: string; code?: string }>;
        };

        const snapshotResult = await this.client.callTool<{
            ok: boolean;
            tool: string;
            data: SnapshotData;
        }>('get_bundle_snapshot', {
            bundleId: this.bundleId,
            includeSchemas: true,
            includeRefGraph: true,
            includeDiagnostics: true,
        });

        if (snapshotResult.isError || !snapshotResult.data?.data) {
            throw new Error('Failed to load bundle snapshot from MCP server');
        }

        const snapshot = snapshotResult.data.data;

        // Transform entities to UiEntity format
        const entities: Record<string, UiEntity[]> = {};
        for (const [entityType, entityList] of Object.entries(snapshot.entities)) {
            entities[entityType] = entityList.map(data => ({
                id: String(data.id),
                entityType,
                filePath: '', // MCP doesn't expose file paths
                data,
            }));
        }

        // Transform refGraph edges
        const edges: UiRefEdge[] = snapshot.refGraph?.edges || [];

        // Transform diagnostics
        const diagnostics: UiDiagnostic[] = (snapshot.diagnostics || []).map(d => ({
            severity: d.severity,
            message: d.message,
            entityType: d.entityType,
            entityId: d.entityId,
            code: d.code,
        }));

        // Build the bundle snapshot
        const bundle: UiBundleSnapshot = {
            manifest: {
                metadata: {
                    name: targetBundle.name,
                    bundleType: targetBundle.bundleType,
                    description: targetBundle.description,
                },
            },
            bundleTypeDefinition: snapshot.bundleTypeDefinition as UiBundleSnapshot['bundleTypeDefinition'],
            entities,
            refGraph: { edges },
            schemas: snapshot.schemas,
        };

        return { bundle, diagnostics };
    }

    /**
     * Load bundle with cache-busting (force refresh).
     * In MCP mode, we reset the session to force a fresh load.
     */
    async loadFresh(bundleDir: string): Promise<BundleResponse> {
        // Reset session to ensure fresh data
        this.client.resetSession();
        return this.load(bundleDir);
    }

    /**
     * Validate the bundle and return diagnostics.
     */
    async validate(bundleDir: string): Promise<ValidateResponse> {
        const result = await this.client.callTool<McpValidationResult>('validate_bundle', {
            bundleId: this.bundleId,
        });

        if (result.isError) {
            throw new Error('Validation failed');
        }

        const diagnostics: UiDiagnostic[] = [];
        if (result.data?.diagnostics) {
            for (const d of result.data.diagnostics) {
                diagnostics.push({
                    severity: d.severity,
                    message: d.message,
                    entityType: d.entityType,
                    entityId: d.entityId,
                    code: d.code,
                });
            }
        }

        return { diagnostics };
    }

    /**
     * Check if MCP server is available
     */
    async checkHealth(): Promise<boolean> {
        try {
            const health = await this.client.checkHealth();
            return health.status === 'healthy';
        } catch {
            return false;
        }
    }

    /**
     * Close the MCP session
     */
    async close(): Promise<void> {
        await this.client.close();
    }
}

/**
 * Singleton MCP bundle API instance
 */
let mcpBundleApiInstance: McpBundleApi | null = null;

/**
 * Get or create the MCP bundle API instance
 */
export function getMcpBundleApi(serverUrl?: string): McpBundleApi {
    if (!mcpBundleApiInstance) {
        mcpBundleApiInstance = new McpBundleApi(serverUrl);
    }
    return mcpBundleApiInstance;
}

/**
 * MCP-based bundle API with the same interface as legacy bundleApi.
 * This is a drop-in replacement that uses MCP tools.
 */
export const mcpBundleApi = {
    /**
     * Load a bundle from the MCP server.
     */
    async load(bundleDir: string): Promise<BundleResponse> {
        const api = getMcpBundleApi();
        return api.load(bundleDir);
    },

    /**
     * Load a bundle with cache-busting.
     */
    async loadFresh(bundleDir: string): Promise<BundleResponse> {
        const api = getMcpBundleApi();
        return api.loadFresh(bundleDir);
    },

    /**
     * Validate a bundle and return diagnostics.
     */
    async validate(bundleDir: string): Promise<ValidateResponse> {
        const api = getMcpBundleApi();
        return api.validate(bundleDir);
    },
};
