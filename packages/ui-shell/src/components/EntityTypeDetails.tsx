import type { UiBundleSnapshot } from '../types';
import { getEntityDisplayName, getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';

interface EntityTypeDetailsProps {
    bundle: UiBundleSnapshot | null;
    entityType: string | null;
}

/**
 * EntityTypeDetails - Shows the schema for an entity type (not an individual entity).
 * Displayed when clicking on an entity type header in the navigator.
 */
export function EntityTypeDetails({ bundle, entityType }: EntityTypeDetailsProps) {
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
    const required = (schema.required as string[]) || [];
    const properties = (schema.properties as Record<string, any>) || {};

    return (
        <div className="entity-type-details">
            <div className="entity-type-header">
                {icon && <span className="entity-type-icon">{icon}</span>}
                <h2>{displayNamePlural}</h2>
                <span className="entity-type-count">{entityCount} entities</span>
            </div>

            <div className="entity-type-body">
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
                        <div className="schema-info-row">
                            <span className="schema-info-label">Description:</span>
                            <span className="schema-info-value">{description}</span>
                        </div>
                    </div>
                </section>

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

                {/* Raw schema JSON */}
                <section className="schema-section">
                    <h3>Raw Schema (JSON)</h3>
                    <pre className="code-block">{JSON.stringify(schema, null, 2)}</pre>
                </section>
            </div>
        </div>
    );
}
