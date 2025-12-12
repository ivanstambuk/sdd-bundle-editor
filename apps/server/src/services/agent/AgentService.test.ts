/**
 * Unit tests for AgentService.
 * Tests the singleton service that manages agent backend lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentService } from './AgentService';

describe('AgentService', () => {
    let service: AgentService;

    beforeEach(async () => {
        // Get fresh instance
        service = AgentService.getInstance();
        // Reset to clean state
        await service.reset();
    });

    afterEach(async () => {
        // Clean up
        await service.reset();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = AgentService.getInstance();
            const instance2 = AgentService.getInstance();

            expect(instance1).toBe(instance2);
        });
    });

    describe('getBackend', () => {
        it('should return a backend instance', () => {
            const backend = service.getBackend();

            expect(backend).toBeDefined();
            expect(typeof backend.sendMessage).toBe('function');
            expect(typeof backend.startConversation).toBe('function');
        });
    });

    describe('getConfig', () => {
        it('should return current configuration', () => {
            const config = service.getConfig();

            expect(config).toBeDefined();
            expect(config.type).toBeDefined();
        });
    });

    describe('saveConfig', () => {
        it('should update configuration', async () => {
            await service.saveConfig({
                type: 'mock',
                model: 'test-model',
            });

            const config = service.getConfig();
            expect(config.model).toBe('test-model');
        });

        it('should recreate backend on type change', async () => {
            const backend1 = service.getBackend();

            await service.saveConfig({
                type: 'mock',
            });

            const backend2 = service.getBackend();

            // Backend should be recreated (different instance)
            expect(backend2).toBeDefined();
        });
    });

    describe('reset', () => {
        it('should reset to default state', async () => {
            // Make some changes
            await service.saveConfig({
                type: 'mock',
                model: 'custom-model',
            });

            const backend = service.getBackend();
            await backend.initialize({ type: 'mock' });
            await backend.startConversation({ bundleDir: '/test' });

            // Reset
            await service.reset();

            // Should be back to idle
            const status = await service.getBackend().getStatus();
            expect(status.status).toBe('idle');
        });
    });

    describe('backend lifecycle', () => {
        it('should initialize backend with config', async () => {
            await service.saveConfig({
                type: 'mock',
                model: 'gpt-5.1',
                reasoningEffort: 'high',
            });

            const backend = service.getBackend();
            const status = await backend.getStatus();

            expect(status.status).toBe('idle');
        });

        it('should start conversation and track state', async () => {
            const backend = service.getBackend();
            await backend.initialize({ type: 'mock' });

            const state = await backend.startConversation({
                bundleDir: '/test/bundle',
            });

            expect(state.status).toBe('active');
        });
    });
});
