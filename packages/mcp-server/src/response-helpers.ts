/**
 * Standard response/error envelope helpers for MCP tools.
 * Ensures consistent response format across all tools.
 */

/** Standard error codes for MCP tool responses */
export type ErrorCode =
    | "BAD_REQUEST"            // Missing/invalid parameters
    | "NOT_FOUND"              // Bundle/entity not found
    | "VALIDATION_ERROR"       // Schema violations
    | "REFERENCE_ERROR"        // Broken references
    | "DELETE_BLOCKED"         // Cannot delete (has dependents)
    | "UNSUPPORTED_CAPABILITY" // Client doesn't support required capability (e.g., sampling)
    | "INTERNAL";              // Unexpected errors

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
 * MCP tool response with structuredContent for reliable machine parsing.
 * 
 * - `content[].text`: Human-readable JSON for debugging
 * - `structuredContent`: Machine-parsable object for agents
 * 
 * Index signature required for MCP SDK compatibility.
 */
export interface ToolResponse {
    content: Array<{ type: "text"; text: string }>;
    structuredContent: Record<string, unknown>;
    isError?: boolean;
    [x: string]: unknown;  // MCP SDK compatibility
}

/**
 * Create a success response for a tool.
 * 
 * Returns both human-readable text (for debugging) and structuredContent
 * (for reliable machine parsing by agents).
 */
export function toolSuccess(
    tool: string,
    data: unknown,
    options?: {
        bundleId?: string;
        meta?: Record<string, unknown>;
        diagnostics?: Diagnostic[];
    }
): ToolResponse {
    // Build response object with uniform envelope
    // Always include meta and diagnostics for agent consumability
    const response: Record<string, unknown> = {
        ok: true,
        tool,
        data,
    };

    // Only include bundleId if provided (bundle-scoped tools should always provide this)
    if (options?.bundleId !== undefined) {
        response.bundleId = options.bundleId;
    }

    // Always include meta (default to empty object for uniform envelope)
    response.meta = options?.meta ?? {};

    // Always include diagnostics (default to empty array for uniform envelope)
    response.diagnostics = options?.diagnostics ?? [];

    return {
        // Human-readable JSON for debugging
        content: [{
            type: "text",
            text: JSON.stringify(response, null, 2),
        }],
        // Machine-parsable object for agents - same structure as text
        structuredContent: response,
    };
}

/**
 * Error response type with structuredContent.
 * Index signature required for MCP SDK compatibility.
 */
export interface ToolErrorResponse {
    content: Array<{ type: "text"; text: string }>;
    structuredContent: Record<string, unknown>;
    isError: true;
    [x: string]: unknown;  // MCP SDK compatibility
}

/**
 * Create an error response for a tool.
 * Always sets isError: true at MCP level.
 * 
 * Returns both human-readable text (for debugging) and structuredContent
 * (for reliable machine parsing by agents).
 */
export function toolError(
    tool: string,
    code: ErrorCode,
    message: string,
    details?: unknown
): ToolErrorResponse {
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
        // Human-readable JSON for debugging
        content: [{
            type: "text",
            text: JSON.stringify(response, null, 2),
        }],
        // Machine-parsable object for agents - same structure as text
        structuredContent: response as unknown as Record<string, unknown>,
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

/**
 * Create a consistent error response for resources.
 * Uses the same {ok:false, resource, error:{...}} envelope as tools for harmonized handling.
 */
export function resourceError(
    resource: string,
    code: ErrorCode,
    message: string,
    details?: unknown
): { ok: false; resource: string; error: { code: ErrorCode; message: string; details?: unknown } } {
    return {
        ok: false,
        resource,
        error: { code, message, details },
    };
}
