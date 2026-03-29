import mermaid from 'mermaid';
import React, { useEffect, useId, useState } from 'react';
import styles from './MermaidDiagram.module.css';

interface MermaidDiagramProps {
    code: string;
    alt?: string;
}

function detectTheme(): 'dark' | 'light' {
    const htmlTheme = document.documentElement.getAttribute('data-theme');
    const bodyTheme = document.body.getAttribute('data-theme');

    if (htmlTheme === 'dark' || bodyTheme === 'dark') {
        return 'dark';
    }
    if (htmlTheme === 'light' || bodyTheme === 'light') {
        return 'light';
    }
    if (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark')
    ) {
        return 'dark';
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

export function MermaidDiagram({ code, alt }: MermaidDiagramProps) {
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>(detectTheme);
    const renderId = useId().replace(/:/g, '-');

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => setTheme(detectTheme());

        mediaQuery.addEventListener('change', handleChange);

        const observer = new MutationObserver(handleChange);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme', 'class'],
        });

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function renderDiagram() {
            setLoading(true);
            setError(null);

            try {
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'strict',
                    theme: theme === 'dark' ? 'dark' : 'default',
                });

                const { svg: renderedSvg } = await mermaid.render(`mermaid-${renderId}`, code.trim());
                if (cancelled) {
                    return;
                }
                setSvg(renderedSvg);
            } catch (err) {
                if (cancelled) {
                    return;
                }
                setSvg(null);
                setError(err instanceof Error ? err.message : 'Failed to render Mermaid diagram');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        renderDiagram();

        return () => {
            cancelled = true;
        };
    }, [code, renderId, theme]);

    if (loading) {
        return (
            <div className={`${styles.diagram} ${styles.loading}`}>
                <span>Rendering Mermaid diagram...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${styles.diagram} ${styles.error}`}>
                <div className={styles.errorHeader}>
                    <span>Failed to render Mermaid diagram</span>
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
            aria-label={alt || 'Mermaid diagram'}
        />
    );
}
