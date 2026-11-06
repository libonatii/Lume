import { test, expect } from '@playwright/test';
import { createInitialState } from '../../public/domain.js';

const PASSWORD = 'senha-local-teste-123';

async function register(requestContext, baseURL, name, prefix) {
  const email = `${prefix}-${Date.now()}@example.test`;
  const response = await requestContext.post('/api/register', {
    data: { name, email, password: PASSWORD },
    headers: { origin: baseURL },
  });
  expect(response.status()).toBe(201);
  return email;
}

async function markOnboarded(requestContext, baseURL) {
  const current = await requestContext.get('/api/library', { headers: { origin: baseURL } });
  const revision = current.ok() ? (await current.json()).revision : 0;
  const saved = await requestContext.post('/api/library/actions', {
    data: { id: crypto.randomUUID(), revision, actions: [{ type: 'account.update', value: { onboarded: true } }] },
    headers: { origin: baseURL },
  });
  expect(saved.status()).toBe(200);
}

async function makeFriends(page, requestContext, baseURL, name, prefix) {
  await register(requestContext, baseURL, name, prefix);
  await markOnboarded(requestContext, baseURL);
  await page.goto('/#amigos');
  await page.getByRole('button', { name: 'Criar convite' }).click();
  const code = (await page.locator('.companion-code > code').first().textContent())?.trim() || '';
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  return code;
}

test('mensagem direta entre amizades, não lida, bloqueio e desbloqueio', async ({ page, browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const code = await makeFriends(page, page.request, baseURL, 'Ana Mensagens', 'msg-a');

  const guestContext = await browser.newContext({ baseURL });
  const guestPage = await guestContext.newPage();
  await register(guestPage.request, baseURL, 'Bia Mensagens', 'msg-b');
  await markOnboarded(guestPage.request, baseURL);
  const accepted = await guestPage.request.post('/api/friends/accept', {
    data: { code },
    headers: { origin: baseURL },
  });
  expect(accepted.status()).toBe(200);

  // Ana abre a conversa pela lista de amigos.
  await page.reload();
  await expect(page.getByText('Bia Mensagens')).toBeVisible();
  await page.getByRole('button', { name: 'Conversar com Bia Mensagens' }).click();
  await expect(page.getByRole('heading', { name: 'Mensagens', exact: true })).toBeVisible();
  await expect(page.getByText('Comece uma conversa')).toBeVisible();
  await page.getByLabel('Mensagem', { exact: true }).fill('Oi, vamos revisar constitucional?');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('region', { name: 'Conversa selecionada' }).getByText('Oi, vamos revisar constitucional?')).toBeVisible();

  // Bia vê a conversa e a mensagem não lida.
  await guestPage.goto('/#mensagens');
  await expect(guestPage.getByText('Oi, vamos revisar constitucional?')).toBeVisible();
  await guestPage.getByRole('button', { name: /Ana Mensagens/ }).first().click();
  await expect(guestPage.getByLabel('Mensagem', { exact: true })).toBeVisible();
  await expect(guestPage.getByRole('region', { name: 'Conversa selecionada' }).getByText('Oi, vamos revisar constitucional?')).toBeVisible();
  await guestPage.getByLabel('Mensagem', { exact: true }).fill('Vamos! Começo pelas questões.');
  await guestPage.getByRole('button', { name: 'Enviar' }).click();
  await expect(guestPage.getByRole('region', { name: 'Conversa selecionada' }).getByText('Vamos! Começo pelas questões.')).toBeVisible();

  // Ana recarrega e vê a resposta.
  await page.reload();
  await expect(page.getByRole('region', { name: 'Conversa selecionada' }).getByText('Vamos! Começo pelas questões.')).toBeVisible();

  // Bloqueio interrompe a composição nos dois lados e preserva o histórico.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Bloquear' }).click();
  await expect(page.getByText('Desbloqueie para voltar a enviar mensagens.')).toBeVisible();
  await expect(page.getByLabel('Mensagem', { exact: true })).toHaveCount(0);
  await guestPage.reload();
  await expect(guestPage.getByText('Esta pessoa bloqueou novas mensagens.')).toBeVisible();
  await expect(guestPage.getByLabel('Mensagem', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByLabel('Mensagem', { exact: true })).toBeVisible();
  await guestPage.reload();
  await guestPage.getByRole('button', { name: /Ana Mensagens/ }).first().click();
  await expect(guestPage.getByLabel('Mensagem', { exact: true })).toBeVisible();

  await guestContext.close();
});
