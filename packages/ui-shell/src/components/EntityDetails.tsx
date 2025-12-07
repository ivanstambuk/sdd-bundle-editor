import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { UiBundleSnapshot, UiEntity, UiDiagnostic } from '../types';
import { SddRefWidget } from './SddRefWidget';

interface EntityDetailsProps {
  bundle: UiBundleSnapshot | null;
  entity: UiEntity | null;
  readOnly?: boolean;
  onNavigate?: (entityType: string, entityId: string) => void;
  onEditRequest?: () => void;
  diagnostics?: UiDiagnostic[];
  onFixDiagnostics?: (entity: UiEntity, diagnostics: UiDiagnostic[]) => void;
}

export function EntityDetails({ bundle, entity, readOnly, onNavigate, onEditRequest, diagnostics = [], onFixDiagnostics }: EntityDetailsProps) {
  if (!bundle || !entity) {
    // ... empty state ...
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

  // ... schema and graph logic ...
  const schema = bundle.schemas?.[entity.entityType] as Record<string, unknown> | undefined;

  const outgoing =
    bundle.refGraph.edges.filter((e) => e.fromEntityType === entity.entityType && e.fromId === entity.id) ??
    [];
  const incoming =
    bundle.refGraph.edges.filter((e) => e.toEntityType === entity.entityType && e.toId === entity.id) ??
    [];

  const uiSchema: Record<string, unknown> = {};
  const widgets: Record<string, any> = {};

  if (schema && typeof schema.properties === 'object') {
    // ... schema parsing ...
    const props = schema.properties as Record<string, any>;
    for (const [propName, propSchema] of Object.entries(props)) {
      const ps = propSchema as any;
      if (ps && ps.type === 'string' && ps.format === 'sdd-ref') {
        uiSchema[propName] = { 'ui:widget': 'SddRefSingle' };
      } else if (
        ps &&
        ps.type === 'array' &&
        ps.items &&
        ps.items.type === 'string' &&
        ps.items.format === 'sdd-ref'
      ) {
        uiSchema[propName] = { 'ui:widget': 'SddRefMulti' };
      } else if (ps && ps['ui:widget']) {
        uiSchema[propName] = { 'ui:widget': ps['ui:widget'] };
      }
    }

    widgets.SddRefSingle = (props: any) => (
      <SddRefWidget {...props} bundle={bundle} multiple={false} />
    );
    widgets.SddRefMulti = (props: any) => (
      <SddRefWidget {...props} bundle={bundle} multiple />
    );
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
            {entity.entityType}
          </span>
          <span className="entity-id">{entity.id}</span>
        </div>
        <div className="entity-header-actions">
          {hasDiagnostics && onFixDiagnostics && (
            <button
              className="btn btn-sm btn-warning"
              onClick={() => onFixDiagnostics(entity, diagnostics)}
              title={`Ask agent to fix ${errorCount} errors, ${warningCount} warnings`}
              data-testid="fix-with-agent-btn"
            >
              🪄 Fix with Agent
            </button>
          )}
          {readOnly && onEditRequest && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={onEditRequest}
              title="Ask the agent to modify this entity"
            >
              Edit via Agent
            </button>
          )}
        </div>
      </div>

      <div className="entity-details-body">
        {readOnly && (
          <div className="read-only-banner">
            Read-Only View
          </div>
        )}
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
            {/* Hide submit button in read-only mode by passing empty fragment */}
            {readOnly ? <></> : undefined}
          </AnyForm>
        ) : (
          <div className="entity-no-schema">
            <p className="text-muted">Schema not found for entity type "{entity.entityType}".</p>
            <p className="text-muted text-sm">This entity cannot be displayed without a valid schema.</p>
          </div>
        )}

        <div className="references-section">
          <h3 className="references-title">Outgoing references</h3>
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
                  >
                    <span className="reference-link-type">{edge.toEntityType}</span>
                    <span className="reference-link-id">{edge.toId}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="reference-empty">No outgoing references</div>
          )}
        </div>

        <div className="references-section">
          <h3 className="references-title">Incoming references</h3>
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
                  >
                    <span className="reference-link-type">{edge.fromEntityType}</span>
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
      </div>
    </div>
  );
}
