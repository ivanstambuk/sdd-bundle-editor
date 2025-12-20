/**
 * HTTP/SSE Transport for SDD MCP Server
 * 
 * Implements the MCP Streamable HTTP transport specification.
 * This allows the UI and other HTTP clients to communicate with the MCP server.
 */
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import cors from "cors";

export interface HttpTransportOptions {
    port: number;
    /** Base path for MCP endpoints (default: /mcp) */
    basePath?: string;
    /** Enable CORS for browser access (default: true) */
    enableCors?: boolean;
    /** Allowed origins for CORS (default: all) */
    allowedOrigins?: string[];
    /** Factory function to create a new MCP server instance for each session */
    getServer: () => McpServer;
}

interface ActiveSession {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
    createdAt: Date;
}

/**
 * Creates an Express app that handles MCP HTTP transport.
 */
export function createMcpHttpServer(options: HttpTransportOptions) {
    const {
        port,
        basePath = "/mcp",
        enableCors = true,
        allowedOrigins,
        getServer,
    } = options;

    const app = express();

    // Enable CORS for browser access
    if (enableCors) {
        app.use(cors({
            origin: allowedOrigins || true,
            methods: ["GET", "POST", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Accept", "Mcp-Session-Id", "Last-Event-ID"],
            exposedHeaders: ["Mcp-Session-Id"],
        }));
    }

    // Parse JSON bodies for POST requests
    app.use(express.json());

    // Store active sessions
    const sessions = new Map<string, ActiveSession>();

    // Health check endpoint
    app.get("/health", (_req, res) => {
        res.json({
            status: "healthy",
            sessions: sessions.size,
            uptime: process.uptime(),
        });
    });

    // Session info endpoint
    app.get("/sessions", (_req, res) => {
        const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
            id,
            createdAt: session.createdAt.toISOString(),
        }));
        res.json({ sessions: sessionList });
    });

    // ============================================
    // PlantUML Rendering API (for web UI only)
    // AI clients can use local plantuml CLI directly
    // ============================================

    // Simple in-memory cache for rendered diagrams
    const diagramCache = new Map<string, string>();
    const MAX_CACHE_SIZE = 100;

    /**
     * Normalize PlantUML code by ensuring it has @startuml/@enduml tags
     * and injecting theme directives based on the requested theme.
     */
    function normalizePlantUml(code: string, theme?: 'light' | 'dark'): string {
        const trimmed = code.trim();

        // Build theme directives
        let themeDirectives = '';
        if (theme === 'dark') {
            // Use cyborg theme for dark mode with transparent background
            themeDirectives = '!theme cyborg\nskinparam backgroundColor transparent\n';
        } else if (theme === 'light') {
            // Light theme just needs transparent background to blend
            themeDirectives = 'skinparam backgroundColor transparent\n';
        }

        if (!trimmed.startsWith('@startuml')) {
            return `@startuml\n${themeDirectives}${trimmed}\n@enduml`;
        }

        // If already has @startuml, inject theme after it
        if (themeDirectives) {
            return trimmed.replace('@startuml', `@startuml\n${themeDirectives}`);
        }

        return trimmed;
    }

    /**
     * Render PlantUML to SVG using the CLI
     */
    async function renderPlantUmlToSvg(code: string, theme?: 'light' | 'dark'): Promise<string> {
        const normalizedCode = normalizePlantUml(code, theme);

        // Check cache first (include theme in cache key)
        const cacheKey = `${theme || 'default'}:${normalizedCode}`;
        const cached = diagramCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        return new Promise((resolve, reject) => {
            const proc = spawn('plantuml', ['-tsvg', '-pipe'], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to spawn plantuml: ${err.message}. Is plantuml installed?`));
            });

            proc.on('close', (exitCode) => {
                if (exitCode !== 0) {
                    reject(new Error(`PlantUML failed (exit ${exitCode}): ${stderr}`));
                    return;
                }

                // Extract just the SVG content (remove XML declaration)
                let svg = stdout;
                const svgStart = svg.indexOf('<svg');
                if (svgStart > 0) {
                    svg = svg.substring(svgStart);
                }

                // Cache the result (with size limit)
                diagramCache.set(cacheKey, svg);
                if (diagramCache.size > MAX_CACHE_SIZE) {
                    const firstKey = diagramCache.keys().next().value;
                    if (firstKey) diagramCache.delete(firstKey);
                }

                resolve(svg);
            });

            // Send the PlantUML code to stdin
            proc.stdin.write(normalizedCode);
            proc.stdin.end();
        });
    }

    /**
     * POST /api/plantuml - Render PlantUML to SVG
     * 
     * Request body: { code: string, theme?: 'light' | 'dark' }
     * Response: { svg: string } or { error: string }
     */
    app.post("/api/plantuml", async (req: Request, res: Response) => {
        const { code, theme } = req.body as { code?: string; theme?: 'light' | 'dark' };

        if (!code || typeof code !== 'string' || !code.trim()) {
            res.status(400).json({ error: 'PlantUML code is required' });
            return;
        }

        try {
            const svg = await renderPlantUmlToSvg(code, theme);
            res.json({ svg });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[PlantUML] Render error:', message);
            res.status(500).json({ error: message });
        }
    });

    /**
     * Handle POST requests to the MCP endpoint.
     * This is the main endpoint for MCP tool calls and initialization.
     */
    const mcpPostHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        try {
            let session: ActiveSession | undefined;

            if (sessionId && sessions.has(sessionId)) {
                // Reuse existing session
                session = sessions.get(sessionId)!;
                console.error(`[HTTP] Reusing session: ${sessionId}`);
            } else if (!sessionId && isInitializeRequest(req.body)) {
                // New initialization request - create a new session
                console.error("[HTTP] New session initialization request");

                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (newSessionId) => {
                        console.error(`[HTTP] Session initialized: ${newSessionId}`);
                        sessions.set(newSessionId, {
                            transport,
                            server: server,
                            createdAt: new Date(),
                        });
                    },
                    onsessionclosed: (closedSessionId) => {
                        console.error(`[HTTP] Session closed: ${closedSessionId}`);
                        sessions.delete(closedSessionId);
                    },
                });

                // Set up close handler
                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid && sessions.has(sid)) {
                        console.error(`[HTTP] Transport closed for session: ${sid}`);
                        sessions.delete(sid);
                    }
                };

                // Create and connect a new MCP server instance
                const server = getServer();
                await server.connect(transport);

                // Handle the request
                await transport.handleRequest(req, res, req.body);
                return;
            } else {
                // Invalid request - no session ID or not an initialization request
                res.status(400).json({
                    jsonrpc: "2.0",
                    error: {
                        code: -32000,
                        message: "Bad Request: No valid session ID provided",
                    },
                    id: null,
                });
                return;
            }

            // Handle the request with existing session's transport
            await session.transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error("[HTTP] Error handling request:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: "Internal server error",
                    },
                    id: null,
                });
            }
        }
    };

    /**
     * Handle GET requests for SSE streams.
     * Clients can establish SSE connections to receive server-to-client notifications.
     */
    const mcpGetHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (!sessionId || !sessions.has(sessionId)) {
            res.status(400).json({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Invalid or missing session ID",
                },
                id: null,
            });
            return;
        }

        const session = sessions.get(sessionId)!;
        const lastEventId = req.headers["last-event-id"] as string | undefined;

        if (lastEventId) {
            console.error(`[HTTP] SSE reconnection for session ${sessionId}, Last-Event-ID: ${lastEventId}`);
        } else {
            console.error(`[HTTP] New SSE stream for session ${sessionId}`);
        }

        await session.transport.handleRequest(req, res);
    };

    /**
     * Handle DELETE requests for session termination.
     */
    const mcpDeleteHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (!sessionId || !sessions.has(sessionId)) {
            res.status(400).json({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Invalid or missing session ID",
                },
                id: null,
            });
            return;
        }

        console.error(`[HTTP] Session termination request: ${sessionId}`);
        const session = sessions.get(sessionId)!;

        try {
            await session.transport.handleRequest(req, res);
        } catch (error) {
            console.error("[HTTP] Error handling session termination:", error);
            if (!res.headersSent) {
                res.status(500).send("Error processing session termination");
            }
        }
    };

    // Register MCP routes
    app.post(basePath, mcpPostHandler);
    app.get(basePath, mcpGetHandler);
    app.delete(basePath, mcpDeleteHandler);

    /**
     * Start the HTTP server
     */
    function start(): Promise<void> {
        return new Promise((resolve, reject) => {
            const server = app.listen(port, (err?: Error) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.error(`[HTTP] MCP HTTP Server listening on http://localhost:${port}${basePath}`);
                resolve();
            });

            // Handle server errors
            server.on("error", (err) => {
                console.error("[HTTP] Server error:", err);
            });

            // Graceful shutdown
            process.on("SIGINT", async () => {
                console.error("[HTTP] Shutting down...");

                // Close all active transports
                for (const [sessionId, session] of sessions) {
                    try {
                        console.error(`[HTTP] Closing session: ${sessionId}`);
                        await session.transport.close();
                    } catch (error) {
                        console.error(`[HTTP] Error closing session ${sessionId}:`, error);
                    }
                }
                sessions.clear();

                server.close(() => {
                    console.error("[HTTP] Server shutdown complete");
                    process.exit(0);
                });
            });
        });
    }

    return {
        app,
        start,
        sessions,
    };
}
