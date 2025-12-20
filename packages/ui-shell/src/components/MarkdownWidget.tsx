import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlantUmlDiagram } from './PlantUmlDiagram';

interface MarkdownWidgetProps {
    id: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
    disabled?: boolean;
    readonly?: boolean;
    placeholder?: string;
}

/**
 * Custom code block renderer that handles PlantUML diagrams.
 * Other code blocks are rendered normally with syntax highlighting.
 */
function CodeBlock({ node, className, children, ...props }: any) {
    // Extract language from className (e.g., "language-plantuml")
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    // Render PlantUML diagrams inline
    if (language === 'plantuml' || language === 'puml') {
        const code = String(children).replace(/\n$/, '');
        return <PlantUmlDiagram code={code} />;
    }

    // Default code block rendering
    return (
        <code className={className} {...props}>
            {children}
        </code>
    );
}

/**
 * Custom pre block renderer that handles PlantUML and Mermaid diagrams.
 */
function PreBlock({ children, ...props }: any) {
    // Check if this is a PlantUML code block
    const childArray = React.Children.toArray(children);
    const childElement = childArray[0];

    // Type guard: check if it's a valid React element with props
    if (React.isValidElement(childElement)) {
        const childProps = childElement.props as Record<string, unknown>;
        const className = typeof childProps.className === 'string' ? childProps.className : '';
        const match = /language-(plantuml|puml)/.exec(className);
        if (match) {
            // Don't wrap PlantUML in <pre>, the CodeBlock handles it
            return <>{children}</>;
        }
    }

    // Default pre block
    return <pre {...props}>{children}</pre>;
}

/**
 * A Markdown-aware text widget for RJSF forms.
 * 
 * - In read-only mode: renders formatted Markdown with proper styling
 * - In edit mode: shows a textarea with a toggle to preview
 * 
 * Use by setting `format: "markdown"` or `displayHint: "markdown"` in the JSON schema.
 * 
 * Supports GitHub Flavored Markdown (GFM) including:
 * - Tables
 * - Strikethrough (~~text~~)
 * - Task lists (- [ ] item)
 * - Autolinks
 * 
 * Also supports PlantUML diagrams in fenced code blocks:
 * ```plantuml
 * @startuml
 * Alice -> Bob: Hello
 * @enduml
 * ```
 */
export function MarkdownWidget(props: MarkdownWidgetProps) {
    const { id, value, onChange, disabled, readonly, placeholder } = props;
    const [showPreview, setShowPreview] = useState(false);

    const textValue = value ?? '';
    const isReadOnly = disabled || readonly;

    // Custom components for ReactMarkdown
    const components = {
        code: CodeBlock,
        pre: PreBlock,
    };

    // In read-only mode, just render the markdown
    if (isReadOnly) {
        if (!textValue.trim()) {
            return (
                <div className="markdown-widget markdown-empty">
                    <em className="text-muted">No content</em>
                </div>
            );
        }

        return (
            <div className="markdown-widget markdown-readonly">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {textValue}
                </ReactMarkdown>
            </div>
        );
    }

    // Edit mode: textarea with preview toggle
    return (
        <div className="markdown-widget markdown-editable">
            <div className="markdown-toolbar">
                <button
                    type="button"
                    className={`markdown-toggle ${!showPreview ? 'active' : ''}`}
                    onClick={() => setShowPreview(false)}
                >
                    ✏️ Edit
                </button>
                <button
                    type="button"
                    className={`markdown-toggle ${showPreview ? 'active' : ''}`}
                    onClick={() => setShowPreview(true)}
                >
                    👁️ Preview
                </button>
            </div>

            {showPreview ? (
                <div className="markdown-preview">
                    {textValue.trim() ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                            {textValue}
                        </ReactMarkdown>
                    ) : (
                        <em className="text-muted">Nothing to preview</em>
                    )}
                </div>
            ) : (
                <textarea
                    id={id}
                    value={textValue}
                    onChange={(e) => onChange(e.target.value || undefined)}
                    placeholder={placeholder || 'Enter markdown text...'}
                    className="markdown-textarea"
                    rows={6}
                />
            )}
        </div>
    );
}
