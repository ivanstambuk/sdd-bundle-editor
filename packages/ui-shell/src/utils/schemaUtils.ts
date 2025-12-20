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
