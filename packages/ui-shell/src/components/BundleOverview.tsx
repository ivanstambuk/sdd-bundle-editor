import { useState, useMemo } from 'react';
import type { UiBundleSnapshot } from '../types';
import { TabBar, type Tab } from './TabBar';
import { EmptyState } from './EmptyState';
import { getFieldDisplayName } from '../utils/schemaUtils';

interface BundleOverviewProps {
    bundle: UiBundleSnapshot | null;
    /** Callback when an entity type is clicked (navigates to sidebar) */
    onSelectType?: (entityType: string) => void;
}

type BundleTab = 'details' | 'entityTypes' | 'relationships' | 'rawSchema';

/**
 * BundleOverview - Shows the bundle's metaschema (entities, relationships, metadata).
 * Displayed when clicking on the bundle header in the navigator.
 * Uses a tabbed interface similar to EntityDetails for organized content.
 */
export function BundleOverview({ bundle, onSelectType }: BundleOverviewProps) {
    const [activeTab, setActiveTab] = useState<BundleTab>('details');

    if (!bundle) {
        return (
            <div className="bundle-overview">
                <EmptyState
                    icon="📦"
                    message="No bundle loaded."
                />
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

    // Define tabs with badges
    const tabs: Tab[] = useMemo(() => [
        { id: 'details', label: '📋 Details', testId: 'details' },
        { id: 'entityTypes', label: '🏷️ Entity Types', badge: entityTypes.length, testId: 'entity-types' },
        { id: 'relationships', label: '🔗 Relationships', badge: relations.length > 0 ? relations.length : undefined, testId: 'relationships' },
        { id: 'rawSchema', label: '📄 Raw Schema', testId: 'raw-schema' },
    ], [entityTypes.length, relations.length]);

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
                                        <button
                                            type="button"
                                            className="entity-type-badge clickable"
                                            data-type={entityType}
                                            onClick={() => onSelectType?.(entityType)}
                                            title={`View ${entityType} in sidebar`}
                                        >
                                            {entityType}
                                        </button>
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
                                    <th>Relationship</th>
                                    <th>To Entity</th>
                                    <th>Cardinality</th>
                                </tr>
                            </thead>
                            <tbody>
                                {relations.map((rel, idx) => {
                                    const displayName = getFieldDisplayName(
                                        bundle.schemas,
                                        rel.fromEntity,
                                        rel.fromField
                                    );
                                    return (
                                        <tr key={idx}>
                                            <td>
                                                <span className="entity-type-badge" data-type={rel.fromEntity}>
                                                    {rel.fromEntity}
                                                </span>
                                            </td>
                                            <td title={`Field: ${rel.fromField}`}>{displayName}</td>
                                            <td>
                                                <span className="entity-type-badge" data-type={rel.toEntity}>
                                                    {rel.toEntity}
                                                </span>
                                            </td>
                                            <td>{rel.cardinality || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="bundle-relations-hint">
                        These relationships define how {manifest?.metadata?.name || 'this bundle'}'s entities reference each other.
                    </p>
                </>
            ) : (
                <EmptyState
                    icon="🔗"
                    message="No relationships defined in this bundle."
                />
            )}
        </div>
    );

    // Render the Raw Schema tab content
    const renderRawSchemaTab = () => (
        <div className="bundle-tab-content">
            {bundleDef ? (
                <pre className="code-block">{JSON.stringify(bundleDef, null, 2)}</pre>
            ) : (
                <EmptyState
                    icon="📄"
                    message="No bundle type definition available."
                />
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

            {/* Tab bar - using reusable TabBar component */}
            <TabBar
                tabs={tabs}
                activeTab={activeTab}
                onSelect={(id) => setActiveTab(id as BundleTab)}
                testIdPrefix="bundle"
            />

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

