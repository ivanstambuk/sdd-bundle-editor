/**
 * useBundleEvents - React hook for subscribing to bundle reload SSE events.
 * 
 * Uses a SharedWorker to share a single SSE connection across all tabs,
 * solving the browser's HTTP/1.1 connection limit (~6 per domain).
 * Falls back to direct EventSource if SharedWorker is not available.
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
    /** SSE endpoint URL (default: /api/events) - only used in fallback mode */
    eventsUrl?: string;
}

// SharedWorker instance (shared across all hook instances in the same tab)
let sharedWorker: SharedWorker | null = null;
let workerSupported: boolean | null = null;

/**
 * Check if SharedWorker is supported
 */
function isSharedWorkerSupported(): boolean {
    if (workerSupported !== null) return workerSupported;

    try {
        workerSupported = typeof SharedWorker !== 'undefined';
    } catch {
        workerSupported = false;
    }

    return workerSupported;
}

/**
 * Get or create the SharedWorker instance
 */
function getSharedWorker(): SharedWorker | null {
    if (!isSharedWorkerSupported()) return null;

    if (!sharedWorker) {
        try {
            sharedWorker = new SharedWorker('/sse-worker.js', { name: 'sse-events' });
            console.log('[SSE] Using SharedWorker for SSE connection');
        } catch (err) {
            console.warn('[SSE] Failed to create SharedWorker, falling back to EventSource:', err);
            workerSupported = false;
            return null;
        }
    }

    return sharedWorker;
}

/**
 * Hook that subscribes to server-sent events for bundle changes.
 * Uses SharedWorker to share connection across tabs.
 * Falls back to direct EventSource if SharedWorker unavailable.
 */
export function useBundleEvents(options: UseBundleEventsOptions) {
    const { onBundleReload, enabled = true, eventsUrl = '/api/events' } = options;
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Stable callback ref to avoid re-creating connections
    const onBundleReloadRef = useRef(onBundleReload);
    onBundleReloadRef.current = onBundleReload;

    // SharedWorker message handler
    const handleWorkerMessage = useCallback((event: MessageEvent) => {
        const msg = event.data;

        if (msg.type === 'sse-event' && msg.event === 'bundle-reload') {
            console.log('[SSE] Bundle reload event via SharedWorker:', msg.data);
            onBundleReloadRef.current?.(msg.data as BundleReloadEvent);
        } else if (msg.type === 'sse-status') {
            console.log('[SSE] Status:', msg.status);
        }
    }, []);

    // Fallback: Direct EventSource connection
    const connectDirect = useCallback(() => {
        if (!enabled) return;

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        try {
            console.log('[SSE] Connecting directly to', eventsUrl);
            const eventSource = new EventSource(eventsUrl);
            eventSourceRef.current = eventSource;

            eventSource.addEventListener('connected', () => {
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

            eventSource.onerror = () => {
                console.error('[SSE] Connection error, will reconnect in 5s');
                eventSource.close();
                eventSourceRef.current = null;

                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                reconnectTimeoutRef.current = setTimeout(connectDirect, 5000);
            };
        } catch (err) {
            console.error('[SSE] Failed to create EventSource:', err);
        }
    }, [enabled, eventsUrl]);

    useEffect(() => {
        if (!enabled) return;

        const worker = getSharedWorker();

        if (worker) {
            // Use SharedWorker
            worker.port.addEventListener('message', handleWorkerMessage);
            worker.port.start();
            worker.port.postMessage({ type: 'subscribe' });

            return () => {
                worker.port.removeEventListener('message', handleWorkerMessage);
                // Don't close the port - other components may still be using it
            };
        } else {
            // Fallback to direct EventSource
            connectDirect();

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
        }
    }, [enabled, handleWorkerMessage, connectDirect]);

    return {
        reconnect: connectDirect,
        isConnected: () => eventSourceRef.current?.readyState === EventSource.OPEN,
    };
}
