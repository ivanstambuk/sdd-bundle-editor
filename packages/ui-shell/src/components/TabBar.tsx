/**
 * TabBar - Reusable horizontal tab bar component.
 * 
 * Used by EntityDetails and BundleOverview for tab navigation.
 * Supports optional badges on tabs for showing counts.
 */

export interface Tab {
    /** Unique identifier for the tab */
    id: string;
    /** Display label (can include emoji) */
    label: string;
    /** Optional badge count to show */
    badge?: number;
    /** Test ID suffix (defaults to id) */
    testId?: string;
}

interface TabBarProps {
    /** Array of tabs to display */
    tabs: Tab[];
    /** Currently active tab ID */
    activeTab: string;
    /** Callback when tab is selected */
    onSelect: (tabId: string) => void;
    /** Optional test ID prefix for the tab bar container */
    testIdPrefix?: string;
}

export function TabBar({ tabs, activeTab, onSelect, testIdPrefix }: TabBarProps) {
    return (
        <div className="entity-tabs" data-testid={testIdPrefix ? `${testIdPrefix}-tabs` : undefined}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`entity-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onSelect(tab.id)}
                    data-testid={testIdPrefix ? `${testIdPrefix}-tab-${tab.testId || tab.id}` : `tab-${tab.testId || tab.id}`}
                >
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="tab-badge">{tab.badge}</span>
                    )}
                </button>
            ))}
        </div>
    );
}
