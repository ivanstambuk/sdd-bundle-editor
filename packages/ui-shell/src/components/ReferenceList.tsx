import styles from './EntityTypeDetails.module.css';

interface Reference {
    label: string;
    url: string;
    type?: string;
}

interface ReferenceListProps {
    references: Reference[];
    /** Whether to show the section header (default: true for standalone use) */
    showHeader?: boolean;
}

/**
 * ReferenceList - Displays external references with bullet points and type chips.
 * 
 * Format: • [type] Link Label
 * 
 * Used in:
 * - EntityTypeDetails for schema external references (x-sdd-meta.references) - with header
 * - EntityDetails for entity external references (x-sdd-displayHint: referenceList) - without header
 */
export function ReferenceList({ references, showHeader = true }: ReferenceListProps) {
    if (!references || references.length === 0) {
        return null;
    }

    const list = (
        <ul className={styles.references}>
            {references.map((ref, idx) => (
                <li key={idx} className={styles.reference}>
                    <span className={styles.referenceBullet}>•</span>
                    {ref.type && (
                        <span className={styles.referenceType}>{ref.type}</span>
                    )}
                    <a href={ref.url} target="_blank" rel="noopener noreferrer">
                        {ref.label}
                    </a>
                </li>
            ))}
        </ul>
    );

    if (!showHeader) {
        return list;
    }

    return (
        <section className={styles.section}>
            <h3>External References</h3>
            {list}
        </section>
    );
}
