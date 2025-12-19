/**
 * Implementation prompts - planning and execution workflows.
 * 
 * Prompts:
 * - implement-requirement: Generate implementation plan for a requirement
 * - create-roadmap: Generate implementation roadmap from specifications
 */

import { z } from "zod";
import { PromptContext } from "./types.js";
import { summarizeEntity, formatEntitiesForPrompt } from "../entity-utils.js";

/**
 * Register implementation-focused prompts.
 */
export function registerImplementationPrompts(ctx: PromptContext): void {
    const { server, getBundle, getBundleIds } = ctx;

    // Prompt: implement-requirement
    server.registerPrompt(
        "implement-requirement",
        {
            description: "Generate a detailed implementation plan for a requirement. Use when user asks 'how do I implement REQ-XXX?', 'help me build this requirement', or 'what tasks are needed for this requirement?'. Gathers related features, components, existing tasks, and domain knowledge to create actionable steps with estimates.",
            argsSchema: {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                requirementId: z.string().describe("The requirement ID to implement"),
                depth: z.enum(["overview", "detailed", "with-code"]).default("detailed").describe("Level of detail"),
            },
        },
        async ({ bundleId, requirementId, depth }) => {
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
            const requirement = bundle.entities.get("Requirement")?.get(requirementId);

            if (!requirement) {
                return {
                    messages: [{
                        role: "user",
                        content: { type: "text", text: `Error: Requirement ${requirementId} not found in bundle ${loaded.id}` }
                    }]
                };
            }

            // Gather related entities (limit to prevent context explosion)
            const MAX_RELATED = 10;
            const relatedEntities: Array<{ data: Record<string, unknown> }> = [];
            const relatedTasks: Array<{ data: Record<string, unknown> }> = [];
            const relatedFeatures: Array<{ data: Record<string, unknown> }> = [];
            const relatedComponents: Array<{ data: Record<string, unknown> }> = [];

            for (const edge of bundle.refGraph.edges) {
                if (edge.toId === requirementId || edge.fromId === requirementId) {
                    const otherId = edge.toId === requirementId ? edge.fromId : edge.toId;
                    const otherType = edge.toId === requirementId ? edge.fromEntityType : edge.toEntityType;
                    const entity = bundle.entities.get(otherType)?.get(otherId);
                    if (entity) {
                        const wrapped = { data: entity.data as Record<string, unknown> };
                        if (otherType === "Task") relatedTasks.push(wrapped);
                        else if (otherType === "Feature") relatedFeatures.push(wrapped);
                        else if (otherType === "Component") relatedComponents.push(wrapped);
                        else relatedEntities.push(wrapped);
                    }
                }
            }

            // Get domain knowledge if available (truncate if too long)
            const MAX_DOMAIN_CHARS = 4000;
            let domainKnowledge = bundle.domainMarkdown || "";
            if (domainKnowledge.length > MAX_DOMAIN_CHARS) {
                domainKnowledge = domainKnowledge.substring(0, MAX_DOMAIN_CHARS) + "\n\n... (truncated, use bundle resources for full domain knowledge)";
            }

            const depthInstructions = {
                overview: "Provide a brief overview with 3-5 bullet points.",
                detailed: "Provide a detailed implementation plan with steps, estimates, and acceptance criteria.",
                "with-code": "Provide a detailed plan with code examples and snippets where appropriate."
            };

            // Use full data for the target requirement, summaries for related entities
            const promptContent = `You are helping implement a requirement from an SDD (Spec-Driven Development) bundle.

## Requirement to Implement
\`\`\`json
${JSON.stringify(requirement.data, null, 2)}
\`\`\`

## Related Features (${relatedFeatures.length})
${relatedFeatures.length > 0 ? formatEntitiesForPrompt(relatedFeatures, { maxEntities: MAX_RELATED, mode: "summary" }) : "None found"}

## Related Components (${relatedComponents.length})
${relatedComponents.length > 0 ? formatEntitiesForPrompt(relatedComponents, { maxEntities: MAX_RELATED, mode: "summary" }) : "None found"}

## Existing Tasks for this Requirement (${relatedTasks.length})
${relatedTasks.length > 0 ? formatEntitiesForPrompt(relatedTasks, { maxEntities: MAX_RELATED, mode: "summary" }) : "None found - you may need to suggest new tasks"}

## Other Related Entities
${relatedEntities.length > 0 ? formatEntitiesForPrompt(relatedEntities, { maxEntities: MAX_RELATED, mode: "summary" }) : "None"}

${domainKnowledge ? `## Domain Knowledge\n${domainKnowledge}\n` : ""}
**Note:** For full entity details, use the \`read_entity\` tool with entityType and entityId.

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

    // Prompt: create-roadmap
    server.registerPrompt(
        "create-roadmap",
        {
            description: "Generate an implementation roadmap from specifications. Use when user asks 'create a project plan', 'what's the roadmap?', 'how do I implement all this?', or 'phased implementation plan'. Creates timeline, phases, or milestone-based roadmaps with dependencies.",
            argsSchema: {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                scope: z.string().default("all").describe("Scope: 'all', 'feature:FEAT-001', or 'tag:security'"),
                format: z.enum(["timeline", "phases", "milestones"]).default("phases").describe("Roadmap format"),
            },
        },
        async ({ bundleId, scope, format }) => {
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

            // Limits for roadmap prompt
            const MAX_FEATURES = 20;
            const MAX_REQUIREMENTS = 30;
            const MAX_TASKS = 40;

            // Get all tasks with their relations (limited)
            const allTasks = Array.from(bundle.entities.get("Task")?.values() || []);
            const tasks = allTasks.slice(0, MAX_TASKS).map(t => {
                const data = t.data as Record<string, unknown>;
                const summary = summarizeEntity(data);
                return {
                    id: t.id,
                    summary,
                    dependencies: [] as string[],
                    relatedReqs: [] as string[],
                    relatedFeatures: [] as string[]
                };
            });

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

            // Get features (summarized)
            const allFeatures = Array.from(bundle.entities.get("Feature")?.values() || []);
            const features = allFeatures.slice(0, MAX_FEATURES).map(f =>
                summarizeEntity(f.data as Record<string, unknown>)
            );

            // Get requirements (summarized)
            const allRequirements = Array.from(bundle.entities.get("Requirement")?.values() || []);
            const requirements = allRequirements.slice(0, MAX_REQUIREMENTS).map(r =>
                summarizeEntity(r.data as Record<string, unknown>)
            );

            const formatInstructions = {
                timeline: "Create a week-by-week timeline with specific dates/durations.",
                phases: "Organize into logical phases (Foundation, Core, Polish, etc.).",
                milestones: "Focus on key milestones and deliverables."
            };

            const promptContent = `You are creating an implementation roadmap from an SDD bundle.

## Bundle: ${loaded.id}
## Scope: ${scope}
## Format: ${format}

## Features (${allFeatures.length} total${allFeatures.length > MAX_FEATURES ? `, showing ${MAX_FEATURES}` : ""})
${features.map(f => `- **${f.id}** - "${f.title}"${f.state ? ` [${f.state}]` : ""}`).join("\n") || "No features"}

## Requirements (${allRequirements.length} total${allRequirements.length > MAX_REQUIREMENTS ? `, showing ${MAX_REQUIREMENTS}` : ""})
${requirements.map(r => `- **${r.id}** - "${r.title}"${r.state ? ` [${r.state}]` : ""}${r.priority ? ` (${r.priority})` : ""}`).join("\n") || "No requirements"}

## Tasks (${allTasks.length} total${allTasks.length > MAX_TASKS ? `, showing ${MAX_TASKS}` : ""})
${tasks.map(t => `- **${t.id}** - "${t.summary.title}"${t.summary.state ? ` [${t.summary.state}]` : ""}
  - Dependencies: ${t.dependencies.join(", ") || "None"}
  - Related Reqs: ${t.relatedReqs.join(", ") || "None"}`).join("\n")}

**Note:** Use \`read_entity\` tool for full entity details.

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
