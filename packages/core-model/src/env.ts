import * as path from 'path';

/**
 * Resolves the default bundle path across the entire monorepo.
 * Order of precedence:
 * 1. SDD_SAMPLE_BUNDLE_PATH environment variable (for local overrides)
 * 2. Fallback to the monorepo-native `packages/sample-bundle/bundle` relative to the CWD
 */
export function getDefaultBundlePath(): string {
    if (process.env.SDD_SAMPLE_BUNDLE_PATH) {
        return process.env.SDD_SAMPLE_BUNDLE_PATH;
    }

    // Default to the native monorepo workspace package "sample-bundle"
    // Since this runs in different contexts (CLI out of /packages/cli, UI from repo root, E2E),
    // traversing up to find the root is a more robust pattern, but falling back to process.cwd() works when ran via pnpm scripts at root.
    return path.resolve(process.cwd(), 'packages/sample-bundle/bundle');
}
