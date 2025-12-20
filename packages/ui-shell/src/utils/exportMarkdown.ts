/**
 * Export entity to markdown utility.
 * 
 * Generates readable markdown documents from entities with optional
 * transitive dependencies.
 */

import type { UiBundleSnapshot, UiEntity } from '../types';

interface ExportOptions {
    /** Include referenced entities in the export (default: true) */
    includeDependencies?: boolean;
    /** How many levels of dependencies to include (default: 2, max: 5) */
    dependencyDepth?: number;
}

interface ExportResult {
    markdown: string;
    dependencies: Array<{ entityType: string; id: string }>;
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
 * Generate markdown content for a single entity.
 */
function entityToMarkdown(
    entity: UiEntity,
    schema: Record<string, unknown> | undefined,
    options: { includeHeader?: boolean; headingLevel?: number } = {}
): string {
    const { includeHeader = true, headingLevel = 1 } = options;
    const data = entity.data as Record<string, unknown>;
    const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;

    const heading = "#".repeat(headingLevel);
    const lines: string[] = [];

    // Header with entity title and type
    if (includeHeader) {
        const title = (data.title || data.name || entity.id) as string;
        lines.push(`${heading} ${title}`);

        // Entity type as blockquote
        const schemaTitle = schema?.title as string | undefined;
        lines.push(`> ${schemaTitle || entity.entityType}`);
        lines.push("");
    }

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

    // Render all fields
    for (const fieldName of Object.keys(data)) {
        lines.push(...renderField(fieldName));
    }

    return lines.join("\n");
}

/**
 * Find entity by type and ID in bundle.
 */
function findEntity(bundle: UiBundleSnapshot, entityType: string, entityId: string): UiEntity | undefined {
    const entities = bundle.entities[entityType] ?? [];
    return entities.find(e => e.id === entityId);
}

/**
 * Extract IDs from reference fields in entity data.
 */
function extractReferences(entity: UiEntity, schema: Record<string, unknown> | undefined): Array<{ entityType: string; id: string }> {
    const refs: Array<{ entityType: string; id: string }> = [];
    const data = entity.data as Record<string, unknown>;
    const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;

    for (const [fieldName, fieldSchema] of Object.entries(props)) {
        const refTargets = fieldSchema["x-sdd-refTargets"] as string[] | undefined;
        if (!refTargets || refTargets.length === 0) continue;

        const value = data[fieldName];
        if (!value) continue;

        // Primary target entityType
        const targetType = refTargets[0];

        // Handle single refs and arrays
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
            if (typeof id === "string") {
                refs.push({ entityType: targetType, id });
            }
        }
    }

    return refs;
}

/**
 * Collect dependencies (outgoing references) for an entity.
 */
function collectDependencies(
    entity: UiEntity,
    bundle: UiBundleSnapshot,
    depth: number,
    maxDepth: number,
    visited: Set<string>
): UiEntity[] {
    if (depth >= maxDepth) return [];

    const key = `${entity.entityType}:${entity.id}`;
    if (visited.has(key)) return [];
    visited.add(key);

    const schema = bundle.schemas?.[entity.entityType] as Record<string, unknown> | undefined;
    const refs = extractReferences(entity, schema);

    const dependencies: UiEntity[] = [];

    for (const ref of refs) {
        const targetEntity = findEntity(bundle, ref.entityType, ref.id);
        if (targetEntity) {
            const targetKey = `${ref.entityType}:${ref.id}`;
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

    return dependencies;
}

/**
 * Export an entity as a markdown document.
 * 
 * Generates a self-contained markdown document with the entity content
 * and optionally all referenced dependencies.
 */
export function exportEntityToMarkdown(
    entity: UiEntity,
    bundle: UiBundleSnapshot,
    options: ExportOptions = {}
): ExportResult {
    const { includeDependencies = true, dependencyDepth = 2 } = options;

    const schema = bundle.schemas?.[entity.entityType] as Record<string, unknown> | undefined;
    const lines: string[] = [];

    // Main entity
    lines.push(entityToMarkdown(entity, schema, { includeHeader: true, headingLevel: 1 }));

    // Collect and render dependencies
    const dependencies: UiEntity[] = [];
    if (includeDependencies) {
        const maxDepth = Math.min(dependencyDepth, 5);
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
        const byType = new Map<string, UiEntity[]>();
        for (const dep of dependencies) {
            if (!byType.has(dep.entityType)) {
                byType.set(dep.entityType, []);
            }
            byType.get(dep.entityType)!.push(dep);
        }

        // Render each type group
        for (const [depType, entities] of byType) {
            const typeSchema = bundle.schemas?.[depType] as Record<string, unknown> | undefined;
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
    lines.push(`*Exported on ${now}${depCount > 0 ? ` (includes ${depCount} dependencies)` : ''}*`);

    return {
        markdown: lines.join("\n"),
        dependencies: dependencies.map(d => ({ entityType: d.entityType, id: d.id })),
    };
}

/**
 * Download markdown content as a file.
 */
export function downloadMarkdown(markdown: string, filename: string): void {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
