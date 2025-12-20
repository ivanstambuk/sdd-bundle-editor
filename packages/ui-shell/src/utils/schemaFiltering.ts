/**
 * Schema Filtering Utilities
 * 
 * Utility functions for filtering JSON Schema objects based on SDD schema hints.
 * Used to create filtered schemas for layout groups and to exclude header-only fields.
 * 
 * Key concepts:
 * - `x-sdd-displayLocation: "header"` - Fields displayed in entity header, not in form
 * - `x-sdd-layoutGroup` - Fields grouped into tabs (e.g., "overview", "meta")
 * - `x-sdd-order` - Field display order within a group
 */

export type JsonSchema = Record<string, unknown>;

/**
 * Extracts field names that should be displayed in the entity header.
 * These fields have `x-sdd-displayLocation: "header"` set.
 * 
 * @param schema - The JSON Schema object
 * @returns Set of field names that belong in the header
 */
export function getHeaderFieldNames(schema: JsonSchema | null | undefined): Set<string> {
    const headerFieldNames = new Set<string>();

    if (!schema?.properties) return headerFieldNames;

    const props = schema.properties as Record<string, any>;
    for (const [fieldName, fieldSchema] of Object.entries(props)) {
        if (fieldSchema?.['x-sdd-displayLocation'] === 'header') {
            headerFieldNames.add(fieldName);
        }
    }

    return headerFieldNames;
}

/**
 * Builds a mapping of field names to their layout groups.
 * Fields with `x-sdd-layoutGroup` are assigned to that group.
 * 
 * @param schema - The JSON Schema object
 * @returns Map from field name to group key
 */
export function getFieldToGroupMap(schema: JsonSchema | null | undefined): Record<string, string> {
    const fieldToGroup: Record<string, string> = {};

    if (!schema?.properties) return fieldToGroup;

    const props = schema.properties as Record<string, any>;
    for (const [fieldName, fieldSchema] of Object.entries(props)) {
        const group = fieldSchema?.['x-sdd-layoutGroup'];
        if (group) {
            fieldToGroup[fieldName] = group;
        }
    }

    return fieldToGroup;
}

/**
 * Strips conditional schema keywords that could reintroduce filtered fields.
 * RJSF evaluates if/then/else and allOf/anyOf/oneOf, which can add fields
 * back that we've explicitly filtered out.
 * 
 * @param schema - The JSON Schema object
 * @returns Schema base without conditional keywords
 */
export function stripConditionalKeywords(schema: JsonSchema): Omit<JsonSchema, 'if' | 'then' | 'else' | 'allOf' | 'anyOf' | 'oneOf'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { if: _if, then: _then, else: _else, allOf, anyOf, oneOf, ...schemaBase } = schema as any;
    return schemaBase;
}

/**
 * Sorts field entries by x-sdd-order (ascending).
 * Fields without x-sdd-order come last.
 * 
 * @param entries - Array of [fieldName, fieldSchema] tuples
 * @returns Sorted array
 */
export function sortFieldsByOrder(entries: [string, any][]): [string, any][] {
    return [...entries].sort((a, b) => {
        const orderA = a[1]?.['x-sdd-order'] ?? Infinity;
        const orderB = b[1]?.['x-sdd-order'] ?? Infinity;
        return orderA - orderB;
    });
}

/**
 * Creates a filtered schema for a specific layout group.
 * Excludes header fields and fields not in the specified group.
 * Sorts fields by x-sdd-order.
 * 
 * @param schema - The original JSON Schema
 * @param groupKey - The layout group key (e.g., "overview", "meta")
 * @param fieldToGroup - Map from field name to group key
 * @param headerFieldNames - Set of field names that belong in header
 * @returns Filtered schema for the group, or null if no fields match
 */
export function filterSchemaForLayoutGroup(
    schema: JsonSchema | null | undefined,
    groupKey: string,
    fieldToGroup: Record<string, string>,
    headerFieldNames: Set<string>
): JsonSchema | null {
    if (!schema || !schema.properties) return null;

    const props = schema.properties as Record<string, any>;
    const filteredEntries: [string, any][] = [];
    const filteredRequired: string[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(props)) {
        // Skip header metadata fields
        if (headerFieldNames.has(fieldName)) continue;

        // Only include fields in this group
        if (fieldToGroup[fieldName] === groupKey) {
            filteredEntries.push([fieldName, fieldSchema]);
            // Check if field is in required list
            if (Array.isArray(schema.required) && (schema.required as string[]).includes(fieldName)) {
                filteredRequired.push(fieldName);
            }
        }
    }

    if (filteredEntries.length === 0) return null;

    // Sort by x-sdd-order
    const sortedEntries = sortFieldsByOrder(filteredEntries);

    // Rebuild properties object in sorted order
    const sortedProps: Record<string, any> = {};
    for (const [name, fieldSchema] of sortedEntries) {
        sortedProps[name] = fieldSchema;
    }

    // Strip conditional keywords and build result
    const schemaBase = stripConditionalKeywords(schema);

    return {
        ...schemaBase,
        properties: sortedProps,
        required: filteredRequired,
        additionalProperties: false,
    };
}

/**
 * Creates a schema with header-only fields removed.
 * Used for non-grouped forms where layout groups aren't defined.
 * 
 * @param schema - The original JSON Schema
 * @param headerFieldNames - Set of field names that belong in header
 * @returns Schema without header fields
 */
export function filterSchemaWithoutHeaderFields(
    schema: JsonSchema | null | undefined,
    headerFieldNames: Set<string>
): JsonSchema | null | undefined {
    if (!schema || !schema.properties || headerFieldNames.size === 0) return schema;

    const props = schema.properties as Record<string, any>;
    const filteredProps: Record<string, any> = {};
    const filteredRequired: string[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(props)) {
        // Skip header metadata fields
        if (headerFieldNames.has(fieldName)) continue;
        filteredProps[fieldName] = fieldSchema;
        if (Array.isArray(schema.required) && (schema.required as string[]).includes(fieldName)) {
            filteredRequired.push(fieldName);
        }
    }

    // Strip conditional keywords and build result
    const schemaBase = stripConditionalKeywords(schema);

    return {
        ...schemaBase,
        properties: filteredProps,
        required: filteredRequired,
        additionalProperties: false,
    };
}

/**
 * Filters formData to only include fields that exist in the schema properties.
 * This prevents RJSF from rendering fields not in schema (header-only fields, etc.)
 * 
 * @param data - The form data object
 * @param schemaToMatch - The filtered schema to match against
 * @returns Filtered data object with only matching fields
 */
export function filterFormDataToSchema(
    data: Record<string, any>,
    schemaToMatch: JsonSchema | null | undefined
): Record<string, any> {
    if (!data || !schemaToMatch || !schemaToMatch.properties) return data;

    const schemaProps = schemaToMatch.properties as Record<string, any>;
    const filtered: Record<string, any> = {};

    for (const key of Object.keys(schemaProps)) {
        if (key in data) {
            filtered[key] = data[key];
        }
    }

    return filtered;
}
