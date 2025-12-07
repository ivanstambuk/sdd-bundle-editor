import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { SddRefWidget } from './SddRefWidget';

interface EntityDetailsProps {
  bundle: UiBundleSnapshot | null;
  entity: UiEntity | null;
  onNavigate?: (entityType: string, entityId: string) => void;
}

export function EntityDetails({ bundle, entity, onNavigate }: EntityDetailsProps) {
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
        <span className="entity-type-badge" data-type={entity.entityType}>
          {entity.entityType}
        </span>
        <span className="entity-id">{entity.id}</span>
      </div>

      <div className="entity-details-body">
        {schema ? (
          <AnyForm
            schema={schema as any}
            formData={entity.data}
            uiSchema={uiSchema}
            widgets={widgets}
            validator={validator}
            readonly
            disabled
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onChange={() => { }}
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onSubmit={() => { }}
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            onError={() => { }}
          >
            <></>
          </AnyForm>
        ) : (
          <pre>{JSON.stringify(entity.data, null, 2)}</pre>
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
