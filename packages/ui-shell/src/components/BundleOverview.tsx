import { useState } from 'react';
import type { UiBundleSnapshot } from '../types';

interface BundleOverviewProps {
    bundle: UiBundleSnapshot | null;
}

type BundleTab = 'details' | 'entityTypes' | 'relationships' | 'rawSchema';

/**
 * BundleOverview - Shows the bundle's metaschema (entities, relationships, metadata).
 * Displayed when clicking on the bundle header in the navigator.
 * Uses a tabbed interface similar to EntityDetails for organized content.
 */
export function BundleOverview({ bundle }: BundleOverviewProps) {
    const [activeTab, setActiveTab] = useState<BundleTab>('details');

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

    // Render the Details tab content
    const renderDetailsTab = () => (
        <div className="bundle-tab-content">
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
        </div>
    );

    // Render the Entity Types tab content
    const renderEntityTypesTab = () => (
        <div className="bundle-tab-content">
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
        </div>
    );

    // Render the Relationships tab content
    const renderRelationshipsTab = () => (
        <div className="bundle-tab-content">
            {relations.length > 0 ? (
                <>
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
                </>
            ) : (
                <div className="bundle-empty-state">
                    <span className="bundle-empty-icon">🔗</span>
                    <p>No relationships defined in this bundle.</p>
                </div>
            )}
        </div>
    );

    // Render the Raw Schema tab content
    const renderRawSchemaTab = () => (
        <div className="bundle-tab-content">
            {bundleDef ? (
                <pre className="code-block">{JSON.stringify(bundleDef, null, 2)}</pre>
            ) : (
                <div className="bundle-empty-state">
                    <span className="bundle-empty-icon">📄</span>
                    <p>No bundle type definition available.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="bundle-overview">
            {/* Bundle header */}
            <div className="bundle-overview-header">
                <span className="bundle-icon">📦</span>
                <h2>{manifest?.metadata?.name || 'Bundle'}</h2>
                <span className="bundle-type-badge">{manifest?.metadata?.bundleType || 'sdd'}</span>
            </div>

            {/* Tab bar */}
            <div className="entity-tabs" data-testid="bundle-tabs">
                <button
                    type="button"
                    className={`entity-tab ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                    data-testid="bundle-tab-details"
                >
                    📋 Details
                </button>
                <button
                    type="button"
                    className={`entity-tab ${activeTab === 'entityTypes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('entityTypes')}
                    data-testid="bundle-tab-entity-types"
                >
                    🏷️ Entity Types
                    <span className="tab-badge">{entityTypes.length}</span>
                </button>
                <button
                    type="button"
                    className={`entity-tab ${activeTab === 'relationships' ? 'active' : ''}`}
                    onClick={() => setActiveTab('relationships')}
                    data-testid="bundle-tab-relationships"
                >
                    🔗 Relationships
                    {relations.length > 0 && <span className="tab-badge">{relations.length}</span>}
                </button>
                <button
                    type="button"
                    className={`entity-tab ${activeTab === 'rawSchema' ? 'active' : ''}`}
                    onClick={() => setActiveTab('rawSchema')}
                    data-testid="bundle-tab-raw-schema"
                >
                    📄 Raw Schema
                </button>
            </div>

            {/* Tab content */}
            <div className="bundle-details-body">
                {activeTab === 'details' && renderDetailsTab()}
                {activeTab === 'entityTypes' && renderEntityTypesTab()}
                {activeTab === 'relationships' && renderRelationshipsTab()}
                {activeTab === 'rawSchema' && renderRawSchemaTab()}
            </div>
        </div>
    );
}
