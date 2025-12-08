import { defineConfig, devices } from '@playwright/test';

const useManagedWebServers = !process.env.PW_SKIP_WEB_SERVER;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  // Run tests serially to avoid race conditions with shared server agent state
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
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
