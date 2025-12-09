
import OpenAI from 'openai';
import {
    AgentBackend,
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
    ConversationMessage
} from '../types';

const PROPOSE_CHANGES_TOOL = {
    type: 'function' as const,
    function: {
        name: 'propose_changes',
        description: 'Propose modifications to the bundle. Use this to create, update, or link entities.',
        parameters: {
            type: 'object',
            properties: {
                changes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            entityId: { type: 'string', description: 'ID of the entity to modify (e.g. FEAT-001). For new entities, propose a unique ID.' },
                            entityType: { type: 'string', description: 'The type of the entity (e.g. Feature, Requirement). Strongly recommended even for existing entities.' },
                            field: { type: 'string', description: 'The field name to modify (e.g. title, status, description).' },
                            newValue: { description: 'The new value for the field. Can be string, array, or object.' },
                            rationale: { type: 'string', description: 'Explanation of why this change is being made.' }
                        },
                        required: ['entityId', 'field', 'newValue']
                    }
                }
            },
            required: ['changes']
        }
    }
};

export class OpenAiAgentBackend implements AgentBackend {
    private client?: OpenAI;
    private config?: AgentBackendConfig; // Store config reference
    private state: ConversationState = {
        status: 'idle',
        messages: []
    };
    private context?: AgentContext;
    private systemPrompt: string = '';

    async initialize(config: AgentBackendConfig): Promise<void> {
        console.log('[OpenAiAgentBackend] Initializing with config:', JSON.stringify(config, null, 2));
        this.config = config; // Store reference

        const apiKey = process.env.DEEPSEEK_API_KEY || process.env.AGENT_HTTP_API_KEY || config.options?.apiKey as string;
        const baseURL = config.options?.baseURL as string || 'https://api.deepseek.com';

        if (!apiKey) {
            console.error('[OpenAiAgentBackend] Missing API Key. check DEEPSEEK_API_KEY, AGENT_HTTP_API_KEY or config.options.apiKey');
            throw new Error('API Key required for OpenAI/DeepSeek provider. Set DEEPSEEK_API_KEY or AGENT_HTTP_API_KEY env var, or provide via config.');
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
        this.systemPrompt = this.buildSystemPrompt();
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
        // Status remains 'active' while waiting

        const apiMessages = [
            { role: 'system' as const, content: this.systemPrompt },
            ...this.state.messages.map(m => ({
                role: (m.role === 'agent' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
                content: m.content
            }))
        ];

        try {
            // Only provide the propose_changes tool if NOT in read-only mode
            const tools = this.context?.readOnly ? [] : [PROPOSE_CHANGES_TOOL];

            const completion = await this.client.chat.completions.create({
                messages: apiMessages,
                model: this.config?.model || 'deepseek-chat', // Removed this.config?.options?.model
                tools: tools.length > 0 ? tools : undefined, // Don't pass tools array if empty
                tool_choice: tools.length > 0 ? 'auto' : undefined,
            });

            const choice = completion.choices[0];
            const responseMsg = choice?.message;

            if (!responseMsg) {
                throw new Error('No response from AI provider');
            }

            const content = responseMsg.content || '';
            const toolCalls = responseMsg.tool_calls;

            // Add agent message
            const agentMsg: ConversationMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                content: content, // Can be null if only tool calls, but we store string
                timestamp: Date.now()
            };
            this.state.messages.push(agentMsg);

            // Handle tool calls
            if (toolCalls && toolCalls.length > 0) {
                const changes: ProposedChange[] = [];

                // Use any cast to bypass strict OpenAI SDK types vs our usage
                for (const toolCall of toolCalls as any[]) {
                    if (toolCall.function?.name === 'propose_changes') {
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            if (Array.isArray(args.changes)) {
                                const mappedChanges = args.changes.map((c: any) => {
                                    let entityType = c.entityType;

                                    // If entityType is missing or partial, try to resolve it from the bundle context
                                    if ((!entityType || entityType === 'Unknown') && c.entityId && this.context?.bundle?.bundle) {
                                        // The Bundle interface has an idRegistry map
                                        const registryEntry = this.context.bundle.bundle.idRegistry.get(c.entityId);
                                        if (registryEntry) {
                                            entityType = registryEntry.entityType;
                                        }
                                    }

                                    // Resolve original value from bundle if possible
                                    let originalValue = null;
                                    if (entityType && entityType !== 'Unknown' && c.entityId && this.context?.bundle?.bundle) {
                                        const entityMap = this.context.bundle.bundle.entities.get(entityType);
                                        const entity = entityMap?.get(c.entityId);
                                        if (entity && entity.data) {
                                            // Simple top-level field access for now. 
                                            // TODO: Support nested path access if 'field' contains dots
                                            originalValue = (entity.data as any)[c.field];
                                        }
                                    }

                                    return {
                                        entityId: c.entityId,
                                        entityType: entityType || 'Unknown',
                                        fieldPath: c.field,
                                        newValue: c.newValue,
                                        originalValue: originalValue,
                                        rationale: c.rationale
                                    };
                                });
                                changes.push(...mappedChanges);
                            }
                        } catch (e) {
                            console.error('Failed to parse tool arguments:', e);
                        }
                    }
                }

                if (changes.length > 0) {
                    this.state.pendingChanges = changes;
                    this.state.status = 'pending_changes';
                } else {
                    this.state.status = 'active';
                }
            } else {
                this.state.status = 'active';
            }

        } catch (err) {
            console.error('AI Provider Error:', err);
            this.state.lastError = (err as Error).message;
            this.state.status = 'error';
        }

        return this.state;
    }

    async applyChanges(changes: ProposedChange[], updatedBundle?: any): Promise<ConversationState> {
        // In this architecture, applyChanges is handled by the server/service layer
        // The backend just proposes them.
        // We assume successful application moves us back to 'active' or 'committed'
        this.state.pendingChanges = undefined;
        this.state.status = 'active';

        if (updatedBundle && this.context) {
            this.context.bundle = updatedBundle;
            this.systemPrompt = this.buildSystemPrompt();
            // Optionally, add a system message to confirm context update
        }

        // Add a system message indicating changes were applied
        // So the LLM knows for the next turn
        this.state.messages.push({
            id: Date.now().toString(),
            role: 'system', // or user 'system' equivalent
            content: 'Changes have been successfully applied to the bundle. The system prompt has been updated with the latest bundle context.',
            timestamp: Date.now()
        });

        return this.state;
    }

    async resolveDecision(decisionId: string, optionId: string): Promise<ConversationState> {
        return this.state;
    }

    async clearPendingChanges(): Promise<ConversationState> {
        this.state.pendingChanges = undefined;
        this.state.status = 'active';
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
        // Serialize the bundle context for the LLM
        // We use JSON for simplicity
        const isReadOnly = this.context?.readOnly ?? false;

        let prompt = `You are an intelligent SDD (Spec-Driven Development) Bundle Editor assistant.
Your goal is to help the user understand and ${isReadOnly ? 'analyze' : 'evolve'} the specification bundle.
`;

        if (isReadOnly) {
            prompt += `
IMPORTANT: You are currently in READ-ONLY mode. You can:
- Answer questions about the bundle
- Analyze entities and their relationships
- Provide recommendations and insights
- Explain specifications

You CANNOT:
- Modify any entities
- Create new entities
- Propose changes to the bundle

If the user asks you to make changes, politely explain that you are in read-only mode and suggest they toggle the "Read-Only" switch in the UI to enable editing.
`;
        } else {
            prompt += `
You have access to a tool 'propose_changes' which you MUST use to modify the bundle.
When the user asks to rename, create, or update entities, call this tool.
Do not ask for permission to use the tool; just use it if the user's intent is clear.
`;
        }

        prompt += `
CURRENT BUNDLE CONTEXT:
`;

        if (this.context?.bundle?.bundle) {
            // Flatten the nested Map<EntityType, Map<EntityId, Entity>> structure
            const allEntities: any[] = [];
            for (const typeMap of this.context.bundle.bundle.entities.values()) {
                for (const entity of typeMap.values()) {
                    allEntities.push({
                        id: entity.id,
                        type: entity.entityType, // use entityType prop from Entity interface
                        data: entity.data
                    });
                }
            }

            const bundleSummary = {
                manifest: this.context.bundle.bundle.manifest,
                entities: allEntities
            };
            prompt += JSON.stringify(bundleSummary, null, 2);
        } else {
            prompt += "(No bundle loaded or empty context)";
        }

        return prompt;
    }
}
