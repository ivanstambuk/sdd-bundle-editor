/**
 * Schema UI Metadata utilities.
 * 
 * Entity schemas can define display metadata via the x-sdd-ui extension:
 * 
 * ```json
 * {
 *   "$id": "OpenQuestion",
 *   "title": "Open Question",
 *   "x-sdd-ui": {
 *     "displayName": "Open Question",
 *     "displayNamePlural": "Open Questions",
 *     "icon": "❓"
 *   },
 *   ...
 * }
 * ```
 */

/**
 * UI metadata extension for entity schemas.
 */
export interface SddUiMetadata {
    /** Human-readable singular display name (e.g., "Open Question") */
    displayName: string;
    /** Human-readable plural display name (e.g., "Open Questions") */
    displayNamePlural?: string;
    /** Emoji icon for the entity type */
    icon: string;
    /** Optional accent color (CSS color value) */
    color?: string;
}

/**
 * Entity schema with optional UI metadata.
 */
export interface EntitySchema {
    $id?: string;
    title?: string;
    description?: string;
    'x-sdd-ui'?: SddUiMetadata;
    properties?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Get UI metadata for an entity type from its schema.
 * Returns undefined if the schema doesn't have x-sdd-ui metadata.
 */
export function getSchemaUiMetadata(schema: unknown): SddUiMetadata | undefined {
    if (!schema || typeof schema !== 'object') {
        return undefined;
    }

    const s = schema as EntitySchema;
    return s['x-sdd-ui'];
}

/**
 * Get singular display name for an entity type from its schema.
 * Returns undefined if not available in schema.
 */
export function getEntityDisplayName(schema: unknown): string | undefined {
    const metadata = getSchemaUiMetadata(schema);
    if (metadata?.displayName) {
        return metadata.displayName;
    }

    // Fallback to schema title if available
    if (schema && typeof schema === 'object') {
        const s = schema as EntitySchema;
        if (s.title) {
            return s.title;
        }
    }

    return undefined;
}

/**
 * Get plural display name for an entity type from its schema.
 * Falls back to singular displayName if plural not defined.
 * Returns undefined if not available in schema.
 */
export function getEntityDisplayNamePlural(schema: unknown): string | undefined {
    const metadata = getSchemaUiMetadata(schema);
    if (metadata?.displayNamePlural) {
        return metadata.displayNamePlural;
    }
    // Fall back to singular if plural not defined
    return getEntityDisplayName(schema);
}

/**
 * Get icon for an entity type from its schema.
 * Returns undefined if not available in schema.
 */
export function getEntityIcon(schema: unknown): string | undefined {
    const metadata = getSchemaUiMetadata(schema);
    return metadata?.icon;
}

/**
 * Build a map of entity type -> UI metadata from all schemas.
 */
export function buildEntityMetadataMap(
    schemas: Record<string, unknown> | undefined
): Map<string, SddUiMetadata> {
    const map = new Map<string, SddUiMetadata>();

    if (!schemas) {
        return map;
    }

    for (const [entityType, schema] of Object.entries(schemas)) {
        const metadata = getSchemaUiMetadata(schema);
        if (metadata) {
            map.set(entityType, metadata);
        }
    }

    return map;
}
