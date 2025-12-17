import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownWidgetProps {
    id: string;
    value: string | undefined;
    onChange: (value: string | undefined) => void;
    disabled?: boolean;
    readonly?: boolean;
    placeholder?: string;
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
 */
export function MarkdownWidget(props: MarkdownWidgetProps) {
    const { id, value, onChange, disabled, readonly, placeholder } = props;
    const [showPreview, setShowPreview] = useState(false);

    const textValue = value ?? '';
    const isReadOnly = disabled || readonly;

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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{textValue}</ReactMarkdown>
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
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{textValue}</ReactMarkdown>
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
