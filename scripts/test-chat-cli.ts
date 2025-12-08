
import { spawn } from 'child_process';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../packages/cli/dist/index.js');
// Use environment variable or default to external bundle location
const BUNDLE_PATH = process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';

async function runTest() {
    console.log('Spawning CLI chat with echo backend...');

    const child = spawn('node', [
        CLI_PATH,
        'chat',
        '--bundle-dir', BUNDLE_PATH,
        '--backend', 'cli',
        '--cmd', 'echo',
        '--args', '[ECHO]'
    ], {
        stdio: ['pipe', 'pipe', 'inherit']
    });

    let output = '';
    child.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[STDOUT]', data.toString());

        if (output.includes('User>')) {
            // Send a message
            child.stdin.write('Test Message\n');
        }
    });

    return new Promise((resolve, reject) => {
        // Wait a bit for response then kill
        setTimeout(() => {
            child.kill();
            if (output.includes('[ECHO] Test Message')) {
                console.log('PASS: Chat echoed correctly.');
                resolve(true);
            } else {
                console.error('FAIL: Did not see echo response.');
                reject(new Error('Echo failed'));
            }
        }, 2000);
    });
}

runTest().then(() => process.exit(0)).catch(() => process.exit(1));
