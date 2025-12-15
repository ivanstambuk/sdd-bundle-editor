#!/usr/bin/env node
import { SddMcpServer } from "./server.js";
import { BundlesConfigFileSchema, BundleConfig } from "./types.js";
import { createMcpHttpServer } from "./http-transport.js";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";

/**
 * Command line argument parsing result
 */
interface ParsedArgs {
    bundleConfigs: BundleConfig[];
    httpMode: boolean;
    httpPort: number;
}

/**
 * Parse command line arguments and determine bundle configuration.
 * 
 * Supported modes:
 * 1. Single path: node server.js /path/to/bundle
 * 2. Multiple paths: node server.js /bundle1 /bundle2 /bundle3
 * 3. Config file: node server.js --config /path/to/bundles.yaml
 * 4. No args: uses SDD_SAMPLE_BUNDLE_PATH env var or default path
 * 
 * HTTP mode:
 * --http          Start HTTP/SSE transport instead of stdio
 * --port <port>   HTTP port (default: 3001)
 */
function parseArgs(): ParsedArgs {
    const args = process.argv.slice(2);

    // Check for HTTP mode
    const httpIndex = args.indexOf("--http");
    const httpMode = httpIndex !== -1;
    if (httpIndex !== -1) {
        args.splice(httpIndex, 1);
    }

    // Check for port
    let httpPort = parseInt(process.env.MCP_HTTP_PORT || "3001", 10);
    const portIndex = args.indexOf("--port");
    if (portIndex !== -1 && args[portIndex + 1]) {
        httpPort = parseInt(args[portIndex + 1], 10);
        args.splice(portIndex, 2);
    }

    // Mode 3: Config file mode
    const configIndex = args.indexOf("--config");
    if (configIndex !== -1 && args[configIndex + 1]) {
        const configPath = path.resolve(args[configIndex + 1]);
        return {
            bundleConfigs: loadConfigFile(configPath),
            httpMode,
            httpPort,
        };
    }

    // Mode 1 & 2: Direct path(s) mode
    if (args.length > 0 && !args[0].startsWith("-")) {
        const usedIds = new Set<string>();
        const bundleConfigs = args.map((argPath, index) => {
            let baseId = path.basename(argPath);
            let id = baseId;
            let counter = 2;
            while (usedIds.has(id)) {
                id = `${baseId}-${counter}`;
                counter++;
            }
            usedIds.add(id);
            return {
                id,
                path: path.resolve(argPath),
            };
        });
        return { bundleConfigs, httpMode, httpPort };
    }

    // Mode 4: Fallback to environment variable or default
    const defaultPath = process.env.SDD_SAMPLE_BUNDLE_PATH || "/home/ivan/dev/sdd-sample-bundle";
    return {
        bundleConfigs: [{
            id: path.basename(defaultPath),
            path: path.resolve(defaultPath),
        }],
        httpMode,
        httpPort,
    };
}

/**
 * Load bundle configuration from a YAML file.
 */
function loadConfigFile(configPath: string): BundleConfig[] {
    if (!fs.existsSync(configPath)) {
        console.error(`Config file not found: ${configPath}`);
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(configPath, "utf-8");
        const parsed = yaml.load(content);
        const validated = BundlesConfigFileSchema.parse(parsed);

        // Resolve relative paths based on config file location
        const configDir = path.dirname(configPath);
        return validated.bundles.map(b => ({
            ...b,
            path: path.isAbsolute(b.path) ? b.path : path.resolve(configDir, b.path),
        }));
    } catch (err) {
        console.error(`Failed to parse config file: ${configPath}`, err);
        process.exit(1);
    }
}

/**
 * Print usage information
 */
function printUsage() {
    console.error(`
SDD Bundle Editor MCP Server

USAGE:
  sdd-mcp-server [options] [bundle-paths...]

OPTIONS:
  --config <path>   Load bundle configuration from YAML file
  --http            Start HTTP/SSE transport instead of stdio
  --port <port>     HTTP port (default: 3001, env: MCP_HTTP_PORT)
  --help            Show this help message

EXAMPLES:
  # Stdio mode (for Claude Desktop, Copilot, etc.)
  sdd-mcp-server /path/to/bundle

  # HTTP mode (for web clients)
  sdd-mcp-server --http --port 3001 /path/to/bundle

  # Config file mode
  sdd-mcp-server --config bundles.yaml

ENVIRONMENT:
  SDD_SAMPLE_BUNDLE_PATH   Default bundle path if no args provided
  MCP_HTTP_PORT            Default HTTP port (default: 3001)
`);
}

// Main entry point
async function main() {
    // Check for help flag
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    const { bundleConfigs, httpMode, httpPort } = parseArgs();

    console.error(`Loading ${bundleConfigs.length} bundle(s):`);
    bundleConfigs.forEach(b => console.error(`  - ${b.id}: ${b.path}`));

    if (httpMode) {
        // HTTP/SSE Transport Mode
        console.error(`\nStarting in HTTP mode on port ${httpPort}...`);

        // First, load bundles using a primary SddMcpServer instance
        const primaryServer = new SddMcpServer(bundleConfigs);
        await primaryServer.loadBundles();

        // Create HTTP server with a factory that creates NEW SddMcpServer instances per session
        // Each session needs its own McpServer instance to avoid state conflicts
        const httpServer = createMcpHttpServer({
            port: httpPort,
            getServer: () => {
                // Create a new SddMcpServer for each HTTP session
                // Important: We share the loaded bundles to avoid re-loading from disk
                const sessionServer = new SddMcpServer(bundleConfigs);
                // Copy loaded bundles from primary server
                const loadedBundles = primaryServer.getLoadedBundles();
                for (const [id, loaded] of loadedBundles) {
                    sessionServer.getLoadedBundles().set(id, loaded);
                }
                return sessionServer.getUnderlyingServer();
            },
        });

        await httpServer.start();
    } else {
        // Stdio Transport Mode (default)
        const server = new SddMcpServer(bundleConfigs);
        await server.start();
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

