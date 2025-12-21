import styles from './DomainKnowledgePanel.module.css';

export interface DomainKnowledgePanelProps {
    content: string;
}

export function DomainKnowledgePanel({ content }: DomainKnowledgePanelProps) {
    return (
        <div className={styles.panel}>
            <h2 className={styles.title}>Domain Knowledge</h2>
            <div className={styles.content}>
                {/* Simple rendering preserving whitespace. In a real app, use react-markdown here. */}
                <pre className={styles.viewer}>{content}</pre>
            </div>
        </div>
    );
}

