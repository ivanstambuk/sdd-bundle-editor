import React, { useState, useEffect, useCallback } from 'react';
import styles from './ThemeToggle.module.css';

type Theme = 'dark' | 'light';

/**
 * Theme toggle button component.
 * - Defaults to dark theme
 * - Persists preference to localStorage
 * - Provides smooth visual transition via CSS
 */
export const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<Theme>(() => {
        // Check localStorage for saved preference, default to dark
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('sdd:theme');
            if (stored === 'light' || stored === 'dark') {
                return stored;
            }
        }
        return 'dark';
    });

    // Apply theme to document on mount and when theme changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('sdd:theme', theme);
    }, [theme]);

    // Initialize theme on mount (handles SSR edge case)
    useEffect(() => {
        const stored = localStorage.getItem('sdd:theme');
        if (stored === 'light' || stored === 'dark') {
            document.documentElement.setAttribute('data-theme', stored);
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    }, []);

    return (
        <button
            className={styles.button}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
            {theme === 'dark' ? '☀️' : '🌙'}
        </button>
    );
};

