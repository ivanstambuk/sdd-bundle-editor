/**
 * MCP Tool Annotations
 * 
 * Provides hints to clients about tool behavior for trust, safety, and UX.
 * These are hints only - clients should not make security decisions based on them.
 * 
 * @see https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations
 */

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * Annotation for read-only tools that don't modify the environment.
 * Used for: list_bundles, get_bundle_schema, get_entity_schema, get_bundle_snapshot,
 * read_entity, read_entities, list_entities, list_entity_summaries, get_entity_relations,
 * get_context, get_conformance_context, search_entities, validate_bundle
 */
export const READ_ONLY_TOOL: ToolAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,  // Operates on local bundle data only
};

/**
 * Annotation for tools that modify the bundle (create/update/delete entities).
 * Used for: apply_changes
 */
export const MUTATING_TOOL: ToolAnnotations = {
    readOnlyHint: false,
    destructiveHint: true,  // Can delete entities or overwrite data
    idempotentHint: false,  // Same operation may have different effects
    openWorldHint: false,   // Operates on local bundle data only
};

/**
 * Annotation for tools that invoke external capabilities (e.g., LLM sampling).
 * Used for: critique_bundle
 */
export const EXTERNAL_SAMPLING_TOOL: ToolAnnotations = {
    readOnlyHint: true,     // Doesn't modify bundle
    destructiveHint: false,
    idempotentHint: false,  // LLM responses may vary
    openWorldHint: true,    // Invokes external LLM
};
