/**
 * TypeBox schemas for bundle API endpoints.
 * These provide runtime validation and OpenAPI generation.
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// Query Schemas
// ============================================================================

export const BundleQuerySchema = Type.Object({
    bundleDir: Type.Optional(Type.String({ description: 'Path to bundle directory' })),
});
export type BundleQuery = Static<typeof BundleQuerySchema>;

// ============================================================================
// Common Schemas
// ============================================================================

export const DiagnosticSchema = Type.Object({
    severity: Type.Union([
        Type.Literal('error'),
        Type.Literal('warning')
    ]),
    code: Type.String({ description: 'Diagnostic code' }),
    message: Type.String({ description: 'Diagnostic message' }),
    entityType: Type.Optional(Type.String()),
    entityId: Type.Optional(Type.String()),
    path: Type.Optional(Type.String({ description: 'Path to the problematic field' })),
});
export type Diagnostic = Static<typeof DiagnosticSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const BundleResponseSchema = Type.Object({
    bundle: Type.Object({
        manifest: Type.Unknown({ description: 'Bundle manifest' }),
        bundleTypeDefinition: Type.Unknown({ description: 'Bundle type definition' }),
        entities: Type.Record(Type.String(), Type.Array(Type.Unknown()), {
            description: 'Map of entity type to array of entities'
        }),
        refGraph: Type.Unknown({ description: 'Reference graph' }),
        schemas: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        domainMarkdown: Type.Optional(Type.String({ description: 'Domain knowledge markdown' })),
    }),
    diagnostics: Type.Array(DiagnosticSchema),
});
export type BundleResponse = Static<typeof BundleResponseSchema>;

export const ValidateRequestSchema = Type.Object({
    bundleDir: Type.Optional(Type.String()),
});
export type ValidateRequest = Static<typeof ValidateRequestSchema>;

export const ValidateResponseSchema = Type.Object({
    diagnostics: Type.Array(DiagnosticSchema),
});
export type ValidateResponse = Static<typeof ValidateResponseSchema>;

// ============================================================================
// Error Schema
// ============================================================================

export const BundleErrorResponseSchema = Type.Object({
    error: Type.String({ description: 'Error message' }),
    code: Type.Optional(Type.String({ description: 'Error code' })),
});
export type BundleErrorResponse = Static<typeof BundleErrorResponseSchema>;
