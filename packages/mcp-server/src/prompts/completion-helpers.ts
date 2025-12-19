/**
 * Completion helpers for MCP prompt arguments.
 * 
 * These functions create completable Zod schemas that provide autocompletion
 * suggestions for prompt arguments like bundleId, entityType, and entityId.
 */

import { z } from "zod";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import { PromptContext } from "./types.js";

/**
 * Create a completable bundleId schema (optional).
 * Returns all loaded bundle IDs as suggestions.
 */
export function completableBundleId(ctx: PromptContext) {
    return completable(
        z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
        () => ctx.getBundleIds()
    );
}

/**
 * Create a completable bundleId schema (required).
 * Returns all loaded bundle IDs as suggestions.
 */
export function completableRequiredBundleId(ctx: PromptContext, description: string = "Bundle ID") {
    return completable(
        z.string().describe(description),
        () => ctx.getBundleIds()
    );
}

/**
 * Create a completable entityType schema.
 * Returns entity types for the bundle specified in context.arguments.bundleId.
 */
export function completableEntityType(ctx: PromptContext) {
    return completable(
        z.string().describe("Entity type"),
        (_value: string, context?: { arguments?: Record<string, string> }) => {
            const bundleId = context?.arguments?.bundleId;
            const loaded = ctx.getBundle(bundleId);
            return loaded ? Array.from(loaded.bundle.entities.keys()) : [];
        }
    );
}

/**
 * Create a completable optional entityType schema.
 * Returns entity types for the bundle specified in context.arguments.bundleId.
 */
export function completableOptionalEntityType(ctx: PromptContext) {
    return completable(
        z.string().optional().describe("Focus on specific entity type"),
        (_value: string | undefined, context?: { arguments?: Record<string, string> }) => {
            const bundleId = context?.arguments?.bundleId;
            const loaded = ctx.getBundle(bundleId);
            return loaded ? Array.from(loaded.bundle.entities.keys()) : [];
        }
    );
}

/**
 * Create a completable entityId schema.
 * Returns entity IDs for the bundle and type specified in context.arguments.
 */
export function completableEntityId(ctx: PromptContext) {
    return completable(
        z.string().describe("Entity ID"),
        (_value: string, context?: { arguments?: Record<string, string> }) => {
            const bundleId = context?.arguments?.bundleId;
            const entityType = context?.arguments?.entityType;
            if (!entityType) return [];
            const loaded = ctx.getBundle(bundleId);
            const entityMap = loaded?.bundle.entities.get(entityType);
            return entityMap ? Array.from(entityMap.keys()) : [];
        }
    );
}

/**
 * Create a completable requirementId schema.
 * Returns Requirement entity IDs for the bundle specified in context.arguments.bundleId.
 */
export function completableRequirementId(ctx: PromptContext) {
    return completable(
        z.string().describe("The requirement ID to implement"),
        (_value: string, context?: { arguments?: Record<string, string> }) => {
            const bundleId = context?.arguments?.bundleId;
            const loaded = ctx.getBundle(bundleId);
            const entityMap = loaded?.bundle.entities.get("Requirement");
            return entityMap ? Array.from(entityMap.keys()) : [];
        }
    );
}

/**
 * Create a completable profileId schema.
 * Returns Profile entity IDs for the bundle specified in context.arguments.bundleId.
 */
export function completableProfileId(ctx: PromptContext) {
    return completable(
        z.string().describe("Profile ID to audit against"),
        (_value: string, context?: { arguments?: Record<string, string> }) => {
            const bundleId = context?.arguments?.bundleId;
            const loaded = ctx.getBundle(bundleId);
            const entityMap = loaded?.bundle.entities.get("Profile");
            return entityMap ? Array.from(entityMap.keys()) : [];
        }
    );
}
