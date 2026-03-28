import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UiBundleSnapshot } from '../types';
import { getEntityDisplayName, getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';
import { HeaderMetadata } from './HeaderMetadata';
import { ReferenceList } from './ReferenceList';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { EntityDependencyGraph } from './EntityDependencyGraph';
import { extractRelationsFromSchemas } from '../utils/schemaUtils';
import styles from './EntityTypeDetails.module.css';

interface EntityTypeDetailsProps {
    bundle: UiBundleSnapshot | null;
    entityType: string | null;
    onNavigate?: (entityType: string, entityId: string) => void;
    onSelectType?: (entityType: string) => void;
}

type EntityTypeTab = 'entities' | 'overview' | 'properties' | 'relationships' | 'json';

/**
 * EntityTypeDetails - Shows the schema for an entity type (not an individual entity).
 * Displayed when clicking on an entity type header in the navigator.
 */
export function EntityTypeDetails(props: EntityTypeDetailsProps) {
    if (!props.bundle || !props.entityType) {
        return (
            <div className={styles.container}>
                <div className={styles.placeholder}>
                    <div className={styles.placeholderIcon}>📋</div>
                    <div>No entity type selected.</div>
                    <div className={`${styles.textMuted} ${styles.textSm} ${styles.mtMd}`}>Click on an entity type header to view its schema.</div>
                </div>
            </div>
        );
    }
    return <EntityTypeDetailsContent bundle={props.bundle} entityType={props.entityType} onNavigate={props.onNavigate} onSelectType={props.onSelectType} />;
}

function EntityTypeDetailsContent({ bundle, entityType, onNavigate, onSelectType }: { bundle: UiBundleSnapshot; entityType: string; onNavigate?: (entityType: string, entityId: string) => void; onSelectType?: (entityType: string) => void }) {
    const [activeTab, setActiveTab] = useState<EntityTypeTab>('entities');
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const [graphDepth, setGraphDepth] = useState<number>(1);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    const schema = bundle.schemas?.[entityType] as Record<string, unknown> | undefined;
    const displayName = getEntityDisplayName(schema) ?? entityType;
    const displayNamePlural = getEntityDisplayNamePlural(schema) ?? entityType;
    const icon = getEntityIcon(schema);
    const entityCount = bundle.entities[entityType]?.length ?? 0;

    if (!schema) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <h2>{displayNamePlural}</h2>
                    <span className={styles.count}>{entityCount} entities</span>
                </div>
                <div className={styles.noSchema}>
                    <p className={styles.textMuted}>No schema found for entity type "{entityType}".</p>
                </div>
            </div>
        );
    }

    // Extract schema details for display
    const schemaId = (schema.$id as string) || 'Unknown';
    const title = (schema.title as string) || displayName;
    const description = (schema.description as string) || 'No description available.';
    const displayHint = schema['x-sdd-displayHint'] as string | undefined;
    const required = (schema.required as string[]) || [];
    const properties = (schema.properties as Record<string, any>) || {};
    const propertyCount = Object.keys(properties).length;

    // Extract schema metadata for header display and references
    const meta = schema['x-sdd-meta'] as {
        createdDate?: string;
        lastModifiedDate?: string;
        lastModifiedBy?: string;
        references?: Array<{ label: string; url: string; type?: string }>;
        tags?: string[];
    } | undefined;

    const handleCopyJson = async () => {
        try {
            const jsonContent = JSON.stringify(schema, null, 2);
            await navigator.clipboard.writeText(jsonContent);
            setCopyFeedback('Copied!');
            setTimeout(() => setCopyFeedback(null), 2000);
        } catch {
            setCopyFeedback('Failed to copy');
            setTimeout(() => setCopyFeedback(null), 2000);
        }
    };

    // Render the Entities tab content (table or grid view)
    const renderEntitiesTab = () => {
        const entitiesMap = bundle?.entities[entityType] || {};
        const entitiesList = Object.values(entitiesMap);
        
        if (entitiesList.length === 0) {
            return (
                <div className={styles.placeholder}>
                    <div className={styles.placeholderIcon}>📭</div>
                    <div>No entities of this type exist yet.</div>
                </div>
            );
        }

        if (viewMode === 'table') {
            return (
                <div className={styles.entitiesTabContent}>
                    <div className={styles.viewToggleContainer}>
                        <button className={`${styles.viewToggleBtn} ${styles.viewToggleBtnActive}`}>Table List</button>
                        <button className={styles.viewToggleBtn} onClick={() => setViewMode('cards')}>Card Grid</button>
                    </div>
                    <div className={styles.entitiesTableWrapper}>
                        <table className={styles.entitiesTable}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Title</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entitiesList.map((e: any) => (
                                    <tr key={e.id} onClick={() => onNavigate && onNavigate(entityType, e.id)} className={styles.entityRow}>
                                        <td><code>{e.id}</code></td>
                                        <td className={styles.entityTitleCell}>{e.data?.title || '-'}</td>
                                        <td>{e.data?.category || '-'}</td>
                                        <td>{e.data?.status ? <span className={styles.entityStatusBadge}>{e.data.status}</span> : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.entitiesTabContent}>
                <div className={styles.viewToggleContainer}>
                    <button className={styles.viewToggleBtn} onClick={() => setViewMode('table')}>Table List</button>
                    <button className={`${styles.viewToggleBtn} ${styles.viewToggleBtnActive}`}>Card Grid</button>
                </div>
                <div className={styles.entitiesCardGrid}>
                    {entitiesList.map((e: any) => (
                        <div key={e.id} className={styles.entityCard} onClick={() => onNavigate && onNavigate(entityType, e.id)}>
                            <div className={styles.entityCardHeader}>
                                <code>{e.id}</code>
                                {e.data?.status && <span className={styles.entityStatusBadge}>{e.data.status}</span>}
                            </div>
                            <div className={styles.entityCardTitle}>{e.data?.title || '-'}</div>
                            {e.data?.description && (
                                <div className={styles.entityCardDesc}>
                                    {typeof e.data.description === 'string' && e.data.description.length > 100 
                                      ? e.data.description.substring(0, 100) + '...' 
                                      : String(e.data.description)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render the Overview tab content (schema info, tags, references)
    const renderOverviewTab = () => {
        return (
            <>
                {/* Schema overview */}
                <section className={styles.section}>
                    <h3>Schema Overview</h3>
                    <div className={styles.info}>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Name:</span>
                            <span className={styles.infoValue}>{title}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>ID:</span>
                            <code className={styles.infoValue}>{schemaId}</code>
                        </div>
                        <div className={`${styles.infoRow} ${styles.infoRowDescription}`}>
                            <span className={styles.infoLabel}>Description:</span>
                            <div className={styles.infoValue}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {description}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tags (optional, schema-driven) */}
                {meta?.tags && meta.tags.length > 0 && (
                    <section className={styles.section}>
                        <h3>Tags</h3>
                        <div className={styles.tags}>
                            {meta.tags.map(tag => (
                                <span key={tag} className={styles.tag}>{tag}</span>
                            ))}
                        </div>
                    </section>
                )}

                {/* External References (optional, schema-driven) */}
                {meta?.references && meta.references.length > 0 && (
                    <ReferenceList references={meta.references} />
                )}
            </>
        );
    };

    // Render the Properties tab content (property table)
    const renderPropertiesTab = () => {
        return (
            <section className={styles.section}>
                <div className={styles.properties}>
                    <table className={styles.propertiesTable}>
                        <thead>
                            <tr>
                                <th>Property</th>
                                <th>Type</th>
                                <th>Required</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(properties).map(([propName, propSchema]) => {
                                const ps = propSchema as any;
                                const type = ps.type || 'any';
                                const isRequired = required.includes(propName);
                                const desc = ps.description || '—';
                                const format = ps.format ? ` (${ps.format})` : '';
                                const enumValues = ps.enum ? `: ${ps.enum.join(' | ')}` : '';

                                return (
                                    <tr key={propName}>
                                        <td>
                                            <code className={styles.propertyName}>{propName}</code>
                                        </td>
                                        <td>
                                            <span className={styles.propertyType}>
                                                {type}{format}{enumValues}
                                            </span>
                                        </td>
                                        <td>
                                            {isRequired ? (
                                                <span className={styles.requiredBadge}>required</span>
                                            ) : (
                                                <span className={styles.optionalBadge}>optional</span>
                                            )}
                                        </td>
                                        <td className={styles.propertyDesc}>{desc}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    };

    const typeEdges = useMemo(() => {
        const relations = extractRelationsFromSchemas(bundle.schemas);
        return relations.map(r => ({
            fromEntityType: r.fromEntity,
            fromId: r.fromEntity,
            fromField: r.fromField,
            toEntityType: r.toEntity,
            toId: r.toEntity
        }));
    }, [bundle.schemas]);

    const getFieldDisplay = (typeFilter: string, fieldFilter: string) => {
        const relations = extractRelationsFromSchemas(bundle.schemas);
        const rel = relations.find(r => r.fromEntity === typeFilter && r.fromField === fieldFilter);
        return rel?.displayName || fieldFilter;
    };

    const renderRelationshipsTab = () => {
        return (
            <div className={styles.tabContent} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', background: 'var(--color-surface-tertiary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🗺️</span> Type Relationships Map
                        </h3>
                    </div>
                    <div style={{ display: 'flex', background: 'var(--color-surface-secondary)', borderRadius: '6px', padding: '4px', border: '1px solid var(--color-border-subtle)' }}>
                        <button
                            type="button"
                            className={`${styles.viewToggleBtn} ${graphDepth === 1 ? styles.viewToggleBtnActive : ''}`}
                            onClick={() => setGraphDepth(1)}
                            title="Only direct schema connections"
                        >
                            1st Degree
                        </button>
                        <button
                            type="button"
                            className={`${styles.viewToggleBtn} ${graphDepth === 2 ? styles.viewToggleBtnActive : ''}`}
                            onClick={() => setGraphDepth(2)}
                            title="Connections 2 schema jumps away"
                        >
                            2nd Degree
                        </button>
                        <button
                            type="button"
                            className={`${styles.viewToggleBtn} ${graphDepth === 3 ? styles.viewToggleBtnActive : ''}`}
                            onClick={() => setGraphDepth(3)}
                            title="Connections 3 schema jumps away"
                        >
                            3rd Degree
                        </button>
                        <button
                            type="button"
                            className={`${styles.viewToggleBtn} ${graphDepth === 99 ? styles.viewToggleBtnActive : ''}`}
                            onClick={() => setGraphDepth(99)}
                            title="Show entire connected architectural schema"
                        >
                            Full Graph
                        </button>
                    </div>
                </div>
                <div style={{ flex: 1, minHeight: '600px', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <EntityDependencyGraph
                        key={`${entityType}:depth-${graphDepth}`}
                        entityType={entityType}
                        entityId={entityType}
                        allEdges={typeEdges as any}
                        depth={graphDepth}
                        entityConfigs={bundle.bundleTypeDefinition?.entities || []}
                        onNavigate={(navType, navId) => {
                            if (navType === navId && onSelectType) {
                                onSelectType(navType);
                            } else if (onNavigate) {
                                onNavigate(navType, navId);
                            }
                        }}
                        getFieldDisplay={getFieldDisplay}
                    />
                </div>
            </div>
        );
    };

    // Memoize JSON content for copy and display
    const jsonContent = useMemo(() => JSON.stringify(schema, null, 2), [schema]);

    const renderJsonTab = () => (
        <div className={styles.jsonViewer}>
            <div className={styles.jsonActions}>
                <button
                    type="button"
                    className={styles.copyButton}
                    onClick={handleCopyJson}
                    data-testid="copy-json-button"
                >
                    {copyFeedback || '📋 Copy to Clipboard'}
                </button>
            </div>
            <SyntaxHighlighter language="json" content={jsonContent} />
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    {icon && <span className={styles.icon}>{icon}</span>}
                    <h2>{displayNamePlural}</h2>
                    <span className={styles.count}>{entityCount} entities</span>
                </div>
                <HeaderMetadata meta={meta} />
            </div>

            {/* Tab bar */}
            <div className={styles.tabs}>
                <button
                    type="button"
                    className={`${styles.tab} ${activeTab === 'entities' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('entities')}
                    data-testid="tab-entities"
                >
                    🗂️ Entities ({entityCount})
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('overview')}
                    data-testid="tab-overview"
                >
                    📋 Overview
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${activeTab === 'properties' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('properties')}
                    data-testid="tab-properties"
                >
                    📦 Properties <span className={styles.tabBadge}>{propertyCount}</span>
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${activeTab === 'relationships' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('relationships')}
                    data-testid="tab-relationships"
                >
                    🔗 Relationships
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${activeTab === 'json' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('json')}
                    data-testid="tab-json"
                >
                    📄 Raw Schema
                </button>
            </div>

            <div className={styles.body}>
                {activeTab === 'entities' && renderEntitiesTab()}
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'properties' && renderPropertiesTab()}
                {activeTab === 'relationships' && renderRelationshipsTab()}
                {activeTab === 'json' && renderJsonTab()}
            </div>
        </div>
    );
}

