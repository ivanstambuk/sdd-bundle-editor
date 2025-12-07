
import { spawn } from 'child_process';
import * as path from 'path';

const MCP_SERVER_PATH = path.resolve(__dirname, '../dist/index.js');
const BUNDLE_PATH = path.resolve(__dirname, '../../../examples/basic-bundle');

async function run() {
    console.log(`Starting MCP server at ${MCP_SERVER_PATH} with bundle ${BUNDLE_PATH}`);
    const server = spawn('node', [MCP_SERVER_PATH, BUNDLE_PATH], {
        stdio: ['pipe', 'pipe', 'inherit'],
    });

    const send = (msg: any) => {
        const str = JSON.stringify(msg);
        server.stdin.write(str + '\n');
    };

    let buffer = '';
    server.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line);
                handleMessage(msg);
            } catch (err) {
                console.error('Failed to parse message:', line);
            }
        }
    });

    let requestId = 0;
    const requests = new Map<number, (res: any) => void>();

    function request(method: string, params: any): Promise<any> {
        const id = requestId++;
        return new Promise((resolve) => {
            requests.set(id, resolve);
            send({ jsonrpc: '2.0', id, method, params });
        });
    }

    function handleMessage(msg: any) {
        if (msg.id !== undefined && requests.has(msg.id)) {
            requests.get(msg.id)!(msg);
            requests.delete(msg.id);
        }
    }

    // 1. Initialize
    await request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0' },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    // 2. Call get_conformance_context for PROF-BASIC
    console.log('Calling get_conformance_context for PROF-BASIC...');
    const res = await request('tools/call', {
        name: 'get_conformance_context',
        arguments: {
            profileId: 'PROF-BASIC'
        }
    });

    if (res.error) {
        console.error('Conformance tool error:', res.error);
        process.exit(1);
    }

    const content = JSON.parse(res.result.content[0].text);
    console.log('Profile:', content.metadata.title);
    console.log('Rules:', content.rules.length);

    const rule1 = content.rules.find((r: any) => r.id === 'RULE-01');
    if (rule1 && rule1.linkedRequirement === 'REQ-001' && rule1.requirementText) {
        console.log('PASS: Rule 1 expanded correctly with linked requirement text.');
    } else {
        console.error('FAIL: Rule 1 expansion failed or missing.', rule1);
        process.exit(1);
    }

    if (content.auditTemplate && content.auditTemplate.includes('# Audit Report')) {
        console.log('PASS: Audit template retrieved.');
    } else {
        console.error('FAIL: Audit template missing.');
        process.exit(1);
    }

    server.kill();
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
