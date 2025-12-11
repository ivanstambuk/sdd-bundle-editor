/**
 * Custom hook for managing keyboard shortcuts.
 * Provides a declarative way to register global keyboard shortcuts.
 */

import { useEffect } from 'react';

export interface ShortcutConfig {
    /** The key to listen for (lowercase) */
    key: string;
    /** Require Ctrl/Cmd modifier */
    ctrl?: boolean;
    /** Require Meta (Cmd on Mac) modifier */
    meta?: boolean;
    /** Require Shift modifier */
    shift?: boolean;
    /** Handler function to call when shortcut is triggered */
    handler: () => void;
    /** Human-readable description for documentation */
    description?: string;
}

/**
 * Hook for registering global keyboard shortcuts.
 * 
 * @param shortcuts Array of shortcut configurations
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'j', ctrl: true, handler: togglePanel, description: 'Toggle Panel' },
 *   { key: 'b', ctrl: true, handler: toggleSidebar, description: 'Toggle Sidebar' },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]): void {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.ctrlKey || e.metaKey;

            for (const shortcut of shortcuts) {
                const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
                const ctrlMatch = shortcut.ctrl ? isMod : true;
                const metaMatch = shortcut.meta ? e.metaKey : true;
                const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey || shortcut.shift === undefined;

                if (keyMatch && ctrlMatch && metaMatch && (shortcut.shift === undefined || shiftMatch)) {
                    e.preventDefault();
                    shortcut.handler();
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
}

/**
 * Get human-readable shortcut string for display.
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.meta) parts.push('⌘');
    if (shortcut.shift) parts.push('Shift');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
}
