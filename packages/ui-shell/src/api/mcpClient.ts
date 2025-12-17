/**
 * MCP Client for Browser
 * 
 * Communicates with the MCP server via HTTP transport.
 * Provides typed methods for calling MCP tools and handling sessions.
 */

export interface McpClientConfig {
    /** MCP server URL (e.g., "http://localhost:3002") */
    serverUrl: string;
    /** MCP endpoint path (default: "/mcp") */
    mcpPath?: string;
}

interface McpSession {
    sessionId: string;
    createdAt: Date;
}

interface McpToolResult<T = unknown> {
    data: T;
    isError: boolean;
}

/**
 * Parse SSE response from MCP server
 */
function parseSSEResponse(text: string): unknown {
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                return JSON.parse(line.slice(6));
            } catch {
                // Ignore parse errors
            }
        }
    }
    // If no SSE data found, try parsing entire response as JSON
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

/**
 * MCP Client for browser-based communication with MCP server.
 */
export class McpClient {
    private config: McpClientConfig;
    private session: McpSession | null = null;
    private requestId = 0;

    constructor(config: McpClientConfig) {
        this.config = {
            mcpPath: '/mcp',
            ...config,
        };
    }

    /**
     * Get the MCP endpoint URL
     */
    private get mcpUrl(): string {
        return `${this.config.serverUrl}${this.config.mcpPath}`;
    }

    /**
     * Initialize a new MCP session
     */
    async initialize(): Promise<void> {
        const response = await fetch(this.mcpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: ++this.requestId,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'sdd-ui-shell', version: '1.0.0' },
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`MCP initialization failed: ${response.status} ${response.statusText}`);
        }

        const sessionId = response.headers.get('mcp-session-id');
        if (!sessionId) {
            throw new Error('No session ID in MCP response');
        }

        this.session = {
            sessionId,
            createdAt: new Date(),
        };
    }

    /**
     * Ensure we have an active session, initializing if needed
     */
    private async ensureSession(): Promise<string> {
        if (!this.session) {
            await this.initialize();
        }
        return this.session!.sessionId;
    }

    /**
     * Call an MCP tool
     */
    async callTool<T = unknown>(
        tool: string,
        args: Record<string, unknown> = {}
    ): Promise<McpToolResult<T>> {
        const sessionId = await this.ensureSession();

        const response = await fetch(this.mcpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
                'Mcp-Session-Id': sessionId,
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: ++this.requestId,
                method: 'tools/call',
                params: { name: tool, arguments: args },
            }),
        });

        if (!response.ok) {
            throw new Error(`MCP tool call failed: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const parsed = parseSSEResponse(text) as {
            result?: { content?: Array<{ text: string }> };
            error?: { message: string; code: number };
        };

        if (parsed?.error) {
            throw new Error(`MCP error: ${parsed.error.message}`);
        }

        // Extract content from MCP response
        if (parsed?.result?.content?.[0]?.text) {
            try {
                return {
                    data: JSON.parse(parsed.result.content[0].text) as T,
                    isError: false,
                };
            } catch {
                return {
                    data: parsed.result.content[0].text as T,
                    isError: false,
                };
            }
        }

        return {
            data: parsed?.result as T,
            isError: false,
        };
    }

    /**
     * Check server health
     */
    async checkHealth(): Promise<{ status: string; sessions: number; uptime: number }> {
        const response = await fetch(`${this.config.serverUrl}/health`);
        if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`);
        }
        return response.json();
    }

    /**
     * Close the current session
     */
    async close(): Promise<void> {
        if (this.session) {
            try {
                await fetch(this.mcpUrl, {
                    method: 'DELETE',
                    headers: {
                        'Mcp-Session-Id': this.session.sessionId,
                    },
                });
            } catch {
                // Ignore close errors
            }
            this.session = null;
        }
    }

    /**
     * Reset session (force re-initialization on next call)
     */
    resetSession(): void {
        this.session = null;
    }
}

// ============================================
// Typed MCP Tool Interfaces
// ============================================

export interface McpBundle {
    id: string;
    name: string;
    bundleType: string;
    tags: string[];
    description?: string;
    path: string;
    entityTypes: string[];
}

export interface McpEntity {
    id: string;
    title?: string;
    description?: string;
    [key: string]: unknown;
}

export interface McpSearchResult {
    query: string;
    resultCount: number;
    results: Array<{
        bundleId: string;
        entityType: string;
        id: string;
        title?: string;
        match: string;
    }>;
}

export interface McpValidationResult {
    bundleId?: string;
    summary: {
        bundlesChecked?: number;
        totalErrors: number;
        totalWarnings: number;
        isValid: boolean;
    };
    diagnostics: Array<{
        bundleId?: string;
        severity: 'error' | 'warning';
        message: string;
        entityType?: string;
        entityId?: string;
        code?: string;
    }>;
}

/**
 * Default MCP client instance
 * Configured based on environment or defaults
 */
export function createMcpClient(serverUrl?: string): McpClient {
    const url = serverUrl || getMcpServerUrl();
    return new McpClient({ serverUrl: url });
}

/**
 * Get MCP server URL from environment or defaults
 * 
 * In browser context, returns empty string to use relative paths
 * which work with webpack proxy. Direct MCP URL can be specified
 * via ?mcpUrl= query param.
 */
export function getMcpServerUrl(): string {
    // In browser, check for query param or use relative path (for webpack proxy)
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const mcpUrl = params.get('mcpUrl');
        if (mcpUrl) return mcpUrl;
        // Use empty string for relative paths (webpack proxy will handle /mcp)
        return '';
    }
    // For server-side/testing, use default MCP server port
    return 'http://localhost:3001';
}

