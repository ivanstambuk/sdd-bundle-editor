import { useState, useEffect, useMemo } from 'react';
import type { UiBundleSnapshot, UiEntity } from '../types';
import { getEntityDisplayNamePlural, getEntityIcon } from '../utils/schemaMetadata';
import type { BundleTypeCategoryConfig } from '@sdd-bundle-editor/shared-types';
import styles from './EntityNavigator.module.css';

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

    // Build category -> entityTypes map with order info
    // Map category -> array of {entityType, order}
    const categoryMap = new Map<string, Array<{ entityType: string; order: number }>>();
    const categorized = new Set<string>();

    for (const config of entityConfigs) {
      if (config.category && existingEntityTypes.includes(config.entityType)) {
        if (!categoryMap.has(config.category)) {
          categoryMap.set(config.category, []);
        }
        categoryMap.get(config.category)!.push({
          entityType: config.entityType,
          order: config.order ?? 999
        });
        categorized.add(config.entityType);
      }
    }

    // Build ordered category groups, sorting entity types within each category
    const groups: CategoryGroup[] = categories
      .filter(cat => categoryMap.has(cat.name))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
      .map(cat => {
        const entityTypesWithOrder = categoryMap.get(cat.name) ?? [];
        // Sort by order, then alphabetically by entityType as tiebreaker
        entityTypesWithOrder.sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.entityType.localeCompare(b.entityType);
        });
        return {
          category: cat,
          entityTypes: entityTypesWithOrder.map(e => e.entityType)
        };
      });

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

  // Auto-expand category and entity type group when selection changes externally
  // (e.g., navigation from diagnostics log, relationship graph, or bundle overview)
  useEffect(() => {
    const entityTypeToReveal = selected?.entityType ?? selectedType;
    if (!entityTypeToReveal || !bundle?.bundleTypeDefinition) return;

    // Find which category contains this entity type
    const entityConfigs = bundle.bundleTypeDefinition.entities ?? [];
    const config = entityConfigs.find(c => c.entityType === entityTypeToReveal);
    const categoryName = config?.category;

    // Expand the category containing this entity type
    if (categoryName) {
      setCollapsedCategories(prev => {
        if (prev.has(categoryName)) {
          const next = new Set(prev);
          next.delete(categoryName);
          return next;
        }
        return prev;
      });
    } else if (uncategorizedTypes.includes(entityTypeToReveal)) {
      // Handle uncategorized types
      setCollapsedCategories(prev => {
        if (prev.has('__uncategorized')) {
          const next = new Set(prev);
          next.delete('__uncategorized');
          return next;
        }
        return prev;
      });
    }

    // Expand the entity type group (if an entity is selected)
    if (selected) {
      setCollapsedGroups(prev => {
        if (prev.has(entityTypeToReveal)) {
          const next = new Set(prev);
          next.delete(entityTypeToReveal);
          return next;
        }
        return prev;
      });
    }
  }, [selected, selectedType, bundle?.bundleTypeDefinition, uncategorizedTypes]);

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
      <div className={styles.navigator}>
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>📦</div>
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
        className={styles.group}
        data-type={entityType}
      >
        <div className={`${styles.groupHeaderWrapper} ${isTypeSelected ? styles.groupHeaderWrapperSelected : ''}`}>
          <button
            type="button"
            className={styles.groupChevronBtn}
            onClick={(e) => toggleGroup(entityType, e)}
            data-testid={`entity-group-chevron-${entityType}`}
            aria-label={isCollapsed ? `Expand ${displayName}` : `Collapse ${displayName}`}
          >
            <span className={`${styles.groupChevron} ${isCollapsed ? styles.groupChevronCollapsed : ''}`}>▸</span>
          </button>
          <button
            type="button"
            className={styles.groupHeader}
            onClick={() => handleTypeClick(entityType)}
            data-testid={`entity-group-${entityType}`}
          >
            {icon && <span className={styles.groupIcon}>{icon}</span>}
            <span className={styles.groupName}>{displayName}</span>
            <span className={styles.groupCount}>{count}</span>
          </button>
        </div>
        {!isCollapsed && (
          <ul className={styles.list}>
            {entities.map((entity) => {
              const isSelected =
                selected?.entityType === entity.entityType && selected?.id === entity.id;
              return (
                <li key={entity.id} className={styles.item}>
                  <button
                    type="button"
                    className={`${styles.entityBtn} ${isSelected ? styles.entityBtnSelected : ''}`}
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
    <div className={styles.navigator} data-testid="entity-navigator">
      {/* Bundle header */}
      <button
        type="button"
        className={`${styles.bundleNavHeader} ${selectedBundle ? styles.bundleNavHeaderSelected : ''}`}
        onClick={handleBundleClick}
        data-testid="bundle-header"
      >
        <span className={styles.bundleNavIcon}>📦</span>
        <span className={styles.bundleNavName}>{bundleName}</span>
        <span className={styles.bundleNavCount}>{totalEntities}</span>
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
                className={styles.category}
                data-category={category.name}
              >
                <button
                  type="button"
                  className={styles.categoryHeader}
                  onClick={(e) => toggleCategory(category.name, e)}
                  data-testid={`category-${category.name}`}
                >
                  <span className={styles.categoryChevron}>
                    {isCategoryCollapsed ? '▸' : '▾'}
                  </span>
                  {category.icon && (
                    <span className={styles.categoryIcon}>{category.icon}</span>
                  )}
                  <span className={styles.categoryName}>{category.displayName}</span>
                  <span className={styles.categoryCount}>{categoryEntityCount}</span>
                </button>
                {!isCategoryCollapsed && (
                  <div className={styles.categoryContent}>
                    {entityTypes.map(renderEntityTypeGroup)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Render uncategorized entity types if any */}
          {uncategorizedTypes.length > 0 && (
            <div
              className={styles.category}
              data-category="uncategorized"
            >
              <button
                type="button"
                className={styles.categoryHeader}
                onClick={(e) => toggleCategory('__uncategorized', e)}
                data-testid="category-uncategorized"
              >
                <span className={styles.categoryChevron}>
                  {collapsedCategories.has('__uncategorized') ? '▸' : '▾'}
                </span>
                <span className={styles.categoryIcon}>📁</span>
                <span className={styles.categoryName}>Uncategorized</span>
                <span className={styles.categoryCount}>
                  {uncategorizedTypes.reduce(
                    (sum, et) => sum + (bundle.entities[et]?.length ?? 0),
                    0
                  )}
                </span>
              </button>
              {!collapsedCategories.has('__uncategorized') && (
                <div className={styles.categoryContent}>
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

