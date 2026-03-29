/**
 * HTTP/SSE Transport for SDD MCP Server
 * 
 * Implements the MCP Streamable HTTP transport specification.
 * This allows the UI and other HTTP clients to communicate with the MCP server.
 */
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import cors from "cors";
import { EventEmitter } from "events";

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
    /** Event emitter for bundle reload events (optional) */
    bundleEventEmitter?: EventEmitter;
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
        bundleEventEmitter,
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

    // Store SSE clients for bundle events
    const bundleEventClients = new Set<Response>();

    // Health check endpoint
    app.get("/health", (_req, res) => {
        res.json({
            status: "healthy",
            sessions: sessions.size,
            sseClients: bundleEventClients.size,
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
    // SSE Events Endpoint for Bundle Reload Notifications
    // ============================================

    /**
     * GET /api/events - SSE endpoint for real-time bundle reload notifications
     * 
     * Frontend connects to this endpoint and receives events when bundles are reloaded.
     * Event format: { type: 'bundle-reload', bundleId: string, timestamp: string }
     * 
     * NOTE: No connection limit - supports multi-user deployment.
     * For local dev with many tabs, be aware browsers limit ~6 HTTP/1.1 connections per domain.
     */
    app.get("/api/events", (req: Request, res: Response) => {
        console.error(`[HTTP] SSE client connected for bundle events (${bundleEventClients.size + 1} active)`);

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders();

        // Send initial connection event
        res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connected' })}\n\n`);

        // Add client to the set
        bundleEventClients.add(res);

        // Remove client on disconnect
        req.on('close', () => {
            console.error(`[HTTP] SSE client disconnected (${bundleEventClients.size - 1} remaining)`);
            bundleEventClients.delete(res);
        });

        // Keep connection alive with periodic heartbeat
        const heartbeat = setInterval(() => {
            res.write(':heartbeat\n\n');
        }, 30000);

        req.on('close', () => {
            clearInterval(heartbeat);
        });
    });

    // Subscribe to bundle reload events if emitter is provided
    if (bundleEventEmitter) {
        bundleEventEmitter.on('reload', (event: { bundleId: string; bundlePath: string }) => {
            const eventData = {
                type: 'bundle-reload',
                bundleId: event.bundleId,
                timestamp: new Date().toISOString(),
            };

            console.error(`[HTTP] Broadcasting bundle-reload to ${bundleEventClients.size} SSE clients`);

            for (const client of bundleEventClients) {
                try {
                    client.write(`event: bundle-reload\ndata: ${JSON.stringify(eventData)}\n\n`);
                } catch (err) {
                    console.error("[HTTP] Error sending SSE event:", err);
                    bundleEventClients.delete(client);
                }
            }
        });
    }

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

    // Serve static frontend files if they exist (for production deployment)
    const frontendPath = require("node:path").resolve(__dirname, '../../../apps/web/dist');
    if (require("node:fs").existsSync(frontendPath)) {
        app.use(express.static(frontendPath));
        
        // Fallback for single-page app routing
        app.use((req: Request, res: Response, next: NextFunction) => {
            if (req.method === 'GET' && req.accepts('html')) {
                res.sendFile(require("node:path").join(frontendPath, 'index.html'));
            } else {
                next();
            }
        });
        console.error(`[HTTP] Configured to serve static frontend from: ${frontendPath}`);
    } else {
        console.error(`[HTTP] Static frontend not found at ${frontendPath}, running as API only.`);
    }

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
