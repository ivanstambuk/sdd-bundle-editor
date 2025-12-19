/**
 * Validation tools - checking bundle correctness.
 * 
 * Tools:
 * - validate_bundle: Validate a bundle and return all diagnostics
 */

import { z } from "zod";
import { ToolContext } from "./types.js";
import { registerReadOnlyTool } from "./registry.js";
import { toolSuccess, toolError } from "../response-helpers.js";

/**
 * Register validation tools.
 */
export function registerValidationTools(ctx: ToolContext): void {
    const { server, bundles, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: validate_bundle
    registerReadOnlyTool(
        server,
        "validate_bundle",
        "Validate a bundle and return all diagnostics. Use when user asks 'are there any issues?', 'validate my spec', 'check for errors', or 'find broken references'. Returns errors and warnings including broken references, schema violations, and lint rule failures.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode, or 'all' to validate all bundles)"),
        },
        async ({ bundleId }) => {
            const TOOL_NAME = "validate_bundle";

            // Validate all bundles
            if (bundleId === "all" || (!bundleId && !isSingleBundleMode())) {
                const allDiagnostics: Array<{
                    bundleId: string;
                    severity: string;
                    message: string;
                    entityType?: string;
                    entityId?: string;
                    code?: string;
                }> = [];

                for (const [bId, loaded] of bundles) {
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
                        bundlesChecked: bundles.size,
                        totalErrors: errorCount,
                        totalWarnings: warnCount,
                        isValid: errorCount === 0,
                    },
                }, {
                    meta: { bundleCount: bundles.size },
                    diagnostics: allDiagnostics as any, // Extended with bundleId
                });
            }

            // Validate single bundle
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId or use 'all'.", { availableBundles: getBundleIds() });
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
}
