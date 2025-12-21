import styles from './EntityHeaderBadges.module.css';

interface HeaderMetadataField {
    fieldName: string;
    label: string;
    value: any;
    fieldSchema: any;
}

interface EntityHeaderBadgesProps {
    /** Fields extracted from schema with x-sdd-displayLocation: "header" and x-sdd-enumStyles */
    fields: HeaderMetadataField[];
}

const colorStyles: Record<string, string> = {
    success: styles.badgeSuccess,
    warning: styles.badgeWarning,
    error: styles.badgeError,
    info: styles.badgeInfo,
    neutral: styles.badgeNeutral,
};

/**
 * EntityHeaderBadges - Renders styled enum badges in the entity header.
 * Used for status, confidence, and other enum fields that should appear
 * prominently next to the entity type badge.
 * 
 * Only renders fields that have x-sdd-enumStyles defined in their schema.
 * Color is determined by the style config: success (green), warning (amber), 
 * error (red), info (blue), neutral (gray).
 * 
 * Usage in EntityDetails:
 *   <EntityHeaderBadges fields={headerMetadataFields.filter(f => f.fieldSchema?.['x-sdd-enumStyles'])} />
 */
export function EntityHeaderBadges({ fields }: EntityHeaderBadgesProps) {
    // Only render badges for fields with enum styles defined
    const badgeFields = fields.filter(f => f.fieldSchema?.['x-sdd-enumStyles']);

    if (badgeFields.length === 0) {
        return null;
    }

    return (
        <div className={styles.badges}>
            {badgeFields.map((field) => {
                const enumStyles = field.fieldSchema?.['x-sdd-enumStyles'] as Record<string, { color?: string }> | undefined;
                const styleConfig = enumStyles?.[field.value];
                const colorClass = styleConfig?.color && colorStyles[styleConfig.color]
                    ? colorStyles[styleConfig.color]
                    : styles.badgeNeutral;

                return (
                    <span key={field.fieldName} className={`${styles.badge} ${colorClass}`}>
                        {field.value || '—'}
                    </span>
                );
            })}
        </div>
    );
}

