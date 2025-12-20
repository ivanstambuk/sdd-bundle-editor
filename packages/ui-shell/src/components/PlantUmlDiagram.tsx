import React, { useState, useEffect } from 'react';

interface PlantUmlDiagramProps {
    /** The PlantUML source code (without the fenced code block markers) */
    code: string;
    /** Optional alt text for the diagram */
    alt?: string;
}

/**
 * PlantUmlDiagram - Renders a PlantUML diagram inline.
 * 
 * Uses the server-side /api/plantuml endpoint to generate SVG from PlantUML source.
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

    useEffect(() => {
        let cancelled = false;

        async function render() {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/plantuml', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
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
    }, [code]);

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
