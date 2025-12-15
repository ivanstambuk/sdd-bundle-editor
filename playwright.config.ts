import { defineConfig, devices } from '@playwright/test';

const useManagedWebServers = !process.env.PW_SKIP_WEB_SERVER;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 120_000,
  expect: {
    timeout: 5_000,
  },
  // Run tests serially to avoid race conditions with shared server agent state
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useManagedWebServers
    ? [
      {
        // Legacy HTTP server (fallback for UI)
        command: 'pnpm exec ts-node apps/server/src/index.ts',
        url: 'http://localhost:3000/health',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 60_000,
        env: {
          ...process.env,
          TEST_MODE: 'true',
          SDD_SAMPLE_BUNDLE_PATH: process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle',
        },
      },
      {
        // MCP server (primary for Phase 4.4 MCP-first UI)
        command: 'node packages/mcp-server/dist/index.js --http --port 3001',
        url: 'http://localhost:3001/health',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 60_000,
        env: {
          ...process.env,
          SDD_SAMPLE_BUNDLE_PATH: process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle',
        },
      },
      {
        // Web dev server
        command: 'pnpm --filter @sdd-bundle-editor/web dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 60_000,
      },
    ]
    : undefined,
});

