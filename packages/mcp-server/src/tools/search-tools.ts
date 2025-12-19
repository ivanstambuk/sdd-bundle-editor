/**
 * Search tools - finding entities across bundles.
 * 
 * Tools:
 * - search_entities: Search for entities by keyword with pagination
 */

import { z } from "zod";
import { ToolContext } from "./types.js";
import { LoadedBundle } from "../types.js";
import { registerReadOnlyTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

/**
 * Register search tools.
 */
export function registerSearchTools(ctx: ToolContext): void {
    const { server, bundles, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: search_entities
    registerReadOnlyTool(
        server,
        "search_entities",
        "Search for entities across all bundles by keyword with pagination. Use when user asks about something by name, topic, or keyword rather than exact ID. Searches entity IDs, titles, statements, and descriptions. Returns matching entities with their bundle and type.",
        {
            query: z.string().describe("Search query (searches in entity IDs and titles)"),
            entityType: z.string().optional().describe("Filter by entity type"),
            bundleId: z.string().optional().describe("Filter by bundle ID"),
            limit: z.number().max(100).default(50).describe("Maximum number of results to return (default: 50, max: 100)"),
            offset: z.number().default(0).describe("Starting offset for pagination"),
        },
        async ({ query, entityType, bundleId, limit, offset }) => {
            const TOOL_NAME = "search_entities";

            // Fix: Return NOT_FOUND if bundleId is provided but doesn't exist
            if (bundleId && !bundles.has(bundleId)) {
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId, availableBundles: getBundleIds() });
            }

            const results: Array<{
                bundleId: string;
                entityType: string;
                id: string;
                title?: string;
                match: string;
                matchPriority: number;  // For deterministic sorting
            }> = [];

            const queryLower = query.toLowerCase();
            const bundlesToSearch = bundleId
                ? [bundles.get(bundleId)].filter(Boolean) as LoadedBundle[]
                : Array.from(bundles.values());

            for (const loaded of bundlesToSearch) {
                const typesToSearch = entityType
                    ? [[entityType, loaded.bundle.entities.get(entityType)] as const].filter(([_, v]) => v)
                    : Array.from(loaded.bundle.entities.entries());

                for (const [eType, entities] of typesToSearch) {
                    if (!entities) continue;
                    for (const [eId, entity] of entities) {
                        const data = entity.data as any;
                        const idMatch = eId.toLowerCase().includes(queryLower);
                        const titleMatch = data.title?.toLowerCase().includes(queryLower);
                        const statementMatch = data.statement?.toLowerCase().includes(queryLower);
                        const descMatch = data.description?.toLowerCase().includes(queryLower);

                        if (idMatch || titleMatch || statementMatch || descMatch) {
                            // Assign priority: id match (1) > title (2) > statement (3) > description (4)
                            const matchPriority = idMatch ? 1 : titleMatch ? 2 : statementMatch ? 3 : 4;
                            results.push({
                                bundleId: loaded.id,
                                entityType: eType,
                                id: eId,
                                title: data.title || data.statement,
                                match: idMatch ? "id" : titleMatch ? "title" : statementMatch ? "statement" : "description",
                                matchPriority,
                            });
                        }
                    }
                }
            }

            // Fix: Sort results deterministically before pagination (by match priority, then bundleId, then entityType, then id)
            results.sort((a, b) => {
                if (a.matchPriority !== b.matchPriority) return a.matchPriority - b.matchPriority;
                if (a.bundleId !== b.bundleId) return a.bundleId.localeCompare(b.bundleId);
                if (a.entityType !== b.entityType) return a.entityType.localeCompare(b.entityType);
                return a.id.localeCompare(b.id);
            });

            // Apply pagination
            const total = results.length;
            // Remove internal matchPriority from output
            const paginatedResults = results.slice(offset, offset + limit).map(({ matchPriority, ...rest }) => rest);
            const hasMore = offset + limit < total;

            // Fix: Include bundleId in envelope if filtering by single bundle
            const effectiveBundleId = bundleId || (bundlesToSearch.length === 1 ? bundlesToSearch[0].id : undefined);

            return toolSuccess(TOOL_NAME, {
                query,
                results: paginatedResults,
            }, {
                bundleId: effectiveBundleId,  // Fix: Include bundleId when single-bundle scoped
                meta: {
                    total,
                    limit,
                    offset,
                    returned: paginatedResults.length,
                    hasMore,
                },
                diagnostics: [],
            });
        }
    );
}
