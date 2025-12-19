/**
 * Bundle Type Definition Types
 * 
 * These types define the structure of bundle type definitions (bundle-type.*.json).
 * They are the SINGLE SOURCE OF TRUTH used by:
 * - core-model (loading/parsing bundle type definitions)
 * - mcp-server (passing bundle type info to clients)
 * - ui-shell (rendering entity types and relationships)
 * 
 * When adding new properties to bundle type definitions:
 * 1. Add them HERE
 * 2. Rebuild shared-types, then dependent packages
 * 3. Update the actual bundle-type.*.json files
 */

/**
 * Configuration for an entity type within a bundle type definition.
 * Defines where entities of this type are stored and how they're identified.
 */
export interface BundleTypeEntityConfig {
    /** The entity type name (e.g., "Feature", "Requirement") */
    entityType: string;
    /** Field name used as the entity's unique identifier (usually "id") */
    idField: string;
    /** Relative path to the JSON schema for this entity type */
    schemaPath: string;
    /** Directory where entities of this type are stored */
    directory: string;
    /** File naming pattern (e.g., "{id}.yaml") */
    filePattern: string;
    /** Optional semantic role for the entity type (e.g., "feature", "stakeholder") */
    role?: string;
    /** Optional color for UI display (CSS color value, e.g. '#bb9af7') */
    color?: string;
}

/**
 * Configuration for a relationship between entity types.
 * Defines how entities reference each other.
 */
export interface BundleTypeRelationConfig {
    /** Human-readable name for the relationship (e.g., "TaskImplementsRequirement") */
    name: string;
    /** Source entity type */
    fromEntity: string;
    /** Field on source entity that contains the reference */
    fromField: string;
    /** Target entity type */
    toEntity: string;
    /** Cardinality: 'one' for single ref, 'many' for array of refs */
    multiplicity: 'one' | 'many';
}

/**
 * Complete bundle type definition structure.
 * Loaded from bundle-type.*.json files.
 */
export interface BundleTypeDefinition {
    /** Bundle type identifier (e.g., "sdd-core") */
    bundleType: string;
    /** Version of the bundle type definition */
    version: string;
    /** Entity type configurations */
    entities: BundleTypeEntityConfig[];
    /** Relationship definitions (optional) */
    relations?: BundleTypeRelationConfig[];
}
