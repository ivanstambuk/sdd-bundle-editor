
import OpenAI from 'openai';
import {
    AgentBackend,
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
    ConversationMessage
} from '../types';

export class OpenAiAgentBackend implements AgentBackend {
    private client?: OpenAI;
    private model: string = 'deepseek-chat';
    private state: ConversationState = {
        status: 'idle',
        messages: []
    };
    private context?: AgentContext;

    async initialize(config: AgentBackendConfig): Promise<void> {
        const apiKey = process.env.DEEPSEEK_API_KEY || config.options?.apiKey as string;
        const baseURL = config.options?.baseURL as string || 'https://api.deepseek.com';
        this.model = config.options?.model as string || 'deepseek-chat';

        if (!apiKey) {
            throw new Error('API Key required for OpenAI/DeepSeek provider');
        }

        this.client = new OpenAI({
            baseURL,
            apiKey,
        });
    }

    async startConversation(context: AgentContext): Promise<ConversationState> {
        this.context = context;
        this.state = {
            status: 'active',
            messages: [],
        };
        return this.state;
    }

    async sendMessage(message: string): Promise<ConversationState> {
        if (!this.client) throw new Error('Backend not initialized');

        // Add user message
        const userMsg: ConversationMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: Date.now()
        };
        this.state.messages.push(userMsg);

        // Build system prompt from context
        const systemPrompt = this.buildSystemPrompt();
        const apiMessages = [
            { role: 'system' as const, content: systemPrompt },
            ...this.state.messages.map(m => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content
            }))
        ];

        try {
            const completion = await this.client.chat.completions.create({
                messages: apiMessages,
                model: this.model,
            });

            const responseContent = completion.choices[0]?.message?.content || '';

            const agentMsg: ConversationMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: responseContent,
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
        // No-op for now
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

    private buildSystemPrompt(): string {
        return `You are an expert SDD Bundle Editor assistant.
    Current Bundle Directory: ${this.context?.bundleDir}
    
    You help the user edit the specification bundle.
    Focus on the entity they are currently viewing if any.
    `;
    }
}
