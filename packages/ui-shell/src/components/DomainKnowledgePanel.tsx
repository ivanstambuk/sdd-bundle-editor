export interface DomainKnowledgePanelProps {
    content: string;
}

export function DomainKnowledgePanel({ content }: DomainKnowledgePanelProps) {
    return (
        <div className="domain-knowledge-panel">
            <h2 className="panel-title">Domain Knowledge</h2>
            <div className="domain-content">
                {/* Simple rendering preserving whitespace. In a real app, use react-markdown here. */}
                <pre className="markdown-viewer">{content}</pre>
            </div>
        </div>
    );
}
