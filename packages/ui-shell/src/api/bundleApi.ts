/**
 * Bundle API client for bundle-related operations.
 * Provides typed methods for loading, validating, and saving bundles.
 */

import type { UiBundleSnapshot, UiDiagnostic } from '../types';
import { fetchJson } from './fetchUtils';

export interface BundleResponse {
    bundle: UiBundleSnapshot;
    diagnostics: UiDiagnostic[];
}

export interface ValidateResponse {
    diagnostics: UiDiagnostic[];
}

export interface SaveResponse {
    saved: boolean;
    diagnostics: UiDiagnostic[];
    bundle?: UiBundleSnapshot;
}

/**
 * Bundle API client with typed methods.
 */
export const bundleApi = {
    /**
     * Load a bundle from the specified directory.
     */
    async load(bundleDir: string): Promise<BundleResponse> {
        return fetchJson<BundleResponse>(
            `/bundle?bundleDir=${encodeURIComponent(bundleDir)}`
        );
    },

    /**
     * Load a bundle with cache-busting (for after modifications).
     */
    async loadFresh(bundleDir: string): Promise<BundleResponse> {
        return fetchJson<BundleResponse>(
            `/bundle?bundleDir=${encodeURIComponent(bundleDir)}&_t=${Date.now()}`
        );
    },

    /**
     * Validate a bundle and return diagnostics.
     */
    async validate(bundleDir: string): Promise<ValidateResponse> {
        return fetchJson<ValidateResponse>('/bundle/validate', {
            method: 'POST',
            body: JSON.stringify({ bundleDir }),
        });
    },

    /**
     * Save bundle changes.
     */
    async save(bundleDir: string, changes?: unknown): Promise<SaveResponse> {
        return fetchJson<SaveResponse>('/bundle/save', {
            method: 'POST',
            body: JSON.stringify({ bundleDir, changes }),
        });
    },
};
