/**
 * API layer for SDD Bundle Editor.
 * Re-exports all API clients for convenient importing.
 * 
 * MCP-First Architecture: The UI uses MCP protocol directly.
 * Legacy HTTP bundle API has been removed.
 */

// HTTP utilities (still used by MCP client)
export { fetchJson, fetchWithRetry } from './fetchUtils';

// MCP-based API (primary)
export { McpClient, createMcpClient, getMcpServerUrl, callMcpTool } from './mcpClient';
export type { McpBundle, McpEntity, McpSearchResult, McpValidationResult } from './mcpClient';
export { McpBundleApi, getMcpBundleApi, mcpBundleApi, type BundleResponse, type ValidateResponse } from './mcpBundleApi';

