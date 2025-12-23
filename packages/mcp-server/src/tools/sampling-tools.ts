/**
 * Sampling tools - LLM-based capabilities via MCP sampling.
 * 
 * Tools:
 * - critique_bundle: LLM-based quality critique via MCP sampling
 */

import { z } from "zod";
import { ToolContext } from "./types.js";
import { registerExternalTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

/**
 * Register sampling-based tools.
 */
export function registerSamplingTools(ctx: ToolContext): void {
    const { server, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: critique_bundle
    registerExternalTool(
        server,
        "critique_bundle",
        "Trigger an LLM-based quality critique of the bundle for AI consumability and completeness. Uses MCP sampling to request the client's LLM to evaluate the spec. Returns scored findings. Requires client to support MCP sampling capability.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            threshold: z.number().min(1).max(10).default(5).describe("Minimum score (1-10) to include in findings. Higher = stricter."),
        },
        async ({ bundleId, threshold }) => {
            const TOOL_NAME = "critique_bundle";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
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

The full spec is available via MCP tools (get_bundle_snapshot, read_entities, list_entities).
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
            const underlyingServer = server.server;
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
