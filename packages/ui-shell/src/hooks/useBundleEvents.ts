/**
 * useBundleEvents - React hook for subscribing to bundle reload SSE events.
 * 
 * Connects to the server's /api/events endpoint and triggers a callback
 * when bundle-reload events are received. Handles reconnection automatically.
 */

import { useEffect, useRef, useCallback } from 'react';

export interface BundleReloadEvent {
    type: 'bundle-reload';
    bundleId: string;
    timestamp: string;
}

interface UseBundleEventsOptions {
    /** Callback when a bundle is reloaded on the server */
    onBundleReload?: (event: BundleReloadEvent) => void;
    /** Whether to enable SSE connection (default: true) */
    enabled?: boolean;
    /** SSE endpoint URL (default: /api/events) */
    eventsUrl?: string;
}

/**
 * Hook that subscribes to server-sent events for bundle changes.
 * Automatically reconnects on disconnect.
 */
export function useBundleEvents(options: UseBundleEventsOptions) {
    const { onBundleReload, enabled = true, eventsUrl = '/api/events' } = options;
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Stable callback ref to avoid re-creating EventSource
    const onBundleReloadRef = useRef(onBundleReload);
    onBundleReloadRef.current = onBundleReload;

    const connect = useCallback(() => {
        if (!enabled) return;

        // Clean up any existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        try {
            console.log('[SSE] Connecting to', eventsUrl);
            const eventSource = new EventSource(eventsUrl);
            eventSourceRef.current = eventSource;

            eventSource.addEventListener('connected', (e) => {
                console.log('[SSE] Connected to bundle events');
            });

            eventSource.addEventListener('bundle-reload', (e) => {
                try {
                    const data = JSON.parse(e.data) as BundleReloadEvent;
                    console.log('[SSE] Bundle reload event:', data);
                    onBundleReloadRef.current?.(data);
                } catch (err) {
                    console.error('[SSE] Error parsing bundle-reload event:', err);
                }
            });

            eventSource.onerror = (err) => {
                console.error('[SSE] Connection error, will reconnect in 5s');
                eventSource.close();
                eventSourceRef.current = null;

                // Schedule reconnection
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                reconnectTimeoutRef.current = setTimeout(connect, 5000);
            };
        } catch (err) {
            console.error('[SSE] Failed to create EventSource:', err);
        }
    }, [enabled, eventsUrl]);

    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                console.log('[SSE] Disconnecting');
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [connect]);

    // Return a manual reconnect function if needed
    return {
        reconnect: connect,
        isConnected: () => eventSourceRef.current?.readyState === EventSource.OPEN,
    };
}
