import { defineConfig, devices } from '@playwright/test'

const digitalProductsEnabled = process.env.FEATURE_DIGITAL_PRODUCTS === 'true'
const disabledRolloutOnlyTests = /public Digital Products storefront remains disabled|program directory hides digital products and retired digital route redirects/

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  reporter: 'list',
  grepInvert: digitalProductsEnabled ? disabledRolloutOnlyTests : undefined,
  use: { baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.TEST_BASE_URL
    ? [
      { command: 'pnpm exec next dev tests/fixtures/carousel-interaction --port 3001', url: 'http://localhost:3001', reuseExistingServer: true, timeout: 60000 },
    ]
    : [
      { command: 'pnpm start --port 3000', url: 'http://localhost:3000/auth', reuseExistingServer: true, timeout: 60000 },
      { command: 'pnpm exec next dev tests/fixtures/carousel-interaction --port 3001', url: 'http://localhost:3001', reuseExistingServer: true, timeout: 60000 },
    ],
})
