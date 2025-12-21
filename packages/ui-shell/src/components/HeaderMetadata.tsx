import { formatDate } from '../utils/dateUtils';
import styles from './HeaderMetadata.module.css';

/**
 * Metadata structure for header display.
 * Following the x-sdd-meta schema pattern.
 */
export interface HeaderMetadataProps {
    meta: {
        createdDate?: string;
        lastModifiedDate?: string;
        lastModifiedBy?: string;
    } | undefined | null;
}

/**
 * HeaderMetadata - Displays creation/modification metadata in a header bar.
 * 
 * Used consistently across:
 * - BundleOverview (bundle type metadata)
 * - EntityTypeDetails (schema metadata)
 * - EntityDetails (entity metadata)
 * 
 * Expects parent container to use flexbox with appropriate gap/alignment.
 * 
 * @example
 * <div className="entity-header">
 *   <div className="header-left">...</div>
 *   <HeaderMetadata meta={schema['x-sdd-meta']} />
 * </div>
 */
export function HeaderMetadata({ meta }: HeaderMetadataProps) {
    if (!meta) return null;

    return (
        <div className={styles.container}>
            <span className={styles.item}>
                <span className={styles.label}>Created Date:</span>
                <span className={styles.value}>{formatDate(meta.createdDate)}</span>
            </span>
            <span className={styles.item}>
                <span className={styles.label}>Last Modified Date:</span>
                <span className={styles.value}>{formatDate(meta.lastModifiedDate)}</span>
            </span>
            <span className={styles.item}>
                <span className={styles.label}>Modified By:</span>
                <span className={styles.value}>{meta.lastModifiedBy || '—'}</span>
            </span>
        </div>
    );
}

