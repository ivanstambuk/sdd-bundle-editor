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

    /**
     * Setup MCP prompts for structured AI workflows
     */
    private setupPrompts() {
        // Prompt 1: implement-requirement
        this.server.prompt(
            "implement-requirement",
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
