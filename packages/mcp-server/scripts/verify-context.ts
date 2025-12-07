
import { spawn } from 'child_process';
import * as path from 'path';

const MCP_SERVER_PATH = path.resolve(__dirname, '../dist/index.js');
const BUNDLE_PATH = path.resolve(__dirname, '../../../examples/basic-bundle');

async function run() {
    console.log(`Starting MCP server at ${MCP_SERVER_PATH} with bundle ${BUNDLE_PATH}`);
    const server = spawn('node', [MCP_SERVER_PATH, BUNDLE_PATH], {
        stdio: ['pipe', 'pipe', 'inherit'], // stdin, stdout, stderr (inherit for logging)
    });

    const send = (msg: any) => {
        const str = JSON.stringify(msg);
        // console.log('Client sending:', str);
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
        } else {
            // console.log("Received notification:", msg);
        }
    }

    // 1. Initialize
    console.log('Sending initialize...');
    const initRes = await request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0' },
    });
    console.log('Initialized:', initRes.result.serverInfo);

    // 2. Notify initialized
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    // 3. Call get_context for TASK-001
    console.log('Calling get_context for TASK-001...');
    const contextRes = await request('tools/call', {
        name: 'get_context',
        arguments: {
            entityType: 'Task',
            id: 'TASK-001',
            depth: 1
        }
    });

    if (contextRes.error) {
        console.error('Context error:', contextRes.error);
        process.exit(1);
    }

    const content = JSON.parse(contextRes.result.content[0].text);
    console.log('Context retrieved for:', content.target.id);
    console.log('Related entities count:', content.related.length);

    content.related.forEach((rel: any) => {
        console.log(`- [${rel.relation}] ${rel.entity.id} (${rel.entity.title || rel.entity.statement})`);
    });

    // Basic assertion
    const hasReqLink = content.related.some((r: any) => r.entity.id === 'REQ-001');
    if (hasReqLink) {
        console.log('PASS: Found verify link to REQ-001');
    } else {
        console.error('FAIL: Did not find link to REQ-001');
        process.exit(1);
    }

    server.kill();
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
