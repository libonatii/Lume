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
  await expect(page.locator('#main').getByText('Bia Mensagens', { exact: true })).toBeVisible();
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

// PNG 1×1 válido, para a foto de perfil de teste.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function setAvatar(requestContext, baseURL) {
  const upload = await requestContext.put('/api/profile/media/avatar', { data: PIXEL, headers: { origin: baseURL, 'content-type': 'image/png' } });
  expect(upload.status()).toBe(201);
  const { url } = await upload.json();
  const current = await (await requestContext.get('/api/library', { headers: { origin: baseURL } })).json();
  const saved = await requestContext.post('/api/library/actions', {
    data: { id: crypto.randomUUID(), revision: current.revision, actions: [{ type: 'account.update', value: { profile: { bio: '', avatar: url, header: '' } } }] },
    headers: { origin: baseURL },
  });
  expect(saved.status()).toBe(200);
  return url;
}

test('fotos de perfil na área Social e aviso flutuante de mensagem nova', async ({ page, browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const code = await makeFriends(page, page.request, baseURL, 'Ana Aviso', 'alert-a');
  const ana = (await (await page.request.get('/api/me')).json()).user;

  const guestContext = await browser.newContext({ baseURL });
  const guestPage = await guestContext.newPage();
  await register(guestPage.request, baseURL, 'Bia Aviso', 'alert-b');
  await markOnboarded(guestPage.request, baseURL);
  expect((await guestPage.request.post('/api/friends/accept', { data: { code }, headers: { origin: baseURL } })).status()).toBe(200);
  const bia = (await (await guestPage.request.get('/api/me')).json()).user;
  const avatar = await setAvatar(guestPage.request, baseURL);
  for (const request of [page.request, guestPage.request]) {
    expect((await request.patch('/api/xp/settings', { data: { rankingOptIn: true }, headers: { origin: baseURL } })).ok()).toBe(true);
  }

  // A foto da amizade aparece em Amigos, Mensagens e Ranking; sem foto, a inicial.
  await page.reload();
  await expect(page.locator(`#main .social-avatar img[src="${avatar}"]`).first()).toBeVisible();
  await page.goto('/#mensagens');
  const conversation = page.getByRole('button', { name: /Bia Aviso/ });
  await expect(conversation.locator(`.conversation-avatar img[src="${avatar}"]`)).toBeVisible();
  await page.goto('/#ranking');
  await expect(page.locator(`.ranking-avatar img[src="${avatar}"]`)).toBeVisible();
  await expect(page.locator('.ranking-row.is-self .ranking-avatar')).toHaveText('AA');

  // Mensagem nova fora da conversa: aviso com foto, nome e começo do texto.
  const send = async (body) => expect((await guestPage.request.post(`/api/messages/${ana.id}`, { data: { body }, headers: { origin: baseURL } })).status()).toBe(201);
  const recheck = async () => {
    const answered = page.waitForResponse((response) => response.url().endsWith('/api/messages/unread'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await answered;
  };
  const alert = page.locator('.message-alert');
  await page.goto('/#hoje');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await send('Bora revisar processo civil hoje à noite?');
  await recheck();
  await expect(alert).toContainText('Bia Aviso');
  await expect(alert).toContainText('Bora revisar processo civil hoje à noite?');
  await expect(alert.locator(`img[src="${avatar}"]`)).toBeVisible();
  await alert.getByRole('link', { name: /Abrir conversa com Bia Aviso/ }).click();
  await expect(page).toHaveURL((url) => url.hash === `#mensagens?com=${bia.id}`);
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Conversa selecionada' }).getByText('Bora revisar processo civil hoje à noite?')).toBeVisible();

  // Com a conversa dessa pessoa aberta, não há aviso.
  const conversationsRead = page.waitForResponse((response) => response.url().endsWith('/api/messages') && response.request().method() === 'GET');
  await send('Já estou com o código aberto.');
  await recheck();
  await conversationsRead;
  await page.waitForTimeout(300);
  await expect(alert).toHaveCount(0);

  // Em outra tela o aviso volta, fecha pelo botão e some sozinho depois de alguns segundos.
  await page.goto('/#biblioteca');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await send('Mandei o resumo.');
  await recheck();
  await expect(alert).toContainText('Mandei o resumo.');
  await alert.getByRole('button', { name: 'Fechar aviso de mensagem' }).click();
  await expect(alert).toHaveCount(0);
  // Com o ponteiro em cima, o aviso espera; longe dele, fecha sozinho.
  await page.mouse.move(0, 0);
  await send('Viu o resumo?');
  await recheck();
  await expect(alert).toContainText('Viu o resumo?');
  await expect(alert).toHaveCount(0, { timeout: 12000 });

  // Notificações de mensagens desligadas: nenhum aviso.
  expect((await page.request.patch('/api/messages/settings', { data: { notifications: false }, headers: { origin: baseURL } })).ok()).toBe(true);
  await recheck();
  const silentRead = page.waitForResponse((response) => response.url().endsWith('/api/messages') && response.request().method() === 'GET');
  await send('Silenciado?');
  await recheck();
  await silentRead;
  await page.waitForTimeout(300);
  await expect(alert).toHaveCount(0);

  await guestContext.close();
});
