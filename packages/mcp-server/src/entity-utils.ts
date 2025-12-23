/**
 * Entity utility functions for prompt scaling and summarization.
 * 
 * These helpers prevent context window explosion by providing
 * compact representations of entities instead of full JSON dumps.
 */

/**
 * Entity summary containing only key fields for display.
 * Uses Record<string, unknown> for compatibility with existing code.
 */
export type EntitySummary = Record<string, unknown>;

/**
 * Create a summary of an entity (id, title/name, state) instead of full JSON.
 * 
 * Extracts the most useful fields for display in prompts:
 * - id: Entity identifier
 * - title: Title, name, or statement (whichever exists)
 * - state: Current state (if present)
 * - priority: Priority level (if present)
 * 
 * @param data - Full entity data object
 * @returns Summary object with key fields
 */
export function summarizeEntity(data: Record<string, unknown>): EntitySummary {
    return {
        id: data.id,
        title: data.title || data.name || data.statement,
        state: data.state,
        ...(data.priority ? { priority: data.priority } : {}),
    };
}

/**
 * Options for formatting entities in prompts.
 */
export interface FormatEntitiesOptions {
    /** Maximum number of entities to include (default: 20) */
    maxEntities?: number;
    /** Output mode: full JSON, summary, or just IDs (default: summary) */
    mode?: "full" | "summary" | "ids";
}

/**
 * Format entities for prompt - either as summaries or limited full data.
 * 
 * Handles truncation and adds helpful messages when data is limited.
 * 
 * @param entities - Array of entity wrappers with data field
 * @param options - Formatting options
 * @returns Formatted string suitable for embedding in prompts
 * 
 * @example
 * // With summaries (default)
 * formatEntitiesForPrompt(entities, { maxEntities: 10, mode: "summary" })
 * 
 * @example
 * // Just IDs for compact lists
 * formatEntitiesForPrompt(entities, { mode: "ids" })
 */
export function formatEntitiesForPrompt(
    entities: Array<{ data: Record<string, unknown> }>,
    options: FormatEntitiesOptions = {}
): string {
    const { maxEntities = 20, mode = "summary" } = options;
    const limited = entities.slice(0, maxEntities);
    const truncated = entities.length > maxEntities;

    if (mode === "ids") {
        const ids = limited.map(e => e.data.id);
        return ids.join(", ") + (truncated ? ` ... and ${entities.length - maxEntities} more` : "");
    }

    const formatted = limited.map(e =>
        mode === "full" ? e.data : summarizeEntity(e.data)
    );

    let result = JSON.stringify(formatted, null, 2);
    if (truncated) {
        result += `\n\n(Showing ${maxEntities} of ${entities.length}. Use read_entities tool for full details.)`;
    }
    return result;
}
