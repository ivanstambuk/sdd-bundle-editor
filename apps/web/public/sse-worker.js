/**
 * SSE SharedWorker - Maintains a single SSE connection shared across all tabs.
 * 
 * This solves the browser's HTTP/1.1 connection limit (~6 per domain).
 * Instead of each tab opening its own SSE connection, all tabs share this one.
 * 
 * Protocol:
 * - Tab sends: { type: 'subscribe' } to start receiving events
 * - Worker broadcasts: { type: 'sse-event', event: string, data: object }
 * - Worker broadcasts: { type: 'sse-status', status: 'connected' | 'disconnected' | 'error' }
 */

// Track all connected ports (one per tab)
const ports = new Set();

// SSE connection state
let eventSource = null;
let reconnectTimeout = null;
const RECONNECT_DELAY = 5000;
const SSE_URL = '/api/events';

/**
 * Broadcast a message to all connected tabs
 */
function broadcast(message) {
    for (const port of ports) {
        try {
            port.postMessage(message);
        } catch (e) {
            // Port might be closed, remove it
            ports.delete(port);
        }
    }
}

/**
 * Connect to SSE endpoint
 */
function connect() {
    if (eventSource) {
        eventSource.close();
    }

    console.log('[SSE-Worker] Connecting to', SSE_URL);
    eventSource = new EventSource(SSE_URL);

    eventSource.addEventListener('connected', (e) => {
        console.log('[SSE-Worker] Connected');
        broadcast({ type: 'sse-status', status: 'connected' });
    });

    eventSource.addEventListener('bundle-reload', (e) => {
        try {
            const data = JSON.parse(e.data);
            console.log('[SSE-Worker] Bundle reload event:', data);
            broadcast({ type: 'sse-event', event: 'bundle-reload', data });
        } catch (err) {
            console.error('[SSE-Worker] Error parsing event:', err);
        }
    });

    eventSource.onerror = () => {
        console.error('[SSE-Worker] Connection error, reconnecting in', RECONNECT_DELAY, 'ms');
        eventSource.close();
        eventSource = null;
        broadcast({ type: 'sse-status', status: 'disconnected' });

        // Schedule reconnection
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }
        reconnectTimeout = setTimeout(connect, RECONNECT_DELAY);
    };
}

/**
 * Handle new tab connections
 */
self.onconnect = function (e) {
    const port = e.ports[0];
    ports.add(port);
    console.log('[SSE-Worker] New tab connected. Total tabs:', ports.size);

    port.onmessage = function (event) {
        const msg = event.data;

        if (msg.type === 'subscribe') {
            // Start SSE connection if this is the first subscriber
            if (!eventSource && ports.size === 1) {
                connect();
            } else if (eventSource && eventSource.readyState === EventSource.OPEN) {
                // Already connected, notify subscriber
                port.postMessage({ type: 'sse-status', status: 'connected' });
            }
        }
    };

    // Handle tab close
    port.onclose = function () {
        ports.delete(port);
        console.log('[SSE-Worker] Tab disconnected. Remaining tabs:', ports.size);

        // If no more tabs, close SSE connection
        if (ports.size === 0 && eventSource) {
            console.log('[SSE-Worker] No tabs remaining, closing SSE');
            eventSource.close();
            eventSource = null;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        }
    };

    port.start();
};
