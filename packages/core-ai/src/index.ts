/**
 * Core AI package - Agent Backend implementations
 * 
 * This package provides the AgentBackend abstraction for conversational AI agents.
 */

export * from './types';
export * from './backends/BaseAgentBackend';
export * from './backends/CliAgentBackend';
export * from './backends/OpenAiAgentBackend';
export * from './backends/MockAgentBackend';
export * from './test-utils';

import { CliAgentBackend } from './backends/CliAgentBackend';
import { OpenAiAgentBackend } from './backends/OpenAiAgentBackend';
import { MockAgentBackend } from './backends/MockAgentBackend';
import { AgentBackend, AgentBackendConfig } from './types';

/**
 * Factory function to create an agent backend based on configuration type.
 */
export function createAgentBackend(config: AgentBackendConfig): AgentBackend {
  switch (config.type) {
    case 'cli':
      return new CliAgentBackend();
    case 'http':
      return new OpenAiAgentBackend();
    case 'mock':
      return new MockAgentBackend();
    default:
      throw new Error(`Unknown agent backend type: ${config.type}`);
  }
}
