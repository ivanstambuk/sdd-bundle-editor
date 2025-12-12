import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadBundleWithSchemaValidation, Bundle } from "@sdd-bundle-editor/core-model";
import { z } from "zod";
import { BundleConfig, LoadedBundle } from "./types.js";

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
        // New tool: list_bundles
        this.server.tool(
            "list_bundles",
            {},
            async () => {
                const bundleList = Array.from(this.bundles.values()).map(b => ({
                    id: b.id,
                    name: b.bundle.manifest.metadata.name,
                    bundleType: b.bundle.manifest.metadata.bundleType,
                    tags: b.tags || [],
                    description: b.description,
                    path: b.path,
                    entityTypes: Array.from(b.bundle.entities.keys()),
                }));
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(bundleList, null, 2),
                    }],
                };
            }
        );

        // read_entity - now with optional bundleId
        this.server.tool(
            "read_entity",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type (e.g., Requirement, Task, Feature)"),
                id: z.string().describe("Entity ID"),
            },
            async ({ bundleId, entityType, id }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return {
                            content: [{ type: "text", text: `Multiple bundles loaded. Please specify bundleId. Available: ${this.getBundleIds().join(", ")}` }],
                            isError: true,
                        };
                    }
                    return {
                        content: [{ type: "text", text: `Bundle not found: ${bundleId}` }],
                        isError: true,
                    };
                }

                const entitiesOfType = loaded.bundle.entities.get(entityType);
                if (!entitiesOfType) {
                    return {
                        content: [{ type: "text", text: `Unknown entity type: ${entityType}` }],
                        isError: true,
                    };
                }

                const entity = entitiesOfType.get(id);
                if (!entity) {
                    return {
                        content: [{ type: "text", text: `Entity not found: ${id}` }],
                        isError: true,
                    };
                }

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({ bundleId: loaded.id, ...entity.data }, null, 2),
                    }],
                };
            }
        );

        // list_entities - now with optional bundleId
        this.server.tool(
            "list_entities",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode, or 'all' to list from all bundles)"),
                entityType: z.string().optional().describe("Filter by entity type"),
            },
            async ({ bundleId, entityType }) => {
                // Special case: list from all bundles
                if (bundleId === "all" || (!bundleId && !this.isSingleBundleMode())) {
                    const result: Record<string, any> = {};
                    for (const [bId, loaded] of this.bundles) {
                        if (entityType) {
                            const entities = loaded.bundle.entities.get(entityType);
                            if (entities) {
                                result[bId] = Array.from(entities.keys());
                            }
                        } else {
                            result[bId] = {
                                entityTypes: Array.from(loaded.bundle.entities.keys()),
                            };
                        }
                    }
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }

                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    return {
                        content: [{ type: "text", text: `Bundle not found: ${bundleId}` }],
                        isError: true,
                    };
                }

                if (entityType) {
                    const entitiesOfType = loaded.bundle.entities.get(entityType);
                    if (!entitiesOfType) return { content: [{ type: "text", text: "[]" }] };

                    const ids = Array.from(entitiesOfType.keys());
                    return {
                        content: [{ type: "text", text: JSON.stringify(ids, null, 2) }]
                    };
                }

                const allTypes = Array.from(loaded.bundle.entities.keys());
                return {
                    content: [{ type: "text", text: `Available types in ${loaded.id}: ${allTypes.join(", ")}` }]
                };
            }
        );

        // get_context - now with optional bundleId
        this.server.tool(
            "get_context",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type"),
                id: z.string().describe("Entity ID"),
                depth: z.number().default(1).describe("Depth of traversal (default: 1)"),
            },
            async ({ bundleId, entityType, id, depth }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return {
                            content: [{ type: "text", text: `Multiple bundles loaded. Please specify bundleId. Available: ${this.getBundleIds().join(", ")}` }],
                            isError: true,
                        };
                    }
                    return {
                        content: [{ type: "text", text: `Bundle not found: ${bundleId}` }],
                        isError: true,
                    };
                }

                const bundle = loaded.bundle;
                const targetEntities = bundle.entities.get(entityType);
                const targetEntity = targetEntities?.get(id);

                if (!targetEntity) {
                    return {
                        content: [{ type: "text", text: `Entity not found: ${entityType}/${id}` }],
                        isError: true,
                    };
                }

                // Graph traversal to find related entities
                const relatedEntities: Array<{ relation: string, entity: any }> = [];
                const visited = new Set<string>();
                visited.add(`${entityType}:${id}`);

                // Helper to add related entity
                const addRelated = (eType: string, eId: string, relation: string) => {
                    const key = `${eType}:${eId}`;
                    if (visited.has(key)) return;
                    visited.add(key);

                    const entity = bundle.entities.get(eType)?.get(eId);
                    if (entity) {
                        relatedEntities.push({ relation, entity: entity.data });
                    }
                };

                // Direct outgoing/incoming references
                for (const edge of bundle.refGraph.edges) {
                    if (edge.fromEntityType === entityType && edge.fromId === id) {
                        addRelated(edge.toEntityType, edge.toId, `Reference to ${edge.toEntityType}`);
                    }
                    if (edge.toEntityType === entityType && edge.toId === id) {
                        addRelated(edge.fromEntityType, edge.fromId, `Referenced by ${edge.fromEntityType}`);
                    }
                }

                const output = {
                    bundleId: loaded.id,
                    target: targetEntity.data,
                    related: relatedEntities,
                };

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(output, null, 2),
                    }],
                };
            }
        );

        // get_conformance_context - now with optional bundleId
        this.server.tool(
            "get_conformance_context",
            {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                profileId: z.string().optional().describe("Profile ID (optional, lists all profiles if not specified)"),
            },
            async ({ bundleId, profileId }) => {
                const loaded = this.getBundle(bundleId);
                if (!loaded) {
                    if (!bundleId && !this.isSingleBundleMode()) {
                        return {
                            content: [{ type: "text", text: `Multiple bundles loaded. Please specify bundleId. Available: ${this.getBundleIds().join(", ")}` }],
                            isError: true,
                        };
                    }
                    return {
                        content: [{ type: "text", text: `Bundle not found: ${bundleId}` }],
                        isError: true,
                    };
                }

                const bundle = loaded.bundle;
                const profiles = bundle.entities.get("Profile");

                // Case 1: List all profiles if no ID provided
                if (!profileId) {
                    if (!profiles || profiles.size === 0) {
                        return { content: [{ type: "text", text: `No profiles found in bundle: ${loaded.id}` }] };
                    }
                    const summary = Array.from(profiles.values()).map(p => ({
                        bundleId: loaded.id,
                        id: p.id,
                        title: p.data.title,
                        description: p.data.description
                    }));
                    return {
                        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
                    };
                }

                // Case 2: Get specific profile context
                const profile = profiles?.get(profileId);
                if (!profile) {
                    return {
                        content: [{ type: "text", text: `Profile not found: ${profileId}` }],
                        isError: true,
                    };
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

                const context = {
                    bundleId: loaded.id,
                    metadata: {
                        id: profile.id,
                        title: data.title,
                        description: data.description
                    },
                    auditTemplate: data.auditTemplate,
                    rules: expandedRules,
                    requiredFeatures,
                    optionalFeatures: data.optionalFeatures
                };

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(context, null, 2),
                    }],
                };
            }
        );

        // New tool: search_entities - search across all bundles
        this.server.tool(
            "search_entities",
            {
                query: z.string().describe("Search query (searches in entity IDs and titles)"),
                entityType: z.string().optional().describe("Filter by entity type"),
                bundleId: z.string().optional().describe("Filter by bundle ID"),
            },
            async ({ query, entityType, bundleId }) => {
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

                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({ query, resultCount: results.length, results }, null, 2),
                    }],
                };
            }
        );
    }

    async start() {
        // Load all bundles
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
                });
                console.error(`  ✓ Loaded ${config.id} (${result.diagnostics.length} diagnostics)`);
            } catch (err) {
                console.error(`  ✗ Failed to load ${config.id}:`, err);
                // Continue loading other bundles
            }
        }

        if (this.bundles.size === 0) {
            console.error("No bundles loaded successfully. Exiting.");
            process.exit(1);
        }

        console.error(`\nLoaded ${this.bundles.size} bundle(s) successfully.`);

        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("SDD MCP Server running on stdio");
    }
}
