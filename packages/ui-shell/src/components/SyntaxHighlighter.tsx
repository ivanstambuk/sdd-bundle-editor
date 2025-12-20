import { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';

export type SyntaxLanguage = 'yaml' | 'json';

interface SyntaxHighlighterProps {
    /** The code content to highlight */
    content: string;
    /** The language for syntax highlighting */
    language: SyntaxLanguage;
    /** Optional CSS class name for the container */
    className?: string;
    /** Test ID for E2E testing */
    testId?: string;
}

/**
 * SyntaxHighlighter - A reusable component for Prism.js syntax highlighting.
 * Centralizes Prism configuration, language imports, and memoization.
 * 
 * Usage:
 *   <SyntaxHighlighter language="yaml" content={yamlString} />
 *   <SyntaxHighlighter language="json" content={jsonString} />
 */
export function SyntaxHighlighter({ content, language, className, testId }: SyntaxHighlighterProps) {
    const highlightedCode = useMemo(() => {
        if (!content) return '';
        const grammar = Prism.languages[language];
        if (!grammar) {
            console.warn(`SyntaxHighlighter: No Prism grammar found for language "${language}"`);
            return content;
        }
        return Prism.highlight(content, grammar, language);
    }, [content, language]);

    const blockClass = language === 'yaml' ? 'yaml-block' : 'json-block';

    return (
        <pre className={`code-block ${blockClass} ${className || ''}`} data-testid={testId}>
            <code
                className={`language-${language}`}
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
        </pre>
    );
}
