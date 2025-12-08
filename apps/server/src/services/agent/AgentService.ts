import { createAgentBackend, AgentBackendConfig, AgentBackend } from '@sdd-bundle-editor/core-ai';
import * as fs from 'fs/promises';
import * as path from 'path';

export class AgentService {
    private backend: AgentBackend;
    private static instance: AgentService;
    private currentConfig: AgentBackendConfig;

    private constructor() {
        const type = (process.env.AGENT_BACKEND_TYPE || 'mock') as AgentBackendConfig['type'];
        // Basic config mapping from env vars
        this.currentConfig = {
            type,
            options: {
                command: process.env.AGENT_CLI_COMMAND,
                args: process.env.AGENT_CLI_ARGS ? JSON.parse(process.env.AGENT_CLI_ARGS) : undefined,
                apiKey: process.env.AGENT_HTTP_API_KEY,
                baseURL: process.env.AGENT_HTTP_BASE_URL,
                model: process.env.AGENT_HTTP_MODEL
            }
        };

        try {
            this.backend = createAgentBackend(this.currentConfig);
            console.log(`AgentService initialized with backend: ${type}`);
        } catch (err) {
            console.warn(`Failed to initialize backend '${type}', falling back to mock.`, err);
            this.backend = createAgentBackend({ type: 'mock' });
            this.currentConfig = { type: 'mock' };
        }

        this.backend.initialize(this.currentConfig);
    }

    static getInstance(): AgentService {
        if (!AgentService.instance) {
            AgentService.instance = new AgentService();
        }
        return AgentService.instance;
    }

    getBackend(): AgentBackend {
        return this.backend;
    }

    getConfig(): AgentBackendConfig {
        return this.currentConfig;
    }

    configure(config: AgentBackendConfig): void {
        console.log(`Reconfiguring AgentService with backend: ${config.type}`);
        try {
            this.backend = createAgentBackend(config);
            this.backend.initialize(config);
            this.currentConfig = config;
        } catch (err) {
            console.error('Failed to configure agent backend:', err);
            throw err;
        }
    }

    /**
     * Resets the agent backend status to its initial state.
     * Useful for testing to ensure a clean slate.
     */
    async reset(): Promise<void> {
        console.log('Resetting AgentService state...');
        // We can either create a new backend instance or add a reset method to the interface.
        // Re-creating the backend ensures total cleanup of internal state (messages, etc).
        // It relies on currentConfig being preserved.
        this.backend = createAgentBackend(this.currentConfig);
        await this.backend.initialize(this.currentConfig);
    }

    async saveConfig(config: AgentBackendConfig): Promise<void> {
        // 1. Configure in-memory first (fast fail)
        this.configure(config);

        // 2. Persist to .env
        const rootDir = process.cwd(); // Assumption: Running from root
        const envPath = path.join(rootDir, '.env');

        try {
            let envContent = '';
            try {
                envContent = await fs.readFile(envPath, 'utf-8');
            } catch (err) {
                // File might not exist
            }

            const updates: Record<string, string | undefined> = {
                AGENT_BACKEND_TYPE: config.type,
                AGENT_CLI_COMMAND: config.type === 'cli' ? (config.options?.command as string) : undefined,
                AGENT_CLI_ARGS: config.type === 'cli' ? JSON.stringify(config.options?.args) : undefined,
                AGENT_HTTP_BASE_URL: config.type === 'http' ? (config.options?.baseURL as string) : undefined,
                AGENT_HTTP_API_KEY: config.type === 'http' ? (config.options?.apiKey as string) : undefined,
                AGENT_HTTP_MODEL: config.type === 'http' ? (config.options?.model as string) : undefined,
            };

            const newContent = this.updateEnvContent(envContent, updates);
            await fs.writeFile(envPath, newContent, 'utf-8');
            console.log('Updated .env configuration');

            // Update process.env for consistency
            Object.assign(process.env, updates);

        } catch (err) {
            console.error('Failed to persist config to .env:', err);
            // Don't throw, just warn. The runtime config worked.
        }
    }

    private updateEnvContent(content: string, updates: Record<string, string | undefined>): string {
        const lines = content.split('\n');
        const newLines: string[] = [];
        const foundKeys = new Set<string>();

        // Update existing lines
        for (const line of lines) {
            const match = line.match(/^([A-Z_]+)=(.*)$/);
            if (match) {
                const key = match[1];
                if (key in updates) {
                    foundKeys.add(key);
                    const val = updates[key];
                    if (val !== undefined) {
                        newLines.push(`${key}=${val}`);
                    } else {
                        // Key should be removed/commented? For now, let's keep it empty or comment it
                        // newLines.push(`# ${key}=`); // Option A
                        // null/undefined means remove? User didn't specify behavior.
                        // Let's just not output it if undef, or empty string.
                        // Better: If undefined, remove it from env?
                        // "Mock" -> remove CLI args. 
                        // Let's clear it.
                        newLines.push(`${key}=`);
                    }
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }

        // Add new keys
        for (const [key, val] of Object.entries(updates)) {
            if (!foundKeys.has(key) && val !== undefined) {
                newLines.push(`${key}=${val}`);
            }
        }

        return newLines.join('\n');
    }
}
