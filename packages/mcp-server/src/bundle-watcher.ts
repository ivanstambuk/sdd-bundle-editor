/**
 * Bundle file watcher using chokidar.
 * 
 * Watches bundle directories for file changes and triggers reload events.
 * Used to automatically refresh the MCP server's cached bundle data
 * when files are modified externally (e.g., via shell scripts).
 */

import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface BundleReloadEvent {
    bundleId: string;
    bundlePath: string;
    changedFile: string;
    eventType: 'add' | 'change' | 'unlink';
}

export class BundleWatcher extends EventEmitter {
    private watchers: Map<string, FSWatcher> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly debounceMs: number;

    constructor(debounceMs: number = 500) {
        super();
        this.debounceMs = debounceMs;
    }

    /**
     * Start watching a bundle directory for changes.
     * Emits 'reload' event when files change (debounced).
     */
    watchBundle(bundleId: string, bundlePath: string): void {
        if (this.watchers.has(bundleId)) {
            console.log(`[BundleWatcher] Already watching ${bundleId}`);
            return;
        }

        const watcher = chokidar.watch(bundlePath, {
            ignoreInitial: true,
            persistent: true,
            // Wait for writes to finish before firing event
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            },
            // Ignore common non-bundle files
            ignored: [
                /(^|[\/\\])\../, // dotfiles
                /node_modules/,
                /\.git/,
                /\.DS_Store/
            ]
        });

        watcher.on('all', (eventType, filePath) => {
            // Only care about yaml, json, and md files
            const ext = path.extname(filePath).toLowerCase();
            if (!['.yaml', '.yml', '.json', '.md'].includes(ext)) {
                return;
            }

            console.log(`[BundleWatcher] ${eventType}: ${path.relative(bundlePath, filePath)}`);

            // Debounce: wait for rapid changes to settle
            const existingTimer = this.debounceTimers.get(bundleId);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                this.debounceTimers.delete(bundleId);

                const event: BundleReloadEvent = {
                    bundleId,
                    bundlePath,
                    changedFile: filePath,
                    eventType: eventType as 'add' | 'change' | 'unlink'
                };

                console.log(`[BundleWatcher] Emitting reload for ${bundleId}`);
                this.emit('reload', event);
            }, this.debounceMs);

            this.debounceTimers.set(bundleId, timer);
        });

        watcher.on('error', (error) => {
            console.error(`[BundleWatcher] Error watching ${bundleId}:`, error);
        });

        this.watchers.set(bundleId, watcher);
        console.log(`[BundleWatcher] Started watching ${bundleId} at ${bundlePath}`);
    }

    /**
     * Stop watching a specific bundle.
     */
    async unwatchBundle(bundleId: string): Promise<void> {
        const watcher = this.watchers.get(bundleId);
        if (watcher) {
            await watcher.close();
            this.watchers.delete(bundleId);

            const timer = this.debounceTimers.get(bundleId);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(bundleId);
            }

            console.log(`[BundleWatcher] Stopped watching ${bundleId}`);
        }
    }

    /**
     * Stop all watchers and clean up.
     */
    async close(): Promise<void> {
        for (const [bundleId, watcher] of this.watchers) {
            await watcher.close();
            console.log(`[BundleWatcher] Closed watcher for ${bundleId}`);
        }
        this.watchers.clear();

        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
}
