
import {
    AgentBackend,
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
    ConversationMessage
} from '../types';

export class MockAgentBackend implements AgentBackend {
    private state: ConversationState = {
        status: 'idle',
        messages: []
    };

    async initialize(config: AgentBackendConfig): Promise<void> {
        // no-op
    }

    async startConversation(context: AgentContext): Promise<ConversationState> {
        this.state = {
            status: 'active',
            messages: [],
        };

        const welcome: ConversationMessage = {
            id: Date.now().toString(),
            role: 'agent',
            content: 'Hello! I am a mock agent. How can I help you?',
            timestamp: Date.now()
        };
        this.state.messages.push(welcome);

        return this.state;
    }

    async sendMessage(message: string): Promise<ConversationState> {
        const userMsg: ConversationMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: Date.now()
        };
        this.state.messages.push(userMsg);

        const agentMsg: ConversationMessage = {
            id: (Date.now() + 1).toString(),
            role: 'agent',
            content: `Echo: ${message}`,
            timestamp: Date.now() + 1
        };
        this.state.messages.push(agentMsg);

        return this.state;
    }

    async applyChanges(changes: ProposedChange[]): Promise<ConversationState> {
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
}
