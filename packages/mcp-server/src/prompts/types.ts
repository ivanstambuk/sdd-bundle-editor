/**
 * Shared types for MCP prompt modules.
 * 
 * These types enable modular prompt registration while providing
 * access to server context (bundles, methods) without tight coupling.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoadedBundle } from "../types.js";

/**
 * Context provided to prompt registration functions.
 * Contains everything a prompt needs to access bundle data and register itself.
 */
export interface PromptContext {
    /** The underlying MCP server for registering prompts */
    server: McpServer;

    /** Get a bundle by ID, or the default bundle if not specified */
    getBundle: (bundleId?: string) => LoadedBundle | undefined;

    /** Get all loaded bundle IDs */
    getBundleIds: () => string[];

    /** Direct access to the bundles map (for prompts that need to compare bundles) */
    bundles: Map<string, LoadedBundle>;
}

/**
 * A function that registers one or more prompts with the MCP server.
 * Each prompt module exports a function of this type.
 */
export type PromptRegistrar = (ctx: PromptContext) => void;
