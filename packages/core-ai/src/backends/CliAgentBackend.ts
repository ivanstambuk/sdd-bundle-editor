
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
    private state: ConversationState = {
        status: 'idle',
        messages: []
    };

    async initialize(config: AgentBackendConfig): Promise<void> {
        this.config = config;
    }

    async startConversation(context: AgentContext): Promise<ConversationState> {
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
        const args = (this.config.options.args as string[]) || [];

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

    async abortConversation(): Promise<ConversationState> {
        this.state.status = 'idle';
        return this.state;
    }

    async getStatus(): Promise<ConversationState> {
        return this.state;
    }

    private runCommand(command: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args);
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
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                } else {
                    resolve(stdout.trim());
                }
            });

            proc.on('error', (err) => reject(err));
        });
    }
}
