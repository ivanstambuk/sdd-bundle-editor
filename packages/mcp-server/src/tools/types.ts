/**
 * Shared types for MCP tool modules.
 * 
 * These types enable modular tool registration while providing
 * access to server context (bundles, methods) without tight coupling.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoadedBundle } from "../types.js";

/**
 * Context provided to tool registration functions.
 * Contains everything a tool needs to access bundle data and register itself.
 */
export interface ToolContext {
    /** The underlying MCP server for registering tools */
    server: McpServer;

    /** Direct access to the bundles map */
    bundles: Map<string, LoadedBundle>;

    /** Get a bundle by ID, or the default bundle if not specified */
    getBundle: (bundleId?: string) => LoadedBundle | undefined;

    /** Get all loaded bundle IDs */
    getBundleIds: () => string[];

    /** Check if we're in single-bundle mode (for backward compatibility) */
    isSingleBundleMode: () => boolean;
}

/**
 * A function that registers one or more tools with the MCP server.
 * Each tool module exports a function of this type.
 */
export type ToolRegistrar = (ctx: ToolContext) => void;
