/**
 * Custom hook for managing bundle state.
 * Encapsulates bundle loading, validation, and selection logic.
 * 
 * MCP-First Architecture (Phase 4.4):
 * This hook now uses MCP protocol directly via mcpBundleApi.
 * Falls back to legacy HTTP API if MCP is unavailable.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { UiBundleSnapshot, UiDiagnostic, UiEntity } from '../types';
import { mcpBundleApi, bundleApi, type BundleResponse } from '../api';
import { createLogger } from '../utils/logger';

const log = createLogger('useBundleState');

/**
 * Detect if we should use MCP or legacy API.
 * 
 * MCP mode is used when:
 * - mcpUrl param is present in URL
 * - useMcp=true param is present in URL
 * 
 * Otherwise, defaults to legacy HTTP API for compatibility.
 * The fallback from MCP to legacy happens automatically if MCP fails.
 */
function shouldUseMcpApi(): boolean {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        // Use MCP only if explicitly requested via URL param
        if (params.get('mcpUrl') || params.get('useMcp') === 'true') {
            return true;
        }
        // Explicitly disable MCP if useMcp=false
        if (params.get('useMcp') === 'false') {
            return false;
        }
    }
    // Default to legacy HTTP mode for compatibility
    // (MCP server may not always be running alongside the legacy server)
    return false;
}

/**
 * Get the appropriate API based on mode
 */
function getApi(useMcp: boolean) {
    return useMcp ? mcpBundleApi : bundleApi;
}

export interface UseBundleStateReturn {
    // State
    bundle: UiBundleSnapshot | null;
    diagnostics: UiDiagnostic[];
    selectedEntity: UiEntity | null;
    loading: boolean;
    error: string | null;
    /** True if using MCP mode, false for legacy HTTP */
    isMcpMode: boolean;

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

    // Track if we're using MCP mode
    const useMcp = useRef(shouldUseMcpApi());
    const [isMcpMode, setIsMcpMode] = useState(useMcp.current);

    // Load bundle from server (MCP or legacy)
    const loadBundle = useCallback(async () => {
        setLoading(true);
        setError(null);

        const api = getApi(useMcp.current);

        try {
            log.info(`Loading bundle via ${useMcp.current ? 'MCP' : 'legacy'} API`, { bundleDir });
            const data = await api.load(bundleDir);
            setBundle(data.bundle);
            setDiagnostics(data.diagnostics);
            setIsMcpMode(useMcp.current);
            log.info('Bundle loaded successfully', {
                entityTypes: Object.keys(data.bundle.entities),
                diagnosticsCount: data.diagnostics.length,
            });
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Failed to load bundle', { error: errorMessage });

            // If MCP fails, try falling back to legacy API
            if (useMcp.current) {
                log.info('MCP load failed, falling back to legacy API');
                useMcp.current = false;
                setIsMcpMode(false);

                try {
                    const data = await bundleApi.load(bundleDir);
                    setBundle(data.bundle);
                    setDiagnostics(data.diagnostics);
                    log.info('Fallback to legacy API succeeded');
                } catch (fallbackErr) {
                    setError(`MCP: ${errorMessage}. Legacy: ${(fallbackErr as Error).message}`);
                }
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    }, [bundleDir]);

    // Reload bundle with cache-busting (after modifications)
    const reloadBundle = useCallback(async () => {
        setLoading(true);

        const api = getApi(useMcp.current);

        try {
            log.info(`Reloading bundle via ${useMcp.current ? 'MCP' : 'legacy'} API`);
            const data = await api.loadFresh(bundleDir);
            log.info('Bundle reloaded', { entityTypes: Object.keys(data.bundle.entities) });
            setBundle(data.bundle);
            setDiagnostics(data.diagnostics);
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Failed to reload bundle', { error: errorMessage });

            // If MCP fails, try falling back to legacy API
            if (useMcp.current) {
                log.info('MCP reload failed, falling back to legacy API');
                useMcp.current = false;
                setIsMcpMode(false);

                try {
                    const data = await bundleApi.loadFresh(bundleDir);
                    setBundle(data.bundle);
                    setDiagnostics(data.diagnostics);
                } catch (fallbackErr) {
                    setError(`MCP: ${errorMessage}. Legacy: ${(fallbackErr as Error).message}`);
                }
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    }, [bundleDir]);

    // Run validation
    const runValidation = useCallback(async () => {
        if (!bundle) return;
        setLoading(true);
        setError(null);

        const api = getApi(useMcp.current);

        try {
            log.info(`Running validation via ${useMcp.current ? 'MCP' : 'legacy'} API`);
            const data = await api.validate(bundleDir);
            setDiagnostics(data.diagnostics);
            log.info('Validation complete', { diagnosticsCount: data.diagnostics.length });
        } catch (err) {
            const errorMessage = (err as Error).message;
            log.error('Validation failed', { error: errorMessage });

            // If MCP fails, try falling back to legacy API
            if (useMcp.current) {
                try {
                    const data = await bundleApi.validate(bundleDir);
                    setDiagnostics(data.diagnostics);
                } catch (fallbackErr) {
                    setError(`Validation failed: ${errorMessage}`);
                }
            } else {
                setError(errorMessage);
            }
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
        isMcpMode,

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

