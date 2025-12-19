import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadBundleWithSchemaValidation, Bundle, saveEntity, createEntity, deleteEntity, applyChange, compileDocumentSchemas, validateEntityWithSchemas } from "@sdd-bundle-editor/core-model";
import { z } from "zod";
import { BundleConfig, LoadedBundle } from "./types.js";
import { toolSuccess, toolError, resourceError, type Diagnostic as ResponseDiagnostic } from "./response-helpers.js";
import { READ_ONLY_TOOL, MUTATING_TOOL, EXTERNAL_SAMPLING_TOOL } from "./tool-annotations.js";
import { setupAllPrompts } from "./prompts/index.js";
import * as path from "path";
import * as fs from "fs/promises";

export class SddMcpServer {
    private server: McpServer;
    private bundleConfigs: BundleConfig[];
    private bundles: Map<string, LoadedBundle> = new Map();

    constructor(bundleConfigs: BundleConfig[]) {
        this.bundleConfigs = bundleConfigs;
        this.server = new McpServer({
            name: "sdd-bundle-editor",
            version: "0.1.0",
        });

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
        this.server.resource(
            "bundles",
            "bundle://list",
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
        this.server.resource(
            "domain-knowledge",
            "bundle://domain-knowledge",
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
        this.server.resource(
            "bundle-manifest",
            new ResourceTemplate("bundle://{bundleId}/manifest", {
                list: async () => {
                    // List all available manifests
                    return {
                        resources: Array.from(this.bundles.keys()).map(bundleId => ({
                            uri: `bundle://${bundleId}/manifest`,
                            name: `${bundleId} manifest`,
                            description: `Bundle manifest for ${bundleId}`,
                        })),
                    };
                },
            }),
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
        this.server.resource(
            "entity",
            new ResourceTemplate("bundle://{bundleId}/entity/{type}/{id}", {
                list: undefined, // Too many entities to enumerate
            }),
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
        this.server.resource(
            "schema",
            new ResourceTemplate("bundle://{bundleId}/schema/{type}", {
                list: async () => {
                    // List all schemas across all bundles
                    const schemas: { uri: string; name: string; description: string }[] = [];
                    for (const [bundleId, loaded] of this.bundles) {
                        const schemaMap = loaded.bundle.manifest.spec?.schemas?.documents || {};
                        for (const entityType of Object.keys(schemaMap)) {
                            schemas.push({
                                uri: `bundle://${bundleId}/schema/${entityType}`,
                                name: `${entityType} schema`,
                                description: `JSON Schema for ${entityType} in ${bundleId}`,
                            });
                        }
                    }
                    return { resources: schemas };
                },
            }),
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

    private setupTools() {
        // Tool: list_bundles - uses registerTool() for annotations support
        this.server.registerTool(
            "list_bundles",
            {
                description: "List all loaded specification bundles. Use this first to discover what bundles are available, their IDs, entity types, and metadata. Returns bundle IDs needed for other tool calls in multi-bundle mode.",
                inputSchema: {},  // No-args tool
                annotations: READ_ONLY_TOOL,
            },
            async () => {
                const TOOL_NAME = "list_bundles";
                const bundleList = Array.from(this.bundles.values()).map(b => ({
                    id: b.id,
                    name: b.bundle.manifest.metadata.name,
                    bundleType: b.bundle.manifest.metadata.bundleType,
                    tags: b.tags || [],
                    description: b.description,
                    path: b.path,
                    entityTypes: Array.from(b.bundle.entities.keys()),
                    entityCount: Array.from(b.bundle.entities.values()).reduce((sum, m) => sum + m.size, 0),
                }));
                return toolSuccess(TOOL_NAME, {
                    bundles: bundleList,
                }, {
                    meta: { count: bundleList.length },
                    diagnostics: [],
                });
            }
        );

        // Tool: get_bundle_schema
        this.server.registerTool(
            "get_bundle_schema",
            {
                description: "Get the bundle type definition (metaschema) for a bundle. Returns entity type configurations, relationships between entities, and bundle metadata. Use to understand how entities relate to each other.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId }) => {
                const TOOL_NAME = "get_bundle_schema";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const bundleDef = loaded.bundle.bundleTypeDefinition;
                const manifest = loaded.bundle.manifest;

                return toolSuccess(TOOL_NAME, {
                    manifest: {
                        name: manifest.metadata?.name,
                        bundleType: manifest.metadata?.bundleType,
                        version: manifest.metadata?.version,
                        description: manifest.metadata?.description,
                    },
                    bundleTypeDefinition: bundleDef,
                }, {
                    bundleId: loaded.id,
                    diagnostics: [],
                });
            }
        );

        // Tool: get_entity_schema
        this.server.registerTool(
            "get_entity_schema",
            {
                description: "Get the JSON schema for a specific entity type. Use for form rendering or understanding entity structure. Returns the complete JSON schema including properties, required fields, and custom extensions like x-sdd-ui.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityType }) => {
                const TOOL_NAME = "get_entity_schema";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                // Get schema path from manifest
                const schemaRelPath = loaded.bundle.manifest.spec?.schemas?.documents?.[entityType];
                if (!schemaRelPath) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `No schema defined for entity type: ${entityType}`, { bundleId: loaded.id, entityType });
                }

                // Load schema from disk
                try {
                    const schemaPath = path.join(loaded.path, schemaRelPath);
                    const schemaContent = await fs.readFile(schemaPath, 'utf8');
                    const schema = JSON.parse(schemaContent);

                    return toolSuccess(TOOL_NAME, {
                        entityType,
                        schema,
                    }, {
                        bundleId: loaded.id,
                        diagnostics: [],
                    });
                } catch (err) {
                    return toolError(TOOL_NAME, "INTERNAL", `Failed to load schema for ${entityType}: ${String(err)}`, { entityType });
                }
            }
        );

        // Tool: get_bundle_snapshot
        this.server.registerTool(
            "get_bundle_snapshot",
            {
                description: "Get a complete bundle snapshot with all entities, schemas, refGraph, and diagnostics in a single call. Optimized for UI initial load - much more efficient than multiple calls. Use entityTypes to filter, includeEntityData to control payload size, and maxEntities to prevent truncation.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    entityTypes: z.array(z.string()).optional().describe("Filter to specific entity types (e.g., ['Requirement', 'Task']). Returns all types if not specified."),
                    includeEntityData: z.enum(["full", "summary", "ids"]).default("full").describe("Entity data detail: full (all fields), summary (id, title, state), ids (just IDs)"),
                    includeSchemas: z.boolean().default(true).describe("Include JSON schemas for each entity type"),
                    includeRefGraph: z.boolean().default(true).describe("Include reference graph edges"),
                    includeDiagnostics: z.boolean().default(true).describe("Include validation diagnostics"),
                    maxEntities: z.number().max(10000).default(5000).describe("Maximum entities to return before truncation (default: 5000, max: 10000)"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityTypes, includeEntityData, includeSchemas, includeRefGraph, includeDiagnostics, maxEntities }) => {
                const TOOL_NAME = "get_bundle_snapshot";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const bundle = loaded.bundle;

                // Determine which types to include
                const typesToInclude = entityTypes
                    ? entityTypes.filter(t => bundle.entities.has(t))
                    : Array.from(bundle.entities.keys());

                // Build entities map with size controls
                const entities: Record<string, Array<Record<string, unknown>>> = {};
                let entityCount = 0;
                let totalEntities = 0;
                let truncated = false;

                for (const entityType of typesToInclude.sort()) { // Stable ordering
                    const entityMap = bundle.entities.get(entityType);
                    if (!entityMap) continue;

                    entities[entityType] = [];
                    const sortedIds = Array.from(entityMap.keys()).sort(); // Stable ordering

                    for (const id of sortedIds) {
                        totalEntities++;
                        if (entityCount >= maxEntities) {
                            truncated = true;
                            continue; // Still count total but don't add
                        }

                        const entity = entityMap.get(id)!;
                        let entityData: Record<string, unknown>;

                        if (includeEntityData === "full") {
                            entityData = {
                                id: entity.id,
                                entityType: entity.entityType,
                                ...entity.data,
                            };
                        } else if (includeEntityData === "summary") {
                            const data = entity.data as Record<string, unknown>;
                            entityData = {
                                id: entity.id,
                                entityType: entity.entityType,
                                title: data.title,
                                name: data.name,
                                state: data.state,
                            };
                        } else {
                            // ids only
                            entityData = { id: entity.id, entityType: entity.entityType };
                        }

                        entities[entityType].push(entityData);
                        entityCount++;
                    }
                }

                // Build schemas map if requested (only for included types)
                let schemas: Record<string, unknown> | undefined;
                if (includeSchemas) {
                    schemas = {};
                    const schemaDocs = bundle.manifest.spec?.schemas?.documents ?? {};
                    for (const entityType of typesToInclude.sort()) {
                        const schemaRelPath = schemaDocs[entityType];
                        if (!schemaRelPath) continue;
                        try {
                            const schemaPath = path.join(loaded.path, schemaRelPath);
                            const schemaContent = await fs.readFile(schemaPath, 'utf8');
                            schemas[entityType] = JSON.parse(schemaContent);
                        } catch {
                            // Schema loading failed - skip silently
                        }
                    }
                }

                // Build response data
                const snapshotData: Record<string, unknown> = {
                    manifest: bundle.manifest,
                    bundleTypeDefinition: bundle.bundleTypeDefinition,
                    entities,
                };

                if (includeSchemas && schemas) {
                    snapshotData.schemas = schemas;
                }

                if (includeRefGraph) {
                    snapshotData.refGraph = bundle.refGraph;
                }

                return toolSuccess(TOOL_NAME, snapshotData, {
                    bundleId: loaded.id,
                    meta: {
                        entityCount,
                        totalEntities,
                        entityTypes: typesToInclude.sort(),
                        allEntityTypes: Array.from(bundle.entities.keys()).sort(),
                        schemaCount: schemas ? Object.keys(schemas).length : 0,
                        diagnosticCount: loaded.diagnostics.length,
                        includeEntityData,
                        maxEntities,
                        truncated,
                    },
                    // Only include diagnostics if requested - undefined will be omitted from response
                    diagnostics: includeDiagnostics ? loaded.diagnostics : undefined,
                });
            }
        );

        // Tool: read_entity
        this.server.registerTool(
            "read_entity",
            {
                description: "Read the complete data for a specific entity. Use when you need full details about a Requirement, Task, Feature, Component, Profile, Threat, or any other entity type. Returns all fields including title, description, state, priority, and relationships.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
                    id: z.string().describe("Entity ID"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityType, id }) => {
                const TOOL_NAME = "read_entity";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const entitiesOfType = loaded.bundle.entities.get(entityType);
                if (!entitiesOfType) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `Unknown entity type: ${entityType}`, { bundleId: loaded.id, entityType });
                }

                const entity = entitiesOfType.get(id);
                if (!entity) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `Entity not found: ${id}`, { bundleId: loaded.id, entityType, entityId: id });
                }

                // Return entity with entityType for consistency
                return toolSuccess(TOOL_NAME, {
                    id: entity.id,
                    entityType: entity.entityType,
                    ...entity.data,
                }, {
                    bundleId: loaded.id,
                    diagnostics: [],
                });
            }
        );

        // Tool: read_entities (bulk read)
        this.server.registerTool(
            "read_entities",
            {
                description: "Read multiple entities in a single call. Use when you need 2-50 entities and already know their IDs. Much more efficient than calling read_entity multiple times.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
                    ids: z.array(z.string()).max(50).describe("Entity IDs to fetch (max 50)"),
                    fields: z.array(z.string()).optional().describe("Specific fields to return (optional, returns all if not specified)"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityType, ids, fields }) => {
                const TOOL_NAME = "read_entities";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const entitiesOfType = loaded.bundle.entities.get(entityType);
                if (!entitiesOfType) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `Unknown entity type: ${entityType}`, { bundleId: loaded.id, entityType });
                }

                const entities: Array<Record<string, unknown>> = [];
                const notFound: string[] = [];

                for (const id of ids) {
                    const entity = entitiesOfType.get(id);
                    if (entity) {
                        let entityData: Record<string, unknown> = { ...entity.data };

                        // Filter fields if specified
                        if (fields && fields.length > 0) {
                            const filtered: Record<string, unknown> = { id: entity.id };
                            for (const field of fields) {
                                if (field in entityData) {
                                    filtered[field] = entityData[field];
                                }
                            }
                            entityData = filtered;
                        }

                        entities.push(entityData);
                    } else {
                        notFound.push(id);
                    }
                }

                return toolSuccess(TOOL_NAME, {
                    entityType,
                    entities,
                }, {
                    bundleId: loaded.id,
                    meta: {
                        requested: ids.length,
                        found: entities.length,
                        notFound,
                    },
                    diagnostics: [],
                });
            }
        );

        // Tool: list_entities
        this.server.registerTool(
            "list_entities",
            {
                description: "List all entity IDs in a bundle with optional pagination. Use to discover available entity IDs, see what entity types exist, or get an overview of bundle contents. Without entityType filter, shows all available types. With filter, shows all IDs of that type.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode, or 'all' to list from all bundles)"),
                    entityType: z.string().optional().describe("Filter by entity type"),
                    limit: z.number().max(500).default(100).describe("Maximum number of IDs to return (default: 100, max: 500)"),
                    offset: z.number().default(0).describe("Starting offset for pagination"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityType, limit, offset }) => {
                const TOOL_NAME = "list_entities";

                // Special case: list from all bundles
                if (bundleId === "all" || (!bundleId && !this.isSingleBundleMode())) {
                    const bundleData: Record<string, any> = {};
                    for (const [bId, loaded] of this.bundles) {
                        if (entityType) {
                            const entities = loaded.bundle.entities.get(entityType);
                            if (entities) {
                                bundleData[bId] = Array.from(entities.keys()).sort(); // Stable ordering
                            }
                        } else {
                            bundleData[bId] = {
                                entityTypes: Array.from(loaded.bundle.entities.keys()).sort(), // Stable ordering
                            };
                        }
                    }
                    return toolSuccess(TOOL_NAME, bundleData, {
                        meta: { bundleCount: this.bundles.size },
                        diagnostics: [],
                    });
                }

                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                if (entityType) {
                    const entitiesOfType = loaded.bundle.entities.get(entityType);
                    const allIds = entitiesOfType ? Array.from(entitiesOfType.keys()).sort() : []; // Stable ordering
                    const total = allIds.length;
                    const paginatedIds = allIds.slice(offset, offset + limit);
                    const hasMore = offset + limit < total;

                    return toolSuccess(TOOL_NAME, {
                        entityType,
                        ids: paginatedIds,
                    }, {
                        bundleId: loaded.id,
                        meta: { total, limit, offset, returned: paginatedIds.length, hasMore },
                        diagnostics: [],
                    });
                }

                const allTypes = Array.from(loaded.bundle.entities.keys()).sort(); // Stable ordering
                return toolSuccess(TOOL_NAME, {
                    entityTypes: allTypes,
                }, {
                    bundleId: loaded.id,
                    meta: { typeCount: allTypes.length },
                    diagnostics: [],
                });
            }
        );

        // Tool: list_entity_summaries
        this.server.registerTool(
            "list_entity_summaries",
            {
                description: "List entities with summary fields (id, title, state, tags). Better than list_entities when you need to select relevant items without loading full entity data. Supports pagination.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    entityType: z.string().optional().describe("Filter by entity type"),
                    include: z.array(z.string()).default(["id", "title"]).describe("Fields to include in summaries"),
                    limit: z.number().default(50).describe("Max results (default 50, max 200)"),
                    offset: z.number().default(0).describe("Pagination offset"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityType, include, limit, offset }) => {
                const TOOL_NAME = "list_entity_summaries";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                // Clamp limit to max 200
                const effectiveLimit = Math.min(limit, 200);

                // Collect entities from all types or just the specified type (with stable ordering)
                const allItems: Array<{ entityType: string;[key: string]: unknown }> = [];
                const typesToScan = entityType
                    ? [[entityType, loaded.bundle.entities.get(entityType)] as const].filter(([_, v]) => v)
                    : Array.from(loaded.bundle.entities.entries()).sort((a, b) => a[0].localeCompare(b[0]));

                for (const [eType, entities] of typesToScan) {
                    if (!entities) continue;
                    const sortedKeys = Array.from(entities.keys()).sort(); // Stable ordering
                    for (const eId of sortedKeys) {
                        const entity = entities.get(eId)!;
                        const summary: Record<string, unknown> = { entityType: eType };
                        const data = entity.data as Record<string, unknown>;

                        // Always include id
                        summary.id = eId;

                        // Include requested fields
                        for (const field of include) {
                            if (field in data) {
                                summary[field] = data[field];
                            }
                        }

                        allItems.push(summary as { entityType: string;[key: string]: unknown });
                    }
                }

                // Apply pagination
                const total = allItems.length;
                const paginatedItems = allItems.slice(offset, offset + effectiveLimit);
                const hasMore = offset + effectiveLimit < total;

                return toolSuccess(TOOL_NAME, {
                    items: paginatedItems,
                }, {
                    bundleId: loaded.id,
                    meta: {
                        total,
                        limit: effectiveLimit,
                        offset,
                        returned: paginatedItems.length,
                        hasMore,
                    },
                    diagnostics: [],
                });
            }
        );

        // Tool: get_entity_relations
        this.server.registerTool(
            "get_entity_relations",
            {
                description: "Get the relationships defined for an entity type. Use to understand how entities connect to each other. Returns relation definitions from the bundle-type specification.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    entityType: z.string().optional().describe("Filter by entity type (optional, shows all relations if not specified)"),
                    direction: z.enum(["outgoing", "incoming", "both"]).default("both").describe("Filter by direction: outgoing (this type references other), incoming (other types reference this), both (all)"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityType, direction }) => {
                const TOOL_NAME = "get_entity_relations";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const bundleDef = loaded.bundle.bundleTypeDefinition;
                if (!bundleDef || !bundleDef.relations) {
                    return toolSuccess(TOOL_NAME, {
                        entityType: entityType || "all",
                        direction,
                        relations: [],
                    }, {
                        bundleId: loaded.id,
                        meta: { total: 0 },
                        diagnostics: [],
                    });
                }

                // Filter relations based on entityType and direction
                const relations = bundleDef.relations.filter(rel => {
                    if (!entityType) return true;

                    const isOutgoing = rel.fromEntity === entityType;
                    const isIncoming = rel.toEntity === entityType;

                    if (direction === "outgoing") return isOutgoing;
                    if (direction === "incoming") return isIncoming;
                    return isOutgoing || isIncoming;
                });

                // Transform to a more useful format
                const formatted = relations.map(rel => ({
                    name: rel.name,
                    fromEntity: rel.fromEntity,
                    fromField: rel.fromField,
                    toEntity: rel.toEntity,
                    multiplicity: rel.multiplicity,
                    // Add computed direction relative to the queried entityType
                    ...(entityType && {
                        direction: rel.fromEntity === entityType ? "outgoing" : "incoming",
                    }),
                }));

                return toolSuccess(TOOL_NAME, {
                    entityType: entityType || "all",
                    direction,
                    relations: formatted,
                }, {
                    bundleId: loaded.id,
                    meta: { total: formatted.length },
                    diagnostics: [],
                });
            }
        );

        // Tool: get_context
        this.server.registerTool(
            "get_context",
            {
                description: "Get an entity with related dependencies. Supports sizing controls to prevent truncation. Use when you need to understand how an entity connects to others.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    entityType: z.string().describe("Entity type"),
                    id: z.string().describe("Entity ID"),
                    depth: z.number().max(3).default(1).describe("Depth of traversal (default: 1, max: 3)"),
                    maxRelated: z.number().max(100).default(20).describe("Max related entities to return (default: 20, max: 100)"),
                    includeRelated: z.enum(["full", "summary", "ids"]).default("full").describe("Detail level for related entities: full (all fields), summary (id, title, state), ids (just IDs)"),
                    fields: z.array(z.string()).optional().describe("Specific fields to return for target entity"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, entityType, id, depth, maxRelated, includeRelated, fields }) => {
                const TOOL_NAME = "get_context";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const bundle = loaded.bundle;
                const targetEntities = bundle.entities.get(entityType);
                const targetEntity = targetEntities?.get(id);

                if (!targetEntity) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `Entity not found: ${entityType}/${id}`, { bundleId: loaded.id, entityType, entityId: id });
                }

                // Graph traversal to find related entities
                interface RelatedItem {
                    id: string;
                    entityType: string;
                    relation: string;  // Stable key: "references" or "referencedBy"
                    field: string;     // The field name that creates the relationship
                    data?: unknown;    // Full data, summary, or omitted based on includeRelated
                }

                const relatedEntities: RelatedItem[] = [];
                const visited = new Set<string>();
                visited.add(`${entityType}:${id}`);
                let totalRelated = 0;
                let truncated = false;

                // Helper to add related entity
                const addRelated = (eType: string, eId: string, relation: string, field: string) => {
                    if (totalRelated >= maxRelated) {
                        truncated = true;
                        return;
                    }

                    const key = `${eType}:${eId}`;
                    if (visited.has(key)) return;
                    visited.add(key);

                    const entity = bundle.entities.get(eType)?.get(eId);
                    if (entity) {
                        const item: RelatedItem = {
                            id: eId,
                            entityType: eType,
                            relation,
                            field,
                        };

                        // Add data based on includeRelated setting
                        if (includeRelated === "full") {
                            item.data = entity.data;
                        } else if (includeRelated === "summary") {
                            const data = entity.data as Record<string, unknown>;
                            item.data = {
                                id: data.id,
                                title: data.title,
                                name: data.name,
                                state: data.state,
                            };
                        }
                        // For "ids", we don't add data property

                        relatedEntities.push(item);
                        totalRelated++;
                    }
                };

                // Direct outgoing/incoming references using stable relation keys
                for (const edge of bundle.refGraph.edges) {
                    if (edge.fromEntityType === entityType && edge.fromId === id) {
                        // Outgoing reference: this entity references the target
                        addRelated(edge.toEntityType, edge.toId, "references", edge.fromField);
                    }
                    if (edge.toEntityType === entityType && edge.toId === id) {
                        // Incoming reference: target is referenced by this entity
                        addRelated(edge.fromEntityType, edge.fromId, "referencedBy", edge.fromField);
                    }
                }

                // Prepare target entity data
                let targetData: unknown = targetEntity.data;
                if (fields && fields.length > 0) {
                    const data = targetEntity.data as Record<string, unknown>;
                    const filtered: Record<string, unknown> = { id: data.id };
                    for (const f of fields) {
                        if (f in data) {
                            filtered[f] = data[f];
                        }
                    }
                    targetData = filtered;
                }

                return toolSuccess(TOOL_NAME, {
                    target: targetData,
                    related: relatedEntities,
                }, {
                    bundleId: loaded.id,
                    meta: {
                        relatedCount: relatedEntities.length,
                        maxRelated,
                        truncated,
                        includeRelated,
                        depth,
                    },
                    diagnostics: [],
                });
            }
        );

        // Tool: get_conformance_context
        this.server.registerTool(
            "get_conformance_context",
            {
                description: "Get conformance rules and audit templates from a Profile. Use for compliance checking, understanding what rules apply, or preparing for audits. Without profileId, lists all available profiles. With profileId, returns detailed rules, linked requirements, and audit templates.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    profileId: z.string().optional().describe("Profile ID (optional, lists all profiles if not specified)"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId, profileId }) => {
                const TOOL_NAME = "get_conformance_context";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const bundle = loaded.bundle;
                const profiles = bundle.entities.get("Profile");

                // Case 1: List all profiles if no ID provided
                if (!profileId) {
                    if (!profiles || profiles.size === 0) {
                        return toolSuccess(TOOL_NAME, {
                            profiles: [],
                        }, {
                            bundleId: loaded.id,
                            meta: { count: 0 },
                            diagnostics: [],
                        });
                    }
                    const profileSummaries = Array.from(profiles.values()).map(p => ({
                        id: p.id,
                        title: p.data.title,
                        description: p.data.description
                    }));
                    return toolSuccess(TOOL_NAME, {
                        profiles: profileSummaries,
                    }, {
                        bundleId: loaded.id,
                        meta: { count: profileSummaries.length },
                        diagnostics: [],
                    });
                }

                // Case 2: Get specific profile context
                const profile = profiles?.get(profileId);
                if (!profile) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `Profile not found: ${profileId}`, { bundleId: loaded.id, profileId });
                }

                const data = profile.data as any;

                // Expand required features
                const requiredFeatures = (data.requiresFeatures || []).map((ref: string) => {
                    const feat = bundle.entities.get("Feature")?.get(ref);
                    return feat ? feat.data : { id: ref, _error: "Feature not found" };
                });

                // Expand rules with simple requirement text if available
                const expandedRules = (data.conformanceRules || []).map((rule: any) => {
                    const expanded = { ...rule };
                    if (rule.linkedRequirement) {
                        const req = bundle.entities.get("Requirement")?.get(rule.linkedRequirement);
                        if (req) {
                            expanded.requirementText = (req.data as any).description;
                        }
                    }
                    return expanded;
                });

                return toolSuccess(TOOL_NAME, {
                    profile: {
                        id: profile.id,
                        title: data.title,
                        description: data.description,
                    },
                    auditTemplate: data.auditTemplate,
                    rules: expandedRules,
                    requiredFeatures,
                    optionalFeatures: data.optionalFeatures,
                }, {
                    bundleId: loaded.id,
                    meta: { ruleCount: expandedRules.length },
                    diagnostics: [],
                });
            }
        );

        // Tool: search_entities
        this.server.registerTool(
            "search_entities",
            {
                description: "Search for entities across all bundles by keyword with pagination. Use when user asks about something by name, topic, or keyword rather than exact ID. Searches entity IDs, titles, statements, and descriptions. Returns matching entities with their bundle and type.",
                inputSchema: {
                    query: z.string().describe("Search query (searches in entity IDs and titles)"),
                    entityType: z.string().optional().describe("Filter by entity type"),
                    bundleId: z.string().optional().describe("Filter by bundle ID"),
                    limit: z.number().max(100).default(50).describe("Maximum number of results to return (default: 50, max: 100)"),
                    offset: z.number().default(0).describe("Starting offset for pagination"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ query, entityType, bundleId, limit, offset }) => {
                const TOOL_NAME = "search_entities";

                // Fix: Return NOT_FOUND if bundleId is provided but doesn't exist
                if (bundleId && !this.bundles.has(bundleId)) {
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId, availableBundles: this.getBundleIds() });
                }

                const results: Array<{
                    bundleId: string;
                    entityType: string;
                    id: string;
                    title?: string;
                    match: string;
                    matchPriority: number;  // For deterministic sorting
                }> = [];

                const queryLower = query.toLowerCase();
                const bundlesToSearch = bundleId
                    ? [this.bundles.get(bundleId)].filter(Boolean) as LoadedBundle[]
                    : Array.from(this.bundles.values());

                for (const loaded of bundlesToSearch) {
                    const typesToSearch = entityType
                        ? [[entityType, loaded.bundle.entities.get(entityType)] as const].filter(([_, v]) => v)
                        : Array.from(loaded.bundle.entities.entries());

                    for (const [eType, entities] of typesToSearch) {
                        if (!entities) continue;
                        for (const [eId, entity] of entities) {
                            const data = entity.data as any;
                            const idMatch = eId.toLowerCase().includes(queryLower);
                            const titleMatch = data.title?.toLowerCase().includes(queryLower);
                            const statementMatch = data.statement?.toLowerCase().includes(queryLower);
                            const descMatch = data.description?.toLowerCase().includes(queryLower);

                            if (idMatch || titleMatch || statementMatch || descMatch) {
                                // Assign priority: id match (1) > title (2) > statement (3) > description (4)
                                const matchPriority = idMatch ? 1 : titleMatch ? 2 : statementMatch ? 3 : 4;
                                results.push({
                                    bundleId: loaded.id,
                                    entityType: eType,
                                    id: eId,
                                    title: data.title || data.statement,
                                    match: idMatch ? "id" : titleMatch ? "title" : statementMatch ? "statement" : "description",
                                    matchPriority,
                                });
                            }
                        }
                    }
                }

                // Fix: Sort results deterministically before pagination (by match priority, then bundleId, then entityType, then id)
                results.sort((a, b) => {
                    if (a.matchPriority !== b.matchPriority) return a.matchPriority - b.matchPriority;
                    if (a.bundleId !== b.bundleId) return a.bundleId.localeCompare(b.bundleId);
                    if (a.entityType !== b.entityType) return a.entityType.localeCompare(b.entityType);
                    return a.id.localeCompare(b.id);
                });

                // Apply pagination
                const total = results.length;
                // Remove internal matchPriority from output
                const paginatedResults = results.slice(offset, offset + limit).map(({ matchPriority, ...rest }) => rest);
                const hasMore = offset + limit < total;

                // Fix: Include bundleId in envelope if filtering by single bundle
                const effectiveBundleId = bundleId || (bundlesToSearch.length === 1 ? bundlesToSearch[0].id : undefined);

                return toolSuccess(TOOL_NAME, {
                    query,
                    results: paginatedResults,
                }, {
                    bundleId: effectiveBundleId,  // Fix: Include bundleId when single-bundle scoped
                    meta: {
                        total,
                        limit,
                        offset,
                        returned: paginatedResults.length,
                        hasMore,
                    },
                    diagnostics: [],
                });
            }
        );

        // Tool: validate_bundle
        this.server.registerTool(
            "validate_bundle",
            {
                description: "Validate a bundle and return all diagnostics. Use when user asks 'are there any issues?', 'validate my spec', 'check for errors', or 'find broken references'. Returns errors and warnings including broken references, schema violations, and lint rule failures.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode, or 'all' to validate all bundles)"),
                },
                annotations: READ_ONLY_TOOL,
            },
            async ({ bundleId }) => {
                const TOOL_NAME = "validate_bundle";

                // Validate all bundles
                if (bundleId === "all" || (!bundleId && !this.isSingleBundleMode())) {
                    const allDiagnostics: Array<{
                        bundleId: string;
                        severity: string;
                        message: string;
                        entityType?: string;
                        entityId?: string;
                        code?: string;
                    }> = [];

                    for (const [bId, loaded] of this.bundles) {
                        for (const d of loaded.diagnostics) {
                            allDiagnostics.push({
                                bundleId: bId,
                                severity: d.severity as "error" | "warning" | "info",
                                message: d.message,
                                entityType: d.entityType,
                                entityId: d.entityId,
                                code: d.code,
                            });
                        }
                    }

                    const errorCount = allDiagnostics.filter(d => d.severity === 'error').length;
                    const warnCount = allDiagnostics.filter(d => d.severity === 'warning').length;

                    return toolSuccess(TOOL_NAME, {
                        summary: {
                            bundlesChecked: this.bundles.size,
                            totalErrors: errorCount,
                            totalWarnings: warnCount,
                            isValid: errorCount === 0,
                        },
                    }, {
                        meta: { bundleCount: this.bundles.size },
                        diagnostics: allDiagnostics as any, // Extended with bundleId
                    });
                }

                // Validate single bundle
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId or use 'all'.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const errorCount = loaded.diagnostics.filter(d => d.severity === 'error').length;
                const warnCount = loaded.diagnostics.filter(d => d.severity === 'warning').length;

                return toolSuccess(TOOL_NAME, {
                    summary: {
                        totalErrors: errorCount,
                        totalWarnings: warnCount,
                        isValid: errorCount === 0,
                    },
                }, {
                    bundleId: loaded.id,
                    diagnostics: loaded.diagnostics,
                });
            }
        );

        // Tool: apply_changes - Atomic batch changes with validate-before-write
        this.server.registerTool(
            "apply_changes",
            {
                description: "Apply multiple changes to a bundle atomically. Supports create, update, and delete operations. All changes are validated against schemas and reference integrity before writing. dryRun defaults to true for safety - set to false to actually write changes. Returns detailed diagnostics on failure with changeIndex indicating which change caused each error.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    changes: z.array(z.object({
                        operation: z.enum(["create", "update", "delete"]).describe("Type of operation"),
                        entityType: z.string().describe("Entity type (e.g., 'Requirement', 'Task', 'Feature')"),
                        entityId: z.string().describe("Entity ID"),
                        fieldPath: z.string().optional().describe("For updates: dot-notation path to field (e.g., 'description', 'priority'). Field MUST exist in schema."),
                        value: z.any().optional().describe("For updates: new value for the field. For creates: ignored if 'data' is provided"),
                        data: z.any().optional().describe("For creates: complete entity data object"),
                    })).describe("Array of changes to apply atomically"),
                    dryRun: z.boolean().default(true).describe("If true (default), validate and return preview without writing files. Set to false to actually write."),
                    validate: z.enum(["strict", "warn", "none"]).optional().describe("Schema validation: strict (default for writes), warn (default for dryRun), none"),
                    referencePolicy: z.enum(["strict", "warn", "none"]).optional().describe("Reference integrity: strict (default for writes), warn (default for dryRun), none"),
                    deleteMode: z.enum(["restrict", "orphan"]).default("restrict").describe("Delete behavior: restrict (fail if referenced), orphan (allow dangling refs)"),
                },
                annotations: MUTATING_TOOL,
            },
            async ({ bundleId, changes, dryRun, validate: validateParam, referencePolicy: refPolicyParam, deleteMode }) => {
                const TOOL_NAME = "apply_changes";

                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const bundleDir = loaded.path;
                const effectiveBundleId = loaded.id;

                // Determine effective validation modes based on dryRun
                const effectiveValidate = validateParam ?? (dryRun ? "warn" : "strict");
                const effectiveRefPolicy = refPolicyParam ?? (dryRun ? "warn" : "strict");

                // Load a fresh working bundle copy
                let workingBundle: Bundle;
                try {
                    const { bundle } = await loadBundleWithSchemaValidation(bundleDir);
                    workingBundle = bundle;
                } catch (err) {
                    return toolError(TOOL_NAME, "INTERNAL", `Failed to load bundle for modification: ${err instanceof Error ? err.message : String(err)}`);
                }

                // Compile schemas for validation
                let compiledSchemas;
                try {
                    compiledSchemas = await compileDocumentSchemas(bundleDir, workingBundle.manifest);
                } catch (err) {
                    return toolError(TOOL_NAME, "INTERNAL", `Failed to compile schemas: ${err instanceof Error ? err.message : String(err)}`);
                }

                // Load raw schemas for field existence checking
                const rawSchemas = new Map<string, Record<string, unknown>>();
                for (const [entityType, relPath] of Object.entries(workingBundle.manifest.spec?.schemas?.documents ?? {})) {
                    try {
                        const schemaPath = path.join(bundleDir, relPath);
                        const schemaContent = await fs.readFile(schemaPath, 'utf8');
                        rawSchemas.set(entityType, JSON.parse(schemaContent));
                    } catch {
                        // Schema loading failed - skip
                    }
                }

                // Track results per change
                interface ChangeResult {
                    index: number;
                    operation: string;
                    entityType: string;
                    entityId: string;
                    status: "would_apply" | "applied" | "error";
                    resultEntity?: unknown;
                    affectedFiles?: string[];
                    diagnostics: ResponseDiagnostic[];
                    error?: { code: string; message: string };
                }

                const results: ChangeResult[] = [];
                const modifiedFiles: string[] = [];
                const deletedFiles: string[] = [];
                let hasBlockingErrors = false;

                // Helper to check if a field path exists in schema
                function fieldExistsInSchema(schema: Record<string, unknown>, fieldPath: string): boolean {
                    const parts = fieldPath.split(".");
                    let current: any = schema;

                    for (const part of parts) {
                        if (!current.properties) return false;
                        if (!(part in current.properties)) return false;
                        current = current.properties[part];
                    }
                    return true;
                }

                // Helper to extract sdd-ref fields from entity data
                function extractRefs(data: Record<string, unknown>, schema: Record<string, unknown>): Array<{ field: string; targetId: string }> {
                    const refs: Array<{ field: string; targetId: string }> = [];
                    const props = (schema as any).properties || {};

                    for (const [field, fieldSchema] of Object.entries(props)) {
                        const fs = fieldSchema as any;
                        const fieldValue = data[field];
                        if (!fieldValue) continue;

                        // Check for format: sdd-ref
                        if (fs.format === "sdd-ref" && typeof fieldValue === "string") {
                            refs.push({ field, targetId: fieldValue });
                        }
                        // Check for array of refs
                        if (fs.type === "array" && fs.items?.format === "sdd-ref" && Array.isArray(fieldValue)) {
                            for (const targetId of fieldValue) {
                                if (typeof targetId === "string") {
                                    refs.push({ field, targetId });
                                }
                            }
                        }
                    }
                    return refs;
                }

                // Process each change
                for (let i = 0; i < changes.length; i++) {
                    const change = changes[i];
                    const result: ChangeResult = {
                        index: i,
                        operation: change.operation,
                        entityType: change.entityType,
                        entityId: change.entityId,
                        status: "would_apply",
                        diagnostics: [],
                    };
                    results.push(result);

                    const schema = rawSchemas.get(change.entityType);

                    try {
                        switch (change.operation) {
                            case "create": {
                                const entityData = change.data ?? { id: change.entityId };

                                // Validate schema if not none
                                if (effectiveValidate !== "none" && schema) {
                                    // Create entity in-memory first
                                    const entity = createEntity(workingBundle, bundleDir, change.entityType, change.entityId, entityData);

                                    // Validate against schema
                                    const schemaDiags = validateEntityWithSchemas(compiledSchemas, entity);
                                    for (const d of schemaDiags) {
                                        result.diagnostics.push({
                                            severity: d.severity,
                                            code: d.code,
                                            message: d.message,
                                            entityType: change.entityType,
                                            entityId: change.entityId,
                                            field: d.path,
                                        });
                                    }

                                    if (schemaDiags.some(d => d.severity === "error") && effectiveValidate === "strict") {
                                        result.status = "error";
                                        result.error = { code: "VALIDATION_ERROR", message: "Schema validation failed" };
                                        hasBlockingErrors = true;
                                        continue;
                                    }

                                    result.resultEntity = entity.data;
                                    result.affectedFiles = [path.relative(bundleDir, entity.filePath)];
                                    if (!modifiedFiles.includes(entity.filePath)) {
                                        modifiedFiles.push(entity.filePath);
                                    }
                                } else {
                                    // No validation - just create
                                    const entity = createEntity(workingBundle, bundleDir, change.entityType, change.entityId, entityData);
                                    result.resultEntity = entity.data;
                                    result.affectedFiles = [path.relative(bundleDir, entity.filePath)];
                                    if (!modifiedFiles.includes(entity.filePath)) {
                                        modifiedFiles.push(entity.filePath);
                                    }
                                }

                                // Check reference integrity for create
                                if (effectiveRefPolicy !== "none" && schema) {
                                    const refs = extractRefs(entityData, schema);
                                    for (const ref of refs) {
                                        if (!workingBundle.idRegistry.has(ref.targetId)) {
                                            result.diagnostics.push({
                                                severity: effectiveRefPolicy === "strict" ? "error" : "warning",
                                                code: "REFERENCE_ERROR",
                                                message: `Reference to non-existent entity: ${ref.targetId}`,
                                                entityType: change.entityType,
                                                entityId: change.entityId,
                                                field: ref.field,
                                            });
                                            if (effectiveRefPolicy === "strict") {
                                                result.status = "error";
                                                result.error = { code: "REFERENCE_ERROR", message: `Broken reference: ${ref.field} -> ${ref.targetId}` };
                                                hasBlockingErrors = true;
                                            }
                                        }
                                    }
                                }
                                break;
                            }

                            case "update": {
                                if (!change.fieldPath) {
                                    result.status = "error";
                                    result.error = { code: "BAD_REQUEST", message: "Update operation requires fieldPath" };
                                    hasBlockingErrors = true;
                                    continue;
                                }

                                // Non-upserting: check if field exists in schema
                                if (effectiveValidate !== "none" && schema) {
                                    if (!fieldExistsInSchema(schema, change.fieldPath)) {
                                        result.status = "error";
                                        result.error = {
                                            code: "VALIDATION_ERROR",
                                            message: `Field '${change.fieldPath}' does not exist in ${change.entityType} schema. Updates cannot create new fields.`
                                        };
                                        result.diagnostics.push({
                                            severity: "error",
                                            code: "VALIDATION_ERROR",
                                            message: `Unknown field: ${change.fieldPath}`,
                                            entityType: change.entityType,
                                            entityId: change.entityId,
                                            field: change.fieldPath,
                                        });
                                        hasBlockingErrors = true;
                                        continue;
                                    }
                                }

                                // Check entity exists BEFORE calling applyChange
                                // This prevents the applyChange throw from being caught as INTERNAL
                                const entityMap = workingBundle.entities.get(change.entityType);
                                const entity = entityMap?.get(change.entityId);

                                if (!entity) {
                                    result.status = "error";
                                    result.error = { code: "NOT_FOUND", message: `Entity not found: ${change.entityType}/${change.entityId}` };
                                    hasBlockingErrors = true;
                                    continue;
                                }

                                // Apply change in-memory (entity is guaranteed to exist now)
                                applyChange(workingBundle, {
                                    entityType: change.entityType,
                                    entityId: change.entityId,
                                    fieldPath: change.fieldPath,
                                    newValue: change.value,
                                    originalValue: null,
                                });

                                // Validate the updated entity against schema
                                if (effectiveValidate !== "none") {
                                    const schemaDiags = validateEntityWithSchemas(compiledSchemas, entity);
                                    for (const d of schemaDiags) {
                                        result.diagnostics.push({
                                            severity: d.severity,
                                            code: d.code,
                                            message: d.message,
                                            entityType: change.entityType,
                                            entityId: change.entityId,
                                            field: d.path,
                                        });
                                    }

                                    if (schemaDiags.some(d => d.severity === "error") && effectiveValidate === "strict") {
                                        result.status = "error";
                                        result.error = { code: "VALIDATION_ERROR", message: "Schema validation failed after update" };
                                        hasBlockingErrors = true;
                                        continue;
                                    }
                                }

                                // Check reference integrity for the updated field if it's a ref
                                if (effectiveRefPolicy !== "none" && schema) {
                                    const refs = extractRefs(entity.data as Record<string, unknown>, schema);
                                    for (const ref of refs) {
                                        if (!workingBundle.idRegistry.has(ref.targetId)) {
                                            result.diagnostics.push({
                                                severity: effectiveRefPolicy === "strict" ? "error" : "warning",
                                                code: "REFERENCE_ERROR",
                                                message: `Reference to non-existent entity: ${ref.targetId}`,
                                                entityType: change.entityType,
                                                entityId: change.entityId,
                                                field: ref.field,
                                            });
                                            if (effectiveRefPolicy === "strict") {
                                                result.status = "error";
                                                result.error = { code: "REFERENCE_ERROR", message: `Broken reference: ${ref.field} -> ${ref.targetId}` };
                                                hasBlockingErrors = true;
                                            }
                                        }
                                    }
                                }

                                result.resultEntity = entity.data;
                                result.affectedFiles = [path.relative(bundleDir, entity.filePath)];
                                if (!modifiedFiles.includes(entity.filePath)) {
                                    modifiedFiles.push(entity.filePath);
                                }
                                break;
                            }

                            case "delete": {
                                const entityMap = workingBundle.entities.get(change.entityType);
                                const entity = entityMap?.get(change.entityId);

                                if (!entity) {
                                    result.status = "error";
                                    result.error = { code: "NOT_FOUND", message: `Entity not found: ${change.entityType}/${change.entityId}` };
                                    hasBlockingErrors = true;
                                    continue;
                                }

                                // Check for incoming references if deleteMode is restrict
                                if (deleteMode === "restrict") {
                                    const incomingRefs: Array<{ fromType: string; fromId: string; field: string }> = [];
                                    for (const edge of workingBundle.refGraph.edges) {
                                        if (edge.toId === change.entityId && edge.toEntityType === change.entityType) {
                                            incomingRefs.push({
                                                fromType: edge.fromEntityType,
                                                fromId: edge.fromId,
                                                field: edge.fromField,
                                            });
                                        }
                                    }

                                    if (incomingRefs.length > 0) {
                                        result.status = "error";
                                        result.error = {
                                            code: "DELETE_BLOCKED",
                                            message: `Cannot delete: ${incomingRefs.length} entity/entities reference this ${change.entityType}`
                                        };
                                        result.diagnostics.push({
                                            severity: "error",
                                            code: "DELETE_BLOCKED",
                                            message: `Referenced by: ${incomingRefs.map(r => `${r.fromType}:${r.fromId}.${r.field}`).join(", ")}`,
                                            entityType: change.entityType,
                                            entityId: change.entityId,
                                        });
                                        hasBlockingErrors = true;
                                        continue;
                                    }
                                }

                                deletedFiles.push(entity.filePath);
                                result.affectedFiles = [path.relative(bundleDir, entity.filePath)];

                                // Remove from bundle in-memory
                                entityMap!.delete(change.entityId);
                                workingBundle.idRegistry.delete(change.entityId);
                                break;
                            }
                        }
                    } catch (err) {
                        result.status = "error";
                        result.error = { code: "INTERNAL", message: err instanceof Error ? err.message : String(err) };
                        hasBlockingErrors = true;
                    }
                }

                // If strict mode and there are errors, fail atomically
                if (hasBlockingErrors) {
                    // Determine most appropriate top-level error code based on per-change errors
                    const failedResults = results.filter(r => r.status === "error");
                    let topLevelCode: "NOT_FOUND" | "REFERENCE_ERROR" | "DELETE_BLOCKED" | "VALIDATION_ERROR" = "VALIDATION_ERROR";

                    // Priority: NOT_FOUND > DELETE_BLOCKED > REFERENCE_ERROR > VALIDATION_ERROR
                    if (failedResults.some(r => r.error?.code === "NOT_FOUND")) {
                        topLevelCode = "NOT_FOUND";
                    } else if (failedResults.some(r => r.error?.code === "DELETE_BLOCKED")) {
                        topLevelCode = "DELETE_BLOCKED";
                    } else if (failedResults.some(r => r.error?.code === "REFERENCE_ERROR")) {
                        topLevelCode = "REFERENCE_ERROR";
                    }

                    return toolError(
                        TOOL_NAME,
                        topLevelCode,
                        `${failedResults.length} change(s) failed`,
                        {
                            dryRun,
                            validate: effectiveValidate,
                            referencePolicy: effectiveRefPolicy,
                            results
                        }
                    );
                }

                // Dry run - return preview
                if (dryRun) {
                    return toolSuccess(TOOL_NAME, {
                        dryRun: true,
                        validate: effectiveValidate,
                        referencePolicy: effectiveRefPolicy,
                        wouldApply: changes.length,
                        wouldModify: modifiedFiles.map(f => path.relative(bundleDir, f)),
                        wouldDelete: deletedFiles.map(f => path.relative(bundleDir, f)),
                        results,
                    }, {
                        bundleId: effectiveBundleId,
                        meta: { changesCount: changes.length },
                        diagnostics: results.flatMap(r => r.diagnostics),
                    });
                }

                // Actually write changes to disk
                for (const change of changes) {
                    if (change.operation === "create" || change.operation === "update") {
                        const entityMap = workingBundle.entities.get(change.entityType);
                        const entity = entityMap?.get(change.entityId);
                        if (entity) {
                            const dir = path.dirname(entity.filePath);
                            await fs.mkdir(dir, { recursive: true });
                            await saveEntity(entity);
                        }
                    }
                }

                // Delete files
                for (const filePath of deletedFiles) {
                    try {
                        await fs.unlink(filePath);
                    } catch (err) {
                        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                            throw err;
                        }
                    }
                }

                // Reload bundle into cache
                const { bundle: reloadedBundle, diagnostics: reloadedDiagnostics } = await loadBundleWithSchemaValidation(bundleDir);
                loaded.bundle = reloadedBundle;
                loaded.diagnostics = reloadedDiagnostics;

                // Update result statuses
                for (const r of results) {
                    if (r.status === "would_apply") {
                        r.status = "applied";
                    }
                }

                return toolSuccess(TOOL_NAME, {
                    dryRun: false,
                    validate: effectiveValidate,
                    referencePolicy: effectiveRefPolicy,
                    applied: changes.length,
                    modifiedFiles: modifiedFiles.map(f => path.relative(bundleDir, f)),
                    deletedFiles: deletedFiles.map(f => path.relative(bundleDir, f)),
                    results,
                }, {
                    bundleId: effectiveBundleId,
                    meta: { changesCount: changes.length },
                    diagnostics: results.flatMap(r => r.diagnostics),
                });
            }
        );

        // Tool: critique_bundle - LLM-based quality critique via MCP sampling
        this.server.registerTool(
            "critique_bundle",
            {
                description: "Trigger an LLM-based quality critique of the bundle for AI consumability and completeness. Uses MCP sampling to request the client's LLM to evaluate the spec. Returns scored findings. Requires client to support MCP sampling capability.",
                inputSchema: {
                    bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                    threshold: z.number().min(1).max(10).default(5).describe("Minimum score (1-10) to include in findings. Higher = stricter."),
                },
                annotations: EXTERNAL_SAMPLING_TOOL,
            },
            async ({ bundleId, threshold }) => {
                const TOOL_NAME = "critique_bundle";
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: this.getBundleIds() });
                    }
                    return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
                }

                const effectiveBundleId = loaded.id;

                // Gather key entities for the critique prompt
                const bundle = loaded.bundle;
                const topEntities: string[] = [];

                // Get up to 3 of each major entity type
                for (const entityType of ["Feature", "Requirement", "Component"]) {
                    const entities = bundle.entities.get(entityType);
                    if (entities) {
                        const ids = Array.from(entities.keys()).slice(0, 3);
                        topEntities.push(...ids.map(id => `${entityType}:${id}`));
                    }
                }

                // Get entity counts for context
                const entityCounts: Record<string, number> = {};
                for (const [type, entities] of bundle.entities) {
                    entityCounts[type] = entities.size;
                }

                // Get existing diagnostics
                const existingIssues = loaded.diagnostics
                    .filter(d => d.severity === "error" || d.severity === "warning")
                    .slice(0, 5)
                    .map(d => `[${d.severity}] ${d.entityType || "Bundle"}${d.entityId ? `:${d.entityId}` : ""} - ${d.message}`);

                // Build the critique prompt
                const critiquePrompt = `You are an SDD (Spec-Driven Development) specification quality auditor.
Your goal is to evaluate this specification for AI consumability and completeness.

## Bundle to Critique
- **Bundle ID**: ${effectiveBundleId}
- **Name**: ${bundle.manifest.metadata.name}
- **Type**: ${bundle.manifest.metadata.bundleType}

## Entity Counts
${Object.entries(entityCounts).map(([type, count]) => `- ${type}: ${count}`).join("\n")}

## Key Entities (sample)
${topEntities.join(", ")}

## Existing Validation Issues
${existingIssues.length > 0 ? existingIssues.join("\n") : "None detected by schema validation"}

The full spec is available via MCP tools (get_bundle_snapshot, read_entity, list_entities).
Use them if you need more detail about specific entities.

## Evaluation Criteria
1. **Completeness**: Every Requirement has rationale, acceptance criteria, and linked Features
2. **Clarity**: Requirements use unambiguous, testable language (no "should handle appropriately")
3. **Connectivity**: No orphan entities - everything is connected in the reference graph
4. **Consistency**: Terminology is consistent across entities
5. **AI Consumability**: Entities have clear IDs, titles, and structured data

## Response Format
Respond ONLY with valid JSON (no markdown, no explanation):
{
  "overallScore": <1-10>,
  "verdict": "APPROVED" | "NEEDS_WORK" | "REJECTED",
  "findings": [
    {
      "score": <1-10>,
      "category": "completeness" | "clarity" | "connectivity" | "consistency" | "consumability",
      "entityId": "<optional entity ID>",
      "issue": "<what is wrong>",
      "suggestion": "<how to fix>"
    }
  ]
}

Scoring Guide:
- 10: Critical flaw, blocks production use
- 7-9: Major issue, must fix before merge  
- 4-6: Minor issue, should fix eventually
- 1-3: Nitpick, optional improvement`;

                // Check if client supports sampling before attempting
                const underlyingServer = this.server.server;
                const clientCapabilities = underlyingServer.getClientCapabilities();

                if (!clientCapabilities?.sampling) {
                    return toolError(TOOL_NAME, "UNSUPPORTED_CAPABILITY",
                        "MCP sampling is not supported by this client. The critique_bundle tool requires sampling capability.",
                        {
                            bundleId: effectiveBundleId,
                            hint: "Use Claude Desktop or another MCP client that supports sampling.",
                            alternative: "Use the 'bundle-health' prompt instead: /mcp.sdd-bundle.bundle-health",
                        }
                    );
                }

                // Try to use MCP sampling with timeout protection
                const SAMPLING_TIMEOUT_MS = 120000; // 120 seconds
                try {
                    const samplingPromise = underlyingServer.createMessage({
                        messages: [
                            {
                                role: "user",
                                content: { type: "text", text: critiquePrompt }
                            }
                        ],
                        maxTokens: 2000,
                        includeContext: "thisServer",
                        // Provide model hints for clients that support model selection
                        // Clients may ignore these preferences per the MCP spec
                        modelPreferences: {
                            hints: [
                                { name: "claude-3-sonnet" },
                                { name: "claude-3" },
                                { name: "gpt-4o" },
                                { name: "gpt-4" },
                            ],
                            intelligencePriority: 0.8, // Prefer more capable models for quality critique
                        },
                    });

                    // Race against timeout to prevent indefinite hangs
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("SAMPLING_TIMEOUT")), SAMPLING_TIMEOUT_MS)
                    );

                    const samplingResult = await Promise.race([samplingPromise, timeoutPromise]);

                    // Parse the response
                    let critique: {
                        overallScore: number;
                        verdict: "APPROVED" | "NEEDS_WORK" | "REJECTED";
                        findings: Array<{
                            score: number;
                            category: string;
                            entityId?: string;
                            issue: string;
                            suggestion: string;
                        }>;
                    };

                    try {
                        const responseText = samplingResult.content.type === "text"
                            ? samplingResult.content.text
                            : JSON.stringify(samplingResult.content);

                        // Try to extract JSON from the response (in case LLM wrapped it)
                        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                        if (!jsonMatch) {
                            throw new Error("No JSON object found in response");
                        }
                        critique = JSON.parse(jsonMatch[0]);
                    } catch (parseError) {
                        return toolError(TOOL_NAME, "INTERNAL", `Failed to parse critique response: ${(parseError as Error).message}`, {
                            bundleId: effectiveBundleId,
                            rawResponse: samplingResult.content,
                        });
                    }

                    // Filter findings by threshold
                    const actionableFindings = critique.findings.filter(f => f.score >= threshold);

                    return toolSuccess(TOOL_NAME, {
                        verdict: critique.verdict,
                        overallScore: critique.overallScore,
                        threshold,
                        findings: actionableFindings,
                        totalFindings: critique.findings.length,
                        filteredOut: critique.findings.length - actionableFindings.length,
                    }, {
                        bundleId: effectiveBundleId,
                        meta: {
                            samplingUsed: true,
                            model: samplingResult.model,
                        },
                        diagnostics: [],
                    });

                } catch (samplingError) {
                    // Sampling failed - return graceful error with instructions
                    const errorMessage = (samplingError as Error).message;

                    // Check for timeout (from our Promise.race)
                    if (errorMessage === "SAMPLING_TIMEOUT") {
                        return toolError(TOOL_NAME, "INTERNAL",
                            "Sampling request timed out after 120 seconds. The LLM may be overloaded or unresponsive.",
                            {
                                bundleId: effectiveBundleId,
                                hint: "Try again later, or use the 'bundle-health' prompt for a faster alternative.",
                                alternative: "Use the 'bundle-health' prompt instead: /mcp.sdd-bundle.bundle-health",
                            }
                        );
                    }

                    // Check if it's a capability/sampling not supported error
                    // This covers: "createMessage not found", "sampling not supported", etc.
                    if (errorMessage.includes("createMessage") ||
                        errorMessage.includes("not supported") ||
                        errorMessage.includes("capability") ||
                        errorMessage.includes("sampling")) {
                        return toolError(TOOL_NAME, "UNSUPPORTED_CAPABILITY",
                            "MCP sampling is not supported by this client. Critique requires the client to have sampling capability enabled.",
                            {
                                bundleId: effectiveBundleId,
                                hint: "Use Claude Desktop or another MCP client that supports sampling.",
                                alternative: "Use the 'bundle-health' prompt instead: /mcp.sdd-bundle.bundle-health",
                            }
                        );
                    }

                    // Check for VS Code model access not configured
                    // This happens when sampling is supported but no model has been authorized
                    if (errorMessage.includes("Endpoint not found") || errorMessage.includes("model auto")) {
                        return toolError(TOOL_NAME, "UNSUPPORTED_CAPABILITY",
                            "MCP sampling requires model access authorization. The server needs permission to use your language model.",
                            {
                                bundleId: effectiveBundleId,
                                solution: "In VS Code: Ctrl+Shift+P → 'MCP: List Servers' → select 'sdd-bundle' → 'Configure Model Access' → enable a model (e.g., GPT-4o)",
                                alternative: "Or use the 'bundle-health' prompt directly: /mcp.sdd-bundle.bundle-health",
                                documentation: "https://code.visualstudio.com/docs/copilot/chat/mcp-servers",
                            }
                        );
                    }

                    return toolError(TOOL_NAME, "INTERNAL", `Sampling request failed: ${errorMessage}`, {
                        bundleId: effectiveBundleId,
                    });
                }
            }
        );
    }

    /**
     * Setup MCP prompts for structured AI workflows.
     * 
     * Prompts are organized into modules by category:
     * - implementation: implement-requirement, create-roadmap
     * - analysis: trace-dependency, coverage-analysis, suggest-relations
     * - documentation: explain-entity, summarize-bundle, diff-bundles
     * - quality: audit-profile, bundle-health, generate-test-cases
     * 
     * See packages/mcp-server/src/prompts/ for individual implementations.
     */
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
