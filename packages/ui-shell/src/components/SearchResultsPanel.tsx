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
            <div className="search-results-panel">
                <div className="search-empty">
                    <span className="search-empty-icon">🔍</span>
                    <span>Enter a search query to find entities across the bundle.</span>
                </div>
            </div>
        );
    }

    if (isSearching) {
        return (
            <div className="search-results-panel">
                <div className="search-loading">
                    <span className="search-spinner">⏳</span>
                    <span>Searching for "{query}"...</span>
                </div>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="search-results-panel">
                <div className="search-empty">
                    <span className="search-empty-icon">😕</span>
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
        <div className="search-results-panel">
            <div className="search-summary">
                Found {results.length} match{results.length !== 1 ? 'es' : ''} in {groups.length} entit{groups.length !== 1 ? 'ies' : 'y'}
            </div>
            <div className="search-results-list">
                {groups.map(group => (
                    <div key={`${group.entityType}:${group.entityId}`} className="search-result-group">
                        <button
                            type="button"
                            className="search-result-header"
                            onClick={() => onNavigate(group.entityType, group.entityId)}
                            data-testid={`search-result-${group.entityId}`}
                        >
                            <span className="result-entity-type">{group.entityType}</span>
                            <span className="result-entity-id">{group.entityId}</span>
                            <span className="result-match-count">({group.matches.length})</span>
                        </button>
                        <ul className="search-result-matches">
                            {group.matches.slice(0, 3).map((match, idx) => (
                                <li key={idx} className="search-result-match">
                                    <span className="match-field">{match.field}:</span>
                                    <span
                                        className="match-context"
                                        dangerouslySetInnerHTML={{
                                            __html: highlightMatch(match.context, match.match)
                                        }}
                                    />
                                </li>
                            ))}
                            {group.matches.length > 3 && (
                                <li className="search-result-more">
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
