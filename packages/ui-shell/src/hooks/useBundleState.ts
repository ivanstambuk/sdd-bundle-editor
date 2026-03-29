/**
 * Custom hook for managing bundle state.
 * Encapsulates bundle loading, validation, and selection logic.
 * 
 * MCP-First Architecture:
 * This hook uses MCP protocol directly via mcpBundleApi.
 * Legacy HTTP API has been removed.
 */

import { useState, useCallback, useEffect } from 'react';
import type { UiBundleSnapshot, UiDiagnostic, UiEntity } from '../types';
import { mcpBundleApi, type BundleResponse, type McpBundle } from '../api';
import { createLogger } from '../utils/logger';

const log = createLogger('useBundleState');

export interface UseBundleStateReturn {
    // State
    bundle: UiBundleSnapshot | null;
    diagnostics: UiDiagnostic[];
    selectedEntity: UiEntity | null;
    loading: boolean;
    error: string | null;
    availableBundles: McpBundle[]; // New array
    activeBundleDir: string;       // Current dir

    // Actions
    switchBundle: (newDir: string) => void;
    loadBundle: () => Promise<void>;
    reloadBundle: () => Promise<void>;
    setBundle: (bundle: UiBundleSnapshot) => void;
    setDiagnostics: (diagnostics: UiDiagnostic[]) => void;
    selectEntity: (entity: UiEntity | null) => void;
    navigateToEntity: (entityType: string, entityId: string) => void;
    runValidation: () => Promise<void>;
    clearError: () => void;
}

/**
 * Hook for managing bundle state.
 * 
 * @param bundleDir Path to the bundle directory
 * @returns Bundle state and actions
 */
export function useBundleState(initialBundleDir: string): UseBundleStateReturn {
    const [activeBundleDir, setActiveBundleDir] = useState(initialBundleDir);
    const [availableBundles, setAvailableBundles] = useState<McpBundle[]>([]);
    const [bundle, setBundle] = useState<UiBundleSnapshot | null>(null);
    const [diagnostics, setDiagnostics] = useState<UiDiagnostic[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<UiEntity | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial fetch of available bundles
    useEffect(() => {
        let mounted = true;
        mcpBundleApi.listBundles().then(bundles => {
            if (!mounted) return;
            setAvailableBundles(bundles);
            
            // If no initial bundle dir is set and we found bundles, default to the first one
            if (!activeBundleDir && bundles.length > 0) {
                const defaultDir = bundles[0].path;
                setActiveBundleDir(defaultDir);
                // Optionally update URL
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('bundleDir', defaultDir);
                    window.history.replaceState({}, '', url.toString());
                }
            }
        }).catch(err => {
            log.error('Failed to list bundles', { error: String(err) });
        });
        return () => { mounted = false; };
    }, [activeBundleDir]);

    const switchBundle = useCallback((newDir: string) => {
        setActiveBundleDir(newDir);
        setBundle(null);
        setDiagnostics([]);
        setSelectedEntity(null);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('bundleDir', newDir);
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Load bundle from MCP server
    const loadBundle = useCallback(async () => {
        if (!activeBundleDir) return;
        setLoading(true);

        try {
            log.info('Loading bundle via MCP API', { activeBundleDir });
            const data = await mcpBundleApi.loadFresh(activeBundleDir);
            setBundle(data.bundle);
            setDiagnostics(data.diagnostics);
            log.info('Bundle loaded successfully', {
                entityTypes: Object.keys(data.bundle.entities),
                diagnosticsCount: data.diagnostics.length,
            });

            // Auto-validate after load
            log.info('Running auto-validation after bundle load');
            try {
                const validationData = await mcpBundleApi.validate(activeBundleDir);
                setDiagnostics(validationData.diagnostics);
                log.info('Auto-validation complete', { diagnosticsCount: validationData.diagnostics.length });
            } catch (validationErr) {
                log.warn('Auto-validation failed, using initial diagnostics', { error: (validationErr as Error).message });
            }
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Failed to load bundle', { error: errorMessage });
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [activeBundleDir]);

    // Automatically load when activeBundleDir changes
    useEffect(() => {
        if (activeBundleDir) {
            loadBundle();
        }
    }, [activeBundleDir, loadBundle]);

    // Reload bundle with cache-busting (after modifications)
    const reloadBundle = useCallback(async () => {
        if (!activeBundleDir) return;
        setLoading(true);

        try {
            log.info('Reloading bundle via MCP API');
            const data = await mcpBundleApi.loadFresh(activeBundleDir);
            log.info('Bundle reloaded', { entityTypes: Object.keys(data.bundle.entities) });
            setBundle(data.bundle);
            setDiagnostics(data.diagnostics);
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Failed to reload bundle', { error: errorMessage });
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [activeBundleDir]);

    // Run validation
    const runValidation = useCallback(async () => {
        if (!bundle || !activeBundleDir) return;
        setLoading(true);
        setError(null);

        try {
            log.info('Running validation via MCP API');
            const data = await mcpBundleApi.validate(activeBundleDir);
            setDiagnostics(data.diagnostics);
            log.info('Validation complete', { diagnosticsCount: data.diagnostics.length });
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Validation failed', { error: errorMessage });
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [bundle, activeBundleDir]);

    // Navigate to entity by type and ID
    const navigateToEntity = useCallback((entityType: string, entityId: string) => {
        if (!bundle) return;
        const entities = bundle.entities[entityType] ?? [];
        const targetEntity = entities.find((e) => e.id === entityId);
        if (targetEntity) {
            setSelectedEntity(targetEntity);
        }
    }, [bundle]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Refresh selected entity when bundle data updates
    useEffect(() => {
        if (bundle && selectedEntity) {
            const entities = bundle.entities[selectedEntity.entityType] ?? [];
            const freshEntity = entities.find(e => e.id === selectedEntity.id);

            if (freshEntity) {
                // Only update if data actually changed to avoid unnecessary renders
                if (JSON.stringify(freshEntity.data) !== JSON.stringify(selectedEntity.data)) {
                    log.info('Entity data changed, updating selection.');
                    setSelectedEntity(freshEntity);
                }
            }
        }
    }, [bundle, selectedEntity]);

    return {
        // State
        bundle,
        diagnostics,
        selectedEntity,
        loading,
        error,
        availableBundles,
        activeBundleDir,

        // Actions
        switchBundle,
        loadBundle,
        reloadBundle,
        setBundle,
        setDiagnostics,
        selectEntity: setSelectedEntity,
        navigateToEntity,
        runValidation,
        clearError,
    };
}
