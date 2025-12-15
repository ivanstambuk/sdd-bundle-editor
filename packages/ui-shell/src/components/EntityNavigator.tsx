import { useState, useEffect, useMemo } from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';

interface EntityNavigatorProps {
  bundle: UiBundleSnapshot | null;
  selected?: { entityType: string; id: string };
  onSelect(entity: UiEntity): void;
}

export function EntityNavigator({ bundle, selected, onSelect }: EntityNavigatorProps) {
  // Track which entity groups are collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Initialize all groups as collapsed when bundle first loads
  useEffect(() => {
    if (bundle && collapsedGroups.size === 0) {
      setCollapsedGroups(new Set(Object.keys(bundle.entities)));
    }
  }, [bundle]);

  // Build metadata lookup from schemas - uses plural for headers
  const getMetadata = useMemo(() => {
    const schemas = bundle?.schemas ?? {};
    return (entityType: string) => {
      const schema = schemas[entityType];
      return {
        displayName: getEntityDisplayNamePlural(schema) ?? entityType, // Plural for headers
        icon: getEntityIcon(schema), // undefined if no metadata
      };
    };
  }, [bundle?.schemas]);

  if (!bundle) {
    return (
      <div className="entity-navigator">
        <div className="entity-placeholder">
          <div className="entity-placeholder-icon">📦</div>
          <div>No bundle loaded.</div>
        </div>
      </div>
    );
  }

  const entries = Object.entries(bundle.entities);

  const toggleGroup = (entityType: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(entityType)) {
        next.delete(entityType);
      } else {
        next.add(entityType);
      }
      return next;
    });
  };

  return (
    <div className="entity-navigator">
      <h2>Entities</h2>
      {entries.map(([entityType, entities]) => {
        const isCollapsed = collapsedGroups.has(entityType);
        const { displayName, icon } = getMetadata(entityType);
        const count = entities.length;

        return (
          <div
            key={entityType}
            className={`entity-group ${isCollapsed ? 'collapsed' : ''}`}
            data-type={entityType}
          >
            <button
              type="button"
              className="entity-group-header"
              onClick={() => toggleGroup(entityType)}
              data-testid={`entity-group-${entityType}`}
            >
              <span className="entity-group-chevron">{isCollapsed ? '▸' : '▾'}</span>
              {icon && <span className="entity-group-icon">{icon}</span>}
              <span className="entity-group-name">{displayName}</span>
              <span className="entity-group-count">{count}</span>
            </button>
            {!isCollapsed && (
              <ul className="entity-list">
                {entities.map((entity) => {
                  const isSelected =
                    selected?.entityType === entity.entityType && selected?.id === entity.id;
                  return (
                    <li key={entity.id} className="entity-item">
                      <button
                        type="button"
                        className={`entity-btn ${isSelected ? 'selected' : ''}`}
                        data-testid={`entity-${entity.id}`}
                        onClick={() => onSelect(entity)}
                      >
                        {entity.id}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
