#!/usr/bin/env npx ts-node
/**
 * MCP Test CLI
 * 
 * A simple command-line tool for testing MCP server tools via HTTP transport.
 * 
 * Usage:
 *   npx ts-node scripts/mcp-cli.ts <command> [options]
 * 
 * Commands:
 *   list_bundles              List all loaded bundles
 *   list_entities             List all entity IDs
 *   read_entity               Read a specific entity
 *   search_entities           Search for entities
 *   validate_bundle           Validate a bundle
 *   apply_changes             Apply changes to a bundle
 *   health                    Check server health
 *   session                   Test session lifecycle
 * 
 * Options:
 *   --port <port>             MCP HTTP server port (default: 3001)
 *   --bundle <id>             Bundle ID (default: first available)
 *   --json                    Output raw JSON
 *   --dry-run                 For apply_changes: preview only
 */

import { parseArgs } from "node:util";

const DEFAULT_PORT = 3001;
const MCP_ENDPOINT = "/mcp";

interface McpSession {
    sessionId: string;
    port: number;
}

interface McpResponse {
    result?: unknown;
    error?: { code: number; message: string };
    id: number;
}

// Parse SSE response from MCP server
function parseSSEResponse(text: string): McpResponse | null {
    const lines = text.split("\n");
    for (const line of lines) {
        if (line.startsWith("data: ")) {
            try {
                return JSON.parse(line.slice(6));
            } catch {
                // Ignore parse errors
            }
        }
    }
    return null;
}

// Initialize MCP session
async function initSession(port: number): Promise<McpSession> {
    const response = await fetch(`http://localhost:${port}${MCP_ENDPOINT}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "mcp-cli", version: "1.0.0" },
            },
        }),
    });

    const sessionId = response.headers.get("mcp-session-id");
    if (!sessionId) {
        throw new Error("No session ID in response");
    }

    const text = await response.text();
    const parsed = parseSSEResponse(text);
    if (parsed?.error) {
        throw new Error(`Init failed: ${parsed.error.message}`);
    }

    return { sessionId, port };
}

// Call an MCP tool
async function callTool(
    session: McpSession,
    name: string,
    args: Record<string, unknown>
): Promise<unknown> {
    const response = await fetch(`http://localhost:${session.port}${MCP_ENDPOINT}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": session.sessionId,
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: { name, arguments: args },
        }),
    });

    const text = await response.text();
    const parsed = parseSSEResponse(text);

    if (parsed?.error) {
        throw new Error(`Tool error: ${parsed.error.message}`);
    }

    // Extract content from MCP response
    const result = parsed?.result as { content?: Array<{ type: string; text: string }> };
    if (result?.content?.[0]?.type === "text") {
        try {
            return JSON.parse(result.content[0].text);
        } catch {
            return result.content[0].text;
        }
    }

    return result;
}

// Check server health
async function checkHealth(port: number): Promise<unknown> {
    const response = await fetch(`http://localhost:${port}/health`);
    return response.json();
}

// List sessions
async function listSessions(port: number): Promise<unknown> {
    const response = await fetch(`http://localhost:${port}/sessions`);
    return response.json();
}

// Main CLI
async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            port: { type: "string", short: "p", default: String(DEFAULT_PORT) },
            bundle: { type: "string", short: "b" },
            json: { type: "boolean", short: "j", default: false },
            "dry-run": { type: "boolean", default: false },
            type: { type: "string", short: "t" },
            id: { type: "string", short: "i" },
            query: { type: "string", short: "q" },
            changes: { type: "string", short: "c" },
            help: { type: "boolean", short: "h", default: false },
        },
    });

    const command = positionals[0];
    const port = parseInt(values.port || String(DEFAULT_PORT));

    if (values.help || !command) {
        console.log(`
MCP Test CLI - Test MCP server tools via HTTP

Usage: npx ts-node scripts/mcp-cli.ts <command> [options]

Commands:
  health              Check server health
  sessions            List active sessions
  list_bundles        List all loaded bundles
  list_entities       List all entity IDs
  read_entity         Read a specific entity
  search_entities     Search for entities
  validate_bundle     Validate a bundle
  apply_changes       Apply changes to a bundle

Options:
  -p, --port <port>   MCP HTTP server port (default: 3001)
  -b, --bundle <id>   Bundle ID
  -t, --type <type>   Entity type (for read_entity, list_entities)
  -i, --id <id>       Entity ID (for read_entity)
  -q, --query <text>  Search query (for search_entities)
  -c, --changes <json> Changes JSON (for apply_changes)
  --dry-run           Preview changes without applying
  -j, --json          Output raw JSON
  -h, --help          Show help

Examples:
  # Check server health
  npx ts-node scripts/mcp-cli.ts health

  # List bundles
  npx ts-node scripts/mcp-cli.ts list_bundles

  # Read an entity
  npx ts-node scripts/mcp-cli.ts read_entity -t Requirement -i REQ-001

  # Search entities
  npx ts-node scripts/mcp-cli.ts search_entities -q "authentication"

  # Apply changes (dry-run)
  npx ts-node scripts/mcp-cli.ts apply_changes --dry-run -c '[{"operation":"update","bundleId":"my-bundle","entityType":"Requirement","entityId":"REQ-001","data":{"title":"Updated Title"}}]'
`);
        process.exit(0);
    }

    const output = (data: unknown) => {
        if (values.json) {
            console.log(JSON.stringify(data, null, 2));
        } else {
            console.log(data);
        }
    };

    try {
        // Commands that don't need a session
        if (command === "health") {
            const result = await checkHealth(port);
            output(result);
            return;
        }

        if (command === "sessions") {
            const result = await listSessions(port);
            output(result);
            return;
        }

        // Commands that need an MCP session
        console.error(`Connecting to MCP server on port ${port}...`);
        const session = await initSession(port);
        console.error(`Session initialized: ${session.sessionId}`);

        let result: unknown;

        switch (command) {
            case "list_bundles":
                result = await callTool(session, "list_bundles", {});
                break;

            case "list_entities":
                result = await callTool(session, "list_entities", {
                    bundleId: values.bundle,
                    entityType: values.type,
                });
                break;

            case "read_entity":
                if (!values.type || !values.id) {
                    console.error("Error: --type and --id are required for read_entity");
                    process.exit(1);
                }
                result = await callTool(session, "read_entity", {
                    bundleId: values.bundle,
                    entityType: values.type,
                    id: values.id,
                });
                break;

            case "search_entities":
                if (!values.query) {
                    console.error("Error: --query is required for search_entities");
                    process.exit(1);
                }
                result = await callTool(session, "search_entities", {
                    query: values.query,
                    bundleId: values.bundle,
                    entityType: values.type,
                });
                break;

            case "validate_bundle":
                result = await callTool(session, "validate_bundle", {
                    bundleId: values.bundle,
                });
                break;

            case "apply_changes":
                if (!values.changes) {
                    console.error("Error: --changes is required for apply_changes");
                    process.exit(1);
                }
                try {
                    const changes = JSON.parse(values.changes);
                    result = await callTool(session, "apply_changes", {
                        changes,
                        dryRun: values["dry-run"],
                    });
                } catch (e) {
                    console.error("Error: Invalid JSON for --changes");
                    process.exit(1);
                }
                break;

            default:
                console.error(`Unknown command: ${command}`);
                console.error("Run with --help for usage information");
                process.exit(1);
        }

        output(result);
    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
