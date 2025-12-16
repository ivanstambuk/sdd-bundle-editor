import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { UiBundleSnapshot, UiEntity, UiDiagnostic } from '../types';
import { getEntityDisplayName } from '../utils/schemaMetadata';

interface EntityDetailsProps {
  bundle: UiBundleSnapshot | null;
  entity: UiEntity | null;
  readOnly?: boolean;
  onNavigate?: (entityType: string, entityId: string) => void;
  diagnostics?: UiDiagnostic[];
}

export function EntityDetails({ bundle, entity, readOnly = true, onNavigate, diagnostics = [] }: EntityDetailsProps) {
  // Collapsible state for reference sections
  const [usesCollapsed, setUsesCollapsed] = useState(true);
  const [usedByCollapsed, setUsedByCollapsed] = useState(true);

  if (!bundle || !entity) {
    return (
      <div className="entity-details">
        <div className="entity-placeholder">
          <div className="entity-placeholder-icon">📄</div>
          <div>No entity selected.</div>
          <div className="text-muted text-sm mt-md">Select an entity from the sidebar to view details.</div>
        </div>
      </div>
    );
  }

  const hasDiagnostics = diagnostics.length > 0;
  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

  const schema = bundle.schemas?.[entity.entityType] as Record<string, unknown> | undefined;

  // Helper to get display name from any entity type's schema
  const getDisplayName = (entityType: string): string => {
    const s = bundle.schemas?.[entityType];
    return getEntityDisplayName(s) ?? entityType;
  };

  const outgoing =
    bundle.refGraph.edges.filter((e) => e.fromEntityType === entity.entityType && e.fromId === entity.id) ??
    [];
  const incoming =
    bundle.refGraph.edges.filter((e) => e.toEntityType === entity.entityType && e.toId === entity.id) ??
    [];

  const uiSchema: Record<string, unknown> = {};
  const widgets: Record<string, any> = {};

  if (schema && typeof schema.properties === 'object') {
    const props = schema.properties as Record<string, any>;
    for (const [propName, propSchema] of Object.entries(props)) {
      const ps = propSchema as any;
      // Hide single reference fields - they're shown in "Uses" section
      if (ps && ps.type === 'string' && ps.format === 'sdd-ref') {
        uiSchema[propName] = { 'ui:widget': 'hidden' };
        // Hide array reference fields - they're shown in "Uses" section
      } else if (
        ps &&
        ps.type === 'array' &&
        ps.items &&
        ps.items.type === 'string' &&
        ps.items.format === 'sdd-ref'
      ) {
        uiSchema[propName] = { 'ui:widget': 'hidden' };
      } else if (ps && ps['ui:widget']) {
        uiSchema[propName] = { 'ui:widget': ps['ui:widget'] };
      }
    }
  }

  const handleReferenceClick = (entityType: string, entityId: string) => {
    if (onNavigate) {
      onNavigate(entityType, entityId);
    }
  };

  const AnyForm = Form as any;

  return (
    <div className="entity-details">
      <div className="entity-details-header">
        <div className="entity-header-left">
          <span className="entity-type-badge" data-type={entity.entityType}>
            {getDisplayName(entity.entityType)}
          </span>
          <span className="entity-id">{entity.id}</span>
        </div>
        <div className="entity-header-actions">
          {hasDiagnostics && (
            <span className="diagnostics-badge" title={`${errorCount} errors, ${warningCount} warnings`}>
              {errorCount > 0 && <span className="error-count">⛔ {errorCount}</span>}
              {warningCount > 0 && <span className="warning-count">⚠️ {warningCount}</span>}
            </span>
          )}
        </div>
      </div>

      <div className="entity-details-body">
        {/* Uses section - at the top */}
        <div className={`references-section collapsible ${usesCollapsed ? 'collapsed' : ''}`}>
          <button
            type="button"
            className="references-header"
            onClick={() => setUsesCollapsed(!usesCollapsed)}
            data-testid="uses-toggle"
          >
            <span className="references-chevron">{usesCollapsed ? '▶' : '▼'}</span>
            <span className="references-title">Uses</span>
            <span className="references-count">{outgoing.length}</span>
          </button>
          {!usesCollapsed && (
            <div className="references-content">
              {outgoing.length > 0 ? (
                <ul className="references-list">
                  {outgoing.map((edge, idx) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={idx} className="reference-item">
                      <span className="reference-field">{edge.fromField}</span>
                      <span className="reference-arrow">→</span>
                      <button
                        type="button"
                        className="reference-link"
                        onClick={() => handleReferenceClick(edge.toEntityType, edge.toId)}
                        title={`Navigate to ${edge.toEntityType} ${edge.toId}`}
                        data-testid={`outgoing-ref-${edge.toEntityType}-${edge.toId}`}
                      >
                        <span className="reference-link-type">{getDisplayName(edge.toEntityType)}</span>
                        <span className="reference-link-id">{edge.toId}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="reference-empty">No outgoing references</div>
              )}
            </div>
          )}
        </div>

        {/* Used By section */}
        <div className={`references-section collapsible ${usedByCollapsed ? 'collapsed' : ''}`}>
          <button
            type="button"
            className="references-header"
            onClick={() => setUsedByCollapsed(!usedByCollapsed)}
            data-testid="used-by-toggle"
          >
            <span className="references-chevron">{usedByCollapsed ? '▶' : '▼'}</span>
            <span className="references-title">Used By</span>
            <span className="references-count">{incoming.length}</span>
          </button>
          {!usedByCollapsed && (
            <div className="references-content">
              {incoming.length > 0 ? (
                <ul className="references-list">
                  {incoming.map((edge, idx) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={idx} className="reference-item">
                      <button
                        type="button"
                        className="reference-link"
                        onClick={() => handleReferenceClick(edge.fromEntityType, edge.fromId)}
                        title={`Navigate to ${edge.fromEntityType} ${edge.fromId}`}
                        data-testid={`incoming-ref-${edge.fromEntityType}-${edge.fromId}`}
                      >
                        <span className="reference-link-type">{getDisplayName(edge.fromEntityType)}</span>
                        <span className="reference-link-id">{edge.fromId}</span>
                      </button>
                      <span className="reference-arrow">via</span>
                      <span className="reference-field">{edge.fromField}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="reference-empty">No incoming references</div>
              )}
            </div>
          )}
        </div>

        {/* Entity form/properties */}
        {schema ? (
          <AnyForm
            schema={schema as any}
            formData={entity.data}
            uiSchema={uiSchema}
            widgets={widgets}
            validator={validator}
            readonly={readOnly}
            disabled={readOnly}
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onChange={() => { }}
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onSubmit={() => { }}
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onError={() => { }}
          >
            {/* Hide submit button in read-only mode */}
            <></>
          </AnyForm>
        ) : (
          <div className="entity-no-schema">
            <p className="text-muted">Schema not found for entity type "{getDisplayName(entity.entityType)}".</p>
            <p className="text-muted text-sm">This entity cannot be displayed without a valid schema.</p>
          </div>
        )}
      </div>
    </div>
  );
}

