import { useMemo } from 'react';
import type { UiEntityTypeConfig } from '../types';

interface EntityTypeBadgeProps {
    /** The entity type name to display */
    entityType: string;
    /** Entity type configurations from the bundle (to look up color) */
    entityConfigs?: UiEntityTypeConfig[];
    /** Whether this badge is clickable */
    clickable?: boolean;
    /** Click handler for clickable badges */
    onClick?: () => void;
    /** Optional title/tooltip */
    title?: string;
}

/**
 * Generates inline styles for an entity type badge based on schema-defined color.
 * Returns undefined if no color is defined (falls back to CSS defaults).
 */
export function getEntityTypeStyles(
    entityType: string,
    entityConfigs?: UiEntityTypeConfig[]
): React.CSSProperties | undefined {
    if (!entityConfigs) return undefined;

    const config = entityConfigs.find(c => c.entityType === entityType);
    if (!config?.color) return undefined;

    // Create a semi-transparent background from the text color
    // Parse the color and create an rgba version with 0.2 opacity
    const color = config.color;

    return {
        color: color,
        backgroundColor: hexToRgba(color, 0.2),
    };
}

/**
 * Convert a hex color to rgba with specified opacity.
 * Falls back to the original color if parsing fails.
 */
function hexToRgba(hex: string, opacity: number): string {
    // Handle shorthand hex (#abc -> #aabbcc)
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    if (result) {
        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // If it's already rgb/rgba/hsl, try to add opacity
    if (hex.startsWith('rgb(')) {
        return hex.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
    }
    if (hex.startsWith('hsl(')) {
        return hex.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
    }

    // Fallback: return a generic transparent background
    return `color-mix(in srgb, ${hex} 20%, transparent)`;
}

/**
 * EntityTypeBadge - A reusable badge component for displaying entity types.
 * Reads color from schema configuration if available, otherwise uses CSS defaults.
 */
export function EntityTypeBadge({
    entityType,
    entityConfigs,
    clickable = false,
    onClick,
    title
}: EntityTypeBadgeProps) {
    const style = useMemo(
        () => getEntityTypeStyles(entityType, entityConfigs),
        [entityType, entityConfigs]
    );

    if (clickable) {
        return (
            <button
                type="button"
                className="entity-type-badge clickable"
                data-type={entityType}
                style={style}
                onClick={onClick}
                title={title}
            >
                {entityType}
            </button>
        );
    }

    return (
        <span
            className="entity-type-badge"
            data-type={entityType}
            style={style}
            title={title}
        >
            {entityType}
        </span>
    );
}
