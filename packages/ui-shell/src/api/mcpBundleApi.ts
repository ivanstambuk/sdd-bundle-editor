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
    type McpBundle,
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
     * This calls list_bundles, list_entities, and read_entity to construct the full bundle.
     */
    async load(bundleDir: string): Promise<BundleResponse> {
        // Step 1: List bundles to find the one matching our bundleDir
        const bundles = await this.client.callTool<McpBundle[]>('list_bundles', {});

        if (bundles.isError || !bundles.data || bundles.data.length === 0) {
            throw new Error('No bundles loaded in MCP server');
        }

        // Find bundle by path (bundleDir) or use first/only bundle
        let targetBundle = bundles.data.find(b => b.path === bundleDir);
        if (!targetBundle) {
            // In single-bundle mode, just use the first bundle
            targetBundle = bundles.data[0];
        }

        this.bundleId = targetBundle.id;

        // Step 2: Get entity types and load all entities
        const entityTypes = targetBundle.entityTypes;
        const entities: Record<string, UiEntity[]> = {};
        const edges: UiRefEdge[] = [];

        for (const entityType of entityTypes) {
            // Get all entity IDs for this type
            const idsResult = await this.client.callTool<string[]>('list_entities', {
                bundleId: this.bundleId,
                entityType,
            });

            if (idsResult.isError || !idsResult.data) {
                entities[entityType] = [];
                continue;
            }

            const entityIds = idsResult.data;
            const typeEntities: UiEntity[] = [];

            // Load each entity
            for (const id of entityIds) {
                const entityResult = await this.client.callTool<Record<string, unknown>>('read_entity', {
                    bundleId: this.bundleId,
                    entityType,
                    id,
                });

                if (!entityResult.isError && entityResult.data) {
                    const data = entityResult.data;
                    typeEntities.push({
                        id: id,
                        entityType,
                        filePath: '', // MCP doesn't expose file paths directly
                        data,
                    });

                    // Extract references for the ref graph
                    this.extractReferences(entityType, id, data, edges);
                }
            }

            entities[entityType] = typeEntities;
        }

        // Step 3: Get diagnostics via validate_bundle
        const validateResult = await this.client.callTool<McpValidationResult>('validate_bundle', {
            bundleId: this.bundleId,
        });

        const diagnostics: UiDiagnostic[] = [];
        if (!validateResult.isError && validateResult.data?.diagnostics) {
            for (const d of validateResult.data.diagnostics) {
                diagnostics.push({
                    severity: d.severity,
                    message: d.message,
                    entityType: d.entityType,
                    entityId: d.entityId,
                    code: d.code,
                });
            }
        }

        // Build the bundle snapshot
        const bundle: UiBundleSnapshot = {
            manifest: {
                metadata: {
                    name: targetBundle.name,
                    bundleType: targetBundle.bundleType,
                    description: targetBundle.description,
                },
            },
            entities,
            refGraph: { edges },
            // Note: schemas and domainMarkdown would need additional MCP resource calls
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
     * Extract reference edges from entity data.
     * Looks for common reference patterns like featureIds, requirementIds, etc.
     */
    private extractReferences(
        fromType: string,
        fromId: string,
        data: Record<string, unknown>,
        edges: UiRefEdge[]
    ): void {
        // Common reference field patterns - standardized relationship field names
        const refPatterns: Record<string, string> = {
            // Standardized Feature references
            realizesFeatureIds: 'Feature',
            belongsToFeatureIds: 'Feature',
            implementsFeatureIds: 'Feature',
            supportsFeatureIds: 'Feature',
            affectsFeatureIds: 'Feature',
            requiresFeatures: 'Feature',
            optionalFeatures: 'Feature',
            featureIds: 'Feature', // backward compatibility
            featureId: 'Feature',

            // Standardized Requirement references
            fulfillsRequirementIds: 'Requirement',
            validatesRequirementIds: 'Requirement',
            implementsRequirements: 'Requirement',
            coversRequirements: 'Requirement',
            constrainsRequirements: 'Requirement',
            guidesRequirements: 'Requirement',
            appliesToRequirements: 'Requirement',
            mitigatedByRequirements: 'Requirement',
            relatedRequirements: 'Requirement',
            touchesRequirements: 'Requirement',
            ownsRequirements: 'Requirement',
            realizedByComponents: 'Component',
            refinesRequirements: 'Requirement',
            requirementIds: 'Requirement', // backward compatibility
            requirementId: 'Requirement',

            // Standardized ADR references
            governedByAdrIds: 'ADR',
            guidesAdrs: 'ADR',
            relatedAdrs: 'ADR',
            touchesAdrs: 'ADR',
            documentedInAdrs: 'ADR',
            supersedes: 'ADR',
            adrIds: 'ADR', // backward compatibility
            adrId: 'ADR',

            // Component references
            dependsOn: 'Component',
            usesComponents: 'Component',
            relatedComponents: 'Component',
            affectsComponents: 'Component',
            constrainsComponents: 'Component',
            appliesToComponents: 'Component',
            componentIds: 'Component',
            componentId: 'Component',

            // Protocol references
            providesProtocols: 'Protocol',
            consumesProtocols: 'Protocol',
            usesProtocols: 'Protocol',
            providedByComponents: 'Component',
            consumedByComponents: 'Component',
            appliesToProtocols: 'Protocol',
            affectsProtocols: 'Protocol',
            documentedInProtocols: 'Protocol',
            usedInProtocols: 'Protocol',
            protocolIds: 'Protocol',
            protocolId: 'Protocol',

            // Task references
            taskIds: 'Task',
            taskId: 'Task',

            // Profile references
            profileIds: 'Profile',
            profileId: 'Profile',

            // Actor references
            ownerId: 'Actor',
            actorId: 'Actor',
            actorIds: 'Actor',

            // Threat references
            relatedThreats: 'Threat',
            relatedToRisks: 'Risk',
            threatIds: 'Threat',
            threatId: 'Threat',

            // Risk references
            riskIds: 'Risk',
            riskId: 'Risk',

            // Policy references
            derivedFromPolicy: 'Policy',
            policyIds: 'Policy',
            policyId: 'Policy',

            // Principle references
            principleIds: 'Principle',
            principleId: 'Principle',

            // Constraint references
            enforcedByConstraints: 'Constraint',
            boundByConstraints: 'Constraint',
            constraintIds: 'Constraint',
            constraintId: 'Constraint',

            // Hierarchy references
            parentId: 'Requirement',

            // DataSchema references
            dataSchemaId: 'DataSchema',
            dataSchemaIds: 'DataSchema',
            inputSchemaId: 'DataSchema',
            outputSchemaId: 'DataSchema',
            problemDetailsSchemaId: 'DataSchema',

            // TelemetrySchema references
            telemetrySchemaId: 'TelemetrySchema',
            telemetrySchemaIds: 'TelemetrySchema',
            referencedInTelemetrySchemas: 'TelemetrySchema',

            // Scenario references
            usesFixtures: 'Fixture',
            constrainsScenarios: 'Scenario',
            relatedScenarios: 'Scenario',
            touchesScenarios: 'Scenario',
            appliesToScenarios: 'Scenario',
            raisedInScenarios: 'Scenario',
            coveredByScenarios: 'Scenario',
            scenarioId: 'Scenario',

            // Viewpoint and View references
            viewpointId: 'Viewpoint',

            // ErrorCode references
            linkedErrorCodes: 'ErrorCode',

            // OpenQuestion references
            openQuestionIds: 'OpenQuestion',
            openQuestionId: 'OpenQuestion',
        };

        for (const [field, targetType] of Object.entries(refPatterns)) {
            const value = data[field];
            if (value) {
                const ids = Array.isArray(value) ? value : [value];
                for (const toId of ids) {
                    if (typeof toId === 'string') {
                        edges.push({
                            fromEntityType: fromType,
                            fromId,
                            fromField: field,
                            toEntityType: targetType,
                            toId,
                        });
                    }
                }
            }
        }
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
