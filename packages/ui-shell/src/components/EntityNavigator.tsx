import { useState, useEffect, useMemo } from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';
import type { BundleTypeCategoryConfig } from '@sdd-bundle-editor/shared-types';

interface EntityNavigatorProps {
  bundle: UiBundleSnapshot | null;
  selected?: { entityType: string; id: string } | null;
  selectedType?: string | null;
  selectedBundle?: boolean;
  onSelect(entity: UiEntity): void;
  onSelectType?(entityType: string): void;
  onSelectBundle?(): void;
}

interface CategoryGroup {
  category: BundleTypeCategoryConfig;
  entityTypes: string[];
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
  // Track which categories are collapsed
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  // Track which entity type groups are collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Group entity types by category
  const { categoryGroups, uncategorizedTypes } = useMemo(() => {
    if (!bundle?.bundleTypeDefinition) {
      return { categoryGroups: [], uncategorizedTypes: Object.keys(bundle?.entities ?? {}) };
    }

    const categories = bundle.bundleTypeDefinition.categories ?? [];
    const entityConfigs = bundle.bundleTypeDefinition.entities ?? [];
    const existingEntityTypes = Object.keys(bundle.entities);

    // Build category -> entityTypes map
    const categoryMap = new Map<string, string[]>();
    const categorized = new Set<string>();

    for (const config of entityConfigs) {
      if (config.category && existingEntityTypes.includes(config.entityType)) {
        if (!categoryMap.has(config.category)) {
          categoryMap.set(config.category, []);
        }
        categoryMap.get(config.category)!.push(config.entityType);
        categorized.add(config.entityType);
      }
    }

    // Build ordered category groups
    const groups: CategoryGroup[] = categories
      .filter(cat => categoryMap.has(cat.name))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map(cat => ({
        category: cat,
        entityTypes: categoryMap.get(cat.name) ?? []
      }));

    // Find uncategorized entity types
    const uncategorized = existingEntityTypes.filter(et => !categorized.has(et));

    return { categoryGroups: groups, uncategorizedTypes: uncategorized };
  }, [bundle?.bundleTypeDefinition, bundle?.entities]);

  // Initialize all categories and entity groups as collapsed when bundle first loads
  useEffect(() => {
    if (bundle) {
      // Collapse all entity type groups
      if (collapsedGroups.size === 0) {
        setCollapsedGroups(new Set(Object.keys(bundle.entities)));
      }
      // Collapse all categories by default
      if (collapsedCategories.size === 0 && categoryGroups.length > 0) {
        const allCategoryNames = categoryGroups.map(cg => cg.category.name);
        if (uncategorizedTypes.length > 0) {
          allCategoryNames.push('__uncategorized');
        }
        setCollapsedCategories(new Set(allCategoryNames));
      }
    }
  }, [bundle, categoryGroups, uncategorizedTypes]);

  // Build metadata lookup from schemas - uses plural for headers
  const getMetadata = useMemo(() => {
    const schemas = bundle?.schemas ?? {};
    return (entityType: string) => {
      const schema = schemas[entityType];
      return {
        displayName: getEntityDisplayNamePlural(schema) ?? entityType,
        icon: getEntityIcon(schema),
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

  const bundleName = bundle.manifest?.metadata?.name || 'Bundle';
  const totalEntities = Object.values(bundle.entities).reduce((sum, arr) => sum + arr.length, 0);

  const toggleCategory = (categoryName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const toggleGroup = (entityType: string, e: React.MouseEvent) => {
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

  // Render an entity type group (reusable for both categorized and uncategorized)
  const renderEntityTypeGroup = (entityType: string) => {
    const entities = bundle.entities[entityType] ?? [];
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
  };

  // Check if we have categories to render
  const hasCategories = categoryGroups.length > 0;

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

      {hasCategories ? (
        <>
          {/* Render categorized entity types */}
          {categoryGroups.map(({ category, entityTypes }) => {
            const isCategoryCollapsed = collapsedCategories.has(category.name);
            const categoryEntityCount = entityTypes.reduce(
              (sum, et) => sum + (bundle.entities[et]?.length ?? 0),
              0
            );

            return (
              <div
                key={category.name}
                className={`entity-category ${isCategoryCollapsed ? 'collapsed' : ''}`}
                data-category={category.name}
              >
                <button
                  type="button"
                  className="entity-category-header"
                  onClick={(e) => toggleCategory(category.name, e)}
                  data-testid={`category-${category.name}`}
                >
                  <span className="entity-category-chevron">
                    {isCategoryCollapsed ? '▸' : '▾'}
                  </span>
                  {category.icon && (
                    <span className="entity-category-icon">{category.icon}</span>
                  )}
                  <span className="entity-category-name">{category.displayName}</span>
                  <span className="entity-category-count">{categoryEntityCount}</span>
                </button>
                {!isCategoryCollapsed && (
                  <div className="entity-category-content">
                    {entityTypes.map(renderEntityTypeGroup)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Render uncategorized entity types if any */}
          {uncategorizedTypes.length > 0 && (
            <div
              className={`entity-category ${collapsedCategories.has('__uncategorized') ? 'collapsed' : ''}`}
              data-category="uncategorized"
            >
              <button
                type="button"
                className="entity-category-header"
                onClick={(e) => toggleCategory('__uncategorized', e)}
                data-testid="category-uncategorized"
              >
                <span className="entity-category-chevron">
                  {collapsedCategories.has('__uncategorized') ? '▸' : '▾'}
                </span>
                <span className="entity-category-icon">📁</span>
                <span className="entity-category-name">Uncategorized</span>
                <span className="entity-category-count">
                  {uncategorizedTypes.reduce(
                    (sum, et) => sum + (bundle.entities[et]?.length ?? 0),
                    0
                  )}
                </span>
              </button>
              {!collapsedCategories.has('__uncategorized') && (
                <div className="entity-category-content">
                  {uncategorizedTypes.map(renderEntityTypeGroup)}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Fallback: render flat list if no categories defined */
        Object.keys(bundle.entities).map(renderEntityTypeGroup)
      )}
    </div>
  );
}

