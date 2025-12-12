/**
 * CLI Agent Backend for CLI-based agents like Codex.
 * Spawns external CLI processes to handle conversations.
 */

import { spawn } from 'child_process';
import { BaseAgentBackend } from './BaseAgentBackend';
import {
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
} from '../types';
import { AgentError, SddErrorCode } from '@sdd-bundle-editor/shared-types';

export class CliAgentBackend extends BaseAgentBackend {
    async initialize(config: AgentBackendConfig): Promise<void> {
        await super.initialize(config);
    }

    async startConversation(context: AgentContext): Promise<ConversationState> {
        this.context = context;
        this.state = {
            status: 'active',
            messages: [],
        };
        return this.getStatus();
    }

    async sendMessage(message: string): Promise<ConversationState> {
        if (!this.config?.options?.command) {
            throw new AgentError(
                'CLI command not configured',
                SddErrorCode.AGENT_CONFIG_INVALID,
                { requiredConfig: 'options.command' }
            );
        }

        const command = this.config.options.command as string;
        let args = [...((this.config.options.args as string[]) || [])];

        // For Codex CLI, use 'exec' subcommand for non-interactive execution
        if (command === 'codex') {
            args = this.prepareCodexArgs(args);
        }

        // Add user message to history
        this.addMessage('user', message);

        try {
            const output = await this.runCommand(command, [...args, message]);
            this.addMessage('agent', output);
        } catch (err) {
            this.setError((err as Error).message);
        }

        return this.getStatus();
    }

    async applyChanges(changes: ProposedChange[]): Promise<ConversationState> {
        // CLI backend doesn't handle application logic itself yet
        return this.getStatus();
    }

    async resolveDecision(decisionId: string, optionId: string): Promise<ConversationState> {
        return this.getStatus();
    }

    // =========================================================================
    // Private helper methods
    // =========================================================================

    /**
     * Prepare Codex CLI-specific arguments.
     */
    private prepareCodexArgs(args: string[]): string[] {
        // Remove any existing flags we want to manage explicitly
        const filteredArgs = args.filter(arg =>
            !arg.startsWith('--sandbox') &&
            !arg.startsWith('-m') &&
            !arg.startsWith('--model') &&
            !arg.startsWith('--reasoning-effort') &&
            !arg.startsWith('--reasoning-summary') &&
            arg !== '--full-auto' &&
            arg !== 'read-only' &&
            arg !== 'workspace-write' &&
            arg !== 'danger-full-access' &&
            arg !== 'exec'
        );

        // Prepend 'exec' subcommand for non-interactive execution
        filteredArgs.unshift('exec');

        // Add appropriate sandbox mode based on readOnly flag
        if (this.isReadOnly()) {
            filteredArgs.push('--sandbox', 'read-only');
        } else {
            filteredArgs.push('--sandbox', 'workspace-write');
        }

        // Add model flag if specified
        if (this.config?.model) {
            filteredArgs.push('-m', this.config.model);
        }

        // Add reasoning effort using the generic -c flag
        if (this.config?.reasoningEffort) {
            filteredArgs.push('-c', `model_reasoning_effort="${this.config.reasoningEffort}"`);
        }

        // Add reasoning summary using the generic -c flag
        if (this.config?.reasoningSummary) {
            filteredArgs.push('-c', `model_reasoning_summary="${this.config.reasoningSummary}"`);
        }

        return filteredArgs;
    }

    /**
     * Execute CLI command and return output.
     */
    private runCommand(command: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const cwd = this.getBundleDir();
            const proc = spawn(command, args, { cwd });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new AgentError(
                        `CLI command failed with code ${code}`,
                        SddErrorCode.AGENT_COMMUNICATION_FAILED,
                        { command, args, code, stderr: stderr || stdout }
                    ));
                } else {
                    resolve(stdout.trim());
                }
            });

            proc.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'ENOENT') {
                    reject(new AgentError(
                        `Command '${command}' not found. Please ensure it is installed and in your PATH.`,
                        SddErrorCode.AGENT_CONFIG_INVALID,
                        { command, errorCode: 'ENOENT' }
                    ));
                } else {
                    reject(new AgentError(
                        `CLI error: ${err.message}`,
                        SddErrorCode.AGENT_COMMUNICATION_FAILED,
                        { command, originalError: err.message }
                    ));
                }
            });
        });
    }
}
