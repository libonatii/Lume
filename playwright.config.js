import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4187', channel: 'chrome', headless: true, trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: {
    command: 'node server.js', url: 'http://127.0.0.1:4187/api/me',
    env: { PORT: '4187', LUME_DATA_DIR: `data/e2e-${Date.now()}`, BCRYPT_ROUNDS: '6' },
    reuseExistingServer: false,
  },
});
