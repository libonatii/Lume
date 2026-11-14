import { defineConfig, devices } from '@playwright/test';

// Porta do servidor dos testes. Outra porta: LUME_E2E_PORT=4188 npm run test:e2e.
const E2E_PORT = process.env.LUME_E2E_PORT || '4187';
const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;

// Localmente usa o Chrome instalado. No CI, PLAYWRIGHT_CHANNEL=bundled usa o
// Chromium baixado por `npx playwright install chromium`.
const channel = process.env.PLAYWRIGHT_CHANNEL === 'bundled' ? undefined : (process.env.PLAYWRIGHT_CHANNEL || 'chrome');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: process.env.CI ? 3 : 4,
  retries: process.env.CI ? 1 : 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: E2E_ORIGIN,
    ...(channel ? { channel } : {}),
    headless: true,
    serviceWorkers: 'block',
    launchOptions: { args: ['--disable-webgl'] },
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // No celular só rodam os testes marcados com @celular (layout, navegação e toque);
    // regras, API e leitores de página não mudam com o tamanho da tela.
    { name: 'mobile', grep: /@celular/, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node server.js', url: `${E2E_ORIGIN}/api/me`,
    env: { PORT: E2E_PORT, LUME_DATA_DIR: `data/e2e-${Date.now()}`, BCRYPT_ROUNDS: '4', LUME_ATTEMPT_LIMIT: '1000' },
    reuseExistingServer: false,
  },
});
