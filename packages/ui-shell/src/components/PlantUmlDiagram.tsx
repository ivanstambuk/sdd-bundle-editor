import React, { useState, useEffect } from 'react';
import styles from './PlantUmlDiagram.module.css';

interface PlantUmlDiagramProps {
    /** The PlantUML source code (without the fenced code block markers) */
    code: string;
    /** Optional alt text for the diagram */
    alt?: string;
}

/**
 * Detect the current UI theme (dark or light)
 * Checks data-theme attribute on html/body, then falls back to prefers-color-scheme
 */
function detectTheme(): 'dark' | 'light' {
    // Check for data-theme attribute on html or body
    const htmlTheme = document.documentElement.getAttribute('data-theme');
    const bodyTheme = document.body.getAttribute('data-theme');

    if (htmlTheme === 'dark' || bodyTheme === 'dark') {
        return 'dark';
    }
    if (htmlTheme === 'light' || bodyTheme === 'light') {
        return 'light';
    }

    // Check for dark class on html/body
    if (document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark')) {
        return 'dark';
    }

    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }

    return 'light';
}

/**
 * PlantUmlDiagram - Renders a PlantUML diagram inline.
 * 
 * Uses the server-side /api/plantuml endpoint to generate SVG from PlantUML source.
 * Automatically detects dark/light theme and requests appropriate styling.
 * This is for the web UI only - AI clients can use local plantuml CLI.
 * 
 * @example
 * ```tsx
 * <PlantUmlDiagram code="@startuml\nAlice -> Bob: Hello\n@enduml" />
 * ```
 */
export function PlantUmlDiagram({ code, alt }: PlantUmlDiagramProps) {
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>(detectTheme);

    // Listen for theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => setTheme(detectTheme());

        mediaQuery.addEventListener('change', handleChange);

        // Also watch for data-theme attribute changes
        const observer = new MutationObserver(handleChange);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme', 'class']
        });

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        /**
         * Compute SHA-256 hash of code + theme for cache key
         * Uses Web Crypto API (available in all modern browsers)
         */
        async function computeHash(code: string, theme: 'dark' | 'light'): Promise<string> {
            const content = `${theme}:${code.trim()}`;
            // crypto.subtle is only available in secure contexts (HTTPS / localhost with some browsers).
            // Fall back to a simple djb2 hash for non-secure HTTP origins.
            if (typeof window !== 'undefined' && window.crypto?.subtle) {
                const encoder = new TextEncoder();
                const data = encoder.encode(content);
                const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                return hashHex.slice(0, 16);
            }
            // Fallback: djb2 hash (good enough for cache key, server re-validates)
            let h = 5381;
            for (let i = 0; i < content.length; i++) {
                h = ((h << 5) + h) ^ content.charCodeAt(i);
            }
            return (h >>> 0).toString(16).padStart(8, '0').slice(0, 16);
        }

        async function render() {
            setLoading(true);
            setError(null);

            try {
                // Compute hash client-side for cacheable GET request
                const hash = await computeHash(code, theme);

                // Use GET endpoint with hash in URL - browser can cache this!
                // Include code as query param for first-time renders
                const params = new URLSearchParams({
                    code: code,
                    theme: theme,
                });

                const response = await fetch(`/api/plantuml/${hash}?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Accept': 'image/svg+xml' },
                });

                if (cancelled) return;

                if (response.status === 304) {
                    // Not modified - should not happen with browser cache, but handle it
                    return;
                }

                if (!response.ok) {
                    // Error response is JSON
                    const contentType = response.headers.get('content-type');
                    if (contentType?.includes('application/json')) {
                        const data = await response.json();
                        setError(data.error || `HTTP ${response.status}`);
                    } else {
                        setError(`HTTP ${response.status}`);
                    }
                    setSvg(null);
                    return;
                }

                // Success - response is SVG
                const svgContent = await response.text();
                setSvg(svgContent);
                setError(null);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to render diagram');
                setSvg(null);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        render();

        return () => {
            cancelled = true;
        };
    }, [code, theme]);

    if (loading) {
        return (
            <div className={`${styles.diagram} ${styles.loading}`}>
                <div className={styles.spinner}>⏳</div>
                <span>Rendering diagram...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${styles.diagram} ${styles.error}`}>
                <div className={styles.errorHeader}>
                    <span>⚠️ Failed to render PlantUML diagram</span>
                </div>
                <pre className={styles.errorMessage}>{error}</pre>
                <details className={styles.sourceDetails}>
                    <summary>Show source</summary>
                    <pre className={styles.source}>{code}</pre>
                </details>
            </div>
        );
    }

    if (!svg) {
        return null;
    }

    return (
        <div
            className={`${styles.diagram} ${styles.rendered}`}
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label={alt || 'PlantUML diagram'}
        />
    );
}
