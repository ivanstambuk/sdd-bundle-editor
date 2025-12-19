/**
 * Context gathering tools - understanding entity relationships.
 * 
 * Tools:
 * - get_context: Get an entity with related dependencies
 * - get_conformance_context: Get conformance rules and audit templates from a Profile
 */

import { z } from "zod";
import { ToolContext } from "./types.js";
import { registerReadOnlyTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

/**
 * Register context gathering tools.
 */
export function registerContextTools(ctx: ToolContext): void {
    const { server, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: get_context
    registerReadOnlyTool(
        server,
        "get_context",
        "Get an entity with related dependencies. Supports sizing controls to prevent truncation. Use when you need to understand how an entity connects to others.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityType: z.string().describe("Entity type"),
            id: z.string().describe("Entity ID"),
            depth: z.number().max(3).default(1).describe("Depth of traversal (default: 1, max: 3)"),
            maxRelated: z.number().max(100).default(20).describe("Max related entities to return (default: 20, max: 100)"),
            includeRelated: z.enum(["full", "summary", "ids"]).default("full").describe("Detail level for related entities: full (all fields), summary (id, title, state), ids (just IDs)"),
            fields: z.array(z.string()).optional().describe("Specific fields to return for target entity"),
        },
        async ({ bundleId, entityType, id, depth, maxRelated, includeRelated, fields }) => {
            const TOOL_NAME = "get_context";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const bundle = loaded.bundle;
            const targetEntities = bundle.entities.get(entityType);
            const targetEntity = targetEntities?.get(id);

            if (!targetEntity) {
                return toolError(TOOL_NAME, "NOT_FOUND", `Entity not found: ${entityType}/${id}`, { bundleId: loaded.id, entityType, entityId: id });
            }

            // Graph traversal to find related entities
            interface RelatedItem {
                id: string;
                entityType: string;
                relation: string;  // Stable key: "references" or "referencedBy"
                field: string;     // The field name that creates the relationship
                data?: unknown;    // Full data, summary, or omitted based on includeRelated
            }

            const relatedEntities: RelatedItem[] = [];
            const visited = new Set<string>();
            visited.add(`${entityType}:${id}`);
            let totalRelated = 0;
            let truncated = false;

            // Helper to add related entity
            const addRelated = (eType: string, eId: string, relation: string, field: string) => {
                if (totalRelated >= maxRelated) {
                    truncated = true;
                    return;
                }

                const key = `${eType}:${eId}`;
                if (visited.has(key)) return;
                visited.add(key);

                const entity = bundle.entities.get(eType)?.get(eId);
                if (entity) {
                    const item: RelatedItem = {
                        id: eId,
                        entityType: eType,
                        relation,
                        field,
                    };

                    // Add data based on includeRelated setting
                    if (includeRelated === "full") {
                        item.data = entity.data;
                    } else if (includeRelated === "summary") {
                        const data = entity.data as Record<string, unknown>;
                        item.data = {
                            id: data.id,
                            title: data.title,
                            name: data.name,
                            state: data.state,
                        };
                    }
                    // For "ids", we don't add data property

                    relatedEntities.push(item);
                    totalRelated++;
                }
            };

            // Direct outgoing/incoming references using stable relation keys
            for (const edge of bundle.refGraph.edges) {
                if (edge.fromEntityType === entityType && edge.fromId === id) {
                    // Outgoing reference: this entity references the target
                    addRelated(edge.toEntityType, edge.toId, "references", edge.fromField);
                }
                if (edge.toEntityType === entityType && edge.toId === id) {
                    // Incoming reference: target is referenced by this entity
                    addRelated(edge.fromEntityType, edge.fromId, "referencedBy", edge.fromField);
                }
            }

            // Prepare target entity data
            let targetData: unknown = targetEntity.data;
            if (fields && fields.length > 0) {
                const data = targetEntity.data as Record<string, unknown>;
                const filtered: Record<string, unknown> = { id: data.id };
                for (const f of fields) {
                    if (f in data) {
                        filtered[f] = data[f];
                    }
                }
                targetData = filtered;
            }

            return toolSuccess(TOOL_NAME, {
                target: targetData,
                related: relatedEntities,
            }, {
                bundleId: loaded.id,
                meta: {
                    relatedCount: relatedEntities.length,
                    maxRelated,
                    truncated,
                    includeRelated,
                    depth,
                },
                diagnostics: [],
            });
        }
    );

    // Tool: get_conformance_context
    registerReadOnlyTool(
        server,
        "get_conformance_context",
        "Get conformance rules and audit templates from a Profile. Use for compliance checking, understanding what rules apply, or preparing for audits. Without profileId, lists all available profiles. With profileId, returns detailed rules, linked requirements, and audit templates.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            profileId: z.string().optional().describe("Profile ID (optional, lists all profiles if not specified)"),
        },
        async ({ bundleId, profileId }) => {
            const TOOL_NAME = "get_conformance_context";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const bundle = loaded.bundle;
            const profiles = bundle.entities.get("Profile");

            // Case 1: List all profiles if no ID provided
            if (!profileId) {
                if (!profiles || profiles.size === 0) {
                    return toolSuccess(TOOL_NAME, {
                        profiles: [],
                    }, {
                        bundleId: loaded.id,
                        meta: { count: 0 },
                        diagnostics: [],
                    });
                }
                const profileSummaries = Array.from(profiles.values()).map(p => ({
                    id: p.id,
                    title: p.data.title,
                    description: p.data.description
                }));
                return toolSuccess(TOOL_NAME, {
                    profiles: profileSummaries,
                }, {
                    bundleId: loaded.id,
                    meta: { count: profileSummaries.length },
                    diagnostics: [],
                });
            }

            // Case 2: Get specific profile context
            const profile = profiles?.get(profileId);
            if (!profile) {
                return toolError(TOOL_NAME, "NOT_FOUND", `Profile not found: ${profileId}`, { bundleId: loaded.id, profileId });
            }

            const data = profile.data as any;

            // Expand required features
            const requiredFeatures = (data.requiresFeatures || []).map((ref: string) => {
                const feat = bundle.entities.get("Feature")?.get(ref);
                return feat ? feat.data : { id: ref, _error: "Feature not found" };
            });

            // Expand rules with simple requirement text if available
            const expandedRules = (data.conformanceRules || []).map((rule: any) => {
                const expanded = { ...rule };
                if (rule.linkedRequirement) {
                    const req = bundle.entities.get("Requirement")?.get(rule.linkedRequirement);
                    if (req) {
                        expanded.requirementText = (req.data as any).description;
                    }
                }
                return expanded;
            });

            return toolSuccess(TOOL_NAME, {
                profile: {
                    id: profile.id,
                    title: data.title,
                    description: data.description,
                },
                auditTemplate: data.auditTemplate,
                rules: expandedRules,
                requiredFeatures,
                optionalFeatures: data.optionalFeatures,
            }, {
                bundleId: loaded.id,
                meta: { ruleCount: expandedRules.length },
                diagnostics: [],
            });
        }
    );
}
