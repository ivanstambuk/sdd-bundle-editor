import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface ResizableBottomPanelProps {
    children: ReactNode;
    title: string;
    badgeCount?: number;
    defaultHeight?: number;
    minHeight?: number;
    maxHeight?: number;
    storageKey?: string;
    autoHide?: boolean;
}

export function ResizableBottomPanel({
    children,
    title,
    badgeCount = 0,
    defaultHeight = 200,
    minHeight = 32, // Height of collapsed header
    maxHeight = 500,
    storageKey = 'bottom-panel-height',
    autoHide = true,
}: ResizableBottomPanelProps) {
    // Load persisted state
    const getInitialHeight = () => {
        try {
            const saved = localStorage.getItem(storageKey);
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
        try {
            const saved = localStorage.getItem(`${storageKey}-collapsed`);
            return saved === 'true';
        } catch { /* ignore */ }
        return false;
    };

    const [height, setHeight] = useState(getInitialHeight);
    const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const startHeight = useRef(0);

    // Auto-hide when no issues
    const shouldHide = autoHide && badgeCount === 0 && isCollapsed;

    // Persist state
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, String(height));
            localStorage.setItem(`${storageKey}-collapsed`, String(isCollapsed));
        } catch { /* ignore */ }
    }, [height, isCollapsed, storageKey]);

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
            const delta = startY.current - e.clientY; // Inverted because we're dragging up
            const newHeight = Math.min(maxHeight, Math.max(minHeight + 40, startHeight.current + delta));
            setHeight(newHeight);
            if (isCollapsed && newHeight > minHeight + 40) {
                setIsCollapsed(false);
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
    }, [isResizing, isCollapsed, minHeight, maxHeight]);

    const toggleCollapse = useCallback(() => {
        setIsCollapsed(prev => !prev);
    }, []);

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

    if (shouldHide) {
        return null;
    }

    const displayHeight = isCollapsed ? minHeight : height;

    return (
        <div
            ref={panelRef}
            className={`resizable-bottom-panel ${isCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
            style={{ height: displayHeight }}
        >
            {/* Resize handle */}
            <div
                className="resize-handle"
                onMouseDown={handleMouseDown}
                title="Drag to resize"
            />

            {/* Panel header */}
            <button
                type="button"
                className="panel-header"
                onClick={toggleCollapse}
                data-testid="bottom-panel-toggle"
            >
                <span className="panel-chevron">{isCollapsed ? '▲' : '▼'}</span>
                <span className="panel-title">{title}</span>
                {badgeCount > 0 && (
                    <span className={`panel-badge ${badgeCount > 0 ? 'has-issues' : ''}`}>
                        {badgeCount} {badgeCount === 1 ? 'issue' : 'issues'}
                    </span>
                )}
                {badgeCount === 0 && (
                    <span className="panel-badge success">✓ No issues</span>
                )}
                <span className="panel-shortcut">Ctrl+J</span>
            </button>

            {/* Panel content */}
            {!isCollapsed && (
                <div className="panel-content">
                    {children}
                </div>
            )}
        </div>
    );
}
