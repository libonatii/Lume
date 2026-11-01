// Roteiro de contrato da API /api/*: status, formato e códigos de erro que o
// cliente, o aplicativo de desktop e a extensão esperam. Roda igual contra
// qualquer alvo de harness.js. Mudança intencional de contrato muda este arquivo.

import assert from 'node:assert/strict';
import { addCourse, completeMission, createInitialState } from '../../public/domain.js';
import { client } from './harness.js';

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89, 0, 0, 0, 13, 0x49, 0x44, 0x41, 0x54,
  0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0, 0x1f, 0, 5, 0, 1, 0xff, 0x89, 0x99, 0x3d, 0x1d,
  0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function unique(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function register(origin, name) {
  const browser = client(origin);
  const email = `${unique(name.toLowerCase())}@example.test`;
  const result = await browser.request('POST', '/api/register', { body: { name, email, password: 'senha-de-teste-1' } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(browser.cookie.startsWith('lume_session='));
  return { browser, email, user: result.data.user };
}

export async function runContract(target, t) {
  const { origin } = target;

  await t.test('rotas desconhecidas e métodos', async () => {
    const anonymous = client(origin);
    assert.equal((await anonymous.request('GET', '/api/nao-existe')).status, 404);
    const wrong = await anonymous.request('GET', '/api/login');
    assert.equal(wrong.status, 405);
    assert.match(wrong.headers.get('allow') || '', /POST/);
    assert.equal((await anonymous.request('DELETE', '/api/state')).status, 405);
  });

  await t.test('sessão anônima', async () => {
    const anonymous = client(origin);
    const me = await anonymous.request('GET', '/api/me');
    assert.equal(me.status, 200);
    assert.deepEqual(me.data, { authenticated: false, user: null });
    assert.equal(me.headers.get('cache-control'), 'no-store');
    assert.equal(me.headers.get('x-content-type-options'), 'nosniff');
    for (const path of ['/api/state', '/api/xp', '/api/friends', '/api/messages', '/api/collaboration/invites', '/api/companion', '/api/ranking']) {
      const result = await anonymous.request('GET', path);
      assert.equal(result.status, 401, path);
      assert.equal(typeof result.data.error, 'string', path);
    }
  });

  await t.test('cadastro, login, saída e validação', async () => {
    const { browser, email, user } = await register(origin, 'Ana');
    assert.deepEqual(Object.keys(user).sort(), ['createdAt', 'email', 'id', 'name']);
    const me = await browser.request('GET', '/api/me');
    assert.equal(me.data.authenticated, true);
    assert.equal(me.data.user.email, email);

    const duplicate = await client(origin).request('POST', '/api/register', { body: { name: 'Ana', email, password: 'senha-de-teste-1' } });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.data.field, 'email');

    const invalid = await client(origin).request('POST', '/api/register', { body: { name: 'A', email: 'x@y.z', password: 'senha-de-teste-1' } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.field, 'name');

    const crossSite = await client(origin).request('POST', '/api/login', { body: { email, password: 'x' }, sameOrigin: false });
    assert.equal(crossSite.status, 403);

    const wrongPassword = await client(origin).request('POST', '/api/login', { body: { email, password: 'errada-errada' } });
    assert.equal(wrongPassword.status, 401);

    const second = client(origin);
    const login = await second.request('POST', '/api/login', { body: { email, password: 'senha-de-teste-1' } });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.id, user.id);

    const logout = await second.request('POST', '/api/logout');
    assert.equal(logout.status, 204);
    assert.equal((await second.request('GET', '/api/me')).data.authenticated, false);

    const badJson = await client(origin).request('POST', '/api/login', { body: '{', raw: true, headers: { 'Content-Type': 'application/json' } });
    assert.equal(badJson.status, 400);
  });

  await t.test('recuperação de senha', async () => {
    const { email } = await register(origin, 'Bia');
    const unknown = await client(origin).request('POST', '/api/password/request', { body: { email: 'ninguem@example.test' } });
    assert.equal(unknown.status, 200);
    assert.equal(unknown.data.resetUrl, undefined);
    const empty = await client(origin).request('POST', '/api/password/request', { body: {} });
    assert.equal(empty.status, 400);

    const requested = await client(origin).request('POST', '/api/password/request', { body: { email } });
    assert.equal(requested.status, 200);
    assert.match(requested.data.resetUrl, /#redefinir\?token=/);
    const token = requested.data.resetUrl.split('token=')[1];

    const badToken = await client(origin).request('POST', '/api/password/reset', { body: { token: 'x'.repeat(43), password: 'nova-senha-123' } });
    assert.equal(badToken.status, 400);
    const reset = await client(origin).request('POST', '/api/password/reset', { body: { token, password: 'nova-senha-123' } });
    assert.equal(reset.status, 200);
    const reused = await client(origin).request('POST', '/api/password/reset', { body: { token, password: 'nova-senha-456' } });
    assert.equal(reused.status, 400);
    const login = await client(origin).request('POST', '/api/login', { body: { email, password: 'nova-senha-123' } });
    assert.equal(login.status, 200);
  });

  await t.test('estado com revisão otimista e XP validado', async () => {
    const { browser } = await register(origin, 'Caio');
    const empty = await browser.request('GET', '/api/state');
    assert.deepEqual(empty.data, { state: null, updatedAt: null, revision: 0 });

    // Cria o marco da política antes do progresso.
    const snapshot = await browser.request('GET', '/api/xp?timeZone=America%2FSao_Paulo');
    assert.equal(snapshot.status, 200);
    assert.ok(snapshot.data.summary);
    assert.ok(Array.isArray(snapshot.data.events));

    let state = { ...createInitialState(), onboarded: true };
    state = addCourse(state, { title: 'Curso de contrato', steps: ['Aula 1', 'Aula 2'] }, 'curso-contrato');
    const at = new Date(Date.now() + 2000).toISOString();
    state = completeMission(state, 'curso-contrato', 'curso-contrato-0', { now: at }).state;

    const saved = await browser.request('PUT', '/api/state', { body: { state, baseRevision: 0 } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.saved, true);
    assert.equal(saved.data.revision, 1);

    const conflict = await browser.request('PUT', '/api/state', { body: { state, baseRevision: 0 } });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.code, 'state_conflict');
    assert.equal(conflict.data.revision, 1);
    assert.equal(conflict.data.state.courses[0].id, 'curso-contrato');

    const invalid = await browser.request('PUT', '/api/state', { body: '[]', raw: true });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.code, 'invalid_state');

    const loaded = await browser.request('GET', '/api/state');
    assert.equal(loaded.data.revision, 1);

    const grant = await browser.request('POST', '/api/xp/complete', { body: { courseId: 'curso-contrato', stepId: 'curso-contrato-0' } });
    assert.equal(grant.status, 200, JSON.stringify(grant.data));
    assert.equal(grant.data.added, true);
    const repeat = await browser.request('POST', '/api/xp/complete', { body: { courseId: 'curso-contrato', stepId: 'curso-contrato-0' } });
    assert.equal(repeat.data.duplicate, true);
    const notDone = await browser.request('POST', '/api/xp/complete', { body: { courseId: 'curso-contrato', stepId: 'curso-contrato-1' } });
    assert.equal(notDone.status, 409);
    assert.equal(notDone.data.code, 'step_not_completed');

    // Comandos de progresso: a segunda aula concluída por comando recebe XP na resposta.
    const saved2 = await browser.request('PUT', '/api/state', { body: { state, baseRevision: 1 } });
    assert.equal(saved2.status, 200);
    const command = await browser.request('POST', '/api/progress', { body: { commands: [
      { id: 'step:curso-contrato-1', type: 'complete', materialId: 'curso-contrato', unitId: 'curso-contrato-1', origin: 'manual', at: new Date().toISOString() },
      { id: 'x', type: 'complete', materialId: 'curso-contrato', unitId: 'nao-existe' },
    ] } });
    assert.equal(command.status, 200, JSON.stringify(command.data));
    assert.equal(command.data.results[0].status, 'recorded');
    assert.equal(command.data.results[1].code, 'unit_not_found');
    assert.ok(command.data.xp.some((event) => event.kind === 'lesson'));
    assert.equal((await browser.request('POST', '/api/progress', { body: { commands: [] } })).data.code, 'empty_commands');
    assert.equal((await client(origin).request('POST', '/api/progress', { body: { commands: [] } })).status, 401);

    const settings = await browser.request('PATCH', '/api/xp/settings', { body: { rankingOptIn: true } });
    assert.equal(settings.status, 200);
    assert.ok(settings.data.settings);

    const ranking = await browser.request('GET', '/api/ranking?tab=level&period=week');
    assert.equal(ranking.status, 200);
    assert.ok(Array.isArray(ranking.data.entries));
  });

  await t.test('amigos, perfil, mensagens, bloqueio e colaboração', async () => {
    const ana = await register(origin, 'Duda');
    const bia = await register(origin, 'Eva');

    const invite = await ana.browser.request('POST', '/api/friends/invite');
    assert.equal(invite.status, 201);
    assert.match(invite.data.code, /\S/);
    const accepted = await bia.browser.request('POST', '/api/friends/accept', { body: { code: invite.data.code } });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    assert.equal(accepted.data.friendId, ana.user.id);

    const list = await ana.browser.request('GET', '/api/friends');
    assert.equal(list.status, 200);

    const profile = await bia.browser.request('GET', `/api/profile/${encodeURIComponent(ana.user.id)}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.data.profile.user.id, ana.user.id);
    assert.equal(profile.data.profile.user.email, undefined);
    const stranger = await register(origin, 'Fabi');
    const forbidden = await stranger.browser.request('GET', `/api/profile/${encodeURIComponent(ana.user.id)}`);
    assert.equal(forbidden.status, 403);
    assert.equal((await bia.browser.request('POST', `/api/profile/${encodeURIComponent(ana.user.id)}`)).status, 405);

    const sent = await bia.browser.request('POST', `/api/messages/${encodeURIComponent(ana.user.id)}`, { body: { body: 'Oi!' } });
    assert.equal(sent.status, 201, JSON.stringify(sent.data));
    const empty = await bia.browser.request('POST', `/api/messages/${encodeURIComponent(ana.user.id)}`, { body: {} });
    assert.equal(empty.status, 400);
    assert.equal(empty.data.code, 'empty_message');
    const unread = await ana.browser.request('GET', '/api/messages/unread');
    assert.equal(unread.status, 200);
    const thread = await ana.browser.request('GET', `/api/messages/${encodeURIComponent(bia.user.id)}`);
    assert.equal(thread.status, 200);
    assert.equal((await ana.browser.request('POST', `/api/messages/${encodeURIComponent(bia.user.id)}/read`)).status, 200);
    assert.equal((await ana.browser.request('GET', '/api/messages')).status, 200);
    assert.equal((await ana.browser.request('GET', '/api/messages/settings')).status, 200);
    assert.equal((await ana.browser.request('PATCH', '/api/messages/settings', { body: { notifications: false } })).status, 200);
    assert.equal((await ana.browser.request('PATCH', '/api/messages/settings', { body: {} })).data.code, 'invalid_preference');
    assert.equal((await ana.browser.request('PUT', `/api/messages/${encodeURIComponent(bia.user.id)}`)).status, 405);

    assert.equal((await ana.browser.request('POST', `/api/blocks/${encodeURIComponent(bia.user.id)}`)).status, 200);
    assert.equal((await ana.browser.request('GET', '/api/blocks')).status, 200);
    const blocked = await bia.browser.request('POST', `/api/messages/${encodeURIComponent(ana.user.id)}`, { body: { body: 'Oi de novo' } });
    assert.ok(blocked.status >= 400 && blocked.status < 500);
    assert.equal((await ana.browser.request('DELETE', `/api/blocks/${encodeURIComponent(bia.user.id)}`)).status, 200);

    assert.equal((await ana.browser.request('GET', '/api/collaboration/invites')).status, 200);
    const noState = await ana.browser.request('POST', '/api/collaboration/invites', { body: { friendId: bia.user.id, courseId: 'x', stepId: 'y' } });
    assert.equal(noState.status, 409);
    assert.equal(noState.data.code, 'state_missing');

    const removed = await ana.browser.request('DELETE', `/api/friends/${encodeURIComponent(bia.user.id)}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.data.removed, true);
  });

  await t.test('aplicativo de desktop', async () => {
    const { browser } = await register(origin, 'Gabi');
    const pair = await browser.request('POST', '/api/companion/pair');
    assert.equal(pair.status, 201);
    const device = client(origin);
    const invalid = await device.request('POST', '/api/companion/redeem', { body: { code: '123' } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.code, 'invalid_code');
    const redeemed = await device.request('POST', '/api/companion/redeem', { body: { code: pair.data.code, deviceName: 'PC' } });
    assert.equal(redeemed.status, 201);
    const auth = { Authorization: `Bearer ${redeemed.data.token}` };
    const me = await device.request('GET', '/api/companion/me', { headers: auth });
    assert.equal(me.status, 200);
    assert.equal((await device.request('GET', '/api/companion/study', { headers: auth })).status, 200);
    const presence = await device.request('PUT', '/api/companion/presence', { headers: auth, body: { app: 'code.exe', category: 'study', since: new Date().toISOString() } });
    assert.equal(presence.status, 200);
    assert.equal((await device.request('DELETE', '/api/companion/presence', { headers: auth })).status, 204);
    assert.equal((await device.request('POST', '/api/companion/me', { headers: auth })).status, 405);
    const unauthorized = await client(origin).request('GET', '/api/companion/me', { headers: { Authorization: 'Bearer x' } });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.data.code, 'device_unauthorized');

    const listed = await browser.request('GET', '/api/companion');
    assert.equal(listed.status, 200);
    const revoked = await browser.request('DELETE', `/api/companion/devices/${encodeURIComponent(redeemed.data.device.id)}`);
    assert.equal(revoked.status, 200);
  });

  await t.test('importação e GitHub', async () => {
    const anonymous = client(origin);
    const missing = await anonymous.request('POST', '/api/import/analyze', { body: {} });
    assert.equal(missing.status, 400);
    assert.equal(missing.data.code, 'missing_url');
    const html = `<html><head><title>Curso de contrato</title></head><body><h2>Conteúdo do curso</h2><ul>
      <li>Aula 1 - Introdução ao assunto</li><li>Aula 2 - Primeiros passos práticos</li><li>Aula 3 - Exercícios guiados</li></ul></body></html>`;
    const snapshot = await anonymous.request('POST', '/api/import/analyze', { body: { html, url: 'https://www.alura.com.br/curso-online-contrato' } });
    assert.equal(snapshot.status, 200, JSON.stringify(snapshot.data));
    assert.equal(snapshot.data.status, 'ok');
    assert.ok(snapshot.data.payload.lessonCount >= 3);
    const organized = await anonymous.request('POST', '/api/import/organize', { body: { text: 'Módulo 1\nAula 1 - A\nAula 2 - B\nAula 3 - C', title: 'Texto' } });
    assert.equal(organized.status, 200, JSON.stringify(organized.data));
    assert.equal(organized.data.ai.used, false);
    const emptyText = await anonymous.request('POST', '/api/import/organize', { body: { text: '  ' } });
    assert.equal(emptyText.status, 400);
    assert.equal(emptyText.data.code, 'empty_text');

    assert.equal((await anonymous.request('POST', '/api/github/analyze', { body: { url: 'x' } })).status, 401);
    const { browser } = await register(origin, 'Hugo');
    const noUrl = await browser.request('POST', '/api/github/analyze', { body: {} });
    assert.equal(noUrl.status, 400);
    assert.equal(noUrl.data.code, 'missing_url');
  });

  await t.test('imagens de perfil e slides', async (sub) => {
    const { browser, user } = await register(origin, 'Iris');
    const upload = await browser.request('PUT', '/api/profile/media/avatar', { body: PNG, raw: true, headers: { 'Content-Type': 'image/png' } });
    if (upload.status === 503) {
      sub.skip('armazenamento de imagens não configurado neste alvo');
      return;
    }
    assert.equal(upload.status, 201, JSON.stringify(upload.data));
    assert.match(upload.data.url, /^\/api\/media\//);
    const image = await fetch(`${origin}${upload.data.url}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    const notImage = await browser.request('PUT', '/api/profile/media/avatar', { body: 'texto', raw: true });
    assert.ok(notImage.status >= 400 && notImage.status < 500);
    assert.equal((await browser.request('GET', '/api/profile/media/avatar')).status, 405);
    assert.equal((await browser.request('DELETE', '/api/profile/media/avatar')).status, 200);
    const slide = await browser.request('PUT', '/api/slides/media/curso/slide-1', { body: PNG, raw: true });
    assert.equal(slide.status, 201);
    assert.ok(slide.data.url.includes(encodeURIComponent(user.id)) || slide.data.url.includes(user.id));
    assert.equal((await fetch(`${origin}/api/media/nada`)).status, 404);
  });
}
