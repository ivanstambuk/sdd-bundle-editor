
import { OpenAiAgentBackend } from '../src/backends/OpenAiAgentBackend';
import { AgentBackendConfig } from '../src/types';

async function main() {
    const backend = new OpenAiAgentBackend();
    const config: AgentBackendConfig = {
        type: 'http',
        options: {
            apiKey: 'sk-test-dummy',
            baseURL: 'https://api.deepseek.com'
        }
    };

    try {
        console.log('Initializing backend...');
        await backend.initialize(config);

        console.log('Backend initialized successfully (client created).');

        // We won't send a message to avoid actual API call failure/cost in this auto-test
        // unless we mock it. For now, initialization proof is sufficient for wiring.
        console.log('PASS: OpenAiAgentBackend initialized.');

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
