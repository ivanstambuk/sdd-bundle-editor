/**
 * Analysis prompts - understanding relationships and gaps.
 * 
 * Prompts:
 * - trace-dependency: Trace upstream/downstream dependencies for any entity
 * - coverage-analysis: Analyze specification coverage and find gaps
 * - suggest-relations: Suggest missing relationships between entities
 */

import { z } from "zod";
import { PromptContext } from "./types.js";
import { summarizeEntity } from "../entity-utils.js";
import { completableBundleId, completableEntityType, completableEntityId, completableOptionalEntityType } from "./completion-helpers.js";

/**
 * Register analysis-focused prompts.
 */
export function registerAnalysisPrompts(ctx: PromptContext): void {
    const { server, getBundle, getBundleIds } = ctx;

    // Prompt: trace-dependency
    server.registerPrompt(
        "trace-dependency",
        {
            description: "Trace all dependencies for any entity. Use when user asks 'what depends on this?', 'what will be affected if I change X?', 'show me the dependency chain', or 'impact analysis for this task'. Returns visual dependency tree with impact assessment.",
            argsSchema: {
                bundleId: completableBundleId(ctx),
                entityType: completableEntityType(ctx),
                entityId: completableEntityId(ctx),
                direction: z.enum(["upstream", "downstream", "both"]).default("both").describe("Trace direction"),
            },
        },
        async ({ bundleId, entityType, entityId, direction }) => {
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

            // BFS to find all upstream (what this depends on) and downstream (what depends on this)
            const upstream: Array<{ depth: number; type: string; id: string; title: string; state?: string; via: string }> = [];
            const downstream: Array<{ depth: number; type: string; id: string; title: string; state?: string; via: string }> = [];
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
                                const data = targetEntity.data as Record<string, unknown>;
                                upstream.push({
                                    depth: current.depth + 1,
                                    type: edge.toEntityType,
                                    id: edge.toId,
                                    title: (data.title || data.name || data.statement || edge.toId) as string,
                                    state: data.state as string | undefined,
                                    via: edge.fromField,
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
                                const data = sourceEntity.data as Record<string, unknown>;
                                downstream.push({
                                    depth: current.depth + 1,
                                    type: edge.fromEntityType,
                                    id: edge.fromId,
                                    title: (data.title || data.name || data.statement || edge.fromId) as string,
                                    state: data.state as string | undefined,
                                    via: edge.fromField,
                                });
                                if (current.depth < 3) { // Limit depth
                                    queue.push({ type: edge.fromEntityType, id: edge.fromId, depth: current.depth + 1 });
                                }
                            }
                        }
                    }
                }
            }

            // Limit number of entities shown in prompt
            const MAX_TRACE_ENTITIES = 20;
            const limitedUpstream = upstream.slice(0, MAX_TRACE_ENTITIES);
            const limitedDownstream = downstream.slice(0, MAX_TRACE_ENTITIES);
            const upstreamTruncated = upstream.length > MAX_TRACE_ENTITIES;
            const downstreamTruncated = downstream.length > MAX_TRACE_ENTITIES;

            const promptContent = `You are analyzing dependencies for an entity in an SDD bundle.

## Target Entity
**Type**: ${entityType}
**ID**: ${entityId}

\`\`\`json
${JSON.stringify(entity.data, null, 2)}
\`\`\`

## Upstream Dependencies (What ${entityId} DEPENDS ON) - ${upstream.length} found
These are entities that ${entityId} references. Changes to these may affect ${entityId}.

${limitedUpstream.length > 0 ? limitedUpstream.map(u => `- **${u.type}:${u.id}** (depth ${u.depth}, via \`${u.via}\`) - "${u.title}"${u.state ? ` [${u.state}]` : ""}`).join("\n") : "No upstream dependencies found - this is a root entity."}${upstreamTruncated ? `\n\n... and ${upstream.length - MAX_TRACE_ENTITIES} more (use \`list_entities\` tool to see all)` : ""}

## Downstream Dependents (What DEPENDS ON ${entityId}) - ${downstream.length} found
These are entities that reference ${entityId}. Changes to ${entityId} will affect these.

${limitedDownstream.length > 0 ? limitedDownstream.map(d => `- **${d.type}:${d.id}** (depth ${d.depth}, via \`${d.via}\`) - "${d.title}"${d.state ? ` [${d.state}]` : ""}`).join("\n") : "No downstream dependents found - nothing depends on this entity."}${downstreamTruncated ? `\n\n... and ${downstream.length - MAX_TRACE_ENTITIES} more (use \`list_entities\` tool to see all)` : ""}

**Note:** Use \`read_entities\` tool to get full details for any entity listed above.

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

    // Prompt: coverage-analysis
    server.registerPrompt(
        "coverage-analysis",
        {
            description: "Analyze specification coverage and find gaps. Use when user asks 'what requirements lack tests?', 'where are the gaps?', 'coverage report', or 'what's missing?'. Returns detailed coverage metrics with prioritized recommendations.",
            argsSchema: {
                bundleId: completableBundleId(ctx),
                focus: z.enum(["requirements", "features", "threats", "all"]).default("all").describe("Coverage focus area"),
                threshold: z.number().default(80).describe("Minimum coverage percentage to flag"),
            },
        },
        async ({ bundleId, focus, threshold }) => {
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

            // Gather all entity counts
            const entityCounts: Record<string, number> = {};
            for (const [type, entities] of bundle.entities) {
                entityCounts[type] = entities.size;
            }

            // Analyze requirements coverage
            const requirements = Array.from(bundle.entities.get("Requirement")?.values() || []);
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
${requirements.filter(r => !reqsWithTasks.has(r.id)).map(r => `- ${r.id}: ${(r.data as Record<string, unknown>).title || (r.data as Record<string, unknown>).statement}`).join("\n") || "All requirements have tasks ✓"}

### Features Coverage
- Total Features: ${features.length}
- With Requirements: ${featuresWithReqs.size} (${features.length > 0 ? Math.round(featuresWithReqs.size / features.length * 100) : 0}%)

### Threat Coverage
- Total Threats: ${threats.length}
- With Mitigations: ${mitigatedThreats.size} (${threats.length > 0 ? Math.round(mitigatedThreats.size / threats.length * 100) : 0}%)

### Unmitigated Threats (${threats.length - mitigatedThreats.size})
${threats.filter(t => !mitigatedThreats.has(t.id)).map(t => `- ${t.id}: ${(t.data as Record<string, unknown>).title || (t.data as Record<string, unknown>).description}`).join("\n") || "All threats are mitigated ✓"}

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

    // Prompt: suggest-relations
    server.registerPrompt(
        "suggest-relations",
        {
            description: "Suggest missing relationships between entities. Use when user asks 'what am I missing?', 'suggest connections', 'find related entities', or 'improve my spec'. Analyzes entity content to find likely relationships that should be added.",
            argsSchema: {
                bundleId: completableBundleId(ctx),
                entityType: completableOptionalEntityType(ctx),
                confidence: z.enum(["high", "medium", "all"]).default("high").describe("Minimum confidence for suggestions"),
            },
        },
        async ({ bundleId, entityType, confidence }) => {
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

            // Gather entities for analysis (limit to prevent context explosion)
            const MAX_ENTITIES_FOR_ANALYSIS = 40;
            const allEntities: Array<{ type: string; id: string; summary: Record<string, unknown> }> = [];
            for (const [type, entities] of bundle.entities) {
                if (!entityType || type === entityType) {
                    for (const [id, entity] of entities) {
                        if (allEntities.length < MAX_ENTITIES_FOR_ANALYSIS) {
                            allEntities.push({
                                type,
                                id,
                                summary: summarizeEntity(entity.data as Record<string, unknown>)
                            });
                        }
                    }
                }
            }

            const totalEntityCount = Array.from(bundle.entities.values()).reduce((sum, m) => sum + m.size, 0);
            const entitiesTruncated = totalEntityCount > MAX_ENTITIES_FOR_ANALYSIS;

            // Get existing relations (limit these too)
            const MAX_RELATIONS = 100;
            const allRelations = bundle.refGraph.edges;
            const existingRelations = allRelations.slice(0, MAX_RELATIONS).map(e =>
                `${e.fromEntityType}:${e.fromId} -> ${e.toEntityType}:${e.toId}`
            );
            const relationsTruncated = allRelations.length > MAX_RELATIONS;

            const promptContent = `You are analyzing an SDD bundle to suggest missing relationships.

## Bundle: ${loaded.id}

## Entities to Analyze (${totalEntityCount} total${entitiesTruncated ? `, showing ${MAX_ENTITIES_FOR_ANALYSIS}` : ""})
${allEntities.map(e => `- **${e.type}:${e.id}** - "${e.summary.title || e.id}"${e.summary.state ? ` [${e.summary.state}]` : ""}`).join("\n")}${entitiesTruncated ? `\n\n... and ${totalEntityCount - MAX_ENTITIES_FOR_ANALYSIS} more (use \`list_entities\` tool to see all)` : ""}

## Existing Relations (${allRelations.length} total${relationsTruncated ? `, showing ${MAX_RELATIONS}` : ""})
${existingRelations.join("\n") || "No relations found"}${relationsTruncated ? `\n\n... and ${allRelations.length - MAX_RELATIONS} more` : ""}

**Note:** Use \`read_entities\` tool for full entity details.

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
}
