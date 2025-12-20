import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import type { UiBundleSnapshot } from '../types';
import { getEntityDisplayName, getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';

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
            <div className="entity-type-details">
                <div className="entity-placeholder">
                    <div className="entity-placeholder-icon">📋</div>
                    <div>No entity type selected.</div>
                    <div className="text-muted text-sm mt-md">Click on an entity type header to view its schema.</div>
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
            <div className="entity-type-details">
                <div className="entity-type-header">
                    {icon && <span className="entity-type-icon">{icon}</span>}
                    <h2>{displayNamePlural}</h2>
                    <span className="entity-type-count">{entityCount} entities</span>
                </div>
                <div className="entity-no-schema">
                    <p className="text-muted">No schema found for entity type "{entityType}".</p>
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

    // Extract schema metadata for header display
    const meta = schema['x-sdd-meta'] as {
        createdDate?: string;
        lastModifiedDate?: string;
        lastModifiedBy?: string;
        references?: Array<{ label: string; url: string; type?: string }>;
        tags?: string[];
    } | undefined;

    const formatDate = (isoDate: string | undefined) => {
        if (!isoDate) return '—';
        try {
            return new Date(isoDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return isoDate;
        }
    };

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
                <section className="schema-section">
                    <h3>Schema Overview</h3>
                    <div className="schema-info">
                        <div className="schema-info-row">
                            <span className="schema-info-label">Name:</span>
                            <span className="schema-info-value">{title}</span>
                        </div>
                        <div className="schema-info-row">
                            <span className="schema-info-label">ID:</span>
                            <code className="schema-info-value">{schemaId}</code>
                        </div>
                        <div className="schema-info-row schema-info-row--description">
                            <span className="schema-info-label">Description:</span>
                            <div className="schema-info-value rjsf-description--markdown">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {description}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tags (optional, schema-driven) */}
                {meta?.tags && meta.tags.length > 0 && (
                    <section className="schema-section">
                        <h3>Tags</h3>
                        <div className="schema-tags">
                            {meta.tags.map(tag => (
                                <span key={tag} className="schema-tag">{tag}</span>
                            ))}
                        </div>
                    </section>
                )}

                {/* External References (optional, schema-driven) */}
                {meta?.references && meta.references.length > 0 && (
                    <section className="schema-section">
                        <h3>External References</h3>
                        <ul className="schema-references">
                            {meta.references.map((ref, idx) => (
                                <li key={idx} className="schema-reference">
                                    <a href={ref.url} target="_blank" rel="noopener noreferrer">
                                        {ref.label}
                                    </a>
                                    {ref.type && (
                                        <span className="reference-type">{ref.type}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Properties table */}
                <section className="schema-section">
                    <h3>Properties ({Object.keys(properties).length})</h3>
                    <div className="schema-properties">
                        <table className="properties-table">
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
                                                <code className="property-name">{propName}</code>
                                            </td>
                                            <td>
                                                <span className="property-type">
                                                    {type}{format}{enumValues}
                                                </span>
                                            </td>
                                            <td>
                                                {isRequired ? (
                                                    <span className="required-badge">required</span>
                                                ) : (
                                                    <span className="optional-badge">optional</span>
                                                )}
                                            </td>
                                            <td className="property-desc">{desc}</td>
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

    // Render the Raw JSON tab content with syntax highlighting
    const jsonContent = useMemo(() => JSON.stringify(schema, null, 2), [schema]);
    const highlightedJson = useMemo(() => {
        return Prism.highlight(jsonContent, Prism.languages['json'], 'json');
    }, [jsonContent]);

    const renderJsonTab = () => (
        <div className="json-viewer">
            <div className="json-actions">
                <button
                    type="button"
                    className="copy-button"
                    onClick={handleCopyJson}
                    data-testid="copy-json-button"
                >
                    {copyFeedback || '📋 Copy to Clipboard'}
                </button>
            </div>
            <pre className="code-block json-block">
                <code
                    className="language-json"
                    dangerouslySetInnerHTML={{ __html: highlightedJson }}
                />
            </pre>
        </div>
    );

    return (
        <div className="entity-type-details">
            <div className="entity-type-header">
                <div className="entity-type-header-left">
                    {icon && <span className="entity-type-icon">{icon}</span>}
                    <h2>{displayNamePlural}</h2>
                    <span className="entity-type-count">{entityCount} entities</span>
                </div>
                {meta && (
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
                )}
            </div>

            {/* Tab bar */}
            <div className="entity-tabs">
                <button
                    type="button"
                    className={`entity-tab ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                    data-testid="tab-details"
                >
                    📋 Details
                </button>
                <button
                    type="button"
                    className={`entity-tab ${activeTab === 'json' ? 'active' : ''}`}
                    onClick={() => setActiveTab('json')}
                    data-testid="tab-json"
                >
                    📄 Raw Schema
                </button>
            </div>

            <div className="entity-type-body">
                {activeTab === 'details' && renderDetailsTab()}
                {activeTab === 'json' && renderJsonTab()}
            </div>
        </div>
    );
}

