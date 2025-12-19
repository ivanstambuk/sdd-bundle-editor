/**
 * Documentation prompts - generating explanations and summaries.
 * 
 * Prompts:
 * - explain-entity: Explain any entity for different audiences
 * - summarize-bundle: Generate bundle summaries for different formats
 * - diff-bundles: Compare two bundles and show differences
 */

import { z } from "zod";
import { PromptContext } from "./types.js";

/**
 * Register documentation-focused prompts.
 */
export function registerDocumentationPrompts(ctx: PromptContext): void {
    const { server, getBundle, getBundleIds, bundles } = ctx;

    // Prompt: explain-entity
    server.registerPrompt(
        "explain-entity",
        {
            description: "Explain any entity in plain language for a specific audience. Use when user asks 'what is FEAT-XXX?', 'explain this to my manager', 'help me understand this component', or 'what does this requirement mean?'. Adapts language for developers, stakeholders, or new team members.",
            argsSchema: {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.string().describe("Entity type (e.g., Requirement, Component, Feature)"),
                entityId: z.string().describe("Entity ID"),
                audience: z.enum(["developer", "stakeholder", "new-team-member"]).default("developer").describe("Target audience"),
            },
        },
        async ({ bundleId, entityType, entityId, audience }) => {
            const loaded = getBundle(bundleId);
            if (!loaded) {
                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: `Error: Bundle not found. Available bundles: ${getBundleIds().join(", ")}` }
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
            const incomingRefs: Array<{ type: string; id: string; title: string; field: string }> = [];
            const outgoingRefs: Array<{ type: string; id: string; title: string; field: string }> = [];

            for (const edge of bundle.refGraph.edges) {
                if (edge.toId === entityId && edge.toEntityType === entityType) {
                    const fromEntity = bundle.entities.get(edge.fromEntityType)?.get(edge.fromId);
                    if (fromEntity) {
                        const data = fromEntity.data as Record<string, unknown>;
                        incomingRefs.push({
                            type: edge.fromEntityType,
                            id: edge.fromId,
                            title: (data.title || data.statement || edge.fromId) as string,
                            field: edge.fromField
                        });
                    }
                }
                if (edge.fromId === entityId && edge.fromEntityType === entityType) {
                    const toEntity = bundle.entities.get(edge.toEntityType)?.get(edge.toId);
                    if (toEntity) {
                        const data = toEntity.data as Record<string, unknown>;
                        outgoingRefs.push({
                            type: edge.toEntityType,
                            id: edge.toId,
                            title: (data.title || data.statement || edge.toId) as string,
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

    // Prompt: summarize-bundle
    server.registerPrompt(
        "summarize-bundle",
        {
            description: "Generate a summary of the entire bundle. Use when user asks 'what is this project about?', 'give me an overview', 'executive summary', or 'onboard me to this spec'. Generates comprehensive summaries tailored for executives, developers, or new team members.",
            argsSchema: {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                format: z.enum(["executive", "technical", "onboarding"]).default("executive").describe("Summary format"),
            },
        },
        async ({ bundleId, format }) => {
            const loaded = getBundle(bundleId);
            if (!loaded) {
                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: `Error: Bundle not found. Available bundles: ${getBundleIds().join(", ")}` }
                    }]
                };
            }

            const bundle = loaded.bundle;
            const manifest = bundle.manifest;

            // Gather statistics
            const stats: Record<string, { count: number; items: Array<{ id: string; title?: string; state?: string; priority?: string }> }> = {};
            for (const [type, entities] of bundle.entities) {
                stats[type] = {
                    count: entities.size,
                    items: Array.from(entities.values()).map(e => {
                        const data = e.data as Record<string, unknown>;
                        return {
                            id: e.id,
                            title: (data.title || data.statement || data.name) as string | undefined,
                            state: data.state as string | undefined,
                            priority: data.priority as string | undefined
                        };
                    })
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

    // Prompt: diff-bundles
    server.registerPrompt(
        "diff-bundles",
        {
            description: "Compare two bundles and show differences. Use when user asks 'what changed between versions?', 'compare these specs', 'diff v1 vs v2', or 'migration analysis'. Requires two bundles loaded. Shows added, removed, and modified entities.",
            argsSchema: {
                bundleA: z.string().describe("First bundle ID"),
                bundleB: z.string().describe("Second bundle ID"),
                focus: z.enum(["all", "requirements", "structure"]).default("all").describe("Diff focus"),
            },
        },
        async ({ bundleA, bundleB, focus }) => {
            const loadedA = bundles.get(bundleA);
            const loadedB = bundles.get(bundleB);

            if (!loadedA) {
                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: `Error: Bundle ${bundleA} not found. Available: ${getBundleIds().join(", ")}` }
                    }]
                };
            }
            if (!loadedB) {
                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: `Error: Bundle ${bundleB} not found. Available: ${getBundleIds().join(", ")}` }
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
}
