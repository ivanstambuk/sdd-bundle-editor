import { useState } from 'react';
import yaml from 'js-yaml';
import Form from '@rjsf/core';
import { customizeValidator } from '@rjsf/validator-ajv8';
import type { UiBundleSnapshot, UiEntity, UiDiagnostic } from '../types';
import { getEntityDisplayName } from '../utils/schemaMetadata';

// Create a custom validator that allows our schema extension keywords
// Without this, AJV strict mode throws "unknown keyword" errors
const validator = customizeValidator({
  ajvOptionsOverrides: {
    // Allow custom keywords used in SDD schemas for UI hints
    keywords: ['displayHint', 'enumDescriptions', 'displayName'],
  },
});

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

  const uiSchema: Record<string, unknown> = {
    // Hide root-level title and description (already shown in entity header)
    'ui:title': ' ',  // Space to effectively hide (empty string doesn't work)
    'ui:description': ' ',
  };

  // Convert camelCase/PascalCase to Title Case with proper word boundaries
  const formatLabel = (label: string): string => {
    if (!label) return '';
    return label
      // Insert space before uppercase letters (camelCase boundary)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Insert space before sequences like "ID" or "API" followed by lowercase
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      // Capitalize first letter
      .replace(/^./, s => s.toUpperCase())
      // Handle common abbreviations
      .replace(/\bId\b/g, 'ID')
      .replace(/\bIds\b/g, 'IDs')
      .replace(/\bApi\b/g, 'API')
      .replace(/\bUrl\b/g, 'URL');
  };

  // Custom field template with tooltip descriptions
  const CustomFieldTemplate = (props: any) => {
    const { id, label, required, children, rawDescription, uiSchema, schema } = props;

    // Skip rendering for hidden fields (ref fields are shown in Dependency Graph tab)
    if (uiSchema?.['ui:widget'] === 'hidden' || uiSchema?.['ui:field'] === 'hiddenField') {
      return null;
    }

    // Detect array item fields (IDs like "root_acceptanceCriteria_0")
    // These should just render the input without our wrapper/label
    const isArrayItem = id && /_\d+$/.test(id);
    if (isArrayItem) {
      return <div className="rjsf-array-item-content">{children}</div>;
    }

    // Detect boolean fields inside objects (checkboxes in qualityAttributes)
    // Render with optional tooltip if description exists
    const isCheckbox = schema?.type === 'boolean';
    if (isCheckbox) {
      const checkboxDescription = schema?.description || rawDescription;
      return (
        <div className="rjsf-checkbox-field">
          {children}
          {checkboxDescription && (
            <span className="field-help-icon" title={checkboxDescription}>
              ⓘ
            </span>
          )}
        </div>
      );
    }

    // Determine field size class based purely on schema properties
    // No field name hard-coding - editor is schema-driven
    const getFieldSizeClass = () => {
      // Multiline fields always span full width
      if (schema?.displayHint === 'multiline') return 'rjsf-field-full';
      // Arrays and objects span full width
      if (schema?.type === 'array' || schema?.type === 'object') return 'rjsf-field-full';
      // Enums are compact (1 column)
      if (schema?.enum) return 'rjsf-field-small';
      // Use maxLength to determine size:
      // - ≤30: small (1 col) - IDs, short codes
      // - 31-50: medium (2 cols) - medium text
      // - 51-100: large (3 cols) - titles, names
      // - >100: full (4 cols) - descriptions
      const maxLen = schema?.maxLength;
      if (maxLen !== undefined) {
        if (maxLen <= 30) return 'rjsf-field-small';
        if (maxLen <= 50) return 'rjsf-field-medium';
        if (maxLen <= 100) return 'rjsf-field-large';
        return 'rjsf-field-full';
      }
      // No maxLength specified - default to full width
      return 'rjsf-field-full';
    };

    const formattedLabel = formatLabel(label || '');
    const hasDescription = rawDescription && rawDescription.trim();
    const sizeClass = getFieldSizeClass();

    return (
      <div className={`rjsf-field ${sizeClass}`}>
        <div className="rjsf-field-label">
          <label htmlFor={id}>
            {formattedLabel}
            {required && <span className="required-asterisk">*</span>}
          </label>
          {hasDescription && (
            <span className="field-help-icon" title={rawDescription}>
              ⓘ
            </span>
          )}
        </div>
        <div className="rjsf-field-content">
          {children}
        </div>
      </div>
    );
  };

  // Custom array field template - supports displayHint for different layouts
  const CustomArrayFieldTemplate = (props: any) => {
    const { items, canAdd, onAddClick, readonly, disabled, schema, formData } = props;
    const showAddButton = canAdd && !readonly && !disabled;
    const displayHint = schema?.displayHint;

    // Chips layout for tags and short label arrays
    if (displayHint === 'chips' && Array.isArray(formData)) {
      return (
        <div className="rjsf-chips">
          {formData.map((item: string, index: number) => (
            <span key={index} className="rjsf-chip">
              {item}
            </span>
          ))}
          {formData.length === 0 && (
            <span className="rjsf-chips-empty">No items</span>
          )}
        </div>
      );
    }

    // Default: full row per item
    return (
      <div className="rjsf-array">
        {items.map((item: any) => item.children)}
        {showAddButton && (
          <button
            type="button"
            className="rjsf-array-add-btn"
            onClick={onAddClick}
          >
            + Add Item
          </button>
        )}
      </div>
    );
  };

  // Hidden widget for scalar fields - returns nothing
  const HiddenWidget = () => null;

  // Hidden field template for array fields - returns nothing
  const HiddenFieldTemplate = () => null;

  // Custom object field template - strips duplicate title/description
  // (parent FieldTemplate already shows these)
  const CustomObjectFieldTemplate = (props: any) => {
    const { properties } = props;
    return (
      <div className="rjsf-object">
        {properties.map((prop: any) => prop.content)}
      </div>
    );
  };

  // Custom array field item template - removes "FieldName-N" labels
  const CustomArrayFieldItemTemplate = (props: any) => {
    const { children } = props;
    return (
      <div className="rjsf-array-item">
        {children}
      </div>
    );
  };

  // Custom checkbox widget - shows property name as label (not description)
  const CustomCheckboxWidget = (props: any) => {
    const { id, value, onChange, label, disabled, readonly } = props;
    const formattedLabel = formatLabel(label || '');

    return (
      <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: readonly ? 'default' : 'pointer' }}>
        <input
          type="checkbox"
          id={id}
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled || readonly}
        />
        <span style={{ textTransform: 'capitalize' }}>{formattedLabel}</span>
      </label>
    );
  };

  // Custom select widget - shows tooltip with description for current value
  const CustomSelectWidget = (props: any) => {
    const { id, value, onChange, options, disabled, readonly, schema } = props;
    const enumDescriptions = schema?.enumDescriptions as Record<string, string> | undefined;
    const currentDescription = enumDescriptions?.[value];

    return (
      <div className="rjsf-select-with-tooltip">
        <select
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || readonly}
        >
          <option value="">Select...</option>
          {options.enumOptions?.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {currentDescription && (
          <span className="field-help-icon" title={currentDescription}>
            ⓘ
          </span>
        )}
      </div>
    );
  };

  const widgets: Record<string, any> = {
    hidden: HiddenWidget,
    CheckboxWidget: CustomCheckboxWidget,
    SelectWidget: CustomSelectWidget,
  };

  const fields: Record<string, any> = {
    hiddenField: HiddenFieldTemplate,
  };

  const templates: Record<string, any> = {
    FieldTemplate: CustomFieldTemplate,
    ArrayFieldTemplate: CustomArrayFieldTemplate,
    ObjectFieldTemplate: CustomObjectFieldTemplate,
    ArrayFieldItemTemplate: CustomArrayFieldItemTemplate,
  };

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
        uiSchema[propName] = { 'ui:field': 'hiddenField' };
      } else if (ps && ps['ui:widget']) {
        uiSchema[propName] = { 'ui:widget': ps['ui:widget'] };
      }

      // displayHint: "multiline" renders as textarea
      if (ps && ps.type === 'string' && ps.displayHint === 'multiline') {
        uiSchema[propName] = { 'ui:widget': 'textarea' };
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
          className="rjsf"
          schema={schema as any}
          formData={entity.data}
          uiSchema={uiSchema}
          widgets={widgets}
          fields={fields}
          templates={templates}
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
