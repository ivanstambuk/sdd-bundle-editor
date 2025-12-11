/**
 * @sdd-bundle-editor/shared-types
 * 
 * Shared TypeScript types for API contracts between frontend and backend.
 * This package has zero runtime dependencies.
 */

// Type definitions (interfaces, type aliases)
export * from './api/agent';

// TypeBox schemas for runtime validation
export * from './schemas';

// Domain-specific error classes
export * from './errors';

// Result type for functional error handling
export * from './result';

// Structured logging utilities
export * from './logging';
