/**
 * Custom hook for managing bundle state.
 * Encapsulates bundle loading, validation, and selection logic.
 */

import { useState, useCallback, useEffect } from 'react';
import type { UiBundleSnapshot, UiDiagnostic, UiEntity } from '../types';
import { bundleApi, type BundleResponse } from '../api';
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

    // Load bundle from server
    const loadBundle = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await bundleApi.load(bundleDir);
            setBundle(data.bundle);
            setDiagnostics(data.diagnostics);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [bundleDir]);

    // Reload bundle with cache-busting (after modifications)
    const reloadBundle = useCallback(async () => {
        setLoading(true);
        try {
            const data = await bundleApi.loadFresh(bundleDir);
            log.info('Bundle reloaded', { entityTypes: Object.keys(data.bundle.entities) });
            setBundle(data.bundle);
            setDiagnostics(data.diagnostics);
        } catch (err) {
            setError((err as Error).message);
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
            const data = await bundleApi.validate(bundleDir);
            setDiagnostics(data.diagnostics);
        } catch (err) {
            setError((err as Error).message);
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
