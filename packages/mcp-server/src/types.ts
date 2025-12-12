import { z } from "zod";

/**
 * Schema for bundles.yaml configuration file
 */
export const BundleConfigSchema = z.object({
    id: z.string().describe("Unique identifier for the bundle"),
    path: z.string().describe("Absolute or relative path to the bundle directory"),
    tags: z.array(z.string()).optional().describe("Optional tags for categorization"),
    description: z.string().optional().describe("Optional description of the bundle"),
});

export const BundlesConfigFileSchema = z.object({
    bundles: z.array(BundleConfigSchema),
});

export type BundleConfig = z.infer<typeof BundleConfigSchema>;
export type BundlesConfigFile = z.infer<typeof BundlesConfigFileSchema>;

/**
 * Diagnostic from bundle validation
 */
export interface BundleDiagnostic {
    severity: 'error' | 'warning';
    message: string;
    entityId?: string;
    entityType?: string;
    filePath?: string;
    path?: string;
    source?: 'schema' | 'lint' | 'gate';
    code?: string;
}

/**
 * Loaded bundle with its configuration and diagnostics
 */
export interface LoadedBundle {
    id: string;
    path: string;
    tags?: string[];
    description?: string;
    bundle: import("@sdd-bundle-editor/core-model").Bundle;
    diagnostics: BundleDiagnostic[];
}
