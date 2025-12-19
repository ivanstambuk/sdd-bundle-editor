/**
 * Bundle-level tools - operations on the bundle itself.
 * 
 * Tools:
 * - list_bundles: List all loaded specification bundles
 * - get_bundle_schema: Get the bundle type definition (metaschema)
 * - get_bundle_snapshot: Get complete bundle snapshot with all entities
 */

import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import { ToolContext } from "./types.js";
import { registerReadOnlyTool, registerReadOnlyToolNoArgs } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

/**
 * Register bundle-level tools.
 */
export function registerBundleTools(ctx: ToolContext): void {
    const { server, bundles, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: list_bundles (no arguments, uses strict schema to reject unknown args)
    registerReadOnlyToolNoArgs(
        server,
        "list_bundles",
        "List all loaded specification bundles. Use this first to discover what bundles are available, their IDs, entity types, and metadata. Returns bundle IDs needed for other tool calls in multi-bundle mode.",
        async () => {
            const TOOL_NAME = "list_bundles";
            const bundleList = Array.from(bundles.values()).map(b => ({
                id: b.id,
                name: b.bundle.manifest.metadata.name,
                bundleType: b.bundle.manifest.metadata.bundleType,
                tags: b.tags || [],
                description: b.description,
                path: b.path,
                entityTypes: Array.from(b.bundle.entities.keys()),
                entityCount: Array.from(b.bundle.entities.values()).reduce((sum, m) => sum + m.size, 0),
            }));
            return toolSuccess(TOOL_NAME, {
                bundles: bundleList,
            }, {
                meta: { count: bundleList.length },
                diagnostics: [],
            });
        }
    );

    // Tool: get_bundle_schema
    registerReadOnlyTool(
        server,
        "get_bundle_schema",
        "Get the bundle type definition (metaschema) for a bundle. Returns entity type configurations, relationships between entities, and bundle metadata. Use to understand how entities relate to each other.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
        },
        async ({ bundleId }) => {
            const TOOL_NAME = "get_bundle_schema";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const bundleDef = loaded.bundle.bundleTypeDefinition;
            const manifest = loaded.bundle.manifest;

            return toolSuccess(TOOL_NAME, {
                manifest: {
                    name: manifest.metadata?.name,
                    bundleType: manifest.metadata?.bundleType,
                    version: manifest.metadata?.version,
                    description: manifest.metadata?.description,
                },
                bundleTypeDefinition: bundleDef,
            }, {
                bundleId: loaded.id,
                diagnostics: [],
            });
        }
    );

    // Tool: get_bundle_snapshot
    registerReadOnlyTool(
        server,
        "get_bundle_snapshot",
        "Get a complete bundle snapshot with all entities, schemas, refGraph, and diagnostics in a single call. Optimized for UI initial load - much more efficient than multiple calls. Use entityTypes to filter, includeEntityData to control payload size, and maxEntities to prevent truncation.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityTypes: z.array(z.string()).optional().describe("Filter to specific entity types (e.g., ['Requirement', 'Task']). Returns all types if not specified."),
            includeEntityData: z.enum(["full", "summary", "ids"]).default("full").describe("Entity data detail: full (all fields), summary (id, title, state), ids (just IDs)"),
            includeSchemas: z.boolean().default(true).describe("Include JSON schemas for each entity type"),
            includeRefGraph: z.boolean().default(true).describe("Include reference graph edges"),
            includeDiagnostics: z.boolean().default(true).describe("Include validation diagnostics"),
            maxEntities: z.number().max(10000).default(5000).describe("Maximum entities to return before truncation (default: 5000, max: 10000)"),
        },
        async ({ bundleId, entityTypes, includeEntityData, includeSchemas, includeRefGraph, includeDiagnostics, maxEntities }) => {
            const TOOL_NAME = "get_bundle_snapshot";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const bundle = loaded.bundle;

            // Determine which types to include
            const typesToInclude = entityTypes
                ? entityTypes.filter(t => bundle.entities.has(t))
                : Array.from(bundle.entities.keys());

            // Build entities map with size controls
            const entities: Record<string, Array<Record<string, unknown>>> = {};
            let entityCount = 0;
            let totalEntities = 0;
            let truncated = false;

            for (const entityType of typesToInclude.sort()) { // Stable ordering
                const entityMap = bundle.entities.get(entityType);
                if (!entityMap) continue;

                entities[entityType] = [];
                const sortedIds = Array.from(entityMap.keys()).sort(); // Stable ordering

                for (const id of sortedIds) {
                    totalEntities++;
                    if (entityCount >= maxEntities) {
                        truncated = true;
                        continue; // Still count total but don't add
                    }

                    const entity = entityMap.get(id)!;
                    let entityData: Record<string, unknown>;

                    if (includeEntityData === "full") {
                        entityData = {
                            id: entity.id,
                            entityType: entity.entityType,
                            ...entity.data,
                        };
                    } else if (includeEntityData === "summary") {
                        const data = entity.data as Record<string, unknown>;
                        entityData = {
                            id: entity.id,
                            entityType: entity.entityType,
                            title: data.title,
                            name: data.name,
                            state: data.state,
                        };
                    } else {
                        // ids only
                        entityData = { id: entity.id, entityType: entity.entityType };
                    }

                    entities[entityType].push(entityData);
                    entityCount++;
                }
            }

            // Build schemas map if requested (only for included types)
            let schemas: Record<string, unknown> | undefined;
            if (includeSchemas) {
                schemas = {};
                const schemaDocs = bundle.manifest.spec?.schemas?.documents ?? {};
                for (const entityType of typesToInclude.sort()) {
                    const schemaRelPath = schemaDocs[entityType];
                    if (!schemaRelPath) continue;
                    try {
                        const schemaPath = path.join(loaded.path, schemaRelPath);
                        const schemaContent = await fs.readFile(schemaPath, 'utf8');
                        schemas[entityType] = JSON.parse(schemaContent);
                    } catch {
                        // Schema loading failed - skip silently
                    }
                }
            }

            // Build response data
            const snapshotData: Record<string, unknown> = {
                manifest: bundle.manifest,
                bundleTypeDefinition: bundle.bundleTypeDefinition,
                entities,
            };

            if (includeSchemas && schemas) {
                snapshotData.schemas = schemas;
            }

            if (includeRefGraph) {
                snapshotData.refGraph = bundle.refGraph;
            }

            return toolSuccess(TOOL_NAME, snapshotData, {
                bundleId: loaded.id,
                meta: {
                    entityCount,
                    totalEntities,
                    entityTypes: typesToInclude.sort(),
                    allEntityTypes: Array.from(bundle.entities.keys()).sort(),
                    schemaCount: schemas ? Object.keys(schemas).length : 0,
                    diagnosticCount: loaded.diagnostics.length,
                    includeEntityData,
                    maxEntities,
                    truncated,
                },
                // Only include diagnostics if requested - undefined will be omitted from response
                diagnostics: includeDiagnostics ? loaded.diagnostics : undefined,
            });
        }
    );
}
