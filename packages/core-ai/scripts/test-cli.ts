
import { CliAgentBackend } from '../src/backends/CliAgentBackend';
import { AgentBackendConfig, AgentContext } from '../src/types';

async function main() {
    const backend = new CliAgentBackend();
    const config: AgentBackendConfig = {
        type: 'cli',
        options: {
            command: 'echo',
            args: ['[AGENT_PREFIX]']
        }
    };

    try {
        console.log('Initializing backend...');
        await backend.initialize(config);

        console.log('Starting conversation...');
        await backend.startConversation({ bundleDir: '/tmp' });

        console.log('Sending message: "Hello"');
        const state = await backend.sendMessage('Hello');

        console.log('Response state:', state);

        if (state.messages.length === 2 && state.messages[1].content.trim() === '[AGENT_PREFIX] Hello') {
            console.log('PASS: CLI backend echoed correctly.');
        } else {
            console.error('FAIL: Unexpected response.');
            process.exit(1);
        }

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
