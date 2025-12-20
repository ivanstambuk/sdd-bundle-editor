/**
 * Export tools - generating readable documents from entities.
 * 
 * Tools:
 * - export_entity_markdown: Export an entity as markdown with optional dependencies
 */

import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import { ToolContext } from "./types.js";
import { registerReadOnlyTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";
import type { Bundle, Entity } from "@sdd-bundle-editor/core-model";
import type { LoadedBundle } from "../types.js";

/**
 * Load a schema from disk for an entity type.
 */
async function loadSchema(loaded: LoadedBundle, entityType: string): Promise<Record<string, unknown> | undefined> {
    const schemaRelPath = loaded.bundle.manifest.spec?.schemas?.documents?.[entityType];
    if (!schemaRelPath) return undefined;

    try {
        const schemaPath = path.join(loaded.path, schemaRelPath);
        const schemaContent = await fs.readFile(schemaPath, 'utf8');
        return JSON.parse(schemaContent) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

/**
 * Generate markdown content for a single entity.
 */
function entityToMarkdown(
    entity: Entity,
    schema: Record<string, unknown> | undefined,
    options: { includeHeader?: boolean; headingLevel?: number } = {}
): string {
    const { includeHeader = true, headingLevel = 1 } = options;
    const data = entity.data as Record<string, unknown>;
    const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;

    const heading = "#".repeat(headingLevel);
    const lines: string[] = [];

    // Header with entity ID and type
    if (includeHeader) {
        const title = (data.title || data.name || data.id) as string;
        lines.push(`${heading} ${title}`);

        // Entity type as blockquote
        const schemaTitle = schema?.title as string | undefined;
        lines.push(`> ${schemaTitle || entity.entityType}`);
        lines.push("");
    }

    // Group fields by layout groups if available
    const layoutGroups = schema?.["x-sdd-layoutGroups"] as Array<{
        name: string;
        title?: string;
        fields: string[]
    }> | undefined;

    // Collect header fields to skip (they're shown in the header)
    const headerFields = new Set<string>();
    for (const [fieldName, fieldSchema] of Object.entries(props)) {
        if (fieldSchema["x-sdd-displayLocation"] === "header") {
            headerFields.add(fieldName);
        }
    }

    // Skip these meta fields - they're either in header or not interesting for docs
    const skipFields = new Set([
        "id",
        ...headerFields
    ]);

    // Render header metadata (status, dates)
    const headerMetadata: string[] = [];
    for (const fieldName of headerFields) {
        const value = data[fieldName];
        if (value) {
            const fieldSchema = props[fieldName];
            const label = (fieldSchema?.title || formatFieldName(fieldName)) as string;

            // Format dates nicely
            if (fieldSchema?.format === "date" || fieldSchema?.format === "date-time") {
                try {
                    const date = new Date(value as string);
                    headerMetadata.push(`**${label}:** ${date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })}`);
                } catch {
                    headerMetadata.push(`**${label}:** ${value}`);
                }
            } else {
                headerMetadata.push(`**${label}:** ${value}`);
            }
        }
    }

    if (headerMetadata.length > 0) {
        lines.push(headerMetadata.join(" | "));
        lines.push("");
    }

    // Function to render a field
    const renderField = (fieldName: string): string[] => {
        if (skipFields.has(fieldName)) return [];

        const value = data[fieldName];
        if (value === undefined || value === null || value === "") return [];

        const fieldSchema = props[fieldName] || {};
        const fieldLines: string[] = [];

        const label = (fieldSchema.title || formatFieldName(fieldName)) as string;
        const format = fieldSchema.format as string | undefined;
        const isMarkdown = format === "markdown" || fieldSchema["x-sdd-widget"] === "markdown";

        // Handle arrays
        if (Array.isArray(value)) {
            if (value.length === 0) return [];

            const subHeading = "#".repeat(headingLevel + 1);
            fieldLines.push(`${subHeading} ${label}`);
            fieldLines.push("");

            // Check if it's an array of objects (like alternatives)
            if (typeof value[0] === "object" && value[0] !== null) {
                for (let i = 0; i < value.length; i++) {
                    const item = value[i] as Record<string, unknown>;
                    const itemTitle = (item.title || item.name || item.id || `Item ${i + 1}`) as string;
                    fieldLines.push(`**${i + 1}. ${itemTitle}**`);

                    // Render each property of the object
                    for (const [key, val] of Object.entries(item)) {
                        if (key === "title" || key === "name" || !val) continue;

                        if (Array.isArray(val)) {
                            fieldLines.push(`- *${formatFieldName(key)}:*`);
                            for (const v of val) {
                                fieldLines.push(`  - ${v}`);
                            }
                        } else {
                            fieldLines.push(`- *${formatFieldName(key)}:* ${val}`);
                        }
                    }
                    fieldLines.push("");
                }
            } else {
                // Simple array of primitives
                for (const item of value) {
                    fieldLines.push(`- ${item}`);
                }
                fieldLines.push("");
            }
        }
        // Handle markdown content specially
        else if (isMarkdown && typeof value === "string") {
            const subHeading = "#".repeat(headingLevel + 1);
            fieldLines.push(`${subHeading} ${label}`);
            fieldLines.push("");
            fieldLines.push(value);
            fieldLines.push("");
        }
        // Handle objects
        else if (typeof value === "object") {
            const subHeading = "#".repeat(headingLevel + 1);
            fieldLines.push(`${subHeading} ${label}`);
            fieldLines.push("");
            fieldLines.push("```json");
            fieldLines.push(JSON.stringify(value, null, 2));
            fieldLines.push("```");
            fieldLines.push("");
        }
        // Simple values
        else {
            // For short values, inline; for long values, use section
            const strValue = String(value);
            if (strValue.length < 100 && !strValue.includes("\n")) {
                fieldLines.push(`**${label}:** ${strValue}`);
                fieldLines.push("");
            } else {
                const subHeading = "#".repeat(headingLevel + 1);
                fieldLines.push(`${subHeading} ${label}`);
                fieldLines.push("");
                fieldLines.push(strValue);
                fieldLines.push("");
            }
        }

        return fieldLines;
    };

    // Render fields by layout groups if available
    if (layoutGroups && layoutGroups.length > 0) {
        const renderedFields = new Set<string>();

        for (const group of layoutGroups) {
            const groupContent: string[] = [];

            for (const fieldName of group.fields) {
                renderedFields.add(fieldName);
                groupContent.push(...renderField(fieldName));
            }

            if (groupContent.length > 0) {
                // Add group title if present
                if (group.title) {
                    const groupHeading = "#".repeat(headingLevel + 1);
                    lines.push(`${groupHeading} ${group.title}`);
                    lines.push("");
                }
                lines.push(...groupContent);
            }
        }

        // Render any remaining fields not in groups
        for (const fieldName of Object.keys(data)) {
            if (!renderedFields.has(fieldName)) {
                lines.push(...renderField(fieldName));
            }
        }
    } else {
        // No layout groups - render all fields
        for (const fieldName of Object.keys(data)) {
            lines.push(...renderField(fieldName));
        }
    }

    return lines.join("\n");
}

/**
 * Format a field name as a readable label.
 */
function formatFieldName(name: string): string {
    return name
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, s => s.toUpperCase())
        .replace(/Id$/, " ID")
        .replace(/Ids$/, " IDs")
        .trim();
}

/**
 * Collect dependencies (outgoing references) for an entity.
 */
function collectDependencies(
    entity: Entity,
    bundle: Bundle,
    depth: number,
    maxDepth: number,
    visited: Set<string>
): Entity[] {
    if (depth >= maxDepth) return [];

    const key = `${entity.entityType}:${entity.id}`;
    if (visited.has(key)) return [];
    visited.add(key);

    const dependencies: Entity[] = [];

    // Find outgoing edges where this entity references others
    for (const edge of bundle.refGraph.edges) {
        if (edge.fromEntityType === entity.entityType && edge.fromId === entity.id) {
            const targetEntity = bundle.entities.get(edge.toEntityType)?.get(edge.toId);
            if (targetEntity) {
                const targetKey = `${edge.toEntityType}:${edge.toId}`;
                if (!visited.has(targetKey)) {
                    dependencies.push(targetEntity);
                    // Recursively collect dependencies
                    dependencies.push(...collectDependencies(
                        targetEntity,
                        bundle,
                        depth + 1,
                        maxDepth,
                        visited
                    ));
                }
            }
        }
    }

    return dependencies;
}

/**
 * Register export tools.
 */
export function registerExportTools(ctx: ToolContext): void {
    const { server, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: export_entity_markdown
    registerReadOnlyTool(
        server,
        "export_entity_markdown",
        "Export an entity as a self-contained markdown document. Optionally includes all referenced entities (dependencies) to create a complete, standalone document. Use for documentation, sharing, or creating readable snapshots of spec components.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            entityType: z.string().describe("Entity type (e.g., 'ADR', 'Feature', 'Requirement')"),
            entityId: z.string().describe("Entity ID to export"),
            includeDependencies: z.boolean().optional().default(true)
                .describe("Include referenced entities in the export (default: true)"),
            dependencyDepth: z.number().optional().default(2)
                .describe("How many levels of dependencies to include (default: 2, max: 5)"),
        },
        async ({ bundleId, entityType, entityId, includeDependencies, dependencyDepth }) => {
            const TOOL_NAME = "export_entity_markdown";

            // Resolve bundle
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST",
                        "Multiple bundles loaded. Please specify bundleId.",
                        { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND",
                    `Bundle not found: ${bundleId}`, { bundleId });
            }

            const bundle = loaded.bundle;

            // Get the entity
            const entity = bundle.entities.get(entityType)?.get(entityId);
            if (!entity) {
                return toolError(TOOL_NAME, "NOT_FOUND",
                    `Entity not found: ${entityType}/${entityId}`,
                    { bundleId: loaded.id, entityType, entityId });
            }

            // Load schema from disk for formatting
            const schema = await loadSchema(loaded, entityType);

            // Build the markdown document
            const lines: string[] = [];

            // Main entity
            lines.push(entityToMarkdown(entity, schema, { includeHeader: true, headingLevel: 1 }));

            // Collect and render dependencies
            const dependencies: Entity[] = [];
            if (includeDependencies) {
                const maxDepth = Math.min(dependencyDepth ?? 2, 5);
                const visited = new Set<string>();
                visited.add(`${entity.entityType}:${entity.id}`);

                dependencies.push(...collectDependencies(entity, bundle, 0, maxDepth, visited));
            }

            if (dependencies.length > 0) {
                lines.push("---");
                lines.push("");
                lines.push("# Related Entities");
                lines.push("");

                // Group by entity type
                const byType = new Map<string, Entity[]>();
                for (const dep of dependencies) {
                    if (!byType.has(dep.entityType)) {
                        byType.set(dep.entityType, []);
                    }
                    byType.get(dep.entityType)!.push(dep);
                }

                // Render each type group (load schemas as needed)
                for (const [depType, entities] of byType) {
                    const typeSchema = await loadSchema(loaded, depType);
                    const typeName = (typeSchema?.title || depType) as string;

                    lines.push(`## ${typeName}s`);
                    lines.push("");

                    for (const depEntity of entities) {
                        lines.push(entityToMarkdown(depEntity, typeSchema, {
                            includeHeader: true,
                            headingLevel: 3
                        }));
                        lines.push("");
                    }
                }
            }

            // Footer with export metadata
            lines.push("---");
            lines.push("");
            const now = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
            const depCount = dependencies.length;
            lines.push(`*Exported from ${loaded.id} on ${now}${depCount > 0 ? ` (includes ${depCount} dependencies)` : ''}*`);

            const markdown = lines.join("\n");

            return toolSuccess(TOOL_NAME, {
                markdown,
                entityType,
                entityId,
                includedDependencies: dependencies.map(d => ({
                    entityType: d.entityType,
                    id: d.id,
                })),
            }, {
                bundleId: loaded.id,
                meta: {
                    characterCount: markdown.length,
                    dependencyCount: dependencies.length,
                },
            });
        }
    );
}
