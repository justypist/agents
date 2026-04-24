import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.CI
      ? 'DATABASE_URL=file:.data/e2e.sqlite pnpm db:migrate && DATABASE_URL=file:.data/e2e.sqlite pnpm build && DATABASE_URL=file:.data/e2e.sqlite pnpm start'
      : 'DATABASE_URL=file:.data/e2e.sqlite pnpm db:migrate && DATABASE_URL=file:.data/e2e.sqlite pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
