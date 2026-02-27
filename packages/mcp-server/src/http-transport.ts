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

    // ============================================
    // PlantUML Rendering API (for web UI only)
    // AI clients can use local plantuml CLI directly
    // ============================================

    // Hash-based in-memory cache for rendered diagrams
    // Key is SHA-256 hash of (code + theme), value is SVG
    const diagramCache = new Map<string, string>();
    const MAX_CACHE_SIZE = 100;

    /**
     * Compute SHA-256 hash of PlantUML code + theme for cache key and ETag
     */
    function computeDiagramHash(code: string, theme?: 'light' | 'dark'): string {
        const crypto = require('node:crypto');
        const content = `${theme || 'default'}:${code.trim()}`;
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    /**
     * Normalize PlantUML code by ensuring it has @startuml/@enduml tags
     * and injecting theme directives based on the requested theme.
     * 
     * Uses skinparam for compatibility with older PlantUML versions (1.2020+).
     * The !theme directive is only available in newer versions (2021+).
     */
    function normalizePlantUml(code: string, theme?: 'light' | 'dark'): string {
        const trimmed = code.trim();

        // Build theme directives using skinparam (compatible with older PlantUML)
        let themeDirectives = '';
        if (theme === 'dark') {
            // Dark theme with Dracula-inspired colors
            themeDirectives = `skinparam backgroundColor transparent
skinparam shadowing false
skinparam defaultFontColor #F8F8F2
skinparam ArrowColor #00BFFF
skinparam sequence {
  ArrowColor #00BFFF
  LifeLineBorderColor #6272A4
  LifeLineBackgroundColor #44475A
  ParticipantBorderColor #6272A4
  ParticipantBackgroundColor #44475A
  ParticipantFontColor #F8F8F2
  BoxBorderColor #6272A4
  BoxBackgroundColor #282A36
}
skinparam note {
  BackgroundColor #44475A
  BorderColor #6272A4
  FontColor #F8F8F2
}
skinparam rectangle {
  BackgroundColor #44475A
  BorderColor #6272A4
  FontColor #F8F8F2
}
skinparam database {
  BackgroundColor #44475A
  BorderColor #6272A4
  FontColor #F8F8F2
}
skinparam actor {
  BackgroundColor #44475A
  BorderColor #BD93F9
}
`;
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
     * Render PlantUML to SVG using the project-local JAR file
     * Returns both the SVG and the hash (for ETag)
     */
    async function renderPlantUmlToSvg(code: string, theme?: 'light' | 'dark'): Promise<{ svg: string; hash: string }> {
        const hash = computeDiagramHash(code, theme);

        // Check cache first using hash key
        const cached = diagramCache.get(hash);
        if (cached) {
            return { svg: cached, hash };
        }

        const normalizedCode = normalizePlantUml(code, theme);

        // Use project-local plantuml.jar (in tools/plantuml/ relative to repo root)
        const path = require('node:path');
        const jarPath = path.resolve(__dirname, '../../../tools/plantuml/plantuml.jar');

        return new Promise((resolve, reject) => {
            const proc = spawn('java', ['-Djava.awt.headless=true', '-jar', jarPath, '-tsvg', '-pipe'], {
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

                // Cache the result using hash key (with size limit)
                diagramCache.set(hash, svg);
                if (diagramCache.size > MAX_CACHE_SIZE) {
                    const firstKey = diagramCache.keys().next().value;
                    if (firstKey) diagramCache.delete(firstKey);
                }

                resolve({ svg, hash });
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
     * Response: { svg: string, hash: string } or { error: string }
     * 
     * The hash can be used with GET /api/plantuml/:hash for cached requests.
     * POST responses are not cached by browsers, but we return the hash
     * so clients can switch to GET for subsequent requests.
     */
    app.post("/api/plantuml", async (req: Request, res: Response) => {
        const { code, theme } = req.body as { code?: string; theme?: 'light' | 'dark' };

        if (!code || typeof code !== 'string' || !code.trim()) {
            res.status(400).json({ error: 'PlantUML code is required' });
            return;
        }

        try {
            const { svg, hash } = await renderPlantUmlToSvg(code, theme);

            // Set ETag header (helps if client decides to use conditional requests)
            res.set('ETag', `"${hash}"`);

            res.json({ svg, hash });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[PlantUML] Render error:', message);
            res.status(500).json({ error: message });
        }
    });

    /**
     * GET /api/plantuml/:hash - Get cached PlantUML SVG by hash
     * 
     * This endpoint supports HTTP caching:
     * - ETag: The hash serves as the entity tag
     * - Cache-Control: immutable, since same hash = same content
     * - If-None-Match: Returns 304 if client has cached version
     * 
     * Query params:
     * - code: The PlantUML source (required if not in server cache)
     * - theme: 'light' or 'dark' (optional)
     * 
     * Flow:
     * 1. Client computes hash client-side and requests GET /api/plantuml/:hash
     * 2. Browser checks its cache first (same URL = cache hit)
     * 3. If not in browser cache, server checks its cache by hash
     * 4. If not in server cache, renders using code from query param
     */
    app.get("/api/plantuml/:hash", async (req: Request, res: Response) => {
        const { hash } = req.params;
        const { code, theme } = req.query as { code?: string; theme?: 'light' | 'dark' };

        // Check If-None-Match header for conditional requests
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === `"${hash}"` || ifNoneMatch === hash) {
            res.status(304).end();
            return;
        }

        // Check server cache first
        const cached = diagramCache.get(hash);
        if (cached) {
            res
                .set('Content-Type', 'image/svg+xml')
                .set('ETag', `"${hash}"`)
                .set('Cache-Control', 'public, max-age=31536000, immutable')
                .send(cached);
            return;
        }

        // Not in cache - need code to render
        if (!code || typeof code !== 'string' || !code.trim()) {
            res.status(400).json({ error: 'PlantUML code required for uncached diagram' });
            return;
        }

        // Verify hash matches the code
        const computedHash = computeDiagramHash(code, theme);
        if (computedHash !== hash) {
            res.status(400).json({ error: 'Hash mismatch - code does not match hash' });
            return;
        }

        try {
            const { svg } = await renderPlantUmlToSvg(code, theme);

            res
                .set('Content-Type', 'image/svg+xml')
                .set('ETag', `"${hash}"`)
                .set('Cache-Control', 'public, max-age=31536000, immutable')
                .send(svg);
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
