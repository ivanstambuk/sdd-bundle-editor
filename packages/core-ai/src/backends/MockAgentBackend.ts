
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

        if (message.includes('propose change')) {
            console.log('MockAgentBackend: Triggering proposal logic for message:', message);
            const change: ProposedChange = {
                entityId: 'FEAT-001',
                entityType: 'Feature',
                fieldPath: 'title',
                originalValue: 'Basic Demo Feature',
                newValue: 'Updated Demo Feature Title',
                rationale: 'User requested title update via mock agent.'
            };
            this.state.pendingChanges = [change];
            this.state.status = 'pending_changes';

            this.state.messages.push({
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: 'I have proposed a change to update the feature title.',
                timestamp: Date.now() + 1
            });
        } else {
            const agentMsg: ConversationMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: `Echo: ${message}`,
                timestamp: Date.now() + 1
            };
            this.state.messages.push(agentMsg);
        }

        return this.state;
    }

    async applyChanges(changes: ProposedChange[], updatedBundle?: any): Promise<ConversationState> {
        this.state.status = 'committed';
        this.state.pendingChanges = undefined;
        this.state.messages.push({
            id: Date.now().toString(),
            role: 'agent',
            content: 'Changes applied successfully.',
            timestamp: Date.now()
        });
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
}
