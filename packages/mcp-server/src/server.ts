import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadBundleWithSchemaValidation } from "@sdd-bundle-editor/core-model";
import { BundleConfig, LoadedBundle } from "./types.js";
import { resourceError } from "./response-helpers.js";
import { setupAllPrompts } from "./prompts/index.js";
import { setupAllTools, ToolContext } from "./tools/index.js";
import * as path from "path";
import * as fs from "fs/promises";

export class SddMcpServer {
    private server: McpServer;
    private bundleConfigs: BundleConfig[];
    private bundles: Map<string, LoadedBundle> = new Map();

    constructor(bundleConfigs: BundleConfig[]) {
        this.bundleConfigs = bundleConfigs;
        this.server = new McpServer(
            {
                name: "sdd-bundle-editor",
                version: "0.1.0",
            },
            {
                instructions: `SDD Bundle Editor MCP Server - Specification bundle access for AI agents.

IMPORTANT DEFAULTS:
- apply_changes: dryRun=true by default (preview mode). Set dryRun=false to persist changes.
- Multi-bundle mode: Most tools require bundleId. Call list_bundles first to discover available bundles.
- validate: 'strict' by default for apply_changes. Schema validation rejects invalid entities.

RECOMMENDED WORKFLOW:
1. list_bundles → get available bundle IDs and entity types
2. get_bundle_snapshot or list_entity_summaries → understand bundle structure
3. read_entity / get_context → get detailed entity data with relationships
4. apply_changes with dryRun=true → preview proposed changes
5. apply_changes with dryRun=false → persist changes to disk

TOOL OUTPUTS:
All tools return a standardized envelope with:
- structuredContent: Machine-parsable object { ok, tool, data, meta, diagnostics }
- content[0].text: Human-readable JSON string
- isError: true if operation failed

For errors, structuredContent contains: { ok: false, error: { code, message, details } }
Error codes: BAD_REQUEST, NOT_FOUND, VALIDATION_ERROR, REFERENCE_ERROR, DELETE_BLOCKED, INTERNAL`,
            }
        );

        this.setupResources();
        this.setupTools();
        this.setupPrompts();
    }

    /**
     * Check if we're in single-bundle mode (for backward compatibility)
     */
    private isSingleBundleMode(): boolean {
        return this.bundles.size === 1;
    }

    /**
     * Get the default bundle (first one, or only one in single-bundle mode)
     */
    private getDefaultBundle(): LoadedBundle | undefined {
        return this.bundles.values().next().value;
    }

    /**
     * Get a bundle by ID, or the default bundle if not specified
     */
    private getBundle(bundleId?: string): LoadedBundle | undefined {
        if (bundleId) {
            return this.bundles.get(bundleId);
        }
        if (this.isSingleBundleMode()) {
            return this.getDefaultBundle();
        }
        return undefined;
    }

    /**
     * Get all bundle IDs
     */
    private getBundleIds(): string[] {
        return Array.from(this.bundles.keys());
    }

    private setupResources() {
        // List all bundles resource
        this.server.registerResource(
            "bundles",
            "bundle://list",
            {
                description: "List all loaded specification bundles with metadata, entity types, and counts",
                mimeType: "application/json",
            },
            async (uri) => {
                const bundleList = Array.from(this.bundles.values()).map(b => ({
                    id: b.id,
                    name: b.bundle.manifest.metadata.name,
                    bundleType: b.bundle.manifest.metadata.bundleType,
                    tags: b.tags || [],
                    description: b.description || b.bundle.manifest.metadata.description || "",
                    entityTypes: Array.from(b.bundle.entities.keys()),
                    entityCount: Array.from(b.bundle.entities.values()).reduce((sum, m) => sum + m.size, 0),
                }));
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(bundleList, null, 2),
                        mimeType: "application/json",
                    }],
                };
            }
        );

        // Domain knowledge resource (aggregated from all bundles)
        this.server.registerResource(
            "domain-knowledge",
            "bundle://domain-knowledge",
            {
                description: "Aggregated domain knowledge documentation from all loaded bundles",
                mimeType: "text/markdown",
            },
            async (uri) => {
                const domainDocs: { bundleId: string; content: string }[] = [];
                for (const [id, loaded] of this.bundles) {
                    if (loaded.bundle.domainMarkdown) {
                        domainDocs.push({
                            bundleId: id,
                            content: loaded.bundle.domainMarkdown,
                        });
                    }
                }

                if (domainDocs.length === 0) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: "No domain knowledge files configured in any loaded bundle.",
                            mimeType: "text/plain",
                        }],
                    };
                }

                // Format as markdown with sections per bundle
                const combined = domainDocs.map(d =>
                    `# Bundle: ${d.bundleId}\n\n${d.content}`
                ).join("\n\n---\n\n");

                return {
                    contents: [{
                        uri: uri.href,
                        text: combined,
                        mimeType: "text/markdown",
                    }],
                };
            }
        );

        // Resource Template: Bundle manifest
        // URI: bundle://{bundleId}/manifest
        this.server.registerResource(
            "bundle-manifest",
            new ResourceTemplate("bundle://{bundleId}/manifest", {
                list: async () => {
                    // List all available manifests
                    return {
                        resources: Array.from(this.bundles.keys()).map(bundleId => ({
                            uri: `bundle://${bundleId}/manifest`,
                            name: `${bundleId} manifest`,
                            description: `Bundle manifest for ${bundleId}`,
                            mimeType: "application/json",
                        })),
                    };
                },
                complete: {
                    bundleId: () => Array.from(this.bundles.keys()),
                },
            }),
            {
                description: "Bundle manifest containing metadata, entity type definitions, and bundle structure",
                mimeType: "application/json",
            },
            async (uri, params) => {
                const bundleId = params.bundleId as string;
                const loaded = this.bundles.get(bundleId);

                if (!loaded) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(resourceError("bundle-manifest", "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId })),
                            mimeType: "application/json",
                        }],
                    };
                }

                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(loaded.bundle.manifest, null, 2),
                        mimeType: "application/json",
                    }],
                };
            }
        );

        // Resource Template: Entity by type and ID
        // URI: bundle://{bundleId}/entity/{type}/{id}
        this.server.registerResource(
            "entity",
            new ResourceTemplate("bundle://{bundleId}/entity/{type}/{id}", {
                list: undefined, // Too many entities to enumerate
                complete: {
                    bundleId: () => Array.from(this.bundles.keys()),
                    type: (_value: string, context?: { arguments?: Record<string, string> }) => {
                        const bundleId = context?.arguments?.bundleId;
                        if (!bundleId) return [];
                        const loaded = this.bundles.get(bundleId);
                        return loaded ? Array.from(loaded.bundle.entities.keys()) : [];
                    },
                    id: (_value: string, context?: { arguments?: Record<string, string> }) => {
                        const bundleId = context?.arguments?.bundleId;
                        const entityType = context?.arguments?.type;
                        if (!bundleId || !entityType) return [];
                        const loaded = this.bundles.get(bundleId);
                        const entityMap = loaded?.bundle.entities.get(entityType);
                        return entityMap ? Array.from(entityMap.keys()) : [];
                    },
                },
            }),
            {
                description: "Read a specific entity by bundle ID, entity type, and entity ID",
                mimeType: "application/json",
            },
            async (uri, params) => {
                const bundleId = params.bundleId as string;
                const entityType = params.type as string;
                const entityId = params.id as string;

                const loaded = this.bundles.get(bundleId);
                if (!loaded) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(resourceError("entity", "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId })),
                            mimeType: "application/json",
                        }],
                    };
                }

                const entityMap = loaded.bundle.entities.get(entityType);
                const entity = entityMap?.get(entityId);

                if (!entity) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(resourceError("entity", "NOT_FOUND", `Entity not found: ${entityType}/${entityId}`, { entityType, entityId })),
                            mimeType: "application/json",
                        }],
                    };
                }

                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify(entity.data, null, 2),
                        mimeType: "application/json",
                    }],
                };
            }
        );

        // Resource Template: Schema by entity type
        // URI: bundle://{bundleId}/schema/{type}
        this.server.registerResource(
            "schema",
            new ResourceTemplate("bundle://{bundleId}/schema/{type}", {
                list: async () => {
                    // List all schemas across all bundles
                    const schemas: { uri: string; name: string; description: string; mimeType: string }[] = [];
                    for (const [bundleId, loaded] of this.bundles) {
                        const schemaMap = loaded.bundle.manifest.spec?.schemas?.documents || {};
                        for (const entityType of Object.keys(schemaMap)) {
                            schemas.push({
                                uri: `bundle://${bundleId}/schema/${entityType}`,
                                name: `${entityType} schema`,
                                description: `JSON Schema for ${entityType} in ${bundleId}`,
                                mimeType: "application/json",
                            });
                        }
                    }
                    return { resources: schemas };
                },
                complete: {
                    bundleId: () => Array.from(this.bundles.keys()),
                    type: (_value: string, context?: { arguments?: Record<string, string> }) => {
                        const bundleId = context?.arguments?.bundleId;
                        if (!bundleId) return [];
                        const loaded = this.bundles.get(bundleId);
                        if (!loaded) return [];
                        const schemaMap = loaded.bundle.manifest.spec?.schemas?.documents || {};
                        return Object.keys(schemaMap);
                    },
                },
            }),
            {
                description: "JSON Schema definition for a specific entity type in a bundle",
                mimeType: "application/json",
            },
            async (uri, params) => {
                const bundleId = params.bundleId as string;
                const entityType = params.type as string;

                const loaded = this.bundles.get(bundleId);
                if (!loaded) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(resourceError("schema", "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId })),
                            mimeType: "application/json",
                        }],
                    };
                }

                const schemaRelPath = loaded.bundle.manifest.spec?.schemas?.documents?.[entityType];
                if (!schemaRelPath) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(resourceError("schema", "NOT_FOUND", `No schema configured for type: ${entityType}`, { entityType })),
                            mimeType: "application/json",
                        }],
                    };
                }

                try {
                    const schemaPath = path.join(loaded.path, schemaRelPath);
                    const schemaContent = await fs.readFile(schemaPath, 'utf8');
                    return {
                        contents: [{
                            uri: uri.href,
                            text: schemaContent,
                            mimeType: "application/json",
                        }],
                    };
                } catch (err) {
                    return {
                        contents: [{
                            uri: uri.href,
                            text: JSON.stringify(resourceError("schema", "INTERNAL", `Failed to load schema: ${err}`)),
                            mimeType: "application/json",
                        }],
                    };
                }
            }
        );
    }

    /**
     * Setup MCP tools for bundle operations.
     * 
     * Tools are organized into modules by category:
     * - bundle-tools.ts: list_bundles, get_bundle_schema, get_bundle_snapshot
     * - entity-tools.ts: read_entity, read_entities, list_entities, list_entity_summaries
     * - schema-tools.ts: get_entity_schema, get_entity_relations
     * - context-tools.ts: get_context, get_conformance_context
     * - search-tools.ts: search_entities
     * - validation-tools.ts: validate_bundle
     * - mutation-tools.ts: apply_changes
     * - sampling-tools.ts: critique_bundle
     * 
     * See packages/mcp-server/src/tools/ for individual implementations.
     */
    private setupTools() {
        const ctx: ToolContext = {
            server: this.server,
            bundles: this.bundles,
            getBundle: (id) => this.getBundle(id),
            getBundleIds: () => this.getBundleIds(),
            isSingleBundleMode: () => this.isSingleBundleMode(),
        };
        setupAllTools(ctx);
    }

    private setupPrompts() {
        setupAllPrompts({
            server: this.server,
            getBundle: (id) => this.getBundle(id),
            getBundleIds: () => this.getBundleIds(),
            bundles: this.bundles,
        });
    }

    /**
     * Load all configured bundles into memory.
     * This is separated from transport startup to allow flexibility.
     */
    async loadBundles(): Promise<void> {
        for (const config of this.bundleConfigs) {
            console.error(`Loading bundle: ${config.id} from ${config.path}...`);
            try {
                const result = await loadBundleWithSchemaValidation(config.path);
                this.bundles.set(config.id, {
                    id: config.id,
                    path: config.path,
                    tags: config.tags,
                    description: config.description,
                    bundle: result.bundle,
                    diagnostics: result.diagnostics.map(d => ({
                        severity: d.severity,
                        message: d.message,
                        entityId: d.entityId,
                        entityType: d.entityType,
                        filePath: d.filePath,
                        path: d.path,
                        source: d.source,
                        code: d.code,
                    })),
                });
                const errorCount = result.diagnostics.filter(d => d.severity === 'error').length;
                const warnCount = result.diagnostics.filter(d => d.severity === 'warning').length;
                console.error(`  ✓ Loaded ${config.id} (${errorCount} errors, ${warnCount} warnings)`);
            } catch (err) {
                console.error(`  ✗ Failed to load ${config.id}:`, err);
                // Continue loading other bundles
            }
        }

        if (this.bundles.size === 0) {
            throw new Error("No bundles loaded successfully.");
        }

        console.error(`\nLoaded ${this.bundles.size} bundle(s) successfully.`);
    }

    /**
     * Get the underlying McpServer instance.
     * Useful for connecting to custom transports (HTTP, WebSocket, etc.)
     */
    getUnderlyingServer(): McpServer {
        return this.server;
    }

    /**
     * Get loaded bundles (for sharing state with HTTP transport).
     */
    getLoadedBundles(): Map<string, LoadedBundle> {
        return this.bundles;
    }

    /**
     * Start the MCP server on stdio transport.
     * This is the primary mode for use with Claude Desktop and other MCP clients.
     */
    async startStdio(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("SDD MCP Server running on stdio");
    }

    /**
     * Legacy start method for backward compatibility.
     * Loads bundles and starts on stdio transport.
     */
    async start(): Promise<void> {
        await this.loadBundles();
        await this.startStdio();
    }
}
