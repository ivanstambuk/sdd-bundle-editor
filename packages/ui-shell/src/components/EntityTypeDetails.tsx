import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UiBundleSnapshot } from '../types';
import { getEntityDisplayName, getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';
import { HeaderMetadata } from './HeaderMetadata';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import styles from './EntityTypeDetails.module.css';

interface EntityTypeDetailsProps {
    bundle: UiBundleSnapshot | null;
    entityType: string | null;
}

type EntityTypeTab = 'details' | 'json';

/**
 * EntityTypeDetails - Shows the schema for an entity type (not an individual entity).
 * Displayed when clicking on an entity type header in the navigator.
 */
export function EntityTypeDetails({ bundle, entityType }: EntityTypeDetailsProps) {
    const [activeTab, setActiveTab] = useState<EntityTypeTab>('details');
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    if (!bundle || !entityType) {
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

    // Render the Details tab content
    const renderDetailsTab = () => {
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
                    <section className={styles.section}>
                        <h3>External References</h3>
                        <ul className={styles.references}>
                            {meta.references.map((ref, idx) => (
                                <li key={idx} className={styles.reference}>
                                    <a href={ref.url} target="_blank" rel="noopener noreferrer">
                                        {ref.label}
                                    </a>
                                    {ref.type && (
                                        <span className={styles.referenceType}>{ref.type}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Properties table */}
                <section className={styles.section}>
                    <h3>Properties ({Object.keys(properties).length})</h3>
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
            </>
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
                    className={`${styles.tab} ${activeTab === 'details' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('details')}
                    data-testid="tab-details"
                >
                    📋 Details
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
                {activeTab === 'details' && renderDetailsTab()}
                {activeTab === 'json' && renderJsonTab()}
            </div>
        </div>
    );
}

