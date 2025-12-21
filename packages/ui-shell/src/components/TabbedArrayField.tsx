import { useState, useMemo } from 'react';
import styles from './TabbedArrayField.module.css';

interface TabbedArrayFieldProps {
    /** RJSF items array */
    items: any[];
    /** Form data for the array */
    formData: any[];
    /** Schema for the array */
    schema: any;
    /** Whether the form is read-only */
    readOnly?: boolean;
    /** Whether we can add new items */
    canAdd?: boolean;
    /** Callback to add new item */
    onAddClick?: () => void;
}

/**
 * TabbedArrayField - Renders array items as sub-tabs
 * 
 * Schema hints:
 * - x-sdd-layout: "tabbedArray" - triggers this layout
 * - x-sdd-tabLabelField: "name" - which property to use as tab label (default: "name")
 * - x-sdd-choiceField: "isChosen" - which boolean property indicates the chosen item
 * - x-sdd-chosenLabel: "✓ CHOSEN" - badge text for chosen item
 * - x-sdd-rejectedLabel: "REJECTED" - badge text for unchosen items
 */
export function TabbedArrayField({
    items,
    formData,
    schema,
    readOnly = true,
    canAdd = false,
    onAddClick,
}: TabbedArrayFieldProps) {
    // Read schema hints
    const tabLabelField = schema?.['x-sdd-tabLabelField'] || 'name';
    const choiceField = schema?.['x-sdd-choiceField'] || 'isChosen';

    // Sort items: chosen first, then by original order
    const sortedItems = useMemo(() => {
        if (!Array.isArray(formData) || formData.length === 0) return [];

        const itemsWithIndex = items.map((item, index) => ({
            item,
            index,
            data: formData[index],
            isChosen: formData[index]?.[choiceField] === true,
        }));

        // Sort: chosen first, then preserve original order
        return itemsWithIndex.sort((a, b) => {
            if (a.isChosen && !b.isChosen) return -1;
            if (!a.isChosen && b.isChosen) return 1;
            return a.index - b.index;
        });
    }, [items, formData, choiceField]);

    // Find the default active tab (chosen one, or first)
    const defaultTabIndex = useMemo(() => {
        if (sortedItems.length === 0) return 0;
        const chosenIdx = sortedItems.findIndex(s => s.isChosen);
        return chosenIdx >= 0 ? chosenIdx : 0;
    }, [sortedItems]);

    const [activeTabIndex, setActiveTabIndex] = useState(defaultTabIndex);

    // Handle empty array
    if (!Array.isArray(formData) || formData.length === 0) {
        return (
            <div className={`${styles.container} ${styles.empty}`}>
                <span className={styles.emptyIcon}>📋</span>
                <span>No items</span>
                {canAdd && !readOnly && onAddClick && (
                    <button
                        type="button"
                        className={styles.addButton}
                        onClick={onAddClick}
                    >
                        + Add Item
                    </button>
                )}
            </div>
        );
    }

    const activeItem = sortedItems[activeTabIndex];

    return (
        <div className={styles.container}>
            {/* Tab bar */}
            <div className={styles.tabs}>
                {sortedItems.map((sortedItem, idx) => {
                    const label = sortedItem.data?.[tabLabelField] || `Item ${sortedItem.index + 1}`;
                    const isChosen = sortedItem.isChosen;
                    const isActive = idx === activeTabIndex;

                    return (
                        <button
                            key={sortedItem.item.key || sortedItem.index}
                            type="button"
                            className={`${styles.tab} ${isActive ? styles.tabActive : ''} ${isChosen ? styles.tabChosen : ''}`}
                            onClick={() => setActiveTabIndex(idx)}
                            title={label}
                        >
                            <span className={styles.tabLabel}>{label}</span>
                            {isChosen && (
                                <span className={styles.tabBadge}>✓</span>
                            )}
                        </button>
                    );
                })}

                {/* Add button in tab bar */}
                {canAdd && !readOnly && onAddClick && (
                    <button
                        type="button"
                        className={styles.addTab}
                        onClick={onAddClick}
                        title="Add new item"
                    >
                        +
                    </button>
                )}
            </div>

            {/* Tab content */}
            <div className={styles.content}>
                {/* Render the active item's children */}
                <div className={styles.itemContent}>
                    {activeItem.item.children}
                </div>
            </div>
        </div>
    );
}
