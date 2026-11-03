import { expect } from '@playwright/test';
import { createInitialState } from '../../public/domain.js';

// Prepara uma conta no servidor, nunca injeta dados no armazenamento do browser.
// PUT legado exercita também a conversão da conta ao abrir o cliente novo.
export async function seedAccount(page, state = { ...createInitialState(), onboarded: true }) {
  const origin = 'http://127.0.0.1:4187';
  const registered = await page.request.post('/api/register', { headers: { origin }, data: { name: 'Pessoa de teste', email: `library-${crypto.randomUUID()}@example.test`, password: 'senha-de-teste-123' } });
  expect(registered.status()).toBe(201);
  const result = await page.request.put('/api/state', { headers: { origin }, data: state });
  expect(result.ok()).toBe(true);
}

export async function readAccount(page) {
  // Espera as mutações imediatas antes de consultar a cópia do servidor.
  await expect(page.locator('.sync-saving')).toHaveCount(0);
  await expect(page.locator('.sync-error')).toHaveCount(0);
  const response = await page.request.get('/api/library', { headers: { origin: 'http://127.0.0.1:4187' } });
  expect(response.ok()).toBe(true);
  return (await response.json()).state;
}
