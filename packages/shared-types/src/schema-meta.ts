/**
 * Schema Metadata Types
 * 
 * These types define metadata that can be attached to JSON schemas
 * using the `x-sdd-meta` extension property.
 * 
 * All schemas (bundle and entity) should have the mandatory fields:
 * - createdDate
 * - lastModifiedDate
 * - lastModifiedBy
 * 
 * Additional schema-specific fields (like references) are optional.
 */

/**
 * External reference to a standard, specification, or documentation.
 * Used in schemas that reference external sources (e.g., ADR → MADR format).
 */
export interface SchemaExternalReference {
    /** Display label for the reference */
    label: string;
    /** URL to the external resource */
    url: string;
    /** Optional type categorization (e.g., "standard", "specification", "documentation") */
    type?: 'standard' | 'specification' | 'documentation' | 'example' | 'other';
}

/**
 * Schema metadata stored in `x-sdd-meta` extension property.
 * 
 * Mandatory fields are required for all schemas.
 * Optional fields can vary per schema based on needs.
 * 
 * @example
 * {
 *   "$id": "https://example.com/sdd/ADR.schema.json",
 *   "x-sdd-meta": {
 *     "createdDate": "2024-01-15T10:00:00Z",
 *     "lastModifiedDate": "2024-12-20T14:30:00Z",
 *     "lastModifiedBy": "ACT-ivan",
 *     "references": [
 *       { "label": "MADR Format", "url": "https://adr.github.io/madr/", "type": "standard" }
 *     ]
 *   }
 * }
 */
export interface SchemaMeta {
    // ==================
    // MANDATORY FIELDS
    // ==================

    /** ISO 8601 date when the schema was first created */
    createdDate: string;

    /** ISO 8601 date when the schema was last modified */
    lastModifiedDate: string;

    /** 
     * Who last modified the schema.
     * Can be an Actor ID (e.g., "ACT-ivan") or a plain name.
     */
    lastModifiedBy: string;

    // ==================
    // OPTIONAL FIELDS
    // ==================

    /** Schema version (e.g., "1.0.0", "2.1.0") */
    version?: string;

    /** 
     * External references to standards, specifications, or documentation.
     * Particularly useful for schemas like ADR that reference external formats.
     */
    references?: SchemaExternalReference[];

    /** 
     * Tags for categorization and filtering.
     */
    tags?: string[];
}

/**
 * JSON Schema with SDD extensions.
 * Represents the structure of entity schema files.
 * 
 * MANDATORY FIELDS (all schemas must have):
 * - Standard JSON Schema: $id, title, description
 * - x-sdd-meta: createdDate, lastModifiedDate, lastModifiedBy
 */
export interface SDDJsonSchema {
    /** Schema identifier URL (MANDATORY) */
    $id: string;
    /** JSON Schema version */
    $schema?: string;
    /** Schema title - entity type name (MANDATORY) */
    title: string;
    /** Schema description - explains purpose and usage, supports markdown (MANDATORY) */
    description: string;
    /** Schema type (usually "object" for entities) */
    type?: string;
    /** Required properties */
    required?: string[];
    /** Property definitions */
    properties?: Record<string, unknown>;

    // SDD Extensions

    /** Schema metadata - MANDATORY fields: createdDate, lastModifiedDate, lastModifiedBy */
    'x-sdd-meta'?: SchemaMeta;

    /** UI hints for the schema */
    'x-sdd-ui'?: {
        title?: string;
        icon?: string;
        displayNamePlural?: string;
    };

    /** Allow additional JSON Schema properties */
    [key: string]: unknown;
}
