/**
 * MCP Prompt Registration - Orchestrator
 * 
 * This module coordinates the registration of all prompt modules.
 * Each category of prompts is defined in its own file for maintainability.
 * 
 * Prompt Categories:
 * - implementation.ts: implement-requirement, create-roadmap
 * - analysis.ts: trace-dependency, coverage-analysis, suggest-relations
 * - documentation.ts: explain-entity, summarize-bundle, diff-bundles
 * - quality.ts: audit-profile, bundle-health, generate-test-cases
 */

import { PromptContext } from "./types.js";
import { registerImplementationPrompts } from "./implementation.js";
import { registerAnalysisPrompts } from "./analysis.js";
import { registerDocumentationPrompts } from "./documentation.js";
import { registerQualityPrompts } from "./quality.js";

// Re-export types for convenience
export type { PromptContext, PromptRegistrar } from "./types.js";

/**
 * Register all MCP prompts with the server.
 * 
 * This is the main entry point called by SddMcpServer.setupPrompts().
 * 
 * @param ctx - Context containing server instance and bundle access methods
 */
export function setupAllPrompts(ctx: PromptContext): void {
    // Implementation prompts (planning & execution)
    registerImplementationPrompts(ctx);

    // Analysis prompts (understanding relationships)
    registerAnalysisPrompts(ctx);

    // Documentation prompts (explanations & summaries)
    registerDocumentationPrompts(ctx);

    // Quality prompts (auditing & testing)
    registerQualityPrompts(ctx);
}
