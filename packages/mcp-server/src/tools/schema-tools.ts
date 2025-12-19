/**
 * Schema introspection tools - understanding entity structure.
 * 
 * Tools:
 * - get_entity_schema: Get JSON schema for a specific entity type
 * - get_entity_relations: Get relationships defined for an entity type
 */

import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import { ToolContext } from "./types.js";
import { registerReadOnlyTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

/**
 * Register schema introspection tools.
 */
export function registerSchemaTools(ctx: ToolContext): void {
    const { server, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: get_entity_schema
    registerReadOnlyTool(
        server,
        "get_entity_schema",
        "Get the JSON schema for a specific entity type. Use for form rendering or understanding entity structure. Returns the complete JSON schema including properties, required fields, and custom extensions like x-sdd-ui.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
        },
        async ({ bundleId, entityType }) => {
            const TOOL_NAME = "get_entity_schema";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            // Get schema path from manifest
            const schemaRelPath = loaded.bundle.manifest.spec?.schemas?.documents?.[entityType];
            if (!schemaRelPath) {
                return toolError(TOOL_NAME, "NOT_FOUND", `No schema defined for entity type: ${entityType}`, { bundleId: loaded.id, entityType });
            }

            // Load schema from disk
            try {
                const schemaPath = path.join(loaded.path, schemaRelPath);
                const schemaContent = await fs.readFile(schemaPath, 'utf8');
                const schema = JSON.parse(schemaContent);

                return toolSuccess(TOOL_NAME, {
                    entityType,
                    schema,
                }, {
                    bundleId: loaded.id,
                    diagnostics: [],
                });
            } catch (err) {
                return toolError(TOOL_NAME, "INTERNAL", `Failed to load schema for ${entityType}: ${String(err)}`, { entityType });
            }
        }
    );

    // Tool: get_entity_relations
    registerReadOnlyTool(
        server,
        "get_entity_relations",
        "Get the relationships defined for an entity type. Use to understand how entities connect to each other. Returns relation definitions from the bundle-type specification.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityType: z.string().optional().describe("Filter by entity type (optional, shows all relations if not specified)"),
            direction: z.enum(["outgoing", "incoming", "both"]).default("both").describe("Filter by direction: outgoing (this type references other), incoming (other types reference this), both (all)"),
        },
        async ({ bundleId, entityType, direction }) => {
            const TOOL_NAME = "get_entity_relations";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const bundleDef = loaded.bundle.bundleTypeDefinition;
            if (!bundleDef || !bundleDef.relations) {
                return toolSuccess(TOOL_NAME, {
                    entityType: entityType || "all",
                    direction,
                    relations: [],
                }, {
                    bundleId: loaded.id,
                    meta: { total: 0 },
                    diagnostics: [],
                });
            }

            // Filter relations based on entityType and direction
            const relations = bundleDef.relations.filter(rel => {
                if (!entityType) return true;

                const isOutgoing = rel.fromEntity === entityType;
                const isIncoming = rel.toEntity === entityType;

                if (direction === "outgoing") return isOutgoing;
                if (direction === "incoming") return isIncoming;
                return isOutgoing || isIncoming;
            });

            // Transform to a more useful format
            const formatted = relations.map(rel => ({
                name: rel.name,
                fromEntity: rel.fromEntity,
                fromField: rel.fromField,
                toEntity: rel.toEntity,
                multiplicity: rel.multiplicity,
                // Add computed direction relative to the queried entityType
                ...(entityType && {
                    direction: rel.fromEntity === entityType ? "outgoing" : "incoming",
                }),
            }));

            return toolSuccess(TOOL_NAME, {
                entityType: entityType || "all",
                direction,
                relations: formatted,
            }, {
                bundleId: loaded.id,
                meta: { total: formatted.length },
                diagnostics: [],
            });
        }
    );
}
