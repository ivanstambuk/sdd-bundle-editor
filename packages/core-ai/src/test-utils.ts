/**
 * Test utilities for agent backends.
 * Provides factories and helpers for unit and E2E testing.
 */

import { MockAgentBackend, MockAgentOptions } from './backends/MockAgentBackend';
import { AgentContext, ProposedChange } from './types';

/**
 * Create a mock backend for testing with common scenarios.
 */
export function createTestBackend(options?: MockAgentOptions): MockAgentBackend {
    return new MockAgentBackend(options);
}

/**
 * Create a mock context for testing.
 */
export function createTestContext(overrides?: Partial<AgentContext>): AgentContext {
    return {
        bundleDir: '/test/bundle',
        bundle: undefined,
        diagnostics: [],
        focusedEntity: { type: 'Requirement', id: 'REQ-001' },
        readOnly: false,
        ...overrides,
    };
}

/**
 * Create mock proposed changes for testing.
 */
export function createTestChanges(count: number = 1): ProposedChange[] {
    return Array.from({ length: count }, (_, i) => ({
        entityType: 'Requirement',
        entityId: `REQ-${String(i + 1).padStart(3, '0')}`,
        fieldPath: 'title',
        originalValue: `Original ${i + 1}`,
        newValue: `Updated ${i + 1}`,
        rationale: `Test change ${i + 1}`,
    }));
}

/**
 * Create a mock backend that always proposes changes on any message.
 */
export function createAlwaysChangeBackend(): MockAgentBackend {
    return new MockAgentBackend({
        changeKeywords: [], // Empty means no keyword matching
        changeGenerator: () => createTestChanges(1),
        responseGenerator: (message) => {
            // Always trigger changes by overriding the logic
            return `Processing: ${message}`;
        },
    });
}

/**
 * Create a mock backend with custom response delay for testing loading states.
 */
export function createSlowBackend(delayMs: number = 2000): MockAgentBackend {
    return new MockAgentBackend({
        responseDelay: delayMs,
    });
}

/**
 * Create a mock backend that simulates errors.
 */
export function createErrorBackend(errorMessage: string = 'Simulated error'): MockAgentBackend {
    const backend = new MockAgentBackend({
        responseGenerator: () => {
            throw new Error(errorMessage);
        },
    });
    return backend;
}
