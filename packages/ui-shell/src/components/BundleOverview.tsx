import { useState, useMemo, useCallback } from 'react';
import type { UiBundleSnapshot } from '../types';
import { TabBar, type Tab } from './TabBar';
import { EmptyState } from './EmptyState';
import { EntityTypeBadge } from './EntityTypeBadge';
import { HeaderMetadata } from './HeaderMetadata';
import { SyntaxHighlighter } from './SyntaxHighlighter';
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
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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
                                        <EntityTypeBadge
                                            entityType={entityType}
                                            entityConfigs={entityConfigs}
                                            clickable
                                            onClick={() => onSelectType?.(entityType)}
                                            title={`View ${entityType} in sidebar`}
                                        />
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

    // Sort relationships by fromEntity (alphabetically), then by toEntity
    const sortedRelations = useMemo(() => {
        return [...relations].sort((a, b) => {
            // Primary sort: fromEntity (A→Z)
            const fromCompare = a.fromEntity.localeCompare(b.fromEntity);
            if (fromCompare !== 0) return fromCompare;
            // Secondary sort: toEntity (A→Z)
            return a.toEntity.localeCompare(b.toEntity);
        });
    }, [relations]);

    // Render the Relationships tab content
    const renderRelationshipsTab = () => (
        <div className="bundle-tab-content">
            {sortedRelations.length > 0 ? (
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
                                {sortedRelations.map((rel, idx) => {
                                    const displayName = getFieldDisplayName(
                                        bundle.schemas,
                                        rel.fromEntity,
                                        rel.fromField
                                    );
                                    return (
                                        <tr key={idx}>
                                            <td>
                                                <EntityTypeBadge
                                                    entityType={rel.fromEntity}
                                                    entityConfigs={entityConfigs}
                                                />
                                            </td>
                                            <td title={`Field: ${rel.fromField}`}>{displayName}</td>
                                            <td>
                                                <EntityTypeBadge
                                                    entityType={rel.toEntity}
                                                    entityConfigs={entityConfigs}
                                                />
                                            </td>
                                            <td>{rel.multiplicity || '—'}</td>
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

    // Memoize schema JSON for copy and display
    const schemaJson = useMemo(() => {
        return bundleDef ? JSON.stringify(bundleDef, null, 2) : '';
    }, [bundleDef]);

    const handleCopySchema = useCallback(async () => {
        if (!schemaJson) return;
        try {
            await navigator.clipboard.writeText(schemaJson);
            setCopyFeedback('Copied!');
            setTimeout(() => setCopyFeedback(null), 2000);
        } catch {
            setCopyFeedback('Failed to copy');
            setTimeout(() => setCopyFeedback(null), 2000);
        }
    }, [schemaJson]);

    const renderRawSchemaTab = () => (
        <div className="bundle-tab-content">
            {bundleDef ? (
                <div className="yaml-viewer">
                    <div className="yaml-actions">
                        <button
                            type="button"
                            className="copy-button"
                            onClick={handleCopySchema}
                            data-testid="copy-schema-button"
                        >
                            {copyFeedback || '📋 Copy to Clipboard'}
                        </button>
                    </div>
                    <SyntaxHighlighter language="json" content={schemaJson} />
                </div>
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
                <div className="bundle-overview-header-left">
                    <span className="bundle-icon">📦</span>
                    <h2>{manifest?.metadata?.name || 'Bundle'}</h2>
                    <span className="bundle-type-badge">{manifest?.metadata?.bundleType || 'sdd'}</span>
                </div>
                <HeaderMetadata meta={bundleDef?.['x-sdd-meta']} />
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

