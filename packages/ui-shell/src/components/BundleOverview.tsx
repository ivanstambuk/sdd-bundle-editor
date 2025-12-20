import { useState, useMemo, useCallback } from 'react';
import type { UiBundleSnapshot } from '../types';
import { TabBar, type Tab } from './TabBar';
import { EmptyState } from './EmptyState';
import { EntityTypeBadge } from './EntityTypeBadge';
import { HeaderMetadata } from './HeaderMetadata';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { RelationshipGraph } from './RelationshipGraph';
import { extractRelationsFromSchemas } from '../utils/schemaUtils';

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
    const [relViewMode, setRelViewMode] = useState<'list' | 'map'>('map'); // Relationships view mode

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

    // Extract relationships from schemas - SINGLE SOURCE OF TRUTH
    const relations = useMemo(
        () => extractRelationsFromSchemas(bundle.schemas),
        [bundle.schemas]
    );

    // Define tabs with badges (merged relationships + map into one)
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

    // Render the Relationships tab content (with List/Map toggle)
    const renderRelationshipsTab = () => {
        // List view: table of relationships
        const renderListView = () => (
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
                                return (
                                    <tr key={idx}>
                                        <td>
                                            <EntityTypeBadge
                                                entityType={rel.fromEntity}
                                                entityConfigs={entityConfigs}
                                            />
                                        </td>
                                        <td title={`Field: ${rel.fromField}`}>{rel.displayName}</td>
                                        <td>
                                            <EntityTypeBadge
                                                entityType={rel.toEntity}
                                                entityConfigs={entityConfigs}
                                            />
                                        </td>
                                        <td>{rel.isMany ? 'many' : 'one'}</td>
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
        );

        // Map view: interactive graph
        const renderMapView = () => (
            <RelationshipGraph
                entityConfigs={entityConfigs}
                categories={bundleDef?.categories}
                schemas={bundle.schemas}
                onSelectType={onSelectType}
            />
        );

        if (sortedRelations.length === 0) {
            return (
                <div className="bundle-tab-content">
                    <EmptyState
                        icon="🔗"
                        message="No relationships defined in this bundle."
                    />
                </div>
            );
        }

        return (
            <div className="bundle-tab-content">
                <div className="dependencies-container">
                    {/* Header with toggle */}
                    <div className="dependencies-header">
                        <div className="view-toggle">
                            <button
                                type="button"
                                className={`view-toggle-btn ${relViewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setRelViewMode('list')}
                                data-testid="rel-view-list"
                            >
                                📋 List
                            </button>
                            <button
                                type="button"
                                className={`view-toggle-btn ${relViewMode === 'map' ? 'active' : ''}`}
                                onClick={() => setRelViewMode('map')}
                                data-testid="rel-view-map"
                            >
                                🗺️ Map
                            </button>
                        </div>
                        <span className="dependencies-stats">
                            {entityConfigs.length} types • {sortedRelations.length} relationships
                        </span>
                    </div>

                    {/* Content based on view mode */}
                    {relViewMode === 'list' ? (
                        <div className="dependencies-list">
                            {renderListView()}
                        </div>
                    ) : (
                        renderMapView()
                    )}
                </div>
            </div>
        );
    };

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

