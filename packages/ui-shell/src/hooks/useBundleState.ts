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
import { mcpBundleApi, type BundleResponse } from '../api';
import { createLogger } from '../utils/logger';

const log = createLogger('useBundleState');

export interface UseBundleStateReturn {
    // State
    bundle: UiBundleSnapshot | null;
    diagnostics: UiDiagnostic[];
    selectedEntity: UiEntity | null;
    loading: boolean;
    error: string | null;

    // Actions
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
export function useBundleState(bundleDir: string): UseBundleStateReturn {
    const [bundle, setBundle] = useState<UiBundleSnapshot | null>(null);
    const [diagnostics, setDiagnostics] = useState<UiDiagnostic[]>([]);
    const [selectedEntity, setSelectedEntity] = useState<UiEntity | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load bundle from MCP server
    const loadBundle = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            log.info('Loading bundle via MCP API', { bundleDir });
            const data = await mcpBundleApi.load(bundleDir);
            setBundle(data.bundle);
            setDiagnostics(data.diagnostics);
            log.info('Bundle loaded successfully', {
                entityTypes: Object.keys(data.bundle.entities),
                diagnosticsCount: data.diagnostics.length,
            });
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Failed to load bundle', { error: errorMessage });
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [bundleDir]);

    // Reload bundle with cache-busting (after modifications)
    const reloadBundle = useCallback(async () => {
        setLoading(true);

        try {
            log.info('Reloading bundle via MCP API');
            const data = await mcpBundleApi.loadFresh(bundleDir);
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
    }, [bundleDir]);

    // Run validation
    const runValidation = useCallback(async () => {
        if (!bundle) return;
        setLoading(true);
        setError(null);

        try {
            log.info('Running validation via MCP API');
            const data = await mcpBundleApi.validate(bundleDir);
            setDiagnostics(data.diagnostics);
            log.info('Validation complete', { diagnosticsCount: data.diagnostics.length });
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Validation failed', { error: errorMessage });
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [bundle, bundleDir]);

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

        // Actions
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

