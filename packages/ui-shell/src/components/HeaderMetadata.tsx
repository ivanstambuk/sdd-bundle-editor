import { formatDate } from '../utils/dateUtils';

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
        <div className="entity-header-metadata">
            <span className="header-metadata-item">
                <span className="header-metadata-label">Created Date:</span>
                <span className="header-metadata-value">{formatDate(meta.createdDate)}</span>
            </span>
            <span className="header-metadata-item">
                <span className="header-metadata-label">Last Modified Date:</span>
                <span className="header-metadata-value">{formatDate(meta.lastModifiedDate)}</span>
            </span>
            <span className="header-metadata-item">
                <span className="header-metadata-label">Modified By:</span>
                <span className="header-metadata-value">{meta.lastModifiedBy || '—'}</span>
            </span>
        </div>
    );
}
