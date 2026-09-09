import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : { command: 'pnpm start --port 3000', url: 'http://localhost:3000/auth', reuseExistingServer: true, timeout: 60000 },
})
