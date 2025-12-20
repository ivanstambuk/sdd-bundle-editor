/**
 * Schema utility functions for extracting metadata from JSON schemas.
 * Used by components that need to display human-readable field names.
 */

/**
 * Get the display name for a field from its schema definition.
 * Uses standard JSON Schema 'title' property.
 * Falls back to converting camelCase to Title Case if no title is set.
 * 
 * @param schemas - Record of entity type to JSON schema
 * @param entityType - The entity type containing the field
 * @param fieldName - The field name to get a display name for
 * @returns The human-readable display name
 */
export function getFieldDisplayName(
    schemas: Record<string, unknown> | undefined,
    entityType: string,
    fieldName: string
): string {
    const schema = schemas?.[entityType] as Record<string, unknown> | undefined;
    if (schema && typeof schema.properties === 'object') {
        const props = schema.properties as Record<string, unknown>;
        const propSchema = props[fieldName] as Record<string, unknown> | undefined;
        // Use standard JSON Schema 'title' for human-readable field name
        if (propSchema && typeof propSchema.title === 'string') {
            return propSchema.title;
        }
    }
    // Fallback: convert camelCase to Title Case
    return camelCaseToTitleCase(fieldName);
}

/**
 * Converts a camelCase field name to a human-readable display name.
 * Examples:
 *   - "governedByAdrIds" -> "Governed By ADR"
 *   - "realizesFeatureIds" -> "Realizes Feature"
 *   - "supersedes" -> "Supersedes"
 *   - "scopeComponentIds" -> "Scope Component"
 * 
 * @param str - camelCase string
 * @returns Human-readable display name
 */
export function camelCaseToTitleCase(str: string): string {
    return str
        // Remove trailing 'Ids' or 'Id' (common in reference fields)
        .replace(/Ids?$/, '')
        // Insert space before uppercase letters
        .replace(/([A-Z])/g, ' $1')
        // Capitalize first letter
        .replace(/^./, s => s.toUpperCase())
        // Clean up multiple spaces and trim
        .replace(/\s+/g, ' ')
        .trim()
        // Fix common abbreviations (ADR, API, etc.)
        .replace(/\bAdr\b/g, 'ADR')
        .replace(/\bApi\b/g, 'API')
        .replace(/\bId\b/g, 'ID')
        .replace(/\bUrl\b/g, 'URL');
}

/**
 * Represents a relationship extracted from schema x-sdd-refTargets.
 * This is the canonical relationship format derived from schemas as SSOT.
 */
export interface SchemaRelation {
    /** Source entity type */
    fromEntity: string;
    /** Field name on source entity */
    fromField: string;
    /** Target entity type(s) - from x-sdd-refTargets */
    toEntity: string;
    /** Display name for the relationship (from schema title or derived) */
    displayName: string;
    /** Whether this is a one-to-many relationship (array field) */
    isMany: boolean;
}

/**
 * Extract all relationships from schemas by scanning for x-sdd-refTargets.
 * 
 * This is the SINGLE SOURCE OF TRUTH for relationships.
 * The bundle-type.json.relations array is deprecated in favor of this.
 * 
 * @param schemas - Record of entity type to JSON schema
 * @returns Array of relationships derived from schema properties
 */
export function extractRelationsFromSchemas(
    schemas: Record<string, unknown> | undefined
): SchemaRelation[] {
    if (!schemas) return [];

    const relations: SchemaRelation[] = [];

    for (const [entityType, schemaObj] of Object.entries(schemas)) {
        const schema = schemaObj as Record<string, unknown>;
        if (!schema || typeof schema.properties !== 'object') continue;

        const properties = schema.properties as Record<string, unknown>;

        for (const [fieldName, propSchemaObj] of Object.entries(properties)) {
            const propSchema = propSchemaObj as Record<string, unknown>;
            if (!propSchema) continue;

            // Check for x-sdd-refTargets at property level (for single refs)
            let refTargets = propSchema['x-sdd-refTargets'] as string[] | undefined;
            let isMany = false;

            // Also check inside items for array fields (common pattern)
            if ((!refTargets || refTargets.length === 0) && propSchema.items) {
                const items = propSchema.items as Record<string, unknown>;
                if (items && items['x-sdd-refTargets']) {
                    refTargets = items['x-sdd-refTargets'] as string[];
                    isMany = true; // Array of refs
                }
            }

            // Also check if it's an array type with direct refTargets
            if (propSchema.type === 'array' && refTargets && refTargets.length > 0) {
                isMany = true;
            }

            if (!refTargets || !Array.isArray(refTargets) || refTargets.length === 0) continue;

            // Get display name from title (check both property and items level)
            let displayName: string;
            if (typeof propSchema.title === 'string') {
                displayName = propSchema.title;
            } else if (propSchema.items && typeof (propSchema.items as Record<string, unknown>).title === 'string') {
                displayName = (propSchema.items as Record<string, unknown>).title as string;
            } else {
                displayName = camelCaseToTitleCase(fieldName);
            }

            // Create a relation for each target entity type
            for (const toEntity of refTargets) {
                relations.push({
                    fromEntity: entityType,
                    fromField: fieldName,
                    toEntity,
                    displayName,
                    isMany,
                });
            }
        }
    }

    return relations;
}

