import { expect } from '@playwright/test';
import { createInitialState } from '../../public/domain.js';
import { libraryActions } from '../../public/library-actions.js';

// Prepara uma conta no servidor, nunca injeta dados no armazenamento do browser.
// Usa o contrato atual por entidade, sem conversão de documentos antigos.
// Origem do servidor dos testes (mesma porta de playwright.config.js).
export const E2E_ORIGIN = `http://127.0.0.1:${process.env.LUME_E2E_PORT || '4187'}`;

export async function seedAccount(page, state = { ...createInitialState(), onboarded: true }) {
  const origin = E2E_ORIGIN;
  const registered = await page.request.post('/api/register', { headers: { origin }, data: { name: 'Pessoa de teste', email: `library-${crypto.randomUUID()}@example.test`, password: 'senha-de-teste-123' } });
  expect(registered.status()).toBe(201);
  const loaded = await page.request.get('/api/library', { headers: { origin } });
  expect(loaded.status()).toBe(200);
  const current = await loaded.json();
  const actions = libraryActions(current.state, state);
  if (!actions.length) return;
  const result = await page.request.post('/api/library/actions', { headers: { origin }, data: { id: crypto.randomUUID(), revision: current.revision, actions } });
  expect(result.ok()).toBe(true);
}

export async function readAccount(page) {
  // Espera as mutações imediatas antes de consultar a cópia do servidor.
  await expect(page.locator('.sync-saving')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('.sync-error')).toHaveCount(0);
  const response = await page.request.get('/api/library', { headers: { origin: E2E_ORIGIN } });
  expect(response.ok()).toBe(true);
  return (await response.json()).state;
}
