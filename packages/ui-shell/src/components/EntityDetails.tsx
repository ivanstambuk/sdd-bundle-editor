import { useState } from 'react';
import yaml from 'js-yaml';
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

type EntityTab = 'details' | 'graph' | 'yaml';

export function EntityDetails({ bundle, entity, readOnly = true, onNavigate, diagnostics = [] }: EntityDetailsProps) {
  // Active tab state
  const [activeTab, setActiveTab] = useState<EntityTab>('details');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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

  // Helper to get display name for a reference field from the source entity's schema
  const getFieldDisplayName = (entityType: string, fieldName: string): string => {
    const s = bundle.schemas?.[entityType] as Record<string, unknown> | undefined;
    if (s && typeof s.properties === 'object') {
      const props = s.properties as Record<string, unknown>;
      const propSchema = props[fieldName] as Record<string, unknown> | undefined;
      if (propSchema && typeof propSchema.displayName === 'string') {
        return propSchema.displayName;
      }
    }
    // Fallback: convert camelCase to Title Case
    return fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
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

  const handleCopyYaml = async () => {
    try {
      const yamlContent = yaml.dump(entity.data, { indent: 2, lineWidth: -1 });
      await navigator.clipboard.writeText(yamlContent);
      setCopyFeedback('Copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const AnyForm = Form as any;

  // Generate YAML for display
  const yamlContent = yaml.dump(entity.data, { indent: 2, lineWidth: -1 });

  // Render the Details tab content
  const renderDetailsTab = () => (
    <>
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
    </>
  );

  // Render the Dependency Graph tab content
  const renderGraphTab = () => (
    <div className="dependency-graph">
      {/* Current entity as root */}
      <div className="graph-node graph-root">
        <span className="entity-type-badge" data-type={entity.entityType}>
          {getDisplayName(entity.entityType)}
        </span>
        <span className="graph-node-id">{entity.id}</span>
      </div>

      {/* Outgoing (Uses) */}
      {outgoing.length > 0 && (
        <div className="graph-branch">
          <div className="graph-branch-label">Uses →</div>
          <div className="graph-children">
            {outgoing.map((edge, idx) => (
              <button
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                type="button"
                className="graph-node graph-child"
                onClick={() => handleReferenceClick(edge.toEntityType, edge.toId)}
                data-testid={`graph-uses-${edge.toId}`}
              >
                <span className="entity-type-badge" data-type={edge.toEntityType}>
                  {getDisplayName(edge.toEntityType)}
                </span>
                <span className="graph-node-id">{edge.toId}</span>
                <span className="graph-field">({getFieldDisplayName(edge.fromEntityType, edge.fromField)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Incoming (Used By) */}
      {incoming.length > 0 && (
        <div className="graph-branch">
          <div className="graph-branch-label">← Used By</div>
          <div className="graph-children">
            {incoming.map((edge, idx) => (
              <button
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                type="button"
                className="graph-node graph-child"
                onClick={() => handleReferenceClick(edge.fromEntityType, edge.fromId)}
                data-testid={`graph-usedby-${edge.fromId}`}
              >
                <span className="entity-type-badge" data-type={edge.fromEntityType}>
                  {getDisplayName(edge.fromEntityType)}
                </span>
                <span className="graph-node-id">{edge.fromId}</span>
                <span className="graph-field">({getFieldDisplayName(edge.fromEntityType, edge.fromField)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {outgoing.length === 0 && incoming.length === 0 && (
        <div className="reference-empty">No dependencies</div>
      )}
    </div>
  );

  // Render the Raw YAML tab content
  const renderYamlTab = () => (
    <div className="yaml-viewer">
      <div className="yaml-actions">
        <button
          type="button"
          className="copy-button"
          onClick={handleCopyYaml}
          data-testid="copy-yaml-button"
        >
          {copyFeedback || '📋 Copy to Clipboard'}
        </button>
      </div>
      <pre className="code-block yaml-block">{yamlContent}</pre>
    </div>
  );

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
          className={`entity-tab ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => setActiveTab('graph')}
          data-testid="tab-graph"
        >
          🔗 Dependency Graph
        </button>
        <button
          type="button"
          className={`entity-tab ${activeTab === 'yaml' ? 'active' : ''}`}
          onClick={() => setActiveTab('yaml')}
          data-testid="tab-yaml"
        >
          📄 Raw YAML
        </button>
      </div>

      <div className="entity-details-body">
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'graph' && renderGraphTab()}
        {activeTab === 'yaml' && renderYamlTab()}
      </div>
    </div>
  );
}
