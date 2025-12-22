import styles from './EntityTypeDetails.module.css';

interface Reference {
    label: string;
    url: string;
    type?: string;
}

interface ReferenceListProps {
    references: Reference[];
}

/**
 * ReferenceList - Displays external references with bullet points and type chips.
 * 
 * Format: • [type] Link Label
 * 
 * Used in EntityTypeDetails for schema external references (x-sdd-meta.references).
 */
export function ReferenceList({ references }: ReferenceListProps) {
    if (!references || references.length === 0) {
        return null;
    }

    return (
        <section className={styles.section}>
            <h3>External References</h3>
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
        </section>
    );
}
