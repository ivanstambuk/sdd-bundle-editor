import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

export interface BottomPanelTab {
    id: string;
    label: string;
    badge?: number | string;
    badgeType?: 'default' | 'warning' | 'error' | 'success';
    content: ReactNode;
}

interface TabbedBottomPanelProps {
    tabs: BottomPanelTab[];
    defaultTab?: string;
    defaultHeight?: number;
    minHeight?: number;
    maxHeight?: number;
    storageKey?: string;
    /** Controlled: external active tab */
    activeTab?: string;
    /** Controlled: callback when tab changes */
    onActiveTabChange?: (tabId: string) => void;
    /** Controlled: external collapsed state */
    isCollapsed?: boolean;
    /** Controlled: callback when collapsed changes */
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function TabbedBottomPanel({
    tabs,
    defaultTab,
    defaultHeight = 200,
    minHeight = 36,
    maxHeight = 500,
    storageKey = 'bottom-panel',
    activeTab: controlledActiveTab,
    onActiveTabChange,
    isCollapsed: controlledIsCollapsed,
    onCollapsedChange,
}: TabbedBottomPanelProps) {
    // Determine if we're in controlled mode
    const isTabControlled = controlledActiveTab !== undefined;
    const isCollapsedControlled = controlledIsCollapsed !== undefined;

    // Load persisted state
    const getInitialHeight = () => {
        try {
            const saved = localStorage.getItem(`${storageKey}-height`);
            if (saved) {
                const height = parseInt(saved, 10);
                if (!isNaN(height) && height >= minHeight && height <= maxHeight) {
                    return height;
                }
            }
        } catch { /* ignore */ }
        return defaultHeight;
    };

    const getInitialCollapsed = () => {
        if (isCollapsedControlled) return controlledIsCollapsed;
        try {
            const saved = localStorage.getItem(`${storageKey}-collapsed`);
            return saved === 'true';
        } catch { /* ignore */ }
        return false;
    };

    const getInitialTab = () => {
        if (isTabControlled) return controlledActiveTab;
        try {
            const saved = localStorage.getItem(`${storageKey}-tab`);
            if (saved && tabs.some(t => t.id === saved)) {
                return saved;
            }
        } catch { /* ignore */ }
        return defaultTab || tabs[0]?.id || '';
    };

    const [height, setHeight] = useState(getInitialHeight);
    const [internalCollapsed, setInternalCollapsed] = useState(getInitialCollapsed);
    const [internalActiveTab, setInternalActiveTab] = useState(getInitialTab);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const startHeight = useRef(0);

    // Use controlled or internal state
    const isCollapsed = isCollapsedControlled ? controlledIsCollapsed : internalCollapsed;
    const activeTab = isTabControlled ? controlledActiveTab : internalActiveTab;

    // Persist state (only for uncontrolled mode)
    useEffect(() => {
        try {
            localStorage.setItem(`${storageKey}-height`, String(height));
            if (!isCollapsedControlled) {
                localStorage.setItem(`${storageKey}-collapsed`, String(isCollapsed));
            }
            if (!isTabControlled) {
                localStorage.setItem(`${storageKey}-tab`, activeTab);
            }
        } catch { /* ignore */ }
    }, [height, isCollapsed, activeTab, storageKey, isCollapsedControlled, isTabControlled]);

    // Handle resize drag
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        startY.current = e.clientY;
        startHeight.current = height;
    }, [height]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const delta = startY.current - e.clientY;
            const newHeight = Math.min(maxHeight, Math.max(minHeight + 40, startHeight.current + delta));
            setHeight(newHeight);
            if (isCollapsed && newHeight > minHeight + 40) {
                if (isCollapsedControlled) {
                    onCollapsedChange?.(false);
                } else {
                    setInternalCollapsed(false);
                }
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, isCollapsed, isCollapsedControlled, onCollapsedChange, minHeight, maxHeight]);

    const toggleCollapse = useCallback(() => {
        if (isCollapsedControlled) {
            onCollapsedChange?.(!isCollapsed);
        } else {
            setInternalCollapsed(prev => !prev);
        }
    }, [isCollapsedControlled, isCollapsed, onCollapsedChange]);

    const handleTabClick = useCallback((tabId: string) => {
        if (isCollapsed) {
            if (isCollapsedControlled) {
                onCollapsedChange?.(false);
            } else {
                setInternalCollapsed(false);
            }
        }
        if (isTabControlled) {
            onActiveTabChange?.(tabId);
        } else {
            setInternalActiveTab(tabId);
        }
    }, [isCollapsed, isCollapsedControlled, isTabControlled, onCollapsedChange, onActiveTabChange]);

    // Keyboard shortcut: Ctrl+J to toggle
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'j') {
                e.preventDefault();
                toggleCollapse();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [toggleCollapse]);

    const displayHeight = isCollapsed ? minHeight : height;
    const activeTabContent = tabs.find(t => t.id === activeTab)?.content;

    return (
        <div
            ref={panelRef}
            className={`tabbed-bottom-panel ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
            style={{ height: displayHeight }}
        >
            {/* Resize handle */}
            <div
                className="resize-handle"
                onMouseDown={handleMouseDown}
                title="Drag to resize"
            />

            {/* Tab bar */}
            <div className="panel-tab-bar">
                <div className="panel-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleTabClick(tab.id)}
                            data-testid={`panel-tab-${tab.id}`}
                        >
                            <span className="tab-label">{tab.label}</span>
                            {tab.badge !== undefined && (
                                <span className={`tab-badge ${tab.badgeType || 'default'}`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="panel-actions">
                    <span className="panel-shortcut">Ctrl+J</span>
                    <button
                        type="button"
                        className="panel-collapse-btn"
                        onClick={toggleCollapse}
                        data-testid="bottom-panel-toggle"
                        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
                    >
                        {isCollapsed ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {/* Tab content */}
            {!isCollapsed && (
                <div className="panel-content">
                    {activeTabContent}
                </div>
            )}
        </div>
    );
}
