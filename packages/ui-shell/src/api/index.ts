/**
 * API layer for SDD Bundle Editor.
 * Re-exports all API clients for convenient importing.
 * 
 * MCP-First Architecture: The UI now uses MCP protocol directly
 * instead of the legacy HTTP bundle API.
 */

// Legacy HTTP-based API (deprecated, kept for fallback)
export { fetchJson, fetchWithRetry } from './fetchUtils';
export { bundleApi, type BundleResponse, type ValidateResponse, type SaveResponse } from './bundleApi';

// MCP-based API (primary, Phase 4.4)
export { McpClient, createMcpClient, getMcpServerUrl } from './mcpClient';
export type { McpBundle, McpEntity, McpSearchResult, McpValidationResult } from './mcpClient';
export { McpBundleApi, getMcpBundleApi, mcpBundleApi } from './mcpBundleApi';
