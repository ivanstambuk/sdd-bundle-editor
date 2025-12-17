/**
 * Standard response/error envelope helpers for MCP tools.
 * Ensures consistent response format across all tools.
 */

/** Standard error codes for MCP tool responses */
export type ErrorCode =
    | "BAD_REQUEST"       // Missing/invalid parameters
    | "NOT_FOUND"         // Bundle/entity not found
    | "VALIDATION_ERROR"  // Schema violations
    | "REFERENCE_ERROR"   // Broken references
    | "DELETE_BLOCKED"    // Cannot delete (has dependents)
    | "INTERNAL";         // Unexpected errors

/** Diagnostic item (warning or error that doesn't block success) */
export interface Diagnostic {
    severity: "error" | "warning" | "info";
    code?: string;
    message: string;
    entityType?: string;
    entityId?: string;
    field?: string;
}

/** Success response envelope */
export interface SuccessResponse {
    ok: true;
    tool: string;
    bundleId?: string;
    data: unknown;
    meta?: Record<string, unknown>;
    diagnostics: Diagnostic[];
}

/** Error response envelope */
export interface ErrorResponse {
    ok: false;
    tool: string;
    error: {
        code: ErrorCode;
        message: string;
        details?: unknown;
    };
}

/**
 * Create a success response for a tool.
 */
export function toolSuccess(
    tool: string,
    data: unknown,
    options?: {
        bundleId?: string;
        meta?: Record<string, unknown>;
        diagnostics?: Diagnostic[];
    }
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
    // Build response object, only including optional fields when present
    const response: Record<string, unknown> = {
        ok: true,
        tool,
        data,
    };

    // Only include bundleId if provided
    if (options?.bundleId !== undefined) {
        response.bundleId = options.bundleId;
    }

    // Only include meta if provided
    if (options?.meta !== undefined) {
        response.meta = options.meta;
    }

    // Only include diagnostics if explicitly provided (not undefined)
    // This allows tools to opt-out of diagnostics in the envelope
    if (options?.diagnostics !== undefined) {
        response.diagnostics = options.diagnostics;
    }

    return {
        content: [{
            type: "text",
            text: JSON.stringify(response, null, 2),
        }],
    };
}

/**
 * Create an error response for a tool.
 * Always sets isError: true at MCP level.
 */
export function toolError(
    tool: string,
    code: ErrorCode,
    message: string,
    details?: unknown
): { content: Array<{ type: "text"; text: string }>; isError: true } {
    const response: ErrorResponse = {
        ok: false,
        tool,
        error: {
            code,
            message,
            details,
        },
    };

    return {
        content: [{
            type: "text",
            text: JSON.stringify(response, null, 2),
        }],
        isError: true,
    };
}

/**
 * Helper to check if bundleId is needed but not provided.
 * Returns error response or null if OK.
 */
export function requireBundleId(
    tool: string,
    bundleId: string | undefined,
    isSingleBundleMode: boolean,
    availableBundleIds: string[]
): ReturnType<typeof toolError> | null {
    if (!bundleId && !isSingleBundleMode) {
        return toolError(
            tool,
            "BAD_REQUEST",
            "Multiple bundles loaded. Please specify bundleId.",
            { availableBundles: availableBundleIds }
        );
    }
    return null;
}

/**
 * Helper to check if bundle exists.
 * Returns error response or null if OK.
 */
export function requireBundle(
    tool: string,
    bundleId: string | undefined,
    bundleExists: boolean
): ReturnType<typeof toolError> | null {
    if (!bundleExists) {
        return toolError(
            tool,
            "NOT_FOUND",
            `Bundle not found: ${bundleId}`,
            { bundleId }
        );
    }
    return null;
}

/**
 * Helper to check if entity type exists.
 * Returns error response or null if OK.
 */
export function requireEntityType(
    tool: string,
    entityType: string,
    typeExists: boolean,
    bundleId?: string
): ReturnType<typeof toolError> | null {
    if (!typeExists) {
        return toolError(
            tool,
            "NOT_FOUND",
            `Unknown entity type: ${entityType}`,
            { bundleId, entityType }
        );
    }
    return null;
}

/**
 * Helper to check if entity exists.
 * Returns error response or null if OK.
 */
export function requireEntity(
    tool: string,
    entityType: string,
    entityId: string,
    entityExists: boolean,
    bundleId?: string
): ReturnType<typeof toolError> | null {
    if (!entityExists) {
        return toolError(
            tool,
            "NOT_FOUND",
            `Entity not found: ${entityType}/${entityId}`,
            { bundleId, entityType, entityId }
        );
    }
    return null;
}
