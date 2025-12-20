/**
 * Entity Color Utilities
 * 
 * Provides consistent color assignment for entity types across the UI.
 * Colors are derived from entity config or calculated from a hash-based fallback.
 */
import type { BundleTypeEntityConfig } from '@sdd-bundle-editor/shared-types';

/** Default color palette for entity types without explicit colors */
export const DEFAULT_ENTITY_COLORS = [
    '#bb9af7', // purple
    '#7dcfff', // cyan
    '#ff9e64', // orange
    '#7aa2f7', // blue
    '#9ece6a', // green
    '#e0af68', // yellow
    '#f7768e', // pink
    '#73daca', // teal
];

/**
 * Get a consistent color for an entity type.
 * 
 * Priority:
 * 1. Explicit color from entity config
 * 2. Hash-based color from DEFAULT_ENTITY_COLORS (ensures same entity type always gets same color)
 * 
 * @param entityType - The entity type name
 * @param config - Optional entity config with explicit color
 * @param index - Optional fallback index (used if no config and for variation)
 * @returns CSS color string
 */
export function getEntityColor(
    entityType: string,
    config?: BundleTypeEntityConfig,
    index = 0
): string {
    // Use explicit color from config if available
    if (config?.color) return config.color;

    // Hash-based assignment for consistency across renders
    const hash = entityType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return DEFAULT_ENTITY_COLORS[(hash + index) % DEFAULT_ENTITY_COLORS.length];
}

/**
 * Get color for an entity type from a list of entity configs.
 * Convenience function that finds the config first.
 * 
 * @param entityType - The entity type name
 * @param entityConfigs - Array of entity configurations to search
 * @returns CSS color string
 */
export function getEntityColorFromConfigs(
    entityType: string,
    entityConfigs: BundleTypeEntityConfig[]
): string {
    const config = entityConfigs.find(c => c.entityType === entityType);
    return getEntityColor(entityType, config);
}
