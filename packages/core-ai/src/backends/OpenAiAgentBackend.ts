/**
 * OpenAI/DeepSeek Agent Backend for HTTP-based AI providers.
 * Uses OpenAI SDK for communication with compatible APIs.
 */

import OpenAI from 'openai';
import { BaseAgentBackend } from './BaseAgentBackend';
import {
    AgentBackendConfig,
    AgentContext,
    ConversationState,
    ProposedChange,
} from '../types';

/**
 * Tool definition for proposing changes to the bundle.
 */
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

export class OpenAiAgentBackend extends BaseAgentBackend {
    private client?: OpenAI;
    private systemPrompt: string = '';

    async initialize(config: AgentBackendConfig): Promise<void> {
        await super.initialize(config);
        console.log('[OpenAiAgentBackend] Initializing with config:', JSON.stringify(config, null, 2));

        const apiKey = process.env.DEEPSEEK_API_KEY || process.env.AGENT_HTTP_API_KEY || config.options?.apiKey as string;
        const baseURL = config.options?.baseURL as string || 'https://api.deepseek.com';

        if (!apiKey) {
            console.error('[OpenAiAgentBackend] Missing API Key. Check DEEPSEEK_API_KEY, AGENT_HTTP_API_KEY or config.options.apiKey');
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
        return this.getStatus();
    }

    async sendMessage(message: string): Promise<ConversationState> {
        if (!this.client) throw new Error('Backend not initialized');

        // Add user message
        this.addMessage('user', message);

        const apiMessages = [
            { role: 'system' as const, content: this.systemPrompt },
            ...this.state.messages.map(m => ({
                role: (m.role === 'agent' ? 'assistant' : m.role) as 'user' | 'assistant' | 'system',
                content: m.content
            }))
        ];

        try {
            // Only provide the propose_changes tool if NOT in read-only mode
            const tools = this.isReadOnly() ? [] : [PROPOSE_CHANGES_TOOL];

            const completion = await this.client.chat.completions.create({
                messages: apiMessages,
                model: this.config?.model || 'deepseek-chat',
                tools: tools.length > 0 ? tools : undefined,
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
            this.addMessage('agent', content);

            // Handle tool calls
            if (toolCalls && toolCalls.length > 0) {
                const changes = this.parseToolCalls(toolCalls);
                if (changes.length > 0) {
                    this.setPendingChanges(changes);
                } else {
                    this.setStatus('active');
                }
            } else {
                this.setStatus('active');
            }

        } catch (err) {
            console.error('AI Provider Error:', err);
            this.setError((err as Error).message);
        }

        return this.getStatus();
    }

    async applyChanges(changes: ProposedChange[], updatedBundle?: unknown): Promise<ConversationState> {
        this.state.pendingChanges = undefined;
        this.setStatus('active');

        if (updatedBundle && this.context) {
            this.context.bundle = updatedBundle as any;
            this.systemPrompt = this.buildSystemPrompt();
        }

        // Add a system message indicating changes were applied
        this.addMessage('system', 'Changes have been successfully applied to the bundle. The system prompt has been updated with the latest bundle context.');

        return this.getStatus();
    }

    async resolveDecision(decisionId: string, optionId: string): Promise<ConversationState> {
        return this.getStatus();
    }

    // =========================================================================
    // Private helper methods
    // =========================================================================

    /**
     * Parse tool calls from OpenAI response and extract changes.
     */
    private parseToolCalls(toolCalls: any[]): ProposedChange[] {
        const changes: ProposedChange[] = [];

        for (const toolCall of toolCalls) {
            if (toolCall.function?.name === 'propose_changes') {
                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    if (Array.isArray(args.changes)) {
                        const mappedChanges = args.changes.map((c: any) => this.mapChange(c));
                        changes.push(...mappedChanges);
                    }
                } catch (e) {
                    console.error('Failed to parse tool arguments:', e);
                }
            }
        }

        return changes;
    }

    /**
     * Map a raw change object to a ProposedChange.
     */
    private mapChange(c: any): ProposedChange {
        let entityType = c.entityType;

        // Resolve entityType from registry if missing
        if ((!entityType || entityType === 'Unknown') && c.entityId && this.context?.bundle?.bundle) {
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
            if (entity?.data) {
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
    }

    /**
     * Build the system prompt with current bundle context.
     */
    private buildSystemPrompt(): string {
        const isReadOnly = this.isReadOnly();

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
            // Flatten the nested Map structure
            const allEntities: any[] = [];
            for (const typeMap of this.context.bundle.bundle.entities.values()) {
                for (const entity of typeMap.values()) {
                    allEntities.push({
                        id: entity.id,
                        type: entity.entityType,
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
