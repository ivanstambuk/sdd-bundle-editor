/**
 * Unit tests for test utilities.
 */

import { describe, it, expect } from 'vitest';
import {
    createTestBackend,
    createTestContext,
    createTestChanges,
    createSlowBackend,
} from './test-utils';

describe('test-utils', () => {
    describe('createTestBackend', () => {
        it('should create a mock backend', () => {
            const backend = createTestBackend();
            expect(backend).toBeDefined();
        });

        it('should accept custom options', () => {
            const backend = createTestBackend({ responseDelay: 100 });
            expect(backend).toBeDefined();
        });
    });

    describe('createTestContext', () => {
        it('should create default context', () => {
            const context = createTestContext();
            expect(context.bundleDir).toBe('/test/bundle');
            expect(context.readOnly).toBe(false);
        });

        it('should allow overrides', () => {
            const context = createTestContext({
                bundleDir: '/custom/path',
                readOnly: true,
            });
            expect(context.bundleDir).toBe('/custom/path');
            expect(context.readOnly).toBe(true);
        });
    });

    describe('createTestChanges', () => {
        it('should create specified number of changes', () => {
            const changes = createTestChanges(3);
            expect(changes).toHaveLength(3);
        });

        it('should create unique entity IDs', () => {
            const changes = createTestChanges(5);
            const ids = changes.map(c => c.entityId);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(5);
        });

        it('should default to 1 change', () => {
            const changes = createTestChanges();
            expect(changes).toHaveLength(1);
        });
    });

    describe('createSlowBackend', () => {
        it('should create backend with custom delay', () => {
            const backend = createSlowBackend(500);
            expect(backend).toBeDefined();
        });
    });
});
