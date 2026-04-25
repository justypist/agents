import { defineConfig, devices } from '@playwright/test';

const databaseUrl =
  process.env.E2E_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  'postgres://agents:agents@localhost:5432/agents';
const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const databaseEnv = `DATABASE_URL=${shellQuote(databaseUrl)}`;

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
      ? `${databaseEnv} pnpm db:migrate && ${databaseEnv} pnpm build && ${databaseEnv} pnpm start`
      : `${databaseEnv} pnpm db:migrate && ${databaseEnv} pnpm dev`,
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
