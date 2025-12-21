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
 * 
 * Note: The caller may pre-add targets to `visited` to exclude them from
 * the dependency list. This function processes edges regardless of whether
 * the entity itself is in visited, but uses visited to:
 * 1. Track which dependencies have already been collected (de-duplication)
 * 2. Prevent infinite loops on circular references
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

    // Add self to visited to prevent cycles, but DON'T return early
    // (caller may have pre-added targets to exclude them from results,
    // but we still need to collect THEIR dependencies)
    const wasAlreadyVisited = visited.has(key);
    visited.add(key);

    // If we've already processed this entity's edges, skip
    // (this happens in recursive calls for circular refs)
    if (wasAlreadyVisited && depth > 0) return [];

    const dependencies: Entity[] = [];

    // Find outgoing edges where this entity references others
    for (const edge of bundle.refGraph.edges) {
        if (edge.fromEntityType === entity.entityType && edge.fromId === entity.id) {
            const targetEntity = bundle.entities.get(edge.toEntityType)?.get(edge.toId);
            if (targetEntity) {
                const targetKey = `${edge.toEntityType}:${edge.toId}`;
                if (!visited.has(targetKey)) {
                    // Mark as visited BEFORE recursing to prevent duplicates
                    visited.add(targetKey);
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

    // Tool: export_context
    // Exports structured JSON/YAML for AI agent consumption with dependencies and schemas
    registerReadOnlyTool(
        server,
        "export_context",
        "Export a machine-parseable subset of the bundle for AI agent implementation work. Returns target entities, their transitive dependencies (what they need to read), relationship metadata, and relevant schemas. Use for offline work, implementation planning, or context snapshots.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            targets: z.array(z.object({
                entityType: z.string().describe("Entity type (e.g., 'Feature')"),
                entityId: z.string().describe("Entity ID (e.g., 'auth-login')"),
            })).min(1).describe("Array of entities to export"),
            includeSchemas: z.boolean().optional().default(true)
                .describe("Include JSON schemas for exported entity types (default: true)"),
            dependencyDepth: z.number().optional().default(3)
                .describe("How deep to traverse dependencies (default: 3, max: 5)"),
            format: z.enum(["json", "yaml"]).optional().default("json")
                .describe("Output format (default: json)"),
            includeRelationMetadata: z.boolean().optional().default(true)
                .describe("Include relationship edges between entities (default: true)"),
        },
        async ({ bundleId, targets, includeSchemas, dependencyDepth, format, includeRelationMetadata }) => {
            const TOOL_NAME = "export_context";

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
            const maxDepth = Math.min(dependencyDepth ?? 3, 5);

            // Collect all target entities
            const targetEntities: Entity[] = [];
            const notFound: Array<{ entityType: string; entityId: string }> = [];

            for (const target of targets) {
                const entity = bundle.entities.get(target.entityType)?.get(target.entityId);
                if (entity) {
                    targetEntities.push(entity);
                } else {
                    notFound.push(target);
                }
            }

            // If some targets not found, report as error
            if (notFound.length > 0) {
                return toolError(TOOL_NAME, "NOT_FOUND",
                    `Some target entities not found`,
                    { notFound, bundleId: loaded.id });
            }

            // Collect dependencies for all targets
            const visited = new Set<string>();
            const allDependencies: Entity[] = [];

            // Mark all targets as visited first (so they don't appear in dependencies)
            for (const target of targetEntities) {
                visited.add(`${target.entityType}:${target.id}`);
            }

            // Collect dependencies for each target
            for (const target of targetEntities) {
                const deps = collectDependencies(target, bundle, 0, maxDepth, visited);
                allDependencies.push(...deps);
            }

            // Helper to get lastModified for an entity
            const getLastModified = async (entity: Entity): Promise<string> => {
                // Priority 1: Entity's lastModifiedDate field
                const data = entity.data as Record<string, unknown>;
                if (data.lastModifiedDate && typeof data.lastModifiedDate === 'string') {
                    return data.lastModifiedDate;
                }

                // Priority 2: File system mtime
                try {
                    const fullPath = path.join(loaded.path, entity.filePath);
                    const stats = await fs.stat(fullPath);
                    return stats.mtime.toISOString();
                } catch {
                    // Fallback to current time if file not accessible
                    return new Date().toISOString();
                }
            };

            // Export entity structure
            interface ExportedEntity {
                entityType: string;
                id: string;
                data: Record<string, unknown>;
                lastModified: string;
            }

            // Build exported entities for targets
            const exportedTargets: ExportedEntity[] = await Promise.all(
                targetEntities.map(async (entity) => ({
                    entityType: entity.entityType,
                    id: entity.id,
                    data: entity.data,
                    lastModified: await getLastModified(entity),
                }))
            );

            // Build exported entities for dependencies
            const exportedDependencies: ExportedEntity[] = await Promise.all(
                allDependencies.map(async (entity) => ({
                    entityType: entity.entityType,
                    id: entity.id,
                    data: entity.data,
                    lastModified: await getLastModified(entity),
                }))
            );

            // Collect relation edges if requested
            interface RelationEdge {
                from: { entityType: string; entityId: string };
                to: { entityType: string; entityId: string };
                field: string;
                displayName: string;
            }

            const relations: RelationEdge[] = [];
            if (includeRelationMetadata) {
                // Get all entity IDs in the export (targets + dependencies)
                const exportedIds = new Set<string>();
                for (const e of [...exportedTargets, ...exportedDependencies]) {
                    exportedIds.add(`${e.entityType}:${e.id}`);
                }

                // Find all edges where both endpoints are in our export
                for (const edge of bundle.refGraph.edges) {
                    const fromKey = `${edge.fromEntityType}:${edge.fromId}`;
                    const toKey = `${edge.toEntityType}:${edge.toId}`;

                    if (exportedIds.has(fromKey) && exportedIds.has(toKey)) {
                        // Get display name for the relationship field
                        const schema = await loadSchema(loaded, edge.fromEntityType);
                        const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
                        const fieldSchema = props[edge.fromField];
                        const displayName = (fieldSchema?.title || formatFieldName(edge.fromField)) as string;

                        relations.push({
                            from: { entityType: edge.fromEntityType, entityId: edge.fromId },
                            to: { entityType: edge.toEntityType, entityId: edge.toId },
                            field: edge.fromField,
                            displayName,
                        });
                    }
                }
            }

            // Collect schemas if requested
            const schemas: Record<string, Record<string, unknown>> = {};
            if (includeSchemas) {
                // Collect unique entity types
                const entityTypes = new Set<string>();
                for (const e of [...exportedTargets, ...exportedDependencies]) {
                    entityTypes.add(e.entityType);
                }

                // Load each schema
                for (const entityType of entityTypes) {
                    const schema = await loadSchema(loaded, entityType);
                    if (schema) {
                        schemas[entityType] = schema;
                    }
                }
            }

            // Build the export response
            const exportData = {
                exportMeta: {
                    bundleId: loaded.id,
                    bundleName: bundle.manifest.metadata.name,
                    exportedAt: new Date().toISOString(),
                    targetCount: exportedTargets.length,
                    dependencyCount: exportedDependencies.length,
                    totalEntities: exportedTargets.length + exportedDependencies.length,
                    format: format ?? "json",
                    version: "1.0" as const,
                },
                targets: exportedTargets,
                dependencies: exportedDependencies,
                relations,
                ...(includeSchemas && Object.keys(schemas).length > 0 ? { schemas } : {}),
            };

            // Format output
            let outputData: unknown;
            if (format === "yaml") {
                // For YAML, we return the object and let the agent handle serialization
                // (or we could use js-yaml here, but keeping deps minimal)
                outputData = exportData;
            } else {
                outputData = exportData;
            }

            return toolSuccess(TOOL_NAME, outputData, {
                bundleId: loaded.id,
                meta: {
                    targetCount: exportedTargets.length,
                    dependencyCount: exportedDependencies.length,
                    relationCount: relations.length,
                    schemaCount: Object.keys(schemas).length,
                },
            });
        }
    );
}
