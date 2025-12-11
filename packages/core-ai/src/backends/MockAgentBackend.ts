/**
 * Mock Agent Backend for testing and demonstration.
 * Provides configurable behavior for E2E tests and development.
 */

import { BaseAgentBackend } from './BaseAgentBackend';
import {
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
    AgentDecision,
} from '../types';

/**
 * Configuration options for the mock backend.
 */
export interface MockAgentOptions {
    /** Delay before responding (ms). Default: 100 */
    responseDelay?: number;
    /** Keywords that trigger change proposals. Default: ['change', 'update', 'modify', 'create', 'propose change'] */
    changeKeywords?: string[];
    /** Keywords that trigger decision prompts. Default: ['decide', 'decision', 'choose'] */
    decisionKeywords?: string[];
    /** Custom response generator */
    responseGenerator?: (message: string, context: AgentContext | null) => string;
    /** Custom change generator */
    changeGenerator?: (message: string, context: AgentContext | null) => ProposedChange[];
    /** Custom decision generator */
    decisionGenerator?: (message: string, context: AgentContext | null) => AgentDecision | undefined;
}

/**
 * Default mock decision for testing decision flows.
 */
const DEFAULT_MOCK_DECISION: AgentDecision = {
    id: 'dec-mock-1',
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

export class MockAgentBackend extends BaseAgentBackend {
    private options: Required<MockAgentOptions>;

    constructor(options: MockAgentOptions = {}) {
        super();
        this.options = {
            responseDelay: options.responseDelay ?? 100,
            changeKeywords: options.changeKeywords ?? ['change', 'update', 'modify', 'create', 'propose change'],
            decisionKeywords: options.decisionKeywords ?? ['decide', 'decision', 'choose'],
            responseGenerator: options.responseGenerator ?? this.defaultResponseGenerator.bind(this),
            changeGenerator: options.changeGenerator ?? this.defaultChangeGenerator.bind(this),
            decisionGenerator: options.decisionGenerator ?? this.defaultDecisionGenerator.bind(this),
        };
    }

    async initialize(config: AgentBackendConfig): Promise<void> {
        await super.initialize(config);
        console.log('MockAgentBackend initialized', config);
    }

    async startConversation(context: AgentContext): Promise<ConversationState> {
        this.context = context;
        this.state = {
            status: 'active',
            messages: []
        };

        this.addMessage('system', `Agent initialized for bundle: ${context.bundleDir}`);
        this.addMessage('agent', 'Hello! I am the bundle editor agent. How can I help you today?');

        return this.getStatus();
    }

    async sendMessage(message: string): Promise<ConversationState> {
        // Add user message
        this.addMessage('user', message);

        // Simulate thinking delay
        if (this.options.responseDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.options.responseDelay));
        }

        // Check for decision keywords first
        if (this.shouldTriggerDecision(message)) {
            const decision = this.options.decisionGenerator(message, this.context);
            if (decision) {
                this.state.activeDecision = decision;
                this.addMessage('agent', 'I found an open question that needs your decision. Please choose an option.');
                return this.getStatus();
            }
        }

        // Check for change keywords
        if (this.shouldProposeChanges(message)) {
            const changes = this.options.changeGenerator(message, this.context);
            if (changes.length > 0) {
                this.setPendingChanges(changes);
                this.addMessage('agent', `I have proposed ${changes.length} change(s). Please review and accept or discard.`);
                return this.getStatus();
            }
        }

        // Default response
        const response = this.options.responseGenerator(message, this.context);
        this.addMessage('agent', response);

        return this.getStatus();
    }

    async applyChanges(changes: ProposedChange[]): Promise<ConversationState> {
        // Simulate apply delay
        if (this.options.responseDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.options.responseDelay * 2));
        }

        this.state.pendingChanges = undefined;
        this.setStatus('active');

        this.addMessage('agent', `I have applied ${changes.length} change(s). Git commit created.`);

        return this.getStatus();
    }

    async resolveDecision(decisionId: string, optionId: string): Promise<ConversationState> {
        // Simulate resolve delay
        if (this.options.responseDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.options.responseDelay));
        }

        if (this.state.activeDecision?.id === decisionId) {
            const selected = this.state.activeDecision.options.find(o => o.id === optionId);
            this.state.activeDecision = undefined;
            this.addMessage('agent', `Decision recorded: "${selected?.label || optionId}". I've updated the specification.`);
        }

        return this.getStatus();
    }

    // =========================================================================
    // Private helper methods
    // =========================================================================

    private shouldProposeChanges(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return this.options.changeKeywords.some(kw => lowerMessage.includes(kw.toLowerCase()));
    }

    private shouldTriggerDecision(message: string): boolean {
        const lowerMessage = message.toLowerCase();
        return this.options.decisionKeywords.some(kw => lowerMessage.includes(kw.toLowerCase()));
    }

    private defaultResponseGenerator(message: string, context: AgentContext | null): string {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('error')) {
            return "I noticed you mentioned an error. I'm checking the logs...";
        }
        if (lowerMessage.includes('help')) {
            return "I can help you with:\n- Viewing and navigating entities\n- Making changes to the specification\n- Answering questions about your bundle";
        }
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            return "Hello! How can I assist you with your specification today?";
        }

        return `I received: "${message}". I am a mock agent - use keywords like "change" or "decide" to trigger special behaviors.`;
    }

    private defaultChangeGenerator(message: string, context: AgentContext | null): ProposedChange[] {
        // Generate a sensible mock change based on context
        const focusedEntity = context?.focusedEntity;

        if (focusedEntity) {
            return [{
                entityType: focusedEntity.type,
                entityId: focusedEntity.id,
                fieldPath: 'description',
                originalValue: 'Original description',
                newValue: 'Updated description by Agent',
                rationale: 'User requested a change.'
            }];
        }

        // Default fallback change
        return [{
            entityType: 'Feature',
            entityId: 'FEAT-001',
            fieldPath: 'title',
            originalValue: 'Basic Demo Feature',
            newValue: 'Updated Demo Feature Title',
            rationale: 'User requested title update via mock agent.'
        }];
    }

    private defaultDecisionGenerator(_message: string, _context: AgentContext | null): AgentDecision | undefined {
        return { ...DEFAULT_MOCK_DECISION };
    }
}
