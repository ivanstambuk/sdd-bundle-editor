import React from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';

interface SddRefWidgetProps {
  id: string;
  value: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
  disabled?: boolean;
  readonly?: boolean;
  schema: Record<string, unknown>;
  bundle: UiBundleSnapshot;
  multiple?: boolean;
}

function getTargetEntities(bundle: UiBundleSnapshot, schema: Record<string, unknown>): UiEntity[] {
  // For array widgets, x-refTargets is in schema.items, not at root level
  const schemaAny = schema as any;
  let targets = schemaAny['x-refTargets'] as string[] | undefined;

  // Check items schema for arrays (e.g., adrIds is an array with items that have x-refTargets)
  if (!targets && schemaAny.items && schemaAny.items['x-refTargets']) {
    targets = schemaAny.items['x-refTargets'] as string[];
  }

  const entityTypes = Array.isArray(targets) && targets.length > 0 ? targets : Object.keys(bundle.entities);

  const result: UiEntity[] = [];
  for (const type of entityTypes) {
    const entitiesOfType = bundle.entities[type];
    if (!entitiesOfType) continue;
    for (const entity of entitiesOfType) {
      result.push(entity);
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}


export function SddRefWidget(props: SddRefWidgetProps) {
  const { id, value, onChange, disabled, readonly, schema, bundle, multiple } = props;
  const entities = getTargetEntities(bundle, schema);

  const isDisabled = disabled || readonly;

  if (multiple) {
    const current = Array.isArray(value) ? value : [];

    const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
      const options = Array.from(event.target.selectedOptions) as HTMLOptionElement[];
      const selected = options
        .map((opt) => opt.value)
        .filter((v) => v);
      onChange(selected);
    };

    return (
      <select id={id} multiple value={current} disabled={isDisabled} onChange={handleChange}>
        {entities.map((e) => {
          const title = (e.data as any)?.title as string | undefined;
          const label = title ? `${e.id} – ${title}` : e.id;
          return (
            <option key={e.id} value={e.id}>
              {label}
            </option>
          );
        })}
      </select>
    );
  }

  const current = typeof value === 'string' ? value : '';

  const handleSingleChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
    const next = event.target.value || undefined;
    onChange(next);
  };

  return (
    <select id={id} value={current} disabled={isDisabled} onChange={handleSingleChange}>
      <option value="">(none)</option>
      {entities.map((e) => {
        const title = (e.data as any)?.title as string | undefined;
        const label = title ? `${e.id} – ${title}` : e.id;
        return (
          <option key={e.id} value={e.id}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
