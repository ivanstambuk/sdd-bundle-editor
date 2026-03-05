/**
 * Shared development configuration — SINGLE SOURCE OF TRUTH for dev ports.
 *
 * Both the MCP server (packages/mcp-server) and the webpack dev server
 * (apps/web) read from this file so port defaults can never drift apart.
 *
 * Override at runtime with environment variables:
 *   MCP_HTTP_PORT=3005 pnpm dev
 *   WEB_PORT=5175 pnpm dev
 */
module.exports = {
    /** MCP HTTP server port (also the webpack proxy target) */
    MCP_HTTP_PORT: parseInt(process.env.MCP_HTTP_PORT || '3001', 10),

    /** Webpack dev server port */
    WEB_PORT: parseInt(process.env.WEB_PORT || '5174', 10),
};
