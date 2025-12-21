import styles from './ProminenceHeader.module.css';

interface ProminenceHeaderProps {
    /** The icon to display (emoji or character) */
    icon?: string;
    /** The title/label text */
    title: string;
    /** Optional description shown as tooltip on help icon */
    description?: string;
}

/**
 * ProminenceHeader - A visual header for hero/primary/secondary prominence fields.
 * Used in RJSF CustomFieldTemplate for fields with x-sdd-prominence schema hints.
 * 
 * Visual hierarchy levels:
 * - hero: Largest, most prominent (e.g., main problem statement)
 * - primary: Important section headers (e.g., Context, Decision)
 * - secondary: Standard field headers (default for most fields)
 * 
 * The visual styling is controlled via CSS classes.
 */
export function ProminenceHeader({ icon, title, description }: ProminenceHeaderProps) {
    return (
        <div className={styles.header}>
            {icon && <span className={styles.icon}>{icon}</span>}
            <span className={styles.title}>{title}</span>
            {description && (
                <span className={styles.helpIcon} title={description}>
                    ⓘ
                </span>
            )}
        </div>
    );
}

