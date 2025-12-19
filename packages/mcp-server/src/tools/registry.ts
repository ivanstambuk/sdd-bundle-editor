/**
 * Tool Registration Factory Helpers
 * 
 * Provides helper functions for registering tools with consistent annotations.
 * This reduces boilerplate and ensures annotation consistency across tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { READ_ONLY_TOOL, MUTATING_TOOL, EXTERNAL_SAMPLING_TOOL } from "../tool-annotations.js";

// Type for Zod raw shape (what inputSchema expects)
type ZodRawShape = Record<string, z.ZodTypeAny>;

// Type for empty schema
type EmptySchema = Record<string, never>;

/**
 * Helper to register a read-only tool with standard annotations.
 * Use for tools that only read data: list_bundles, read_entity, search_entities, etc.
 * 
 * Note: For no-argument tools, pass {} as inputSchema. The MCP SDK's TypeScript
 * types don't support z.object({}).strict() or raw JSON Schema objects.
 */
export function registerReadOnlyTool<T extends ZodRawShape | EmptySchema>(
    server: McpServer,
    name: string,
    description: string,
    inputSchema: T,
    handler: (args: T extends ZodRawShape ? z.infer<z.ZodObject<T>> : Record<string, never>) => Promise<unknown>
): void {
    server.registerTool(name, {
        description,
        inputSchema,
        annotations: READ_ONLY_TOOL,
    }, handler as any);
}

/**
 * Helper to register a mutating tool with standard annotations.
 * Use for tools that modify data: apply_changes
 */
export function registerMutatingTool<T extends ZodRawShape>(
    server: McpServer,
    name: string,
    description: string,
    inputSchema: T,
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<unknown>
): void {
    server.registerTool(name, {
        description,
        inputSchema,
        annotations: MUTATING_TOOL,
    }, handler as any);
}

/**
 * Helper to register an external sampling tool with standard annotations.
 * Use for tools that invoke external LLM capabilities: critique_bundle
 */
export function registerExternalTool<T extends ZodRawShape>(
    server: McpServer,
    name: string,
    description: string,
    inputSchema: T,
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<unknown>
): void {
    server.registerTool(name, {
        description,
        inputSchema,
        annotations: EXTERNAL_SAMPLING_TOOL,
    }, handler as any);
}
