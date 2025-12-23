/**
 * MCP Tool Registration - Orchestrator
 * 
 * This module coordinates the registration of all tool modules.
 * Each category of tools is defined in its own file for maintainability.
 * 
 * Tool Categories:
 * - bundle-tools.ts: list_bundles, get_bundle_schema, get_bundle_snapshot
 * - entity-tools.ts: read_entities, list_entities, list_entity_summaries
 * - schema-tools.ts: get_entity_schema, get_entity_relations
 * - context-tools.ts: get_context, get_conformance_context
 * - search-tools.ts: search_entities
 * - validation-tools.ts: validate_bundle
 * - mutation-tools.ts: apply_changes
 * - sampling-tools.ts: critique_bundle
 * - export-tools.ts: export_entity_markdown
 */

import { ToolContext } from "./types.js";
import { registerBundleTools } from "./bundle-tools.js";
import { registerEntityTools } from "./entity-tools.js";
import { registerSchemaTools } from "./schema-tools.js";
import { registerContextTools } from "./context-tools.js";
import { registerSearchTools } from "./search-tools.js";
import { registerValidationTools } from "./validation-tools.js";
import { registerMutationTools } from "./mutation-tools.js";
import { registerSamplingTools } from "./sampling-tools.js";
import { registerExportTools } from "./export-tools.js";

// Re-export types for convenience
export type { ToolContext, ToolRegistrar } from "./types.js";
export { registerReadOnlyTool, registerMutatingTool, registerExternalTool } from "./registry.js";

/**
 * Register all MCP tools with the server.
 * 
 * This is the main entry point called by SddMcpServer.setupTools().
 * 
 * @param ctx - Context containing server instance and bundle access methods
 */
export function setupAllTools(ctx: ToolContext): void {
    // Bundle-level tools (list, schema, snapshot)
    registerBundleTools(ctx);

    // Entity CRUD tools
    registerEntityTools(ctx);

    // Schema introspection tools
    registerSchemaTools(ctx);

    // Context gathering tools (graph traversal)
    registerContextTools(ctx);

    // Search tools
    registerSearchTools(ctx);

    // Validation tools
    registerValidationTools(ctx);

    // Mutation tools (apply_changes)
    registerMutationTools(ctx);

    // Sampling-based tools (critique_bundle)
    registerSamplingTools(ctx);

    // Export tools (export_entity_markdown)
    registerExportTools(ctx);
}
