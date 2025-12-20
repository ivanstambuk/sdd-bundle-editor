/**
 * GraphFilterDropdown - Multi-select dropdown for filtering entity types in the relationship graph.
 * Groups entity types by category with "select all" shortcuts per category.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { BundleTypeEntityConfig, BundleTypeCategoryConfig } from '@sdd-bundle-editor/shared-types';

interface GraphFilterDropdownProps {
    /** All entity type configurations */
    entityConfigs: BundleTypeEntityConfig[];
    /** Category configurations for grouping */
    categories?: BundleTypeCategoryConfig[];
    /** Currently selected entity types (empty = show all) */
    selectedTypes: Set<string>;
    /** Callback when selection changes */
    onSelectionChange: (selected: Set<string>) => void;
}

interface GroupedEntityTypes {
    category: BundleTypeCategoryConfig | null;
    types: BundleTypeEntityConfig[];
}

export function GraphFilterDropdown({
    entityConfigs,
    categories,
    selectedTypes,
    onSelectionChange,
}: GraphFilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Group entity types by category
    const groupedTypes: GroupedEntityTypes[] = (() => {
        if (!categories || categories.length === 0) {
            // No categories - single uncategorized group
            return [{ category: null, types: entityConfigs }];
        }

        const categoryMap = new Map<string, BundleTypeCategoryConfig>();
        categories.forEach(cat => categoryMap.set(cat.name, cat));

        const groups: Map<string | null, BundleTypeEntityConfig[]> = new Map();

        // Initialize groups for each category
        categories.forEach(cat => groups.set(cat.name, []));
        groups.set(null, []); // Uncategorized

        // Sort entities into groups
        entityConfigs.forEach(config => {
            const catId = config.category || null;
            const group = groups.get(catId) || groups.get(null)!;
            group.push(config);
        });

        // Build result array with categories in order
        const result: GroupedEntityTypes[] = [];
        categories.forEach(cat => {
            const types = groups.get(cat.name) || [];
            if (types.length > 0) {
                result.push({ category: cat, types });
            }
        });

        // Add uncategorized at the end if any
        const uncategorized = groups.get(null) || [];
        if (uncategorized.length > 0) {
            result.push({ category: null, types: uncategorized });
        }

        return result;
    })();

    // Check if all types are selected (or none selected = show all)
    const allSelected = selectedTypes.size === 0 || selectedTypes.size === entityConfigs.length;
    const someSelected = selectedTypes.size > 0 && selectedTypes.size < entityConfigs.length;

    // Toggle a single entity type
    const toggleType = useCallback((entityType: string) => {
        const newSelection = new Set(selectedTypes);
        if (newSelection.has(entityType)) {
            newSelection.delete(entityType);
        } else {
            newSelection.add(entityType);
        }
        onSelectionChange(newSelection);
    }, [selectedTypes, onSelectionChange]);

    // Toggle all types in a category
    const toggleCategory = useCallback((categoryId: string | null) => {
        const typesInCategory = entityConfigs
            .filter(c => (c.category || null) === categoryId)
            .map(c => c.entityType);

        const allInCategorySelected = typesInCategory.every(t => selectedTypes.has(t));
        const newSelection = new Set(selectedTypes);

        if (allInCategorySelected) {
            // Deselect all in category
            typesInCategory.forEach(t => newSelection.delete(t));
        } else {
            // Select all in category
            typesInCategory.forEach(t => newSelection.add(t));
        }

        onSelectionChange(newSelection);
    }, [entityConfigs, selectedTypes, onSelectionChange]);

    // Select all types
    const selectAll = useCallback(() => {
        onSelectionChange(new Set()); // Empty = show all
    }, [onSelectionChange]);

    // Clear selection (also shows all)
    const clearSelection = useCallback(() => {
        onSelectionChange(new Set());
    }, [onSelectionChange]);

    // Get summary text
    const getSummaryText = () => {
        if (selectedTypes.size === 0) {
            return `All ${entityConfigs.length} types`;
        }
        return `${selectedTypes.size} of ${entityConfigs.length} types`;
    };

    // Check if a category has all its types selected
    const isCategoryFullySelected = (categoryId: string | null): boolean => {
        if (selectedTypes.size === 0) return true; // Show all mode
        const typesInCategory = entityConfigs
            .filter(c => (c.category || null) === categoryId)
            .map(c => c.entityType);
        return typesInCategory.every(t => selectedTypes.has(t));
    };

    // Check if a category has some types selected
    const isCategoryPartiallySelected = (categoryId: string | null): boolean => {
        if (selectedTypes.size === 0) return false;
        const typesInCategory = entityConfigs
            .filter(c => (c.category || null) === categoryId)
            .map(c => c.entityType);
        const selectedInCategory = typesInCategory.filter(t => selectedTypes.has(t));
        return selectedInCategory.length > 0 && selectedInCategory.length < typesInCategory.length;
    };

    return (
        <div className="graph-filter-dropdown" ref={dropdownRef}>
            <button
                className={`graph-filter-trigger ${someSelected ? 'has-filter' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <span className="graph-filter-icon">🔍</span>
                <span className="graph-filter-text">{getSummaryText()}</span>
                <span className={`graph-filter-chevron ${isOpen ? 'open' : ''}`}>▾</span>
            </button>

            {isOpen && (
                <div className="graph-filter-panel" role="listbox">
                    {/* Header actions */}
                    <div className="graph-filter-actions">
                        <button
                            className="graph-filter-action"
                            onClick={selectAll}
                            disabled={allSelected}
                        >
                            Show All
                        </button>
                        <button
                            className="graph-filter-action"
                            onClick={clearSelection}
                            disabled={selectedTypes.size === 0}
                        >
                            Reset
                        </button>
                    </div>

                    {/* Category groups */}
                    <div className="graph-filter-groups">
                        {groupedTypes.map((group, groupIndex) => {
                            const categoryId = group.category?.name || null;
                            const categoryLabel = group.category?.displayName || 'Other';
                            const isFullySelected = isCategoryFullySelected(categoryId);
                            const isPartiallySelected = isCategoryPartiallySelected(categoryId);

                            return (
                                <div key={groupIndex} className="graph-filter-group">
                                    {/* Category header */}
                                    <button
                                        className="graph-filter-category"
                                        onClick={() => toggleCategory(categoryId)}
                                    >
                                        <span className={`graph-filter-checkbox ${isFullySelected ? 'checked' : ''} ${isPartiallySelected ? 'partial' : ''}`}>
                                            {isFullySelected ? '✓' : isPartiallySelected ? '−' : ''}
                                        </span>
                                        <span className="graph-filter-category-label">{categoryLabel}</span>
                                        <span className="graph-filter-category-count">
                                            ({group.types.length})
                                        </span>
                                    </button>

                                    {/* Entity types in category */}
                                    <div className="graph-filter-items">
                                        {group.types.map(config => {
                                            const isSelected = selectedTypes.size === 0 || selectedTypes.has(config.entityType);
                                            return (
                                                <label
                                                    key={config.entityType}
                                                    className="graph-filter-item"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleType(config.entityType)}
                                                    />
                                                    <span
                                                        className="graph-filter-color"
                                                        style={{ backgroundColor: config.color || '#7aa2f7' }}
                                                    />
                                                    <span className="graph-filter-label">
                                                        {config.entityType}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
