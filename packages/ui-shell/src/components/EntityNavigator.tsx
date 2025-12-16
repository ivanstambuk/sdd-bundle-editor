import { useState, useEffect, useMemo } from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';

interface EntityNavigatorProps {
  bundle: UiBundleSnapshot | null;
  selected?: { entityType: string; id: string } | null;
  selectedType?: string | null;
  selectedBundle?: boolean;
  onSelect(entity: UiEntity): void;
  onSelectType?(entityType: string): void;
  onSelectBundle?(): void;
}

export function EntityNavigator({
  bundle,
  selected,
  selectedType,
  selectedBundle,
  onSelect,
  onSelectType,
  onSelectBundle
}: EntityNavigatorProps) {
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
  const bundleName = bundle.manifest?.metadata?.name || 'Bundle';
  const totalEntities = Object.values(bundle.entities).reduce((sum, arr) => sum + arr.length, 0);

  const toggleGroup = (entityType: string, e: React.MouseEvent) => {
    // Only toggle if clicking the chevron area
    e.stopPropagation();
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

  const handleTypeClick = (entityType: string) => {
    // When clicking the entity type header (not chevron), select the type to show schema
    if (onSelectType) {
      onSelectType(entityType);
    }
    // Also expand the group
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.delete(entityType);
      return next;
    });
  };

  const handleBundleClick = () => {
    if (onSelectBundle) {
      onSelectBundle();
    }
  };

  return (
    <div className="entity-navigator" data-testid="entity-navigator">
      {/* Bundle header */}
      <button
        type="button"
        className={`bundle-nav-header ${selectedBundle ? 'selected' : ''}`}
        onClick={handleBundleClick}
        data-testid="bundle-header"
      >
        <span className="bundle-nav-icon">📦</span>
        <span className="bundle-nav-name">{bundleName}</span>
        <span className="bundle-nav-count">{totalEntities}</span>
      </button>

      <h2>Entities</h2>
      {entries.map(([entityType, entities]) => {
        const isCollapsed = collapsedGroups.has(entityType);
        const { displayName, icon } = getMetadata(entityType);
        const count = entities.length;
        const isTypeSelected = selectedType === entityType && !selected;

        return (
          <div
            key={entityType}
            className={`entity-group ${isCollapsed ? 'collapsed' : ''}`}
            data-type={entityType}
          >
            <div className={`entity-group-header-wrapper ${isTypeSelected ? 'selected' : ''}`}>
              <button
                type="button"
                className="entity-group-chevron-btn"
                onClick={(e) => toggleGroup(entityType, e)}
                data-testid={`entity-group-chevron-${entityType}`}
                aria-label={isCollapsed ? `Expand ${displayName}` : `Collapse ${displayName}`}
              >
                <span className="entity-group-chevron">{isCollapsed ? '▸' : '▾'}</span>
              </button>
              <button
                type="button"
                className="entity-group-header"
                onClick={() => handleTypeClick(entityType)}
                data-testid={`entity-group-${entityType}`}
              >
                {icon && <span className="entity-group-icon">{icon}</span>}
                <span className="entity-group-name">{displayName}</span>
                <span className="entity-group-count">{count}</span>
              </button>
            </div>
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
                        data-testid={`entity-item-${entityType}-${entity.id}`}
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
