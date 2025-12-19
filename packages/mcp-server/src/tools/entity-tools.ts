/**
 * Entity-level tools - CRUD operations on entities.
 * 
 * Tools:
 * - read_entity: Read complete data for a single entity
 * - read_entities: Bulk read multiple entities
 * - list_entities: List entity IDs with optional pagination
 * - list_entity_summaries: List entities with summary fields
 */

import { z } from "zod";
import { ToolContext } from "./types.js";
import { registerReadOnlyTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

/**
 * Register entity-level tools.
 */
export function registerEntityTools(ctx: ToolContext): void {
    const { server, bundles, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: read_entity
    registerReadOnlyTool(
        server,
        "read_entity",
        "Read the complete data for a specific entity. Use when you need full details about a Requirement, Task, Feature, Component, Profile, Threat, or any other entity type. Returns all fields including title, description, state, priority, and relationships.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
            id: z.string().describe("Entity ID"),
        },
        async ({ bundleId, entityType, id }) => {
            const TOOL_NAME = "read_entity";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const entitiesOfType = loaded.bundle.entities.get(entityType);
            if (!entitiesOfType) {
                return toolError(TOOL_NAME, "NOT_FOUND", `Unknown entity type: ${entityType}`, { bundleId: loaded.id, entityType });
            }

            const entity = entitiesOfType.get(id);
            if (!entity) {
                return toolError(TOOL_NAME, "NOT_FOUND", `Entity not found: ${id}`, { bundleId: loaded.id, entityType, entityId: id });
            }

            // Return entity with entityType for consistency
            return toolSuccess(TOOL_NAME, {
                id: entity.id,
                entityType: entity.entityType,
                ...entity.data,
            }, {
                bundleId: loaded.id,
                diagnostics: [],
            });
        }
    );

    // Tool: read_entities (bulk read)
    registerReadOnlyTool(
        server,
        "read_entities",
        "Read multiple entities in a single call. Use when you need 2-50 entities and already know their IDs. Much more efficient than calling read_entity multiple times.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
            ids: z.array(z.string()).max(50).describe("Entity IDs to fetch (max 50)"),
            fields: z.array(z.string()).optional().describe("Specific fields to return (optional, returns all if not specified)"),
        },
        async ({ bundleId, entityType, ids, fields }) => {
            const TOOL_NAME = "read_entities";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const entitiesOfType = loaded.bundle.entities.get(entityType);
            if (!entitiesOfType) {
                return toolError(TOOL_NAME, "NOT_FOUND", `Unknown entity type: ${entityType}`, { bundleId: loaded.id, entityType });
            }

            const entities: Array<Record<string, unknown>> = [];
            const notFound: string[] = [];

            for (const id of ids) {
                const entity = entitiesOfType.get(id);
                if (entity) {
                    let entityData: Record<string, unknown> = { ...entity.data };

                    // Filter fields if specified
                    if (fields && fields.length > 0) {
                        const filtered: Record<string, unknown> = { id: entity.id };
                        for (const field of fields) {
                            if (field in entityData) {
                                filtered[field] = entityData[field];
                            }
                        }
                        entityData = filtered;
                    }

                    entities.push(entityData);
                } else {
                    notFound.push(id);
                }
            }

            return toolSuccess(TOOL_NAME, {
                entityType,
                entities,
            }, {
                bundleId: loaded.id,
                meta: {
                    requested: ids.length,
                    found: entities.length,
                    notFound,
                },
                diagnostics: [],
            });
        }
    );

    // Tool: list_entities
    registerReadOnlyTool(
        server,
        "list_entities",
        "List all entity IDs in a bundle with optional pagination. Use to discover available entity IDs, see what entity types exist, or get an overview of bundle contents. Without entityType filter, shows all available types. With filter, shows all IDs of that type.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode, or 'all' to list from all bundles)"),
            entityType: z.string().optional().describe("Filter by entity type"),
            limit: z.number().max(500).default(100).describe("Maximum number of IDs to return (default: 100, max: 500)"),
            offset: z.number().default(0).describe("Starting offset for pagination"),
        },
        async ({ bundleId, entityType, limit, offset }) => {
            const TOOL_NAME = "list_entities";

            // Special case: list from all bundles
            if (bundleId === "all" || (!bundleId && !isSingleBundleMode())) {
                const bundleData: Record<string, any> = {};
                for (const [bId, loaded] of bundles) {
                    if (entityType) {
                        const entities = loaded.bundle.entities.get(entityType);
                        if (entities) {
                            bundleData[bId] = Array.from(entities.keys()).sort(); // Stable ordering
                        }
                    } else {
                        bundleData[bId] = {
                            entityTypes: Array.from(loaded.bundle.entities.keys()).sort(), // Stable ordering
                        };
                    }
                }
                return toolSuccess(TOOL_NAME, bundleData, {
                    meta: { bundleCount: bundles.size },
                    diagnostics: [],
                });
            }

            const loaded = getBundle(bundleId);
            if (!loaded) {
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            if (entityType) {
                const entitiesOfType = loaded.bundle.entities.get(entityType);
                const allIds = entitiesOfType ? Array.from(entitiesOfType.keys()).sort() : []; // Stable ordering
                const total = allIds.length;
                const paginatedIds = allIds.slice(offset, offset + limit);
                const hasMore = offset + limit < total;

                return toolSuccess(TOOL_NAME, {
                    entityType,
                    ids: paginatedIds,
                }, {
                    bundleId: loaded.id,
                    meta: { total, limit, offset, returned: paginatedIds.length, hasMore },
                    diagnostics: [],
                });
            }

            const allTypes = Array.from(loaded.bundle.entities.keys()).sort(); // Stable ordering
            return toolSuccess(TOOL_NAME, {
                entityTypes: allTypes,
            }, {
                bundleId: loaded.id,
                meta: { typeCount: allTypes.length },
                diagnostics: [],
            });
        }
    );

    // Tool: list_entity_summaries
    registerReadOnlyTool(
        server,
        "list_entity_summaries",
        "List entities with summary fields (id, title, state, tags). Better than list_entities when you need to select relevant items without loading full entity data. Supports pagination.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityType: z.string().optional().describe("Filter by entity type"),
            include: z.array(z.string()).default(["id", "title"]).describe("Fields to include in summaries"),
            limit: z.number().default(50).describe("Max results (default 50, max 200)"),
            offset: z.number().default(0).describe("Pagination offset"),
        },
        async ({ bundleId, entityType, include, limit, offset }) => {
            const TOOL_NAME = "list_entity_summaries";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            // Clamp limit to max 200
            const effectiveLimit = Math.min(limit, 200);

            // Collect entities from all types or just the specified type (with stable ordering)
            const allItems: Array<{ entityType: string;[key: string]: unknown }> = [];
            const typesToScan = entityType
                ? [[entityType, loaded.bundle.entities.get(entityType)] as const].filter(([_, v]) => v)
                : Array.from(loaded.bundle.entities.entries()).sort((a, b) => a[0].localeCompare(b[0]));

            for (const [eType, entities] of typesToScan) {
                if (!entities) continue;
                const sortedKeys = Array.from(entities.keys()).sort(); // Stable ordering
                for (const eId of sortedKeys) {
                    const entity = entities.get(eId)!;
                    const summary: Record<string, unknown> = { entityType: eType };
                    const data = entity.data as Record<string, unknown>;

                    // Always include id
                    summary.id = eId;

                    // Include requested fields
                    for (const field of include) {
                        if (field in data) {
                            summary[field] = data[field];
                        }
                    }

                    allItems.push(summary as { entityType: string;[key: string]: unknown });
                }
            }

            // Apply pagination
            const total = allItems.length;
            const paginatedItems = allItems.slice(offset, offset + effectiveLimit);
            const hasMore = offset + effectiveLimit < total;

            return toolSuccess(TOOL_NAME, {
                items: paginatedItems,
            }, {
                bundleId: loaded.id,
                meta: {
                    total,
                    limit: effectiveLimit,
                    offset,
                    returned: paginatedItems.length,
                    hasMore,
                },
                diagnostics: [],
            });
        }
    );
}
