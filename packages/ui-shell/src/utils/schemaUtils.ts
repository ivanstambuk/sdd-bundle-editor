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
 * Converts a camelCase string to Title Case with spaces.
 * Examples:
 *   - "governedByAdrIds" -> "Governed By Adr Ids"
 *   - "supersedes" -> "Supersedes"
 * 
 * @param str - camelCase string
 * @returns Title Case string with spaces
 */
export function camelCaseToTitleCase(str: string): string {
    return str
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
}
