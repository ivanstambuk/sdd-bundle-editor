
import fs from 'fs/promises';
import path from 'path';
import { AgentBackendConfig } from '../packages/core-ai/src/types';

const ENV_PATH = path.resolve(process.cwd(), '.env');

async function main() {
    console.log('Verifying Agent Configuration Persistence...');

    // 1. Initial State
    let envContent = '';
    try {
        envContent = await fs.readFile(ENV_PATH, 'utf-8');
        console.log('Initial AGENT_BACKEND_TYPE:', envContent.match(/AGENT_BACKEND_TYPE=(.*)/)?.[1]);
    } catch {
        console.log('.env not found, expecting it to be created.');
    }

    // 2. Mock API Call (simulating what the server does, or calling the server if running)
    // To be robust, we will use fetch to hit the running server if possible.
    // The server should be running from the failed test or we can assume port 3000.

    const config: AgentBackendConfig = {
        type: 'cli',
        options: {
            command: 'echo',
            args: ['persistence_test']
        }
    };

    console.log('Sending config update to server...', config);
    try {
        const res = await fetch('http://localhost:3000/agent/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status} ${res.statusText}`);
        }
        console.log('Server accepted config.');
    } catch (e) {
        console.error('Failed to contact server. Is it running?', e);
        process.exit(1);
    }

    // 3. Verify .env File Update
    console.log('Waiting for .env write...');
    await new Promise(r => setTimeout(r, 1000));

    envContent = await fs.readFile(ENV_PATH, 'utf-8');
    const type = envContent.match(/AGENT_BACKEND_TYPE=(.*)/)?.[1];
    const cmd = envContent.match(/AGENT_CLI_COMMAND=(.*)/)?.[1];
    const args = envContent.match(/AGENT_CLI_ARGS=(.*)/)?.[1];

    console.log('New AGENT_BACKEND_TYPE:', type);
    console.log('New AGENT_CLI_COMMAND:', cmd);
    console.log('New AGENT_CLI_ARGS:', args);

    if (type !== 'cli') throw new Error(`Expected cli, got ${type}`);
    if (cmd !== 'echo') throw new Error(`Expected echo, got ${cmd}`);
    // args might be json string
    if (!args || !args.includes('persistence_test')) throw new Error(`Expected args to contain persistence_test, got ${args}`);

    console.log('SUCCESS: .env configuration persisted.');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
