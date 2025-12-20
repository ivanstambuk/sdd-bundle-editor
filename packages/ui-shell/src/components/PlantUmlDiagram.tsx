import React, { useState, useEffect } from 'react';

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

        async function render() {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/plantuml', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, theme }),
                });

                if (cancelled) return;

                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || `HTTP ${response.status}`);
                    setSvg(null);
                } else if (data.svg) {
                    setSvg(data.svg);
                    setError(null);
                } else {
                    setError('No SVG returned from server');
                }
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
            <div className="plantuml-diagram plantuml-loading">
                <div className="plantuml-spinner">⏳</div>
                <span>Rendering diagram...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="plantuml-diagram plantuml-error">
                <div className="plantuml-error-header">
                    <span>⚠️ Failed to render PlantUML diagram</span>
                </div>
                <pre className="plantuml-error-message">{error}</pre>
                <details className="plantuml-source-details">
                    <summary>Show source</summary>
                    <pre className="plantuml-source">{code}</pre>
                </details>
            </div>
        );
    }

    if (!svg) {
        return null;
    }

    return (
        <div
            className="plantuml-diagram plantuml-rendered"
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label={alt || 'PlantUML diagram'}
        />
    );
}
