/**
 * Domain-specific error classes for SDD Bundle Editor.
 * Provides structured error handling with error codes and context.
 */

/**
 * Error codes for categorizing different error types.
 */
export const SddErrorCode = {
    // Bundle errors
    BUNDLE_NOT_FOUND: 'BUNDLE_NOT_FOUND',
    BUNDLE_INVALID: 'BUNDLE_INVALID',
    BUNDLE_LOAD_FAILED: 'BUNDLE_LOAD_FAILED',

    // Entity errors
    ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
    ENTITY_INVALID: 'ENTITY_INVALID',
    ENTITY_CREATE_FAILED: 'ENTITY_CREATE_FAILED',
    ENTITY_UPDATE_FAILED: 'ENTITY_UPDATE_FAILED',

    // Schema errors
    SCHEMA_NOT_FOUND: 'SCHEMA_NOT_FOUND',
    SCHEMA_INVALID: 'SCHEMA_INVALID',
    VALIDATION_FAILED: 'VALIDATION_FAILED',

    // Agent errors
    AGENT_NOT_INITIALIZED: 'AGENT_NOT_INITIALIZED',
    AGENT_CONFIG_INVALID: 'AGENT_CONFIG_INVALID',
    AGENT_COMMUNICATION_FAILED: 'AGENT_COMMUNICATION_FAILED',
    AGENT_DECISION_FAILED: 'AGENT_DECISION_FAILED',

    // Git errors
    GIT_NOT_CLEAN: 'GIT_NOT_CLEAN',
    GIT_COMMIT_FAILED: 'GIT_COMMIT_FAILED',
    GIT_NOT_REPO: 'GIT_NOT_REPO',

    // API errors
    API_VALIDATION_FAILED: 'API_VALIDATION_FAILED',
    API_UNAUTHORIZED: 'API_UNAUTHORIZED',
    API_NOT_FOUND: 'API_NOT_FOUND',

    // General errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    UNKNOWN: 'UNKNOWN',
} as const;

export type SddErrorCodeType = typeof SddErrorCode[keyof typeof SddErrorCode];

/**
 * Base error class for SDD Bundle Editor.
 * All domain-specific errors should extend this class.
 */
export class SddError extends Error {
    public readonly code: SddErrorCodeType;
    public readonly context?: Record<string, unknown>;
    public readonly statusCode: number;
    public readonly timestamp: Date;

    constructor(
        message: string,
        code: SddErrorCodeType = SddErrorCode.UNKNOWN,
        context?: Record<string, unknown>,
        statusCode: number = 500
    ) {
        super(message);
        this.name = 'SddError';
        this.code = code;
        this.context = context;
        this.statusCode = statusCode;
        this.timestamp = new Date();

        // Maintains proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SddError);
        }
    }

    /**
     * Serialize error for API responses.
     */
    toJSON(): Record<string, unknown> {
        return {
            error: this.message,
            code: this.code,
            context: this.context,
            timestamp: this.timestamp.toISOString(),
        };
    }

    /**
     * Serialize error for logging.
     */
    toLogObject(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            statusCode: this.statusCode,
            stack: this.stack,
            timestamp: this.timestamp.toISOString(),
        };
    }
}

// ============================================================================
// Domain-specific error subclasses
// ============================================================================

/**
 * Errors related to bundle operations.
 */
export class BundleError extends SddError {
    constructor(
        message: string,
        code: SddErrorCodeType = SddErrorCode.BUNDLE_INVALID,
        context?: Record<string, unknown>
    ) {
        super(message, code, context, 400);
        this.name = 'BundleError';
    }
}

/**
 * Errors related to entity operations.
 */
export class EntityError extends SddError {
    constructor(
        message: string,
        code: SddErrorCodeType = SddErrorCode.ENTITY_INVALID,
        context?: Record<string, unknown>
    ) {
        super(message, code, context, 400);
        this.name = 'EntityError';
    }
}

/**
 * Errors related to schema validation.
 */
export class ValidationError extends SddError {
    public readonly validationDetails?: unknown[];

    constructor(
        message: string,
        validationDetails?: unknown[],
        context?: Record<string, unknown>
    ) {
        super(message, SddErrorCode.VALIDATION_FAILED, context, 400);
        this.name = 'ValidationError';
        this.validationDetails = validationDetails;
    }

    toJSON(): Record<string, unknown> {
        return {
            ...super.toJSON(),
            validationDetails: this.validationDetails,
        };
    }
}

/**
 * Errors related to agent operations.
 */
export class AgentError extends SddError {
    constructor(
        message: string,
        code: SddErrorCodeType = SddErrorCode.AGENT_COMMUNICATION_FAILED,
        context?: Record<string, unknown>
    ) {
        super(message, code, context, 500);
        this.name = 'AgentError';
    }
}

/**
 * Errors related to Git operations.
 */
export class GitError extends SddError {
    constructor(
        message: string,
        code: SddErrorCodeType = SddErrorCode.GIT_NOT_CLEAN,
        context?: Record<string, unknown>
    ) {
        super(message, code, context, 400);
        this.name = 'GitError';
    }
}

/**
 * Errors related to API requests.
 */
export class ApiError extends SddError {
    constructor(
        message: string,
        code: SddErrorCodeType = SddErrorCode.API_VALIDATION_FAILED,
        context?: Record<string, unknown>,
        statusCode: number = 400
    ) {
        super(message, code, context, statusCode);
        this.name = 'ApiError';
    }
}

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Check if an error is an SddError.
 */
export function isSddError(error: unknown): error is SddError {
    return error instanceof SddError;
}

/**
 * Wrap an unknown error as an SddError.
 */
export function wrapError(error: unknown, defaultMessage = 'An unexpected error occurred'): SddError {
    if (isSddError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return new SddError(error.message, SddErrorCode.INTERNAL_ERROR, {
            originalStack: error.stack,
        });
    }

    return new SddError(
        typeof error === 'string' ? error : defaultMessage,
        SddErrorCode.UNKNOWN
    );
}
