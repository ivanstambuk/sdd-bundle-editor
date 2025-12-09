
import { spawn } from 'child_process';
import {
    AgentBackend,
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
    AgentDecision,
    ConversationMessage
} from '../types';

export class CliAgentBackend implements AgentBackend {
    private config?: AgentBackendConfig;
    private context?: AgentContext;
    private state: ConversationState = {
        status: 'idle',
        messages: []
    };

    async initialize(config: AgentBackendConfig): Promise<void> {
        this.config = config;
    }

    async startConversation(context: AgentContext): Promise<ConversationState> {
        this.context = context;
        this.state = {
            status: 'active',
            messages: [],
        };
        // Optionally invoke CLI with initial context if supported
        return this.state;
    }

    async sendMessage(message: string): Promise<ConversationState> {
        if (!this.config?.options?.command) {
            throw new Error('CLI command not configured');
        }

        const command = this.config.options.command as string;
        let args = [...((this.config.options.args as string[]) || [])];

        // For Codex CLI, adjust sandbox mode and add model/reasoning flags
        if (command === 'codex') {
            // Remove any existing flags we want to manage explicitly
            args = args.filter(arg =>
                !arg.startsWith('--sandbox') &&
                !arg.startsWith('-m') &&
                !arg.startsWith('--model') &&
                !arg.startsWith('--reasoning-effort') &&
                !arg.startsWith('--reasoning-summary') &&
                arg !== '--full-auto' &&
                arg !== 'read-only' &&
                arg !== 'workspace-write' &&
                arg !== 'danger-full-access'
            );

            // Add appropriate sandbox mode based on readOnly flag
            if (this.context?.readOnly) {
                // Read-only mode: can read files, run commands, but NO file modifications
                args.push('--sandbox', 'read-only');
            } else {
                // Write mode: can modify files in the workspace
                args.push('--sandbox', 'workspace-write');
            }

            // Add model flag if specified
            if (this.config.model) {
                args.push('-m', this.config.model);
            }

            // Add reasoning effort using the generic -c flag
            if (this.config.reasoningEffort) {
                args.push('-c', `model_reasoning_effort="${this.config.reasoningEffort}"`);
            }

            // Add reasoning summary using the generic -c flag
            if (this.config.reasoningSummary) {
                args.push('-c', `model_reasoning_summary="${this.config.reasoningSummary}"`);
            }
        }

        // Add user message to history
        const userMsg: ConversationMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: Date.now()
        };
        this.state.messages.push(userMsg);

        try {
            const output = await this.runCommand(command, [...args, message]);

            const agentMsg: ConversationMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: output,
                timestamp: Date.now()
            };
            this.state.messages.push(agentMsg);
        } catch (err) {
            this.state.lastError = (err as Error).message;
            this.state.status = 'error';
        }

        return this.state;
    }

    async applyChanges(changes: ProposedChange[]): Promise<ConversationState> {
        // CLI backend doesn't handle application logic itself yet
        return this.state;
    }

    async resolveDecision(decisionId: string, optionId: string): Promise<ConversationState> {
        return this.state;
    }

    async clearPendingChanges(): Promise<ConversationState> {
        this.state.pendingChanges = undefined;
        if (this.state.status === 'pending_changes' || this.state.status === 'linting') {
            this.state.status = 'active';
        }
        return this.state;
    }

    async abortConversation(): Promise<ConversationState> {
        this.state.status = 'idle';
        return this.state;
    }

    async getStatus(): Promise<ConversationState> {
        return this.state;
    }

    private runCommand(command: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            // Run CLI in the bundle directory so MCP tools index the correct files
            const cwd = this.context?.bundleDir || process.cwd();
            // Wrap command in 'script' to fake a TTY if capturing output
            // Usage: script -q -c "command args..." /dev/null
            // This is a workaround for "stdin is not a terminal" on some systems
            // We need to carefully construct the command string for script
            const wrappedArgs = ['-q', '-c', `${command} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`, '/dev/null'];

            const proc = spawn('script', wrappedArgs, { cwd });
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
                    // Check if it's the known "stdin is not a terminal" error pattern in stderr or stdout
                    // But since we are using script, it should succeed.
                    // If script fails, we report it.
                    reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
                } else {
                    // Clean up script output artifacts (e.g. \r\n) might be needed, but for now trim implies it.
                    // script might capture stderr in stdout depending on shell, but usually distinct.
                    // NOTE: script output often contains \r\n line endings.
                    resolve(stdout.trim());
                }
            });

            proc.on('error', (err: any) => {
                if (err.code === 'ENOENT') {
                    // Check if 'script' is missing, or the command itself
                    // Since we spawn 'script', ENOENT here means 'script' is missing.
                    reject(new Error(`Command 'script' not found. Please ensure 'util-linux' or equivalent is installed.`));
                } else {
                    reject(err);
                }
            });
        });
    }
}
