import type {
    AgentBackend,
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ConversationMessage,
    ProposedChange,
    ConversationStatus,
    AgentDecision
} from '@sdd-bundle-editor/core-ai';
import { OpenQuestionsRepository } from './OpenQuestionsRepository';

export class MockAgentBackend implements AgentBackend {
    private conversation: ConversationState = {
        status: 'idle',
        messages: []
    };

    async initialize(config: AgentBackendConfig): Promise<void> {
        console.log('MockAgentBackend initialized', config);
    }

    async startConversation(context: AgentContext): Promise<ConversationState> {
        this.conversation = {
            status: 'active',
            messages: [
                {
                    id: `sys-${Date.now()}`,
                    role: 'system',
                    content: `Agent initialized for bundle: ${context.bundleDir}`,
                    timestamp: Date.now()
                },
                {
                    id: `agent-${Date.now()}`,
                    role: 'agent',
                    content: 'Hello! I am the bundle editor agent. How can I help you today?',
                    timestamp: Date.now()
                }
            ]
        };
        return this.conversation;
    }

    async sendMessage(message: string): Promise<ConversationState> {
        // Add user message
        this.conversation.messages.push({
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        // Simulate thinking delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Simple mock response logic
        let responseContent = `I received: "${message}". I am a mock agent.`;
        let pendingChanges: ProposedChange[] | undefined = undefined;
        let status: ConversationStatus = 'active';

        const mockDecision: AgentDecision = {
            id: 'dec-1',
            question: 'How should the spec treat syntactically malformed JWT inputs?',
            status: 'open',
            context: 'Clarification about malformed-token semantics.',
            options: [
                {
                    id: 'opt-a',
                    label: 'Option A (recommended)',
                    description: 'Malformed JWTs are valid inputs with a defined outcome',
                    pros: ['Clean, testable contract', 'Easiest for callers'],
                    cons: ['Interface preconditions become looser']
                },
                {
                    id: 'opt-b',
                    label: 'Option B',
                    description: 'Malformed JWTs violate the precondition',
                    pros: ['Cleaner spec purist perspective', 'Existing behavior preserved'],
                    cons: ['Undermines conformance vectors', 'Worse DX']
                }
            ]
        };

        if (message.toLowerCase().includes('error')) {
            responseContent = "I noticed you mentioned an error. I'm checking the logs...";
        } else if (message.toLowerCase().includes('change')) {
            responseContent = "I can help with changes. I propose updating the description of the bundle.";
            status = 'pending_changes';
            pendingChanges = [{
                entityType: 'Bundle',
                entityId: 'root',
                fieldPath: 'description',
                originalValue: 'Old description',
                newValue: 'Updated description by Agent',
                rationale: 'User requested a change.'
            }];
        } else if (message.toLowerCase().includes('decide')) {
            responseContent = "I found an open question regarding JWT handling. Please decide.";
            this.conversation.activeDecision = mockDecision;
            const bundlePath = process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';
            const repo = new OpenQuestionsRepository(bundlePath);
            await repo.addQuestion(mockDecision);
        }

        this.conversation.messages.push({
            id: `agent-${Date.now()}`,
            role: 'agent',
            content: responseContent,
            timestamp: Date.now()
        });

        this.conversation.status = status;
        if (pendingChanges) {
            this.conversation.pendingChanges = pendingChanges;
        }

        return this.conversation;
    }

    async applyChanges(changes: ProposedChange[]): Promise<ConversationState> {
        // Simulate applying changes
        await new Promise(resolve => setTimeout(resolve, 1000));

        this.conversation.messages.push({
            id: `agent-${Date.now()}`,
            role: 'agent',
            content: `I have applied ${changes.length} changes. Git commit created.`,
            timestamp: Date.now()
        });

        this.conversation.status = 'active';
        this.conversation.pendingChanges = undefined;

        return this.conversation;
    }

    async resolveDecision(decisionId: string, optionId: string): Promise<ConversationState> {
        // Simulate resolving
        await new Promise(resolve => setTimeout(resolve, 500));

        if (this.conversation.activeDecision?.id === decisionId) {
            const selected = this.conversation.activeDecision.options.find(o => o.id === optionId);

            // Update repository
            // NOTE: In a real app we'd get bundleDir from context but here we rely on environment variable for mock
            const bundlePath = process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';
            const repo = new OpenQuestionsRepository(bundlePath);
            await repo.resolveQuestion(decisionId, selected?.label || 'Unknown');

            this.conversation.activeDecision = undefined;
            this.conversation.messages.push({
                id: `agent-${Date.now()}`,
                role: 'agent',
                content: `Decision recorded: "${selected?.label}". I've updated OPEN_QUESTIONS.md.`,
                timestamp: Date.now()
            });
        }

        return this.conversation;
    }

    async clearPendingChanges(): Promise<ConversationState> {
        this.conversation.pendingChanges = undefined;
        if (this.conversation.status === 'pending_changes' || this.conversation.status === 'linting') {
            this.conversation.status = 'active';
        }
        return this.conversation;
    }

    async abortConversation(): Promise<ConversationState> {
        this.conversation = {
            status: 'idle',
            messages: []
        };
        return this.conversation;
    }

    async getStatus(): Promise<ConversationState> {
        return this.conversation;
    }
}
