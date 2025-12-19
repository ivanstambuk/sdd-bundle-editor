/**
 * Quality prompts - auditing, health checks, and test generation.
 * 
 * Prompts:
 * - audit-profile: Perform conformance audit against a profile
 * - bundle-health: Analyze bundle health and generate report
 * - generate-test-cases: Generate test cases for requirements or features
 */

import { z } from "zod";
import { PromptContext } from "./types.js";
import { summarizeEntity, formatEntitiesForPrompt } from "../entity-utils.js";

/**
 * Register quality-focused prompts.
 */
export function registerQualityPrompts(ctx: PromptContext): void {
    const { server, getBundle, getBundleIds } = ctx;

    // Prompt: audit-profile
    server.registerPrompt(
        "audit-profile",
        {
            description: "Run a conformance audit against a profile's rules. Use when user asks 'are we compliant with X?', 'audit against security baseline', 'check conformance', or 'what rules are we missing?'. Returns detailed pass/fail analysis with remediation recommendations.",
            argsSchema: {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                profileId: z.string().describe("Profile ID to audit against"),
                scope: z.enum(["full", "requirements-only", "quick"]).default("full").describe("Audit scope"),
            },
        },
        async ({ bundleId, profileId, scope }) => {
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

            const profileData = profile.data as Record<string, unknown>;

            // Gather requirements and components (with limits to prevent context explosion)
            const MAX_ENTITIES = 30; // Limit entities in prompt
            const allRequirements = Array.from(bundle.entities.get("Requirement")?.values() || []);
            const allComponents = Array.from(bundle.entities.get("Component")?.values() || []);

            // Get conformance rules
            const conformanceRules = (profileData.conformanceRules || []) as Array<Record<string, unknown>>;

            // Expand linked requirements in rules (use summaries for linked reqs)
            const expandedRules = conformanceRules.map((rule) => {
                const expanded = { ...rule };
                if (rule.linkedRequirement) {
                    const req = bundle.entities.get("Requirement")?.get(rule.linkedRequirement as string);
                    if (req) {
                        // Use summary instead of full data
                        expanded.requirementDetails = summarizeEntity(req.data as Record<string, unknown>);
                    }
                }
                return expanded;
            });

            const scopeInstructions = {
                full: "Perform a comprehensive audit checking all rules, requirements, and implementation status.",
                "requirements-only": "Focus only on requirements coverage and completeness.",
                quick: "Provide a quick summary with just the most critical findings."
            };

            // Adjust entity limit based on scope
            const entityLimit = scope === "quick" ? 15 : MAX_ENTITIES;

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

### Requirements (${allRequirements.length} total)
${formatEntitiesForPrompt(allRequirements as Array<{ data: Record<string, unknown> }>, { maxEntities: entityLimit, mode: "summary" })}

### Components (${allComponents.length} total)
${formatEntitiesForPrompt(allComponents as Array<{ data: Record<string, unknown> }>, { maxEntities: entityLimit, mode: "summary" })}

${profileData.auditTemplate ? `## Audit Template\n${profileData.auditTemplate}\n` : ""}

**Note:** Entity summaries shown above. Use \`read_entity\` tool for full entity details if needed.

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

    // Prompt: bundle-health
    server.registerPrompt(
        "bundle-health",
        {
            description: "Analyze bundle health and generate a comprehensive report. Use when user asks 'how healthy is my spec?', 'are there any issues?', 'bundle status', or 'quality check'. Returns analysis of broken references, schema errors, coverage gaps, and recommendations.",
            argsSchema: {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            },
        },
        async ({ bundleId }) => {
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

    // Prompt: generate-test-cases
    server.registerPrompt(
        "generate-test-cases",
        {
            description: "Generate test cases for a requirement or feature. Use when user asks 'write tests for REQ-XXX', 'what should I test?', 'BDD scenarios for this feature', or 'test coverage for this'. Generates comprehensive test cases in BDD, traditional, or checklist format.",
            argsSchema: {
                bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
                entityType: z.enum(["Requirement", "Feature"]).describe("Entity type to generate tests for"),
                entityId: z.string().describe("Entity ID"),
                style: z.enum(["bdd", "traditional", "checklist"]).default("bdd").describe("Test case style"),
            },
        },
        async ({ bundleId, entityType, entityId, style }) => {
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

            // Get related entities for context (limit to prevent context explosion)
            const MAX_RELATED = 10;
            const relatedEntities: Array<{ type: string; id: string; summary: Record<string, unknown> }> = [];
            for (const edge of bundle.refGraph.edges) {
                if (relatedEntities.length >= MAX_RELATED) break;
                if (edge.fromId === entityId || edge.toId === entityId) {
                    const otherId = edge.fromId === entityId ? edge.toId : edge.fromId;
                    const otherType = edge.fromId === entityId ? edge.toEntityType : edge.fromEntityType;
                    const otherEntity = bundle.entities.get(otherType)?.get(otherId);
                    if (otherEntity) {
                        relatedEntities.push({
                            type: otherType,
                            id: otherId,
                            summary: summarizeEntity(otherEntity.data as Record<string, unknown>)
                        });
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
${relatedEntities.map(e => `- **${e.type}:${e.id}** - "${e.summary.title || e.id}"${e.summary.state ? ` [${e.summary.state}]` : ""}`).join("\n") || "No related entities"}

**Note:** Use \`read_entity\` tool for full details of related entities.

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
}
