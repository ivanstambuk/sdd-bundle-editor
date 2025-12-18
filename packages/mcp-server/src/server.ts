import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadBundleWithSchemaValidation, Bundle, saveEntity, createEntity, deleteEntity, applyChange, compileDocumentSchemas, validateEntityWithSchemas } from "@sdd-bundle-editor/core-model";
import { z } from "zod";
import { BundleConfig, LoadedBundle } from "./types.js";
import { toolSuccess, toolError, type Diagnostic as ResponseDiagnostic } from "./response-helpers.js";
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
    }

    private setupTools() {
        // Tool: list_bundles
        this.server.tool(
            "list_bundles",
            "List all loaded specification bundles. Use this first to discover what bundles are available, their IDs, entity types, and metadata. Returns bundle IDs needed for other tool calls in multi-bundle mode.",
            {},
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
        this.server.tool(
            "get_bundle_schema",
            "Get the bundle type definition (metaschema) for a bundle. Returns entity type configurations, relationships between entities, and bundle metadata. Use to understand how entities relate to each other.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
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
        this.server.tool(
            "get_entity_schema",
            "Get the JSON schema for a specific entity type. Use for form rendering or understanding entity structure. Returns the complete JSON schema including properties, required fields, and custom extensions like x-sdd-ui.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
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
        this.server.tool(
            "get_bundle_snapshot",
            "Get a complete bundle snapshot with all entities, schemas, refGraph, and diagnostics in a single call. Optimized for UI initial load - much more efficient than multiple calls. Use entityTypes to filter, includeEntityData to control payload size, and maxEntities to prevent truncation.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityTypes: z.array(z.string()).optional().describe("Filter to specific entity types (e.g., ['Requirement', 'Task']). Returns all types if not specified."),
                includeEntityData: z.enum(["full", "summary", "ids"]).default("full").describe("Entity data detail: full (all fields), summary (id, title, state), ids (just IDs)"),
                includeSchemas: z.boolean().default(true).describe("Include JSON schemas for each entity type"),
                includeRefGraph: z.boolean().default(true).describe("Include reference graph edges"),
                includeDiagnostics: z.boolean().default(true).describe("Include validation diagnostics"),
                maxEntities: z.number().max(10000).default(5000).describe("Maximum entities to return before truncation (default: 5000, max: 10000)"),
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
        this.server.tool(
            "read_entity",
            "Read the complete data for a specific entity. Use when you need full details about a Requirement, Task, Feature, Component, Profile, Threat, or any other entity type. Returns all fields including title, description, state, priority, and relationships.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
                id: z.string().describe("Entity ID"),
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
        this.server.tool(
            "read_entities",
            "Read multiple entities in a single call. Use when you need 2-50 entities and already know their IDs. Much more efficient than calling read_entity multiple times.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
                ids: z.array(z.string()).max(50).describe("Entity IDs to fetch (max 50)"),
                fields: z.array(z.string()).optional().describe("Specific fields to return (optional, returns all if not specified)"),
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
        this.server.tool(
            "list_entities",
            "List all entity IDs in a bundle with optional pagination. Use to discover available entity IDs, see what entity types exist, or get an overview of bundle contents. Without entityType filter, shows all available types. With filter, shows all IDs of that type.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode, or 'all' to list from all bundles)"),
                entityType: z.string().optional().describe("Filter by entity type"),
                limit: z.number().max(500).default(100).describe("Maximum number of IDs to return (default: 100, max: 500)"),
                offset: z.number().default(0).describe("Starting offset for pagination"),
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
        this.server.tool(
            "list_entity_summaries",
            "List entities with summary fields (id, title, state, tags). Better than list_entities when you need to select relevant items without loading full entity data. Supports pagination.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().optional().describe("Filter by entity type"),
                include: z.array(z.string()).default(["id", "title"]).describe("Fields to include in summaries"),
                limit: z.number().default(50).describe("Max results (default 50, max 200)"),
                offset: z.number().default(0).describe("Pagination offset"),
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
        this.server.tool(
            "get_entity_relations",
            "Get the relationships defined for an entity type. Use to understand how entities connect to each other. Returns relation definitions from the bundle-type specification.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().optional().describe("Filter by entity type (optional, shows all relations if not specified)"),
                direction: z.enum(["outgoing", "incoming", "both"]).default("both").describe("Filter by direction: outgoing (this type references other), incoming (other types reference this), both (all)"),
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
        this.server.tool(
            "get_context",
            "Get an entity with related dependencies. Supports sizing controls to prevent truncation. Use when you need to understand how an entity connects to others.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type"),
                id: z.string().describe("Entity ID"),
                depth: z.number().max(3).default(1).describe("Depth of traversal (default: 1, max: 3)"),
                maxRelated: z.number().max(100).default(20).describe("Max related entities to return (default: 20, max: 100)"),
                includeRelated: z.enum(["full", "summary", "ids"]).default("full").describe("Detail level for related entities: full (all fields), summary (id, title, state), ids (just IDs)"),
                fields: z.array(z.string()).optional().describe("Specific fields to return for target entity"),
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
        this.server.tool(
            "get_conformance_context",
            "Get conformance rules and audit templates from a Profile. Use for compliance checking, understanding what rules apply, or preparing for audits. Without profileId, lists all available profiles. With profileId, returns detailed rules, linked requirements, and audit templates.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                profileId: z.string().optional().describe("Profile ID (optional, lists all profiles if not specified)"),
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
        this.server.tool(
            "search_entities",
            "Search for entities across all bundles by keyword with pagination. Use when user asks about something by name, topic, or keyword rather than exact ID. Searches entity IDs, titles, statements, and descriptions. Returns matching entities with their bundle and type.",
            {
                query: z.string().describe("Search query (searches in entity IDs and titles)"),
                entityType: z.string().optional().describe("Filter by entity type"),
                bundleId: z.string().optional().describe("Filter by bundle ID"),
                limit: z.number().max(100).default(50).describe("Maximum number of results to return (default: 50, max: 100)"),
                offset: z.number().default(0).describe("Starting offset for pagination"),
            },
            async ({ query, entityType, bundleId, limit, offset }) => {
                const TOOL_NAME = "search_entities";
                const results: Array<{
                    bundleId: string;
                    entityType: string;
                    id: string;
                    title?: string;
                    match: string;
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
                                results.push({
                                    bundleId: loaded.id,
                                    entityType: eType,
                                    id: eId,
                                    title: data.title || data.statement,
                                    match: idMatch ? "id" : titleMatch ? "title" : statementMatch ? "statement" : "description",
                                });
                            }
                        }
                    }
                }

                // Apply pagination
                const total = results.length;
                const paginatedResults = results.slice(offset, offset + limit);
                const hasMore = offset + limit < total;

                return toolSuccess(TOOL_NAME, {
                    query,
                    results: paginatedResults,
                }, {
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
        this.server.tool(
            "validate_bundle",
            "Validate a bundle and return all diagnostics. Use when user asks 'are there any issues?', 'validate my spec', 'check for errors', or 'find broken references'. Returns errors and warnings including broken references, schema violations, and lint rule failures.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode, or 'all' to validate all bundles)"),
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
        this.server.tool(
            "apply_changes",
            "Apply multiple changes to a bundle atomically. Supports create, update, and delete operations. All changes are validated against schemas and reference integrity before writing. dryRun defaults to true for safety - set to false to actually write changes. Returns detailed diagnostics on failure with changeIndex indicating which change caused each error.",
            {
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

                                // Apply change in-memory
                                applyChange(workingBundle, {
                                    entityType: change.entityType,
                                    entityId: change.entityId,
                                    fieldPath: change.fieldPath,
                                    newValue: change.value,
                                    originalValue: null,
                                });

                                const entityMap = workingBundle.entities.get(change.entityType);
                                const entity = entityMap?.get(change.entityId);

                                if (!entity) {
                                    result.status = "error";
                                    result.error = { code: "NOT_FOUND", message: `Entity not found: ${change.entityType}/${change.entityId}` };
                                    hasBlockingErrors = true;
                                    continue;
                                }

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
                    return toolError(
                        TOOL_NAME,
                        "VALIDATION_ERROR",
                        `${results.filter(r => r.status === "error").length} change(s) failed validation`,
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
        this.server.tool(
            "critique_bundle",
            "Trigger an LLM-based quality critique of the bundle for AI consumability and completeness. Uses MCP sampling to request the client's LLM to evaluate the spec. Returns scored findings. Requires client to support MCP sampling capability.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                threshold: z.number().min(1).max(10).default(5).describe("Minimum score (1-10) to include in findings. Higher = stricter."),
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

                // Try to use MCP sampling
                try {
                    // Access the underlying Server to call createMessage
                    const underlyingServer = this.server.server;

                    const samplingResult = await underlyingServer.createMessage({
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

                    // Check if it's a "not supported" type error
                    if (errorMessage.includes("not supported") || errorMessage.includes("capability")) {
                        return toolError(TOOL_NAME, "BAD_REQUEST",
                            "MCP sampling is not supported by this client. Critique requires the client to have sampling capability enabled.",
                            {
                                bundleId: effectiveBundleId,
                                hint: "Use Claude Desktop or another MCP client that supports sampling.",
                            }
                        );
                    }

                    // Check for GitHub Copilot-specific error (doesn't support MCP sampling)
                    if (errorMessage.includes("Endpoint not found") || errorMessage.includes("model auto")) {
                        return toolError(TOOL_NAME, "BAD_REQUEST",
                            "GitHub Copilot does not support MCP sampling. The critique_bundle tool requires a client that implements the MCP sampling capability.",
                            {
                                bundleId: effectiveBundleId,
                                hint: "Use Claude Desktop (which supports MCP sampling), or try the 'bundle-health' prompt instead: /mcp.sdd-bundle.bundle-health",
                                documentation: "https://modelcontextprotocol.io/docs/concepts/sampling",
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
     * Setup MCP prompts for structured AI workflows
     */
    private setupPrompts() {
        // Prompt 1: implement-requirement
        this.server.prompt(
            "implement-requirement",
            "Generate a detailed implementation plan for a requirement. Use when user asks 'how do I implement REQ-XXX?', 'help me build this requirement', or 'what tasks are needed for this requirement?'. Gathers related features, components, existing tasks, and domain knowledge to create actionable steps with estimates.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                requirementId: z.string().describe("The requirement ID to implement"),
                depth: z.enum(["overview", "detailed", "with-code"]).default("detailed").describe("Level of detail"),
            },
            async ({ bundleId, requirementId, depth }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;
                const requirement = bundle.entities.get("Requirement")?.get(requirementId);

                if (!requirement) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Requirement ${requirementId} not found in bundle ${loaded.id}` }
                        }]
                    };
                }

                // Gather related entities
                const relatedEntities: any[] = [];
                const relatedTasks: any[] = [];
                const relatedFeatures: any[] = [];
                const relatedComponents: any[] = [];

                for (const edge of bundle.refGraph.edges) {
                    if (edge.toId === requirementId || edge.fromId === requirementId) {
                        const otherId = edge.toId === requirementId ? edge.fromId : edge.toId;
                        const otherType = edge.toId === requirementId ? edge.fromEntityType : edge.toEntityType;
                        const entity = bundle.entities.get(otherType)?.get(otherId);
                        if (entity) {
                            if (otherType === "Task") relatedTasks.push(entity.data);
                            else if (otherType === "Feature") relatedFeatures.push(entity.data);
                            else if (otherType === "Component") relatedComponents.push(entity.data);
                            else relatedEntities.push({ type: otherType, ...entity.data });
                        }
                    }
                }

                // Get domain knowledge if available
                const domainKnowledge = bundle.domainMarkdown || "";

                const depthInstructions = {
                    overview: "Provide a brief overview with 3-5 bullet points.",
                    detailed: "Provide a detailed implementation plan with steps, estimates, and acceptance criteria.",
                    "with-code": "Provide a detailed plan with code examples and snippets where appropriate."
                };

                const promptContent = `You are helping implement a requirement from an SDD (Spec-Driven Development) bundle.

## Requirement to Implement
\`\`\`json
${JSON.stringify(requirement.data, null, 2)}
\`\`\`

## Related Features (${relatedFeatures.length})
${relatedFeatures.length > 0 ? JSON.stringify(relatedFeatures, null, 2) : "None found"}

## Related Components (${relatedComponents.length})
${relatedComponents.length > 0 ? JSON.stringify(relatedComponents, null, 2) : "None found"}

## Existing Tasks for this Requirement (${relatedTasks.length})
${relatedTasks.length > 0 ? JSON.stringify(relatedTasks, null, 2) : "None found - you may need to suggest new tasks"}

## Other Related Entities
${relatedEntities.length > 0 ? JSON.stringify(relatedEntities, null, 2) : "None"}

${domainKnowledge ? `## Domain Knowledge\n${domainKnowledge}\n` : ""}

## Your Task
Create an implementation plan for requirement ${requirementId}.

${depthInstructions[depth]}

Include:
1. Summary of what needs to be built
2. Implementation steps with time estimates
3. Dependencies and prerequisites
4. Suggested new tasks (if needed)
5. Acceptance criteria
6. Potential risks or concerns`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 2: explain-entity
        this.server.prompt(
            "explain-entity",
            "Explain any entity in plain language for a specific audience. Use when user asks 'what is FEAT-XXX?', 'explain this to my manager', 'help me understand this component', or 'what does this requirement mean?'. Adapts language for developers, stakeholders, or new team members.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type (e.g., Requirement, Component, Feature)"),
                entityId: z.string().describe("Entity ID"),
                audience: z.enum(["developer", "stakeholder", "new-team-member"]).default("developer").describe("Target audience"),
            },
            async ({ bundleId, entityType, entityId, audience }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;
                const entity = bundle.entities.get(entityType)?.get(entityId);

                if (!entity) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: ${entityType} ${entityId} not found in bundle ${loaded.id}` }
                        }]
                    };
                }

                // Gather connections
                const incomingRefs: any[] = [];
                const outgoingRefs: any[] = [];

                for (const edge of bundle.refGraph.edges) {
                    if (edge.toId === entityId && edge.toEntityType === entityType) {
                        const fromEntity = bundle.entities.get(edge.fromEntityType)?.get(edge.fromId);
                        if (fromEntity) {
                            incomingRefs.push({
                                type: edge.fromEntityType,
                                id: edge.fromId,
                                title: (fromEntity.data as any).title || (fromEntity.data as any).statement || edge.fromId,
                                field: edge.fromField
                            });
                        }
                    }
                    if (edge.fromId === entityId && edge.fromEntityType === entityType) {
                        const toEntity = bundle.entities.get(edge.toEntityType)?.get(edge.toId);
                        if (toEntity) {
                            outgoingRefs.push({
                                type: edge.toEntityType,
                                id: edge.toId,
                                title: (toEntity.data as any).title || (toEntity.data as any).statement || edge.toId,
                                field: edge.fromField
                            });
                        }
                    }
                }

                const audienceInstructions = {
                    developer: "Use technical language, include implementation details, mention relevant code patterns.",
                    stakeholder: "Use business language, focus on value and outcomes, avoid technical jargon.",
                    "new-team-member": "Be thorough and educational, explain context, define terms, assume no prior knowledge."
                };

                const domainKnowledge = bundle.domainMarkdown || "";

                const promptContent = `You are explaining an entity from an SDD (Spec-Driven Development) bundle.

## Entity to Explain
**Type**: ${entityType}
**ID**: ${entityId}

\`\`\`json
${JSON.stringify(entity.data, null, 2)}
\`\`\`

## Connections

### Referenced BY (${incomingRefs.length} entities depend on this)
${incomingRefs.length > 0 ? incomingRefs.map(r => `- ${r.type}: ${r.id} (${r.title})`).join("\n") : "None - this is a leaf entity"}

### References TO (${outgoingRefs.length} dependencies)
${outgoingRefs.length > 0 ? outgoingRefs.map(r => `- ${r.type}: ${r.id} (${r.title})`).join("\n") : "None - this entity has no dependencies"}

${domainKnowledge ? `## Domain Context\n${domainKnowledge.substring(0, 2000)}...\n` : ""}

## Your Task
Explain this ${entityType} for a **${audience}** audience.

${audienceInstructions[audience]}

Include:
1. What this entity is and why it exists
2. How it connects to other parts of the system
3. Its current status/state (if applicable)
4. Key things to know about it
5. Any actions or next steps related to it`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 3: audit-profile
        this.server.prompt(
            "audit-profile",
            "Run a conformance audit against a profile's rules. Use when user asks 'are we compliant with X?', 'audit against security baseline', 'check conformance', or 'what rules are we missing?'. Returns detailed pass/fail analysis with remediation recommendations.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                profileId: z.string().describe("Profile ID to audit against"),
                scope: z.enum(["full", "requirements-only", "quick"]).default("full").describe("Audit scope"),
            },
            async ({ bundleId, profileId, scope }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;
                const profile = bundle.entities.get("Profile")?.get(profileId);

                if (!profile) {
                    const availableProfiles = Array.from(bundle.entities.get("Profile")?.keys() || []);
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Profile ${profileId} not found. Available profiles: ${availableProfiles.join(", ") || "None"}` }
                        }]
                    };
                }

                const profileData = profile.data as any;

                // Gather all requirements in the bundle
                const allRequirements = Array.from(bundle.entities.get("Requirement")?.values() || []).map(e => e.data);

                // Gather all components
                const allComponents = Array.from(bundle.entities.get("Component")?.values() || []).map(e => e.data);

                // Get conformance rules
                const conformanceRules = profileData.conformanceRules || [];

                // Expand linked requirements in rules
                const expandedRules = conformanceRules.map((rule: any) => {
                    const expanded = { ...rule };
                    if (rule.linkedRequirement) {
                        const req = bundle.entities.get("Requirement")?.get(rule.linkedRequirement);
                        if (req) {
                            expanded.requirementDetails = req.data;
                        }
                    }
                    return expanded;
                });

                const scopeInstructions = {
                    full: "Perform a comprehensive audit checking all rules, requirements, and implementation status.",
                    "requirements-only": "Focus only on requirements coverage and completeness.",
                    quick: "Provide a quick summary with just the most critical findings."
                };

                const promptContent = `You are performing a conformance audit against a profile in an SDD bundle.

## Profile Being Audited
**ID**: ${profileId}
**Title**: ${profileData.title || "Untitled"}
**Description**: ${profileData.description || "No description"}

\`\`\`json
${JSON.stringify(profileData, null, 2)}
\`\`\`

## Conformance Rules to Check (${expandedRules.length})
\`\`\`json
${JSON.stringify(expandedRules, null, 2)}
\`\`\`

## Bundle Content to Audit

### Requirements (${allRequirements.length})
\`\`\`json
${JSON.stringify(allRequirements, null, 2)}
\`\`\`

### Components (${allComponents.length})
\`\`\`json
${JSON.stringify(allComponents, null, 2)}
\`\`\`

${profileData.auditTemplate ? `## Audit Template\n${profileData.auditTemplate}\n` : ""}

## Your Task
Perform a **${scope}** conformance audit.

${scopeInstructions[scope]}

Structure your response as:
1. **Audit Summary** - Overall pass/fail counts
2. **Detailed Findings** - For each rule, status (✅ Passed / ⚠️ Partial / ❌ Failed) with evidence
3. **Gaps Identified** - Missing requirements, untested areas
4. **Remediation Priority** - Ordered list of what to fix first
5. **Recommendations** - Suggested improvements`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 4: trace-dependency
        this.server.prompt(
            "trace-dependency",
            "Trace all dependencies for any entity. Use when user asks 'what depends on this?', 'what will be affected if I change X?', 'show me the dependency chain', or 'impact analysis for this task'. Returns visual dependency tree with impact assessment.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type"),
                entityId: z.string().describe("Entity ID to trace"),
                direction: z.enum(["upstream", "downstream", "both"]).default("both").describe("Trace direction"),
            },
            async ({ bundleId, entityType, entityId, direction }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;
                const entity = bundle.entities.get(entityType)?.get(entityId);

                if (!entity) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: ${entityType} ${entityId} not found in bundle ${loaded.id}` }
                        }]
                    };
                }

                // BFS to find all upstream (what this depends on) and downstream (what depends on this)
                const upstream: any[] = [];
                const downstream: any[] = [];
                const visitedUp = new Set<string>();
                const visitedDown = new Set<string>();

                // Upstream: things this entity references (dependencies)
                if (direction === "upstream" || direction === "both") {
                    const queue = [{ type: entityType, id: entityId, depth: 0 }];
                    while (queue.length > 0) {
                        const current = queue.shift()!;
                        const key = `${current.type}:${current.id}`;
                        if (visitedUp.has(key)) continue;
                        visitedUp.add(key);

                        for (const edge of bundle.refGraph.edges) {
                            if (edge.fromEntityType === current.type && edge.fromId === current.id) {
                                const targetEntity = bundle.entities.get(edge.toEntityType)?.get(edge.toId);
                                if (targetEntity) {
                                    upstream.push({
                                        depth: current.depth + 1,
                                        type: edge.toEntityType,
                                        id: edge.toId,
                                        title: (targetEntity.data as any).title || (targetEntity.data as any).statement || edge.toId,
                                        via: edge.fromField,
                                        data: targetEntity.data
                                    });
                                    if (current.depth < 3) { // Limit depth
                                        queue.push({ type: edge.toEntityType, id: edge.toId, depth: current.depth + 1 });
                                    }
                                }
                            }
                        }
                    }
                }

                // Downstream: things that reference this entity (dependents)
                if (direction === "downstream" || direction === "both") {
                    const queue = [{ type: entityType, id: entityId, depth: 0 }];
                    while (queue.length > 0) {
                        const current = queue.shift()!;
                        const key = `${current.type}:${current.id}`;
                        if (visitedDown.has(key)) continue;
                        visitedDown.add(key);

                        for (const edge of bundle.refGraph.edges) {
                            if (edge.toEntityType === current.type && edge.toId === current.id) {
                                const sourceEntity = bundle.entities.get(edge.fromEntityType)?.get(edge.fromId);
                                if (sourceEntity) {
                                    downstream.push({
                                        depth: current.depth + 1,
                                        type: edge.fromEntityType,
                                        id: edge.fromId,
                                        title: (sourceEntity.data as any).title || (sourceEntity.data as any).statement || edge.fromId,
                                        via: edge.fromField,
                                        data: sourceEntity.data
                                    });
                                    if (current.depth < 3) { // Limit depth
                                        queue.push({ type: edge.fromEntityType, id: edge.fromId, depth: current.depth + 1 });
                                    }
                                }
                            }
                        }
                    }
                }

                const promptContent = `You are analyzing dependencies for an entity in an SDD bundle.

## Target Entity
**Type**: ${entityType}
**ID**: ${entityId}

\`\`\`json
${JSON.stringify(entity.data, null, 2)}
\`\`\`

## Upstream Dependencies (What ${entityId} DEPENDS ON) - ${upstream.length} found
These are entities that ${entityId} references. Changes to these may affect ${entityId}.

${upstream.length > 0 ? upstream.map(u => `### ${u.type}: ${u.id} (depth ${u.depth}, via ${u.via})
${u.title}
\`\`\`json
${JSON.stringify(u.data, null, 2)}
\`\`\``).join("\n\n") : "No upstream dependencies found - this is a root entity."}

## Downstream Dependents (What DEPENDS ON ${entityId}) - ${downstream.length} found
These are entities that reference ${entityId}. Changes to ${entityId} will affect these.

${downstream.length > 0 ? downstream.map(d => `### ${d.type}: ${d.id} (depth ${d.depth}, via ${d.via})
${d.title}
\`\`\`json
${JSON.stringify(d.data, null, 2)}
\`\`\``).join("\n\n") : "No downstream dependents found - nothing depends on this entity."}

## Your Task
Analyze this dependency trace and provide:

1. **Dependency Summary** - Visual tree representation (ASCII art)
2. **Impact Analysis** - What happens if ${entityId} is:
   - Modified
   - Delayed
   - Removed
3. **Critical Path** - Is this entity on a critical path? What depends on it completing?
4. **Risk Assessment** - Single points of failure, tight coupling concerns
5. **Recommendations** - Suggestions for managing these dependencies`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 5: coverage-analysis
        this.server.prompt(
            "coverage-analysis",
            "Analyze specification coverage and find gaps. Use when user asks 'what requirements lack tests?', 'where are the gaps?', 'coverage report', or 'what's missing?'. Returns detailed coverage metrics with prioritized recommendations.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                focus: z.enum(["requirements", "features", "threats", "all"]).default("all").describe("Coverage focus area"),
                threshold: z.number().default(80).describe("Minimum coverage percentage to flag"),
            },
            async ({ bundleId, focus, threshold }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;

                // Gather all entity counts
                const entityCounts: Record<string, number> = {};
                for (const [type, entities] of bundle.entities) {
                    entityCounts[type] = entities.size;
                }

                // Analyze requirements coverage
                const requirements = Array.from(bundle.entities.get("Requirement")?.values() || []);
                const tasks = Array.from(bundle.entities.get("Task")?.values() || []);
                const features = Array.from(bundle.entities.get("Feature")?.values() || []);
                const threats = Array.from(bundle.entities.get("Threat")?.values() || []);

                // Find which requirements have tasks
                const reqsWithTasks = new Set<string>();
                const reqsWithTests = new Set<string>();
                for (const edge of bundle.refGraph.edges) {
                    if (edge.toEntityType === "Requirement") {
                        if (edge.fromEntityType === "Task") reqsWithTasks.add(edge.toId);
                        if (edge.fromEntityType === "Test") reqsWithTests.add(edge.toId);
                    }
                }

                // Find features without requirements
                const featuresWithReqs = new Set<string>();
                for (const edge of bundle.refGraph.edges) {
                    if (edge.toEntityType === "Feature" && edge.fromEntityType === "Requirement") {
                        featuresWithReqs.add(edge.toId);
                    }
                }

                // Find unmitigated threats
                const mitigatedThreats = new Set<string>();
                for (const edge of bundle.refGraph.edges) {
                    if (edge.toEntityType === "Threat") {
                        mitigatedThreats.add(edge.toId);
                    }
                }

                const promptContent = `You are performing a coverage analysis on an SDD bundle.

## Bundle: ${loaded.id}

## Entity Counts
${Object.entries(entityCounts).map(([type, count]) => `- ${type}: ${count}`).join("\n")}

## Coverage Metrics

### Requirements Coverage
- Total Requirements: ${requirements.length}
- With Tasks: ${reqsWithTasks.size} (${requirements.length > 0 ? Math.round(reqsWithTasks.size / requirements.length * 100) : 0}%)
- With Tests: ${reqsWithTests.size} (${requirements.length > 0 ? Math.round(reqsWithTests.size / requirements.length * 100) : 0}%)

### Requirements WITHOUT Tasks (${requirements.length - reqsWithTasks.size})
${requirements.filter(r => !reqsWithTasks.has(r.id)).map(r => `- ${r.id}: ${(r.data as any).title || (r.data as any).statement}`).join("\n") || "All requirements have tasks ✓"}

### Features Coverage
- Total Features: ${features.length}
- With Requirements: ${featuresWithReqs.size} (${features.length > 0 ? Math.round(featuresWithReqs.size / features.length * 100) : 0}%)

### Threat Coverage
- Total Threats: ${threats.length}
- With Mitigations: ${mitigatedThreats.size} (${threats.length > 0 ? Math.round(mitigatedThreats.size / threats.length * 100) : 0}%)

### Unmitigated Threats (${threats.length - mitigatedThreats.size})
${threats.filter(t => !mitigatedThreats.has(t.id)).map(t => `- ${t.id}: ${(t.data as any).title || (t.data as any).description}`).join("\n") || "All threats are mitigated ✓"}

## Coverage Threshold: ${threshold}%

## Your Task
Analyze coverage for focus area: **${focus}**

Provide:
1. **Coverage Summary** - Table with pass/fail status based on ${threshold}% threshold
2. **Critical Gaps** - Most important missing coverage
3. **Risk Assessment** - What could go wrong due to these gaps
4. **Prioritized Recommendations** - What to address first and why
5. **Quick Wins** - Easy coverage improvements`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 6: suggest-relations
        this.server.prompt(
            "suggest-relations",
            "Suggest missing relationships between entities. Use when user asks 'what am I missing?', 'suggest connections', 'find related entities', or 'improve my spec'. Analyzes entity content to find likely relationships that should be added.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().optional().describe("Focus on specific entity type"),
                confidence: z.enum(["high", "medium", "all"]).default("high").describe("Minimum confidence for suggestions"),
            },
            async ({ bundleId, entityType, confidence }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;

                // Gather all entities for analysis
                const allEntities: Array<{ type: string; id: string; data: any }> = [];
                for (const [type, entities] of bundle.entities) {
                    if (!entityType || type === entityType) {
                        for (const [id, entity] of entities) {
                            allEntities.push({ type, id, data: entity.data });
                        }
                    }
                }

                // Get existing relations
                const existingRelations = bundle.refGraph.edges.map(e =>
                    `${e.fromEntityType}:${e.fromId} -> ${e.toEntityType}:${e.toId}`
                );

                const promptContent = `You are analyzing an SDD bundle to suggest missing relationships.

## Bundle: ${loaded.id}

## Entities to Analyze (${allEntities.length})
${allEntities.map(e => `### ${e.type}: ${e.id}
${JSON.stringify(e.data, null, 2)}`).join("\n\n")}

## Existing Relations (${existingRelations.length})
${existingRelations.join("\n") || "No relations found"}

## Confidence Level: ${confidence}

## Your Task
Suggest missing relationships between entities.

For each suggestion, provide:
1. **From Entity** - Source entity (type:id)
2. **To Entity** - Target entity (type:id)
3. **Relation Type** - e.g., implements, verifies, mitigates, related-to, blocks
4. **Reason** - Why you think this relation should exist
5. **Confidence** - High/Medium/Low with explanation

Focus on:
- Requirements that should link to Features
- Tasks that should link to Requirements they implement
- Threats that should have mitigating Requirements
- Components that should link to Features they implement
- Tests that should link to Requirements they verify

Provide at least 5 suggestions if possible, sorted by confidence.`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 7: generate-test-cases
        this.server.prompt(
            "generate-test-cases",
            "Generate test cases for a requirement or feature. Use when user asks 'write tests for REQ-XXX', 'what should I test?', 'BDD scenarios for this feature', or 'test coverage for this'. Generates comprehensive test cases in BDD, traditional, or checklist format.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.enum(["Requirement", "Feature"]).describe("Entity type to generate tests for"),
                entityId: z.string().describe("Entity ID"),
                style: z.enum(["bdd", "traditional", "checklist"]).default("bdd").describe("Test case style"),
            },
            async ({ bundleId, entityType, entityId, style }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;
                const entity = bundle.entities.get(entityType)?.get(entityId);

                if (!entity) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: ${entityType} ${entityId} not found in bundle ${loaded.id}` }
                        }]
                    };
                }

                // Get related entities for context
                const relatedEntities: any[] = [];
                for (const edge of bundle.refGraph.edges) {
                    if (edge.fromId === entityId || edge.toId === entityId) {
                        const otherId = edge.fromId === entityId ? edge.toId : edge.fromId;
                        const otherType = edge.fromId === entityId ? edge.toEntityType : edge.fromEntityType;
                        const otherEntity = bundle.entities.get(otherType)?.get(otherId);
                        if (otherEntity) {
                            relatedEntities.push({ type: otherType, id: otherId, data: otherEntity.data });
                        }
                    }
                }

                const styleInstructions = {
                    bdd: "Use Gherkin syntax (Given/When/Then). Include Feature and Scenario blocks.",
                    traditional: "Use traditional test case format with ID, Title, Preconditions, Steps, Expected Results.",
                    checklist: "Use a simple checklist format suitable for manual testing."
                };

                const promptContent = `You are generating test cases for an SDD entity.

## Entity to Test
**Type**: ${entityType}
**ID**: ${entityId}

\`\`\`json
${JSON.stringify(entity.data, null, 2)}
\`\`\`

## Related Context (${relatedEntities.length} entities)
${relatedEntities.map(e => `### ${e.type}: ${e.id}
\`\`\`json
${JSON.stringify(e.data, null, 2)}
\`\`\``).join("\n\n") || "No related entities"}

## Test Style: ${style}
${styleInstructions[style]}

## Your Task
Generate comprehensive test cases for ${entityId}.

Include:
1. **Happy Path Tests** - Normal successful scenarios
2. **Edge Cases** - Boundary conditions, empty inputs, max values
3. **Error Cases** - Invalid inputs, unauthorized access, failures
4. **Integration Points** - Tests involving related entities
5. **Performance Considerations** (if applicable)

For each test, ensure it is:
- Specific and measurable
- Independent (can run in isolation)
- Repeatable
- Traceable back to the ${entityType}`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 8: summarize-bundle
        this.server.prompt(
            "summarize-bundle",
            "Generate a summary of the entire bundle. Use when user asks 'what is this project about?', 'give me an overview', 'executive summary', or 'onboard me to this spec'. Generates comprehensive summaries tailored for executives, developers, or new team members.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                format: z.enum(["executive", "technical", "onboarding"]).default("executive").describe("Summary format"),
            },
            async ({ bundleId, format }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;
                const manifest = bundle.manifest;

                // Gather statistics
                const stats: Record<string, { count: number; items: any[] }> = {};
                for (const [type, entities] of bundle.entities) {
                    stats[type] = {
                        count: entities.size,
                        items: Array.from(entities.values()).map(e => ({
                            id: e.id,
                            title: (e.data as any).title || (e.data as any).statement || (e.data as any).name,
                            state: (e.data as any).state,
                            priority: (e.data as any).priority
                        }))
                    };
                }

                // Count relations
                const relationCount = bundle.refGraph.edges.length;

                const formatInstructions = {
                    executive: "Write for executives. Focus on business value, risks, and key decisions. Use simple language, no jargon.",
                    technical: "Write for developers. Include architecture details, technical decisions, and implementation considerations.",
                    onboarding: "Write for new team members. Explain everything, provide context, define terms."
                };

                const promptContent = `You are summarizing an SDD bundle.

## Bundle Metadata
- **Name**: ${manifest.metadata.name}
- **Type**: ${manifest.metadata.bundleType}
- **Version**: ${manifest.metadata.schemaVersion || "N/A"}

## Entity Statistics
${Object.entries(stats).map(([type, data]) => `### ${type} (${data.count})
${data.items.slice(0, 10).map(i => `- ${i.id}: ${i.title || "Untitled"}${i.state ? ` [${i.state}]` : ""}${i.priority ? ` (${i.priority})` : ""}`).join("\n")}
${data.count > 10 ? `... and ${data.count - 10} more` : ""}`).join("\n\n")}

## Relations
Total: ${relationCount} connections between entities

## Domain Knowledge
${bundle.domainMarkdown ? bundle.domainMarkdown.substring(0, 3000) : "No domain knowledge file provided."}

## Summary Format: ${format}
${formatInstructions[format]}

## Your Task
Create a comprehensive summary of this bundle.

Include:
1. **Overview** - What is this bundle about? (2-3 sentences)
2. **Key Metrics** - Entity counts, health indicators
3. **Main Features/Capabilities** - What does it define?
4. **Current Status** - Progress, blockers, risks
5. **Key Concerns** - What needs attention?
6. **Recommended Next Steps** - Prioritized actions`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 9: diff-bundles
        this.server.prompt(
            "diff-bundles",
            "Compare two bundles and show differences. Use when user asks 'what changed between versions?', 'compare these specs', 'diff v1 vs v2', or 'migration analysis'. Requires two bundles loaded. Shows added, removed, and modified entities.",
            {
                bundleA: z.string().describe("First bundle ID"),
                bundleB: z.string().describe("Second bundle ID"),
                focus: z.enum(["all", "requirements", "structure"]).default("all").describe("Diff focus"),
            },
            async ({ bundleA, bundleB, focus }) => {
                const loadedA = this.bundles.get(bundleA);
                const loadedB = this.bundles.get(bundleB);

                if (!loadedA) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle ${bundleA} not found. Available: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }
                if (!loadedB) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle ${bundleB} not found. Available: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                // Compare entity types
                const typesA = new Set(loadedA.bundle.entities.keys());
                const typesB = new Set(loadedB.bundle.entities.keys());
                const allTypes = new Set([...typesA, ...typesB]);

                const comparison: Record<string, { inA: number; inB: number; inBoth: string[]; onlyA: string[]; onlyB: string[] }> = {};

                for (const type of allTypes) {
                    const entitiesA = loadedA.bundle.entities.get(type) || new Map();
                    const entitiesB = loadedB.bundle.entities.get(type) || new Map();

                    const idsA = new Set(entitiesA.keys());
                    const idsB = new Set(entitiesB.keys());

                    comparison[type] = {
                        inA: idsA.size,
                        inB: idsB.size,
                        inBoth: [...idsA].filter(id => idsB.has(id)),
                        onlyA: [...idsA].filter(id => !idsB.has(id)),
                        onlyB: [...idsB].filter(id => !idsA.has(id))
                    };
                }

                const promptContent = `You are comparing two SDD bundles.

## Bundle A: ${bundleA}
- Name: ${loadedA.bundle.manifest.metadata.name}
- Relations: ${loadedA.bundle.refGraph.edges.length}

## Bundle B: ${bundleB}
- Name: ${loadedB.bundle.manifest.metadata.name}
- Relations: ${loadedB.bundle.refGraph.edges.length}

## Entity Comparison
${Object.entries(comparison).map(([type, data]) => `### ${type}
- In ${bundleA}: ${data.inA}
- In ${bundleB}: ${data.inB}
- In Both: ${data.inBoth.length}
- Only in ${bundleA}: ${data.onlyA.join(", ") || "None"}
- Only in ${bundleB}: ${data.onlyB.join(", ") || "None"}`).join("\n\n")}

## Diff Focus: ${focus}

## Your Task
Compare these bundles and provide:

1. **Summary** - High-level differences
2. **Added** - What's new in ${bundleB}
3. **Removed** - What's gone from ${bundleA}
4. **Entity Changes** - Detailed comparison by type
5. **Breaking Changes** - Changes that might cause issues
6. **Recommendations** - How to handle the differences`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 10: create-roadmap
        this.server.prompt(
            "create-roadmap",
            "Generate an implementation roadmap from specifications. Use when user asks 'create a project plan', 'what's the roadmap?', 'how do I implement all this?', or 'phased implementation plan'. Creates timeline, phases, or milestone-based roadmaps with dependencies.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                scope: z.string().default("all").describe("Scope: 'all', 'feature:FEAT-001', or 'tag:security'"),
                format: z.enum(["timeline", "phases", "milestones"]).default("phases").describe("Roadmap format"),
            },
            async ({ bundleId, scope, format }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;

                // Get all tasks with their relations
                const tasks = Array.from(bundle.entities.get("Task")?.values() || []).map(t => ({
                    id: t.id,
                    data: t.data,
                    dependencies: [] as string[],
                    relatedReqs: [] as string[],
                    relatedFeatures: [] as string[]
                }));

                // Build dependency info
                for (const task of tasks) {
                    for (const edge of bundle.refGraph.edges) {
                        if (edge.fromId === task.id) {
                            if (edge.toEntityType === "Task") task.dependencies.push(edge.toId);
                            if (edge.toEntityType === "Requirement") task.relatedReqs.push(edge.toId);
                            if (edge.toEntityType === "Feature") task.relatedFeatures.push(edge.toId);
                        }
                    }
                }

                // Get features
                const features = Array.from(bundle.entities.get("Feature")?.values() || []).map(f => f.data);

                // Get requirements
                const requirements = Array.from(bundle.entities.get("Requirement")?.values() || []).map(r => r.data);

                const formatInstructions = {
                    timeline: "Create a week-by-week timeline with specific dates/durations.",
                    phases: "Organize into logical phases (Foundation, Core, Polish, etc.).",
                    milestones: "Focus on key milestones and deliverables."
                };

                const promptContent = `You are creating an implementation roadmap from an SDD bundle.

## Bundle: ${loaded.id}
## Scope: ${scope}
## Format: ${format}

## Features (${features.length})
\`\`\`json
${JSON.stringify(features, null, 2)}
\`\`\`

## Requirements (${requirements.length})
\`\`\`json
${JSON.stringify(requirements, null, 2)}
\`\`\`

## Tasks (${tasks.length})
${tasks.map(t => `### ${t.id}
${JSON.stringify(t.data, null, 2)}
Dependencies: ${t.dependencies.join(", ") || "None"}
Related Requirements: ${t.relatedReqs.join(", ") || "None"}
Related Features: ${t.relatedFeatures.join(", ") || "None"}`).join("\n\n")}

## Roadmap Format
${formatInstructions[format]}

## Your Task
Create an implementation roadmap.

Include:
1. **Overview** - What will be built, in what order
2. **Phases/Timeline** - Organized work breakdown
3. **Dependencies** - What blocks what
4. **Milestones** - Key deliverables and checkpoints
5. **Estimates** - Time estimates for major work items
6. **Risks** - What could delay the schedule
7. **Visualization** - ASCII diagram of the timeline/phases`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );

        // Prompt 11: bundle-health
        this.server.prompt(
            "bundle-health",
            "Analyze bundle health and generate a comprehensive report. Use when user asks 'how healthy is my spec?', 'are there any issues?', 'bundle status', or 'quality check'. Returns analysis of broken references, schema errors, coverage gaps, and recommendations.",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            },
            async ({ bundleId }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: `Error: Bundle not found. Available bundles: ${this.getBundleIds().join(", ")}` }
                        }]
                    };
                }

                const bundle = loaded.bundle;
                const diagnostics = loaded.diagnostics;

                // Categorize diagnostics
                const errors = diagnostics.filter(d => d.severity === 'error');
                const warnings = diagnostics.filter(d => d.severity === 'warning');
                const brokenRefs = diagnostics.filter(d => d.code?.includes('broken') || d.message.includes('missing') || d.message.includes('not found'));
                const schemaErrors = diagnostics.filter(d => d.source === 'schema');
                const lintWarnings = diagnostics.filter(d => d.source === 'lint');

                // Entity statistics
                const entityCounts: Record<string, number> = {};
                for (const [type, entities] of bundle.entities) {
                    entityCounts[type] = entities.size;
                }
                const totalEntities = Object.values(entityCounts).reduce((a, b) => a + b, 0);
                const relationCount = bundle.refGraph.edges.length;

                // Orphan detection (entities with no incoming or outgoing refs)
                const entitiesWithRefs = new Set<string>();
                for (const edge of bundle.refGraph.edges) {
                    entitiesWithRefs.add(edge.fromId);
                    entitiesWithRefs.add(edge.toId);
                }
                const orphans: string[] = [];
                for (const [type, entities] of bundle.entities) {
                    for (const [id] of entities) {
                        if (!entitiesWithRefs.has(id)) {
                            orphans.push(`${type}:${id}`);
                        }
                    }
                }

                const promptContent = `You are analyzing the health of an SDD bundle.

## Bundle: ${loaded.id}
- **Path**: ${loaded.path}
- **Description**: ${loaded.description || "N/A"}

## Overall Health Status
${errors.length === 0 ? "✅ **HEALTHY** - No critical errors" : `❌ **ISSUES FOUND** - ${errors.length} error(s) need attention`}

## Summary Metrics
| Metric | Value |
|--------|-------|
| Total Entities | ${totalEntities} |
| Relations | ${relationCount} |
| Errors | ${errors.length} |
| Warnings | ${warnings.length} |
| Orphan Entities | ${orphans.length} |

## Entity Breakdown
${Object.entries(entityCounts).map(([type, count]) => `- ${type}: ${count}`).join("\n")}

## Critical Issues (${errors.length})
${errors.length > 0 ? errors.map(e => `- ❌ **${e.entityType || "Bundle"}${e.entityId ? ` (${e.entityId})` : ""}**: ${e.message}`).join("\n") : "None - bundle is error-free! ✓"}

## Broken References (${brokenRefs.length})
${brokenRefs.length > 0 ? brokenRefs.map(e => `- ${e.entityType}:${e.entityId} → ${e.message}`).join("\n") : "No broken references found ✓"}

## Schema Issues (${schemaErrors.length})
${schemaErrors.length > 0 ? schemaErrors.map(e => `- ${e.entityType}:${e.entityId} - ${e.message} [${e.code}]`).join("\n") : "All entities conform to schema ✓"}

## Lint Warnings (${lintWarnings.length})
${lintWarnings.length > 0 ? lintWarnings.map(e => `- ${e.entityType}:${e.entityId} - ${e.message}`).join("\n") : "No lint warnings ✓"}

## Orphan Entities (${orphans.length})
${orphans.length > 0 ? `These entities have no relationships:\n${orphans.slice(0, 10).map(o => `- ${o}`).join("\n")}${orphans.length > 10 ? `\n... and ${orphans.length - 10} more` : ""}` : "All entities are connected ✓"}

## Your Task
Generate a comprehensive bundle health report:

1. **Executive Summary** - One paragraph overall assessment
2. **Critical Actions** - What must be fixed immediately (errors)
3. **Recommended Improvements** - What should be fixed (warnings)
4. **Coverage Analysis** - Are specifications complete?
5. **Risk Assessment** - What could these issues lead to?
6. **Next Steps** - Prioritized action items with estimates

Be specific about what needs to be done to resolve each issue.`;

                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: promptContent }
                    }]
                };
            }
        );
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
