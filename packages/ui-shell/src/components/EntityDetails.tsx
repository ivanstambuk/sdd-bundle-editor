import { useState } from 'react';
import yaml from 'js-yaml';
import Form from '@rjsf/core';
import { customizeValidator } from '@rjsf/validator-ajv8';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UiBundleSnapshot, UiEntity, UiDiagnostic, UiEntityTypeConfig } from '../types';
import { getEntityDisplayName } from '../utils/schemaMetadata';
import { getFieldDisplayName } from '../utils/schemaUtils';
import { EntityTypeBadge } from './EntityTypeBadge';
import { MarkdownWidget } from './MarkdownWidget';
import { DateWidget } from './DateWidget';

// Create a custom validator that allows our schema extension keywords
// Without this, AJV strict mode throws "unknown keyword" errors
const validator = customizeValidator({
  ajvOptionsOverrides: {
    // Allow custom keywords used in SDD schemas for UI hints (x-sdd-* namespace)
    keywords: [
      'x-sdd-displayHint', 'x-sdd-enumDescriptions',
      'x-sdd-refTargets', 'x-sdd-idTemplate', 'x-sdd-entityType', 'x-sdd-idScope',
      'x-sdd-widget', 'x-sdd-ui', 'x-sdd-layout', 'x-sdd-layoutGroup', 'x-sdd-layoutGroups', 'x-sdd-indicator',
      'x-sdd-choiceField', 'x-sdd-chosenLabel', 'x-sdd-rejectedLabel',
      // Visual hierarchy keywords
      'x-sdd-order', 'x-sdd-prominence', 'x-sdd-prominenceLabel', 'x-sdd-prominenceIcon',
      'x-sdd-enumStyles', 'x-sdd-displayLocation'
    ],
  },
});

interface EntityDetailsProps {
  bundle: UiBundleSnapshot | null;
  entity: UiEntity | null;
  readOnly?: boolean;
  onNavigate?: (entityType: string, entityId: string) => void;
  diagnostics?: UiDiagnostic[];
  /** Entity type configurations for schema-driven colors */
  entityConfigs?: UiEntityTypeConfig[];
}

type EntityTab = 'details' | 'graph' | 'yaml';

export function EntityDetails({ bundle, entity, readOnly = true, onNavigate, diagnostics = [], entityConfigs }: EntityDetailsProps) {
  // Active tab state
  const [activeTab, setActiveTab] = useState<EntityTab>('details');
  const [activeSubTab, setActiveSubTab] = useState<string>('overview'); // Sub-tab within Details
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

  // Extract layout groups from schema (for sub-tabs within Details)
  const layoutGroupsConfig = schema?.['x-sdd-layoutGroups'] as Record<string, { title: string; order: number }> | undefined;
  const hasLayoutGroups = layoutGroupsConfig && Object.keys(layoutGroupsConfig).length > 0;

  // Build sorted list of sub-tabs from layout groups
  const subTabs = hasLayoutGroups
    ? Object.entries(layoutGroupsConfig)
      .map(([key, config]) => ({ key, title: config.title, order: config.order }))
      .sort((a, b) => a.order - b.order)
    : [];

  // Build a map of which fields belong to which group
  const fieldToGroup: Record<string, string> = {};
  if (hasLayoutGroups && schema?.properties) {
    const props = schema.properties as Record<string, any>;
    for (const [fieldName, fieldSchema] of Object.entries(props)) {
      const group = fieldSchema?.['x-sdd-layoutGroup'];
      if (group) {
        fieldToGroup[fieldName] = group;
      }
    }
  }

  // Extract header metadata fields (x-sdd-displayLocation: "header")
  // These fields are displayed in the entity header, not in the main form
  interface HeaderMetadataField {
    fieldName: string;
    label: string;
    value: any;
    fieldSchema: any;
  }
  const headerMetadataFields: HeaderMetadataField[] = [];
  const headerFieldNames = new Set<string>();

  if (schema?.properties) {
    const props = schema.properties as Record<string, any>;
    const data = entity.data as Record<string, any>;

    for (const [fieldName, fieldSchema] of Object.entries(props)) {
      if (fieldSchema?.['x-sdd-displayLocation'] === 'header') {
        headerFieldNames.add(fieldName);
        headerMetadataFields.push({
          fieldName,
          label: fieldSchema.title || fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase()).trim(),
          value: data?.[fieldName],
          fieldSchema,
        });
      }
    }
  }

  // Create a filtered schema for a specific layout group
  // Sorts fields by x-sdd-order (fields without order come last)
  // Excludes header metadata fields
  const createFilteredSchema = (groupKey: string): Record<string, unknown> | null => {
    if (!schema || !schema.properties) return null;

    const props = schema.properties as Record<string, any>;
    const filteredEntries: [string, any][] = [];
    const filteredRequired: string[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(props)) {
      // Skip header metadata fields
      if (headerFieldNames.has(fieldName)) continue;

      if (fieldToGroup[fieldName] === groupKey) {
        filteredEntries.push([fieldName, fieldSchema]);
        // Check if field is in required list
        if (Array.isArray(schema.required) && schema.required.includes(fieldName)) {
          filteredRequired.push(fieldName);
        }
      }
    }

    if (filteredEntries.length === 0) return null;

    // Sort by x-sdd-order (default to Infinity for fields without order)
    filteredEntries.sort((a, b) => {
      const orderA = a[1]?.['x-sdd-order'] ?? Infinity;
      const orderB = b[1]?.['x-sdd-order'] ?? Infinity;
      return orderA - orderB;
    });

    // Rebuild properties object in sorted order
    const sortedProps: Record<string, any> = {};
    for (const [name, fieldSchema] of filteredEntries) {
      sortedProps[name] = fieldSchema;
    }

    return {
      ...schema,
      properties: sortedProps,
      required: filteredRequired,
    };
  };

  // Helper to get display name from any entity type's schema
  const getDisplayName = (entityType: string): string => {
    const s = bundle.schemas?.[entityType];
    return getEntityDisplayName(s) ?? entityType;
  };

  // Helper wrapper for shared getFieldDisplayName utility
  const getFieldDisplay = (entityType: string, fieldName: string): string => {
    return getFieldDisplayName(bundle.schemas, entityType, fieldName);
  };

  const outgoing =
    bundle.refGraph.edges.filter((e) => e.fromEntityType === entity.entityType && e.fromId === entity.id) ??
    [];
  const incoming =
    bundle.refGraph.edges.filter((e) => e.toEntityType === entity.entityType && e.toId === entity.id) ??
    [];

  const uiSchema: Record<string, unknown> = {
    // Hide root-level title (already shown in entity header)
    // Description is rendered via DescriptionFieldTemplate based on schema's x-sdd-descriptionHint
    'ui:title': ' ',  // Space to effectively hide (empty string doesn't work)
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
      // Markdown/multiline fields always span full width
      const displayHint = schema?.['x-sdd-displayHint'];
      if (displayHint === 'multiline' || displayHint === 'markdown') return 'rjsf-field-full';
      // Arrays (except chips) and objects span full width
      if (schema?.type === 'object') return 'rjsf-field-full';
      if (schema?.type === 'array' && displayHint !== 'chips') return 'rjsf-field-full';
      // Chips layout is compact
      if (displayHint === 'chips') return 'rjsf-field-medium';
      // Enums are compact (1 column)
      if (schema?.enum) return 'rjsf-field-small';
      // Date fields are compact
      if (schema?.format === 'date' || schema?.format === 'date-time') return 'rjsf-field-small';
      // Use maxLength to determine size:
      // - ≤30: small (1 col) - IDs, short codes
      // - 31-80: medium (2 cols) - medium text, titles
      // - 81-150: large (3 cols) - longer titles
      // - >150: full (4 cols) - descriptions
      const maxLen = schema?.maxLength;
      if (maxLen !== undefined) {
        if (maxLen <= 30) return 'rjsf-field-small';
        if (maxLen <= 80) return 'rjsf-field-medium';
        if (maxLen <= 150) return 'rjsf-field-large';
        return 'rjsf-field-full';
      }
      // No maxLength specified - default to medium for strings, full for others
      if (schema?.type === 'string') return 'rjsf-field-medium';
      return 'rjsf-field-full';
    };

    const formattedLabel = formatLabel(label || '');
    // Skip root-level description icon - entity type description is already in header/breadcrumb
    const isRoot = id === 'root';
    const hasDescription = !isRoot && rawDescription && rawDescription.trim();
    const sizeClass = getFieldSizeClass();

    // Visual hierarchy: read prominence from schema
    const prominence = schema?.['x-sdd-prominence'] as string | undefined;
    const prominenceLabel = schema?.['x-sdd-prominenceLabel'] as string | undefined;
    const prominenceIcon = schema?.['x-sdd-prominenceIcon'] as string | undefined;
    const prominenceClass = prominence ? `rjsf-field--${prominence}` : '';

    // Typography control: label and value styling from schema
    // x-sdd-labelStyle: "muted" (default) | "prominent"
    // x-sdd-valueStyle: "plain" (default) | "boxed"
    const labelStyle = schema?.['x-sdd-labelStyle'] as string | undefined || 'muted';
    const valueStyle = schema?.['x-sdd-valueStyle'] as string | undefined || 'plain';
    const labelStyleClass = `rjsf-label--${labelStyle}`;
    const valueStyleClass = `rjsf-value--${valueStyle}`;

    // Hero, primary, and secondary with label get special headers
    const showProminenceHeader = (prominence === 'hero' || prominence === 'primary' || prominence === 'secondary') && prominenceLabel;

    return (
      <div
        className={`rjsf-field ${sizeClass} ${prominenceClass} ${valueStyleClass}`}
        data-prominence={prominence || 'secondary'}
        data-label-style={labelStyle}
        data-value-style={valueStyle}
      >
        {/* Prominence header for hero/primary fields */}
        {showProminenceHeader && (
          <div className="rjsf-prominence-header">
            {prominenceIcon && <span className="rjsf-prominence-icon">{prominenceIcon}</span>}
            <span className="rjsf-prominence-title">{prominenceLabel}</span>
            {hasDescription && (
              <span className="field-help-icon" title={rawDescription}>
                ⓘ
              </span>
            )}
          </div>
        )}

        {/* Normal field label (skip for hero/primary with prominence header to avoid duplication) */}
        {!showProminenceHeader && (
          <div className={`rjsf-field-label ${labelStyleClass}`}>
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
        )}

        <div className="rjsf-field-content">
          {children}
        </div>
      </div>
    );
  };

  // ========================================
  // Array Layout Renderers
  // Each layout is extracted for maintainability and testability
  // ========================================

  // Chips layout - inline tags for short string arrays (e.g., tags)
  const renderChipsLayout = (formData: string[]) => (
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

  // Bullet list layout - compact list for string arrays (e.g., pros, cons, consequences)
  const renderBulletListLayout = (
    items: any[],
    indicator: string | null,
    showAddButton: boolean,
    onAddClick: () => void
  ) => (
    <div className="rjsf-bullet-list">
      <ul className={`rjsf-bullet-items ${indicator ? 'has-indicator' : ''}`}>
        {items.map((item: any, index: number) => (
          <li key={item.key || index} className="rjsf-bullet-item">
            {indicator && <span className="rjsf-bullet-marker">{indicator}</span>}
            {item.children}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <span className="rjsf-bullet-empty">No items</span>
      )}
      {showAddButton && (
        <button
          type="button"
          className="rjsf-array-add-btn rjsf-bullet-add"
          onClick={onAddClick}
        >
          + Add
        </button>
      )}
    </div>
  );

  // Alternatives layout - cards with chosen/rejected badges (e.g., ADR alternatives)
  const renderAlternativesLayout = (
    items: any[],
    formData: any[],
    choiceField: string,
    chosenLabel: string,
    rejectedLabel: string,
    showAddButton: boolean,
    onAddClick: () => void
  ) => (
    <div className="rjsf-array">
      {items.map((item: any, index: number) => {
        const itemData = Array.isArray(formData) ? formData[index] : undefined;
        const isChosen = itemData?.[choiceField] === true;
        const itemClass = isChosen
          ? 'rjsf-array-item rjsf-alternative-item rjsf-alternative-chosen'
          : 'rjsf-array-item rjsf-alternative-item rjsf-alternative-rejected';

        return (
          <div key={item.key || index} className={itemClass}>
            {isChosen && (
              <div className="rjsf-alternative-badge rjsf-badge-chosen">{chosenLabel}</div>
            )}
            {!isChosen && (
              <div className="rjsf-alternative-badge rjsf-badge-rejected">{rejectedLabel}</div>
            )}
            {item.children}
          </div>
        );
      })}
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

  // Default array layout - row per item, cards for complex objects
  const renderDefaultArrayLayout = (
    items: any[],
    formData: any[],
    hasComplexItems: boolean,
    indicator: string | null,
    showAddButton: boolean,
    onAddClick: () => void
  ) => {
    const getItemClass = () => {
      if (hasComplexItems) return 'rjsf-array-item';
      if (indicator) return 'rjsf-array-simple-item rjsf-indicated-item';
      return 'rjsf-array-simple-item';
    };

    return (
      <div className="rjsf-array">
        {items.map((item: any, index: number) => (
          <div key={item.key || index} className={getItemClass()}>
            {indicator && <span className="rjsf-indicator">{indicator}</span>}
            {item.children}
          </div>
        ))}
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

  // ========================================
  // Custom Array Field Template
  // Dispatches to appropriate layout renderer based on schema hints
  // ========================================
  const CustomArrayFieldTemplate = (props: any) => {
    const { items, canAdd, onAddClick, readonly, disabled, schema, formData } = props;
    const showAddButton = canAdd && !readonly && !disabled;
    const displayHint = schema?.['x-sdd-displayHint'];
    const layout = schema?.['x-sdd-layout'];
    const indicator = schema?.items?.['x-sdd-indicator'] || null;

    // Chips layout for tags and short label arrays
    if (displayHint === 'chips' && Array.isArray(formData)) {
      return renderChipsLayout(formData);
    }

    // Bullet list layout for compact string arrays
    if (layout === 'bulletList' && schema?.items?.type === 'string') {
      return renderBulletListLayout(items, indicator, showAddButton, onAddClick);
    }

    // Alternatives layout for choice arrays (ADR alternatives)
    if (layout === 'alternatives') {
      const choiceField = schema?.['x-sdd-choiceField'] || 'isChosen';
      const chosenLabel = schema?.['x-sdd-chosenLabel'] || '✓ CHOSEN';
      const rejectedLabel = schema?.['x-sdd-rejectedLabel'] || 'REJECTED';
      return renderAlternativesLayout(
        items, formData, choiceField, chosenLabel, rejectedLabel, showAddButton, onAddClick
      );
    }

    // Default layout
    const hasComplexItems = schema?.items?.type === 'object' && schema?.items?.properties;
    return renderDefaultArrayLayout(items, formData, hasComplexItems, indicator, showAddButton, onAddClick);
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
  // In read-only mode with x-sdd-enumStyles, renders as a colored badge
  const CustomSelectWidget = (props: any) => {
    const { id, value, onChange, options, disabled, readonly, schema } = props;
    const enumDescriptions = schema?.['x-sdd-enumDescriptions'] as Record<string, string> | undefined;
    const enumStyles = schema?.['x-sdd-enumStyles'] as Record<string, { color?: string }> | undefined;
    const currentDescription = enumDescriptions?.[value];

    // In read-only mode with enum styles, render as a colored badge
    if ((readonly || disabled) && enumStyles && value) {
      const styleConfig = enumStyles[value];
      const colorClass = styleConfig?.color ? `rjsf-enum-badge--${styleConfig.color}` : 'rjsf-enum-badge--neutral';

      return (
        <div className="rjsf-enum-badge-container">
          <span className={`rjsf-enum-badge ${colorClass}`}>
            {value}
          </span>
          {currentDescription && (
            <span className="field-help-icon" title={currentDescription}>
              ⓘ
            </span>
          )}
        </div>
      );
    }

    // Default: editable dropdown
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
    MarkdownWidget: MarkdownWidget,
    DateWidget: DateWidget,
  };

  const fields: Record<string, any> = {
    hiddenField: HiddenFieldTemplate,
  };

  const templates: Record<string, any> = {
    FieldTemplate: CustomFieldTemplate,
    ArrayFieldTemplate: CustomArrayFieldTemplate,
    ObjectFieldTemplate: CustomObjectFieldTemplate,
    // Schema-driven description rendering: reads x-sdd-displayHint from schema root
    DescriptionFieldTemplate: (props: any) => {
      const { description, schema: formSchema } = props;
      if (!description) return null;
      // Read schema-level hint for description rendering (uses same x-sdd-displayHint)
      const displayHint = formSchema?.['x-sdd-displayHint'];
      if (displayHint === 'markdown') {
        return (
          <div className="rjsf-description rjsf-description--markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {description}
            </ReactMarkdown>
          </div>
        );
      }
      // Default: plain text
      return <p className="rjsf-description">{description}</p>;
    },
  };

  // Recursively build uiSchema for nested properties
  const buildUiSchema = (propSchema: any, targetUiSchema: Record<string, any>) => {
    if (!propSchema || typeof propSchema !== 'object') return;

    // Handle object properties
    if (propSchema.properties && typeof propSchema.properties === 'object') {
      for (const [propName, ps] of Object.entries(propSchema.properties as Record<string, any>)) {
        // Hide single reference fields - they're shown in "Uses" section
        if (ps && ps.type === 'string' && ps.format === 'sdd-ref') {
          targetUiSchema[propName] = { 'ui:widget': 'hidden' };
        } else if (
          ps &&
          ps.type === 'array' &&
          ps.items &&
          ps.items.type === 'string' &&
          ps.items.format === 'sdd-ref'
        ) {
          targetUiSchema[propName] = { 'ui:field': 'hiddenField' };
        } else if (ps && ps['x-sdd-widget']) {
          targetUiSchema[propName] = { 'ui:widget': ps['x-sdd-widget'] };
        }

        // x-sdd-displayHint: "multiline" renders as textarea
        const displayHint = ps?.['x-sdd-displayHint'];

        // x-sdd-displayHint: "hidden" hides field entirely from UI
        if (displayHint === 'hidden') {
          if (ps?.type === 'array') {
            targetUiSchema[propName] = { 'ui:field': 'hiddenField' };
          } else {
            targetUiSchema[propName] = { 'ui:widget': 'hidden' };
          }
          continue; // Skip other processing for hidden fields
        }

        if (ps && ps.type === 'string' && displayHint === 'multiline') {
          targetUiSchema[propName] = { 'ui:widget': 'textarea' };
        }

        // x-sdd-displayHint: "markdown" renders with MarkdownWidget
        if (ps && ps.type === 'string' && displayHint === 'markdown') {
          targetUiSchema[propName] = { 'ui:widget': 'MarkdownWidget' };
        }

        // Date fields use custom DateWidget for better empty state handling
        if (ps && ps.type === 'string' && (ps.format === 'date' || ps.format === 'date-time')) {
          targetUiSchema[propName] = { 'ui:widget': 'DateWidget' };
        }

        // Recurse into nested objects
        if (ps && ps.type === 'object' && ps.properties) {
          targetUiSchema[propName] = targetUiSchema[propName] || {};
          buildUiSchema(ps, targetUiSchema[propName]);
        }

        // Recurse into array items (object items)
        if (ps && ps.type === 'array' && ps.items && ps.items.type === 'object' && ps.items.properties) {
          targetUiSchema[propName] = targetUiSchema[propName] || {};
          targetUiSchema[propName].items = targetUiSchema[propName].items || {};
          buildUiSchema(ps.items, targetUiSchema[propName].items);
        }
      }
    }
  };

  // Build uiSchema for all properties including nested ones
  if (schema) {
    buildUiSchema(schema, uiSchema);
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
  const renderDetailsTab = () => {
    // If no layout groups, render the full form
    if (!hasLayoutGroups || subTabs.length === 0) {
      return (
        <>
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
              onChange={() => { }}
              onSubmit={() => { }}
              onError={() => { }}
            >
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
    }

    // With layout groups: render sub-tabs
    const currentSubTabSchema = createFilteredSchema(activeSubTab);

    return (
      <>
        {/* Sub-tab bar */}
        <div className="entity-subtabs">
          {subTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`entity-subtab ${activeSubTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.key)}
              data-testid={`subtab-${tab.key}`}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {/* Sub-tab content */}
        <div className="entity-subtab-content">
          {currentSubTabSchema ? (
            <AnyForm
              className="rjsf"
              schema={currentSubTabSchema as any}
              formData={entity.data}
              uiSchema={uiSchema}
              widgets={widgets}
              fields={fields}
              templates={templates}
              validator={validator}
              readonly={readOnly}
              disabled={readOnly}
              onChange={() => { }}
              onSubmit={() => { }}
              onError={() => { }}
            >
              <></>
            </AnyForm>
          ) : (
            <div className="entity-subtab-empty">
              <p className="text-muted">No fields in this section.</p>
            </div>
          )}
        </div>
      </>
    );
  };

  // Render the Dependency Graph tab content
  const renderGraphTab = () => (
    <div className="dependency-graph">
      {/* Current entity as root */}
      <div className="graph-node graph-root">
        <EntityTypeBadge
          entityType={entity.entityType}
          entityConfigs={entityConfigs}
        />
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
                <EntityTypeBadge
                  entityType={edge.toEntityType}
                  entityConfigs={entityConfigs}
                />
                <span className="graph-node-id">{edge.toId}</span>
                <span className="graph-field">({getFieldDisplay(edge.fromEntityType, edge.fromField)})</span>
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
                <EntityTypeBadge
                  entityType={edge.fromEntityType}
                  entityConfigs={entityConfigs}
                />
                <span className="graph-node-id">{edge.fromId}</span>
                <span className="graph-field">({getFieldDisplay(edge.fromEntityType, edge.fromField)})</span>
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
          <EntityTypeBadge
            entityType={entity.entityType}
            entityConfigs={entityConfigs}
          />
          <span className="entity-id">{entity.id}</span>
        </div>

        {/* Header status badges - enums with x-sdd-enumStyles go next to entity type */}
        {headerMetadataFields.filter(f => f.fieldSchema?.['x-sdd-enumStyles']).length > 0 && (
          <div className="entity-header-badges">
            {headerMetadataFields
              .filter(f => f.fieldSchema?.['x-sdd-enumStyles'])
              .map((field) => {
                const enumStyles = field.fieldSchema?.['x-sdd-enumStyles'] as Record<string, { color?: string }> | undefined;
                const styleConfig = enumStyles?.[field.value];
                const colorClass = styleConfig?.color ? `rjsf-enum-badge--${styleConfig.color}` : 'rjsf-enum-badge--neutral';

                return (
                  <span key={field.fieldName} className={`rjsf-enum-badge ${colorClass}`}>
                    {field.value || '—'}
                  </span>
                );
              })}
          </div>
        )}

        {/* Header metadata - dates and text fields on the right */}
        {headerMetadataFields.filter(f => !f.fieldSchema?.['x-sdd-enumStyles']).length > 0 && (
          <div className="entity-header-metadata">
            {headerMetadataFields
              .filter(f => !f.fieldSchema?.['x-sdd-enumStyles'])
              .map((field, idx, arr) => {
                // Format date values nicely
                let displayValue = field.value;
                if (field.fieldSchema?.format === 'date' && displayValue) {
                  try {
                    const date = new Date(displayValue);
                    displayValue = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  } catch { /* keep original */ }
                } else if (field.fieldSchema?.format === 'date-time' && displayValue) {
                  try {
                    const date = new Date(displayValue);
                    displayValue = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  } catch { /* keep original */ }
                }

                // For Actor refs, just show the ID cleanly
                if (field.fieldSchema?.format === 'sdd-ref' && displayValue) {
                  // Strip common prefixes for cleaner display
                  displayValue = displayValue.replace(/^ACT-/, '').replace(/-/g, ' ');
                }

                return (
                  <span key={field.fieldName} className="header-metadata-item">
                    <span className="header-metadata-label">{field.label}:</span>
                    <span className="header-metadata-value">{displayValue || '—'}</span>
                    {idx < arr.length - 1 && <span className="header-metadata-sep">·</span>}
                  </span>
                );
              })}
          </div>
        )}

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
