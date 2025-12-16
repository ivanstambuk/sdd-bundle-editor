import type { UiBundleSnapshot } from '../types';

interface BundleOverviewProps {
    bundle: UiBundleSnapshot | null;
}

/**
 * BundleOverview - Shows the bundle's metaschema (entities, relationships, metadata).
 * Displayed when clicking on the bundle header in the navigator.
 */
export function BundleOverview({ bundle }: BundleOverviewProps) {
    if (!bundle) {
        return (
            <div className="bundle-overview">
                <div className="entity-placeholder">
                    <div className="entity-placeholder-icon">📦</div>
                    <div>No bundle loaded.</div>
                </div>
            </div>
        );
    }

    const manifest = bundle.manifest;
    const bundleDef = bundle.bundleTypeDefinition;
    const entityTypes = Object.keys(bundle.entities);
    const totalEntities = Object.values(bundle.entities).reduce((sum, arr) => sum + arr.length, 0);

    // Get entity type configs from bundle definition
    const entityConfigs = bundleDef?.entities || [];
    const relations = bundleDef?.relations || [];

    return (
        <div className="bundle-overview">
            {/* Bundle header */}
            <div className="bundle-overview-header">
                <span className="bundle-icon">📦</span>
                <h2>{manifest?.metadata?.name || 'Bundle'}</h2>
                <span className="bundle-type-badge">{manifest?.metadata?.bundleType || 'sdd'}</span>
            </div>

            {/* Bundle info */}
            <section className="bundle-section">
                <h3>Bundle Information</h3>
                <div className="bundle-info">
                    <div className="bundle-info-row">
                        <span className="bundle-info-label">Name:</span>
                        <span className="bundle-info-value">{manifest?.metadata?.name || 'Unknown'}</span>
                    </div>
                    <div className="bundle-info-row">
                        <span className="bundle-info-label">Type:</span>
                        <span className="bundle-info-value">{manifest?.metadata?.bundleType || 'sdd'}</span>
                    </div>
                    {manifest?.metadata?.version && (
                        <div className="bundle-info-row">
                            <span className="bundle-info-label">Version:</span>
                            <span className="bundle-info-value">{manifest.metadata.version}</span>
                        </div>
                    )}
                    {manifest?.metadata?.description && (
                        <div className="bundle-info-row">
                            <span className="bundle-info-label">Description:</span>
                            <span className="bundle-info-value">{manifest.metadata.description}</span>
                        </div>
                    )}
                    <div className="bundle-info-row">
                        <span className="bundle-info-label">Entity Types:</span>
                        <span className="bundle-info-value">{entityTypes.length}</span>
                    </div>
                    <div className="bundle-info-row">
                        <span className="bundle-info-label">Total Entities:</span>
                        <span className="bundle-info-value">{totalEntities}</span>
                    </div>
                </div>
            </section>

            {/* Entity Types */}
            <section className="bundle-section">
                <h3>Entity Types ({entityTypes.length})</h3>
                <div className="bundle-entity-types">
                    <table className="properties-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Count</th>
                                <th>Directory</th>
                                <th>Pattern</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entityTypes.map(entityType => {
                                const config = entityConfigs.find(c => c.entityType === entityType);
                                const count = bundle.entities[entityType]?.length || 0;
                                return (
                                    <tr key={entityType}>
                                        <td>
                                            <span className="entity-type-badge" data-type={entityType}>
                                                {entityType}
                                            </span>
                                        </td>
                                        <td>{count}</td>
                                        <td><code>{config?.directory || '—'}</code></td>
                                        <td><code>{config?.filePattern || '—'}</code></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Relationships */}
            {relations.length > 0 && (
                <section className="bundle-section">
                    <h3>Relationships ({relations.length})</h3>
                    <div className="bundle-relations">
                        <table className="properties-table">
                            <thead>
                                <tr>
                                    <th>From Entity</th>
                                    <th>Field</th>
                                    <th>To Entity</th>
                                    <th>Cardinality</th>
                                </tr>
                            </thead>
                            <tbody>
                                {relations.map((rel, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <span className="entity-type-badge" data-type={rel.fromEntity}>
                                                {rel.fromEntity}
                                            </span>
                                        </td>
                                        <td><code>{rel.fromField}</code></td>
                                        <td>
                                            <span className="entity-type-badge" data-type={rel.toEntity}>
                                                {rel.toEntity}
                                            </span>
                                        </td>
                                        <td>{rel.cardinality || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="bundle-relations-hint">
                        These relationships define how {manifest?.metadata?.name || 'this bundle'}'s entities reference each other.
                    </p>
                </section>
            )}

            {/* Raw Bundle Schema (collapsible) */}
            {bundleDef && (
                <section className="bundle-section">
                    <h3>Raw Bundle Schema (JSON)</h3>
                    <pre className="code-block">{JSON.stringify(bundleDef, null, 2)}</pre>
                </section>
            )}
        </div>
    );
}
