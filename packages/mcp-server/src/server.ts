import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadBundleWithSchemaValidation, Bundle } from "@sdd-bundle-editor/core-model";
import { z } from "zod";

export class SddMcpServer {
    private server: McpServer;
    private bundleDir: string;
    private bundle: Bundle | null = null;

    constructor(bundleDir: string) {
        this.bundleDir = bundleDir;
        this.server = new McpServer({
            name: "sdd-bundle-editor",
            version: "0.1.0",
        });

        this.setupResources();
        this.setupTools();
    }

    private setupResources() {
        this.server.resource(
            "current-bundle",
            "bundle://current",
            async (uri) => {
                if (!this.bundle) {
                    throw new Error("Bundle not loaded");
                }
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(this.bundle.manifest, null, 2), // TODO: Return meaningful summary or manifest
                            mimeType: "application/json",
                        },
                    ],
                };
            }
        );
    }

    private setupTools() {
        this.server.tool(
            "read_entity",
            {
                entityType: z.string(),
                id: z.string(),
            },
            async ({ entityType, id }) => {
                if (!this.bundle) throw new Error("Bundle not loaded");

                const entitiesOfType = this.bundle.entities.get(entityType);
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
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(entity.data, null, 2),
                        },
                    ],
                };
            }
        );

        this.server.tool(
            "list_entities",
            {
                entityType: z.string().optional(),
            },
            async ({ entityType }) => {
                if (!this.bundle) throw new Error("Bundle not loaded");

                if (entityType) {
                    const entitiesOfType = this.bundle.entities.get(entityType);
                    if (!entitiesOfType) return { content: [{ type: "text", text: "[]" }] };

                    const ids = Array.from(entitiesOfType.keys());
                    return {
                        content: [{ type: "text", text: JSON.stringify(ids, null, 2) }]
                    };
                }

                const allTypes = Array.from(this.bundle.entities.keys());
                return {
                    content: [{ type: "text", text: `Available types: ${allTypes.join(", ")}` }]
                };
            }
        );

        this.server.tool(
            "get_context",
            {
                entityType: z.string(),
                id: z.string(),
                depth: z.number().default(1),
            },
            async ({ entityType, id, depth }) => {
                if (!this.bundle) throw new Error("Bundle not loaded");

                const targetEntities = this.bundle.entities.get(entityType);
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

                    const entity = this.bundle!.entities.get(eType)?.get(eId);
                    if (entity) {
                        relatedEntities.push({ relation, entity: entity.data });
                    }
                };

                // 1. Direct outgoing references (from edges)
                // We really need an efficient lookup for this. iterating all edges is O(E).
                // For a small bundle, it's fine.
                for (const edge of this.bundle.refGraph.edges) {
                    if (edge.fromEntityType === entityType && edge.fromId === id) {
                        addRelated(edge.toEntityType, edge.toId, `Reference to ${edge.toEntityType}`);
                    }
                    if (edge.toEntityType === entityType && edge.toId === id) {
                        addRelated(edge.fromEntityType, edge.fromId, `Referenced by ${edge.fromEntityType}`);
                    }
                }

                const output = {
                    target: targetEntity.data,
                    related: relatedEntities,
                };

                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(output, null, 2),
                        },
                    ],
                };
            }
        );

        this.server.tool(
            "get_conformance_context",
            {
                profileId: z.string().optional(),
            },
            async ({ profileId }) => {
                if (!this.bundle) throw new Error("Bundle not loaded");

                const profiles = this.bundle.entities.get("Profile");

                // Case 1: List all profiles if no ID provided
                if (!profileId) {
                    if (!profiles || profiles.size === 0) {
                        return { content: [{ type: "text", text: "No profiles found in bundle." }] };
                    }
                    const summary = Array.from(profiles.values()).map(p => ({
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
                    const feat = this.bundle!.entities.get("Feature")?.get(ref);
                    return feat ? feat.data : { id: ref, _error: "Feature not found" };
                });

                // Expand rules with simple requirement text if available
                const expandedRules = (data.conformanceRules || []).map((rule: any) => {
                    const expanded = { ...rule };
                    if (rule.linkedRequirement) {
                        const req = this.bundle!.entities.get("Requirement")?.get(rule.linkedRequirement);
                        if (req) {
                            expanded.requirementText = (req.data as any).description;
                        }
                    }
                    return expanded;
                });

                const context = {
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
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(context, null, 2),
                        },
                    ],
                };
            }
        );
    }

    async start() {
        console.error(`Loading bundle from ${this.bundleDir}...`);
        try {
            const result = await loadBundleWithSchemaValidation(this.bundleDir);
            this.bundle = result.bundle;
            console.error(`Bundle loaded. ${result.diagnostics.length} diagnostics.`);
        } catch (err) {
            console.error("Failed to load bundle:", err);
            process.exit(1);
        }

        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("SDD MCP Server running on stdio");
    }
}
