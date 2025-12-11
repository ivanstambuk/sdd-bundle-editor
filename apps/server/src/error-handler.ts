/**
 * Centralized error handler for Fastify.
 * Converts errors to consistent API responses.
 */

import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { SddError, isSddError, wrapError, SddErrorCode } from '@sdd-bundle-editor/shared-types';

/**
 * Register centralized error handling for Fastify.
 */
export function registerErrorHandler(fastify: FastifyInstance): void {
    fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
        // Log the error
        fastify.log.error({
            err: error,
            requestId: request.id,
            url: request.url,
            method: request.method,
        }, 'Request error');

        // Convert to SddError for consistent response
        const sddError = toSddError(error);

        // Send response
        return reply.status(sddError.statusCode).send(sddError.toJSON());
    });

    // Handle 404s
    fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
        const error = new SddError(
            `Route not found: ${request.method} ${request.url}`,
            SddErrorCode.API_NOT_FOUND,
            { method: request.method, url: request.url },
            404
        );

        return reply.status(404).send(error.toJSON());
    });
}

/**
 * Convert any error to an SddError.
 */
function toSddError(error: FastifyError | Error | unknown): SddError {
    // Already an SddError
    if (isSddError(error)) {
        return error;
    }

    // Fastify validation error
    if (isFastifyValidationError(error)) {
        return new SddError(
            'Request validation failed',
            SddErrorCode.API_VALIDATION_FAILED,
            { validation: error.validation },
            400
        );
    }

    // Standard Error
    if (error instanceof Error) {
        // Determine status code based on error type/message
        let statusCode = 500;
        let code: string = SddErrorCode.INTERNAL_ERROR;

        if (error.message.includes('not found')) {
            statusCode = 404;
            code = SddErrorCode.API_NOT_FOUND;
        } else if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
            statusCode = 401;
            code = SddErrorCode.API_UNAUTHORIZED;
        }

        return new SddError(error.message, code as any, undefined, statusCode);
    }

    // Unknown error
    return wrapError(error);
}

/**
 * Type guard for Fastify validation errors.
 */
function isFastifyValidationError(error: unknown): error is FastifyError & { validation: unknown[] } {
    return (
        error !== null &&
        typeof error === 'object' &&
        'validation' in error &&
        Array.isArray((error as any).validation)
    );
}
