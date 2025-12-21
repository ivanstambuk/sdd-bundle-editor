import styles from './SearchResultsPanel.module.css';

export interface SearchResult {
    entityType: string;
    entityId: string;
    field: string;
    match: string;
    context: string;
}

interface SearchResultsPanelProps {
    query: string;
    results: SearchResult[];
    onNavigate: (entityType: string, entityId: string) => void;
    isSearching?: boolean;
}

export function SearchResultsPanel({
    query,
    results,
    onNavigate,
    isSearching = false
}: SearchResultsPanelProps) {
    if (!query) {
        return (
            <div className={styles.panel}>
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>🔍</span>
                    <span>Enter a search query to find entities across the bundle.</span>
                </div>
            </div>
        );
    }

    if (isSearching) {
        return (
            <div className={styles.panel}>
                <div className={styles.loading}>
                    <span className={styles.spinner}>⏳</span>
                    <span>Searching for "{query}"...</span>
                </div>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className={styles.panel}>
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>😕</span>
                    <span>No results found for "{query}"</span>
                </div>
            </div>
        );
    }

    // Group results by entity
    const grouped = results.reduce((acc, result) => {
        const key = `${result.entityType}:${result.entityId}`;
        if (!acc[key]) {
            acc[key] = {
                entityType: result.entityType,
                entityId: result.entityId,
                matches: [],
            };
        }
        acc[key].matches.push(result);
        return acc;
    }, {} as Record<string, { entityType: string; entityId: string; matches: SearchResult[] }>);

    const groups = Object.values(grouped);

    return (
        <div className={styles.panel}>
            <div className={styles.summary}>
                Found {results.length} match{results.length !== 1 ? 'es' : ''} in {groups.length} entit{groups.length !== 1 ? 'ies' : 'y'}
            </div>
            <div className={styles.list}>
                {groups.map(group => (
                    <div key={`${group.entityType}:${group.entityId}`} className={styles.group}>
                        <button
                            type="button"
                            className={styles.header}
                            onClick={() => onNavigate(group.entityType, group.entityId)}
                            data-testid={`search-result-${group.entityId}`}
                        >
                            <span className={styles.entityType}>{group.entityType}</span>
                            <span className={styles.entityId}>{group.entityId}</span>
                            <span className={styles.matchCount}>({group.matches.length})</span>
                        </button>
                        <ul className={styles.matches}>
                            {group.matches.slice(0, 3).map((match, idx) => (
                                <li key={idx} className={styles.match}>
                                    <span className={styles.matchField}>{match.field}:</span>
                                    <span
                                        className={styles.matchContext}
                                        dangerouslySetInnerHTML={{
                                            __html: highlightMatch(match.context, match.match)
                                        }}
                                    />
                                </li>
                            ))}
                            {group.matches.length > 3 && (
                                <li className={styles.more}>
                                    +{group.matches.length - 3} more matches
                                </li>
                            )}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}


function highlightMatch(context: string, match: string): string {
    if (!match) return escapeHtml(context);
    const regex = new RegExp(`(${escapeRegex(match)})`, 'gi');
    return escapeHtml(context).replace(regex, '<mark>$1</mark>');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
