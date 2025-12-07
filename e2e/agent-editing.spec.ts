

import { test, expect } from './fixtures';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import * as util from 'node:util';
import * as os from 'node:os';

const execAsync = util.promisify(exec);

// Run serially to avoid conflict with shared server state
test.describe.serial('Agent Editing Flow', () => {
    let tempDir: string;

    test.beforeAll(async () => {
        // Create a temporary directory for the test bundle
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdd-test-'));
        console.log(`Test bundle dir: ${tempDir}`);

        // Copy basic-bundle to temp dir
        // Assuming test runs from repo root
        const sourceDir = path.resolve('examples/basic-bundle');
        await execAsync(`cp -r "${sourceDir}/." "${tempDir}"`);

        // Initialize git repo
        await execAsync('git init', { cwd: tempDir });
        await execAsync('git add .', { cwd: tempDir });
        await execAsync('git config user.name "Test User"', { cwd: tempDir });
        await execAsync('git config user.email "test@example.com"', { cwd: tempDir });
        await execAsync('git commit -m "Initial commit"', { cwd: tempDir });
        // Create a feature branch because 'main/master' are protected
        await execAsync('git checkout -b feature/test-agent-edit', { cwd: tempDir });
    });

    test.afterAll(async () => {
        // Cleanup
        // await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('should propose and apply changes', async ({ page, request }) => {

        // 1. Reset agent config to mock
        // We use the request fixture to call the API directly. 
        // Note: baseURL is http://localhost:5173 (webpack dev server), which proxies to backend.
        await request.post('/agent/config', {
            data: { type: 'mock' }
        });

        // 2. Navigate to app with custom bundleDir
        // Note: bundleDir must be preserved in URL for AppShell to use it
        await page.goto(`/?bundleDir=${encodeURIComponent(tempDir)}&debug=true`);

        // 3. Open Agent Panel (it might be closed by default? AppShell says `useState(true)`)
        // Check if agent panel is visible
        const agentPanel = page.locator('.agent-panel');
        await expect(agentPanel).toBeVisible({ timeout: 10000 });

        // 4. Start Conversation
        // Ensure we are in configured state. Mock backend is key.
        const startBtn = page.locator('button.start-btn');
        if (await startBtn.isVisible()) {
            await startBtn.click();
        }

        // 5. Send "propose change"
        const inputArea = page.locator('textarea[placeholder="Describe changes..."]');
        await expect(inputArea).toBeVisible();
        await inputArea.fill('propose change');
        await page.locator('button.send-btn').click();

        // 6. Verify Proposal
        await expect(page.locator('.message-content').getByText('I have proposed a change', { exact: false })).toBeVisible();

        // Check for proposed changes panel (in the message or strict UI?)
        // The UI shows "AI Proposed Changes" in the main content area if `aiProposedBundle` is set via /ai/generate.
        // BUT here we are using the Agent Panel's pending changes flow.
        // AgentPanel.tsx renders `PendingChanges` component?
        // Let's verify AgentPanel implementation.
        // It should show a "Review Proposed Changes" block or similar inside the chat or panel.
        // Based on `AgentPanel.tsx`, it passes `pendingChanges` to the component.
        // We expect to see "Proposed Changes" in the Agent Panel.
        await expect(page.locator('.pending-changes-block')).toBeVisible();
        await expect(page.locator('.change-type').getByText('Profile', { exact: false })).toBeVisible();
        await expect(page.locator('.change-path').getByText('title', { exact: false })).toBeVisible();

        // 7. Accept Changes
        const acceptBtn = page.getByRole('button', { name: 'Accept & Apply' });
        await expect(acceptBtn).toBeVisible();
        await acceptBtn.click();

        // 8. Verify Success
        const errorMsg = page.locator('.status-error');
        if (await errorMsg.isVisible()) {
            console.log('SIDEBAR ERROR:', await errorMsg.innerText());
        }

        const lastMessage = page.locator('.message-content').last();
        if (await lastMessage.isVisible()) {
            console.log('Last message:', await lastMessage.innerText());
        }
        await expect(lastMessage.getByText('Changes applied successfully.', { exact: false })).toBeVisible();

        // 9. Verify File on Disk
        // Bundle structure: bundle/profiles/PROF-BASIC.yaml
        const userFilePath = path.join(tempDir, 'bundle/profiles/PROF-BASIC.yaml');
        const content = await fs.readFile(userFilePath, 'utf8');
        expect(content).toContain('title: Updated User Profile');

        // 10. Verify Git Commit
        const { stdout: gitLog } = await execAsync('git log -1 --pretty=%B', { cwd: tempDir });
        expect(gitLog.trim()).toBe('Applied changes via Agent');
    });
});
