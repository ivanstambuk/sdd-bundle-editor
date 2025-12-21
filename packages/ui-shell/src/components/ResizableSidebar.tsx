import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ResizableSidebar.module.css';

interface ResizableSidebarProps {
    children: React.ReactNode;
    isCollapsed: boolean;
    minWidth?: number;
    maxWidth?: number;
    defaultWidth?: number;
}

const STORAGE_KEY = 'sdd-sidebar-width';

export function ResizableSidebar({
    children,
    isCollapsed,
    minWidth = 200,
    maxWidth = 500,
    defaultWidth = 280,
}: ResizableSidebarProps) {
    const [width, setWidth] = useState(() => {
        // Load from localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (parsed >= minWidth && parsed <= maxWidth) {
                return parsed;
            }
        }
        return defaultWidth;
    });

    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Save width to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, width.toString());
    }, [width]);

    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing && sidebarRef.current) {
                const newWidth = e.clientX;
                if (newWidth >= minWidth && newWidth <= maxWidth) {
                    setWidth(newWidth);
                }
            }
        },
        [isResizing, minWidth, maxWidth]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            // Prevent text selection during resize
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isResizing, resize, stopResizing]);

    return (
        <aside
            ref={sidebarRef}
            className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}
            style={{ width: isCollapsed ? '50px' : `${width}px` }}
        >
            {children}
            {!isCollapsed && (
                <div
                    className={styles.resizeHandle}
                    onMouseDown={startResizing}
                    data-testid="sidebar-resize-handle"
                />
            )}
        </aside>
    );
}

