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
        // MCP server (primary for MCP-first UI)
        // Pre-build to ensure dist/ is up-to-date, pass bundle path as argument
        command: `pnpm --filter @sdd-bundle-editor/mcp-server build && node packages/mcp-server/dist/index.js --http --port 3001 ${process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle'}`,
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

