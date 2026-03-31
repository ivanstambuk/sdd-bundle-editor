import { z } from "zod";
import { toolError, toolSuccess } from "../response-helpers.js";
import { resolveBindingPacket } from "../prompts/binding.js";
import { registerReadOnlyTool } from "./registry.js";
import { ToolContext } from "./types.js";

export function registerPacketTools(ctx: ToolContext): void {
    const { server, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    registerReadOnlyTool(
        server,
        "resolve_binding_packet",
        "Resolve a generic implementation or conformance packet for an ImplementationBinding without requiring the caller to know MCP prompt endpoint names.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            packetType: z.enum(["implementation", "conformance"]).describe("Packet type to resolve"),
            bindingId: z.string().describe("ImplementationBinding ID"),
            operationId: z.string().optional().describe("Operation ID for implementation packets"),
            suiteId: z.string().optional().describe("ConformanceSuite ID for conformance packets"),
            artifactMode: z.string().optional().describe("Artifact mode hint, such as library-only"),
            promptName: z.string().optional().describe("Legacy prompt-name override when a specific MCP prompt endpoint must be selected"),
        },
        async ({ bundleId, packetType, bindingId, operationId, suiteId, artifactMode, promptName }) => {
            const TOOL_NAME = "resolve_binding_packet";
            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            try {
                const packet = resolveBindingPacket(ctx, {
                    bundleId: loaded.id,
                    packetType,
                    bindingId,
                    operationId,
                    suiteId,
                    artifactMode,
                    promptName,
                });

                return toolSuccess(TOOL_NAME, packet, {
                    bundleId: loaded.id,
                    meta: {
                        packetType,
                        promptName: packet.promptName,
                        promptRole: packet.promptRole,
                        templateId: packet.templateId,
                    },
                    diagnostics: [],
                });
            } catch (error) {
                return toolError(
                    TOOL_NAME,
                    "BAD_REQUEST",
                    error instanceof Error ? error.message : String(error),
                    {
                        bundleId: loaded.id,
                        packetType,
                        bindingId,
                        operationId,
                        suiteId,
                        artifactMode,
                        promptName,
                    }
                );
            }
        }
    );
}
