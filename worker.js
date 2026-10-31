import {
  ValidationError, SESSION_TTL_MS, RESET_TTL_MS, bcryptRounds,
  validateName, validateEmail, validatePassword, normalizeEmail,
  hashPassword, verifyPassword, createSessionToken, hashSessionToken,
  sessionCookie, clearedSessionCookie, parseCookies,
} from './auth.js';
import { ImportError, analyzeUrl, analyzeText } from './import-server.js';
import { normalizePayload, detectProvider } from './public/import-domain.js';
import { buildProfile } from './public/profile-domain.js';
import { createInitialState, restoreState } from './public/domain.js';
import {
  CompanionError, authenticateDevice, clearPresence, companionSelf, createPairCode,
  listCompanion, redeemPairCode, reportPresence, revokeDevice, studySnapshot,
} from './companion.js';
import {
  FriendsError, acceptInvite, createInvite, listFriends, removeFriend,
} from './friends.js';
import {
  MediaError, MAX_MEDIA_BYTES, deleteProfileObject, parseMediaKeyFromPath,
  r2BucketAdapter, uploadProfileObject,
} from './media.js';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_STATE_BYTES = 256 * 1024;
const MAX_IMPORT_BYTES = 96 * 1024;
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function log(event, details = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Corpo grande demais.'), { status: 413 });
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('JSON inválido.'), { status: 400 });
  }
}

function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  if (!origin) return request.headers.get('Sec-Fetch-Site') === 'same-origin';
  return origin === url.origin;
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

// Em HTTPS, o cookie de sessão só pode ser enviado por conexão segura.
function secureCookies(url) {
  return url.protocol === 'https:';
}

async function rateLimited(env, key) {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, started_at) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN started_at < ?3 THEN 1 ELSE count + 1 END,
       started_at = CASE WHEN started_at < ?3 THEN ?2 ELSE started_at END`,
  ).bind(key, now, now - ATTEMPT_WINDOW_MS).run();

  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?1').bind(key).first();
  if (Math.random() < 0.05) {
    await env.DB.prepare('DELETE FROM rate_limits WHERE started_at < ?1').bind(now - CLEANUP_AFTER_MS).run();
  }
  return (row?.count ?? 0) > ATTEMPT_LIMIT;
}

async function startSession(env, userId) {
  const { token, tokenHash } = await createSessionToken();
  const now = new Date();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(tokenHash, userId, now.toISOString(), new Date(now.getTime() + SESSION_TTL_MS).toISOString())
    .run();
  return token;
}

async function currentUser(request, env) {
  const token = parseCookies(request.headers.get('Cookie')).lume_session;
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  const session = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?1').bind(tokenHash).first();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
    return null;
  }
  return await env.DB.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?1').bind(session.user_id).first();
}

async function handleRegister(request, env, url) {
  const body = await readJson(request);
  const name = validateName(body.name);
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first();
  if (existing) {
    return json({ error: 'Este e-mail já tem uma conta no Lume.', field: 'email' }, 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password, bcryptRounds(env.BCRYPT_ROUNDS));
  const createdAt = new Date().toISOString();

  try {
    await env.DB.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(id, name, email, passwordHash, createdAt)
      .run();
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return json({ error: 'Este e-mail já tem uma conta no Lume.', field: 'email' }, 409);
    }
    throw error;
  }

  const token = await startSession(env, id);
  log('account_registered', { userId: id });
  return json(
    { user: { id, name, email, createdAt } },
    201,
    { 'Set-Cookie': sessionCookie(token, { secure: secureCookies(url) }) },
  );
}

async function handleLogin(request, env, url) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  const row = email ? await env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first() : null;
  const valid = row ? await verifyPassword(password, row.password_hash) : false;
  if (!valid) {
    log('login_failed', { email });
    return json({ error: 'E-mail ou senha não conferem.' }, 401);
  }

  const token = await startSession(env, row.id);
  log('login_succeeded', { userId: row.id });
  return json({ user: publicUser(row) }, 200, { 'Set-Cookie': sessionCookie(token, { secure: secureCookies(url) }) });
}

async function handleLogout(request, env, url) {
  const token = parseCookies(request.headers.get('Cookie')).lume_session;
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await hashSessionToken(token)).run();
  }
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store', 'Set-Cookie': clearedSessionCookie({ secure: secureCookies(url) }) },
  });
}

async function handlePasswordRequest(request, env, url) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: 'Escreva o e-mail da sua conta.', field: 'email' }, 400);

  const answer = { message: 'Se este e-mail tiver uma conta no Lume, um link de recuperação foi gerado. Ele vale por 30 minutos.' };
  const row = await env.DB.prepare('SELECT id, email FROM users WHERE email = ?1').bind(email).first();
  if (!row) return json(answer);

  const { token, tokenHash } = await createSessionToken();
  const now = new Date();
  await env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?1').bind(row.id).run();
  await env.DB.prepare('INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(tokenHash, row.id, now.toISOString(), new Date(now.getTime() + RESET_TTL_MS).toISOString())
    .run();

  const link = `${url.origin}/#redefinir?token=${token}`;
  // Sem transporte de e-mail, o link é a única forma de recuperar o acesso.
  // Em produção ele vai para o log (visível só para o dono da conta na Cloudflare),
  // nunca para a resposta da API.
  if (env.SHOW_RESET_LINK === 'false') {
    console.log(JSON.stringify({ event: 'password_reset_link', userId: row.id, link }));
  }
  log('password_reset_requested', { userId: row.id });
  if (env.SHOW_RESET_LINK !== 'false') answer.resetUrl = link;
  return json(answer);
}

async function handlePasswordReset(request, env) {
  const body = await readJson(request);
  const token = typeof body.token === 'string' ? body.token : '';
  const password = validatePassword(body.password);
  if (!token) return json({ error: 'Este link de recuperação está incompleto. Peça um novo.' }, 400);

  const tokenHash = await hashSessionToken(token);
  const reset = await env.DB.prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?1').bind(tokenHash).first();
  if (!reset || reset.used_at) return json({ error: 'Este link não é mais válido. Peça uma nova recuperação.' }, 400);
  if (new Date(reset.expires_at).getTime() <= Date.now()) {
    return json({ error: 'Este link expirou. Peça uma nova recuperação.' }, 400);
  }

  const passwordHash = await hashPassword(password, bcryptRounds(env.BCRYPT_ROUNDS));
  await env.DB.prepare('UPDATE users SET password_hash = ?1 WHERE id = ?2').bind(passwordHash, reset.user_id).run();
  await env.DB.prepare('UPDATE password_resets SET used_at = ?1 WHERE token_hash = ?2').bind(new Date().toISOString(), tokenHash).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(reset.user_id).run();
  log('password_reset_completed', { userId: reset.user_id });
  return json({ message: 'Senha alterada. Você já pode entrar com a nova senha.' });
}

async function handleStateGet(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Entre na sua conta para ver seu progresso.' }, 401);
  const row = await env.DB.prepare('SELECT state, updated_at FROM user_state WHERE user_id = ?1').bind(user.id).first();
  if (!row) return json({ state: null, updatedAt: null });
  let parsed;
  try {
    parsed = JSON.parse(row.state);
  } catch {
    return json({ state: null, updatedAt: row.updated_at });
  }
  return json({ state: parsed, updatedAt: row.updated_at });
}

async function handleStatePut(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Entre na sua conta para salvar seu progresso.' }, 401);

  const text = await request.text();
  if (text.length > MAX_STATE_BYTES) {
    return json({ error: 'O progresso enviado é grande demais.' }, 413);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: 'Progresso em formato inválido.' }, 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return json({ error: 'Progresso em formato inválido.' }, 400);
  }

  const updatedAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_state (user_id, state, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id) DO UPDATE SET state = ?2, updated_at = ?3`,
  ).bind(user.id, text, updatedAt).run();

  log('state_saved', { userId: user.id, bytes: text.length });
  return json({ saved: true, updatedAt });
}

const routes = new Map([
  ['/api/register', handleRegister],
  ['/api/login', handleLogin],
  ['/api/password/request', handlePasswordRequest],
  ['/api/password/reset', handlePasswordReset],
]);

// ---------- Importação de cursos ----------
// O Worker não tem resolvedor DNS: a validação de endereço acontece na URL e em
// cada redirecionamento. O servidor local também resolve o domínio antes de
// conectar. O limite de saída do Worker continua sendo o da conta Cloudflare.

async function readImportBody(request) {
  const text = await request.text();
  if (text.length > MAX_IMPORT_BYTES) throw new ImportError('O conteúdo enviado é grande demais.', 'too_large', 413);
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new ImportError('JSON inválido.', 'invalid_json', 400); }
}

async function handleImportAnalyze(request, env) {
  const body = await readImportBody(request);
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return json({ error: 'Cole o link do curso para analisar.', code: 'missing_url' }, 400);
  const analysis = await analyzeUrl(url);
  const payload = normalizePayload(analysis, { sourceUrl: analysis.sourceUrl || url });
  log('course_analyzed', { provider: payload.provider.id, lessons: payload.lessonCount });
  return json({ status: 'ok', payload, ai: { used: false, reason: 'not_requested' } });
}

async function handleImportOrganize(request, env) {
  const body = await readImportBody(request);
  const text = typeof body.text === 'string' ? body.text : '';
  const title = typeof body.title === 'string' ? body.title : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!text.trim()) return json({ error: 'Cole a grade do curso para organizar.', code: 'empty_text' }, 400);
  const { payload: raw, ai } = await analyzeText(text, { title, env });
  const payload = normalizePayload(
    { ...raw, provider: { id: url ? detectProvider(url).id : 'unknown' }, sourceUrl: url },
    { sourceUrl: url },
  );
  log('course_organized', { provider: payload.provider.id, lessons: payload.lessonCount, ai: ai.used });
  return json({ status: 'ok', payload, ai: { used: ai.used, reason: ai.reason || null } });
}

const importRoutes = new Map([
  ['/api/import/analyze', handleImportAnalyze],
  ['/api/import/organize', handleImportOrganize],
]);

// ---------- Lume Companion ----------

function companionDb(env) {
  return {
    run: async (sql, params = []) => {
      const result = await env.DB.prepare(sql).bind(...params).run();
      return Number(result?.meta?.changes ?? 0);
    },
    first: async (sql, params = []) => env.DB.prepare(sql).bind(...params).first(),
    all: async (sql, params = []) => (await env.DB.prepare(sql).bind(...params).all()).results ?? [],
  };
}

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function handleCompanion(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const dbAdapter = companionDb(env);

  if (pathname === '/api/companion/redeem') {
    if (method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { Allow: 'POST' });
    const clientKey = request.headers.get('CF-Connecting-IP') ?? 'desconhecido';
    if (await rateLimited(env, `companion-redeem|${clientKey}`)) {
      return json({ error: 'Muitas tentativas de conexão. Aguarde alguns minutos.', code: 'rate_limited' }, 429);
    }
    const body = await readJson(request);
    return json(await redeemPairCode(dbAdapter, { code: body.code, deviceName: body.deviceName }), 201);
  }

  if (pathname === '/api/companion/presence' || pathname === '/api/companion/me' || pathname === '/api/companion/study') {
    const device = await authenticateDevice(dbAdapter, bearerToken(request));
    if (!device) {
      return json({ error: 'Este programa não está mais conectado. Gere um novo código no Lume.', code: 'device_unauthorized' }, 401);
    }
    if (pathname === '/api/companion/me') {
      if (method !== 'GET') return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET' });
      return json(await companionSelf(dbAdapter, device));
    }
    if (pathname === '/api/companion/study') {
      if (method !== 'GET') return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET' });
      return json(await studySnapshot(dbAdapter, device));
    }
    if (method === 'PUT') {
      const body = await readJson(request);
      return json(await reportPresence(dbAdapter, device, { app: body.app, category: body.category, since: body.since }));
    }
    if (method === 'DELETE') {
      await clearPresence(dbAdapter, device.id);
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    return json({ error: 'Método não permitido.' }, 405, { Allow: 'PUT, DELETE' });
  }

  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Entre na sua conta para gerenciar o Companion.' }, 401);
  if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);

  if (pathname === '/api/companion' && method === 'GET') return json(await listCompanion(dbAdapter, user.id));
  if (pathname === '/api/companion/pair' && method === 'POST') return json(await createPairCode(dbAdapter, user.id), 201);
  if (pathname.startsWith('/api/companion/devices/') && method === 'DELETE') {
    const deviceId = decodeURIComponent(pathname.slice('/api/companion/devices/'.length));
    return json(await revokeDevice(dbAdapter, user.id, deviceId));
  }
  return json({ error: 'Rota não encontrada.' }, 404);
}

// ---------- Amigos ----------

// ---------- Perfil compartilhado ----------
// O perfil é uma projeção da cópia de estado que a própria pessoa sincronizou.
// Só amigos veem, o e-mail nunca sai e o que não foi autorizado não entra na resposta.

async function handleProfile(request, env, url) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Entre na sua conta para ver perfis.' }, 401);
  if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);

  const friendId = decodeURIComponent(url.pathname.slice('/api/profile/'.length));
  if (!friendId) return json({ error: 'Perfil não encontrado.' }, 404);

  const link = await env.DB.prepare('SELECT 1 AS linked FROM friendships WHERE user_id = ?1 AND friend_id = ?2')
    .bind(user.id, friendId).first();
  if (!link) return json({ error: 'Você só vê o perfil de quem está na sua lista de amigos.' }, 403);

  const target = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?1').bind(friendId).first();
  if (!target) return json({ error: 'Perfil não encontrado.' }, 404);

  const row = await env.DB.prepare('SELECT state, updated_at FROM user_state WHERE user_id = ?1').bind(friendId).first();
  let state = createInitialState();
  if (row?.state) {
    try { state = restoreState(row.state); } catch { state = createInitialState(); }
  }

  return json({
    profile: {
      user: { id: target.id, name: target.name },
      updatedAt: row?.updated_at ?? null,
      ...buildProfile(state),
    },
  });
}

async function handleFriends(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Entre na sua conta para convidar amigos.' }, 401);
  if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);
  const dbAdapter = companionDb(env);

  if (pathname === '/api/friends' && method === 'GET') return json(await listFriends(dbAdapter, user.id));
  if (pathname === '/api/friends/invite' && method === 'POST') return json(await createInvite(dbAdapter, user.id), 201);
  if (pathname === '/api/friends/accept' && method === 'POST') {
    if (await rateLimited(env, `friends-accept|${user.id}`)) {
      return json({ error: 'Muitas tentativas de convite. Aguarde alguns minutos.', code: 'rate_limited' }, 429);
    }
    const body = await readJson(request);
    return json(await acceptInvite(dbAdapter, user.id, body.code));
  }
  if (pathname.startsWith('/api/friends/') && method === 'DELETE') {
    const friendId = decodeURIComponent(pathname.slice('/api/friends/'.length));
    return json(await removeFriend(dbAdapter, user.id, friendId));
  }
  return json({ error: 'Rota não encontrada.' }, 404);
}

async function handleProfileMedia(request, env, url) {
  const { pathname } = url;
  const slot = decodeURIComponent(pathname.slice('/api/profile/media/'.length));
  if (!['PUT', 'DELETE'].includes(request.method)) {
    return json({ error: 'Método não permitido.' }, 405, { Allow: 'PUT, DELETE' });
  }
  if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);
  const user = await currentUser(request, env);
  const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (!user && !isLocalHost) {
    return json({ error: 'Entre na sua conta para enviar imagens do perfil.' }, 401);
  }
  const ownerId = user?.id || 'preview';
  const bucket = r2BucketAdapter(env.MEDIA);

  if (request.method === 'DELETE') {
    return json(await deleteProfileObject(bucket, { ownerId, slot }));
  }

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_MEDIA_BYTES) {
    return json({ error: 'A imagem ultrapassa o limite de 2 MB.', code: 'image_too_large' }, 413);
  }
  const uploaded = await uploadProfileObject(bucket, {
    ownerId,
    slot,
    bytes: new Uint8Array(buffer),
  });
  return json(uploaded, 201);
}

async function handleMediaGet(request, env, url) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, HEAD' });
  }
  const parsed = parseMediaKeyFromPath(url.pathname);
  if (!parsed) return json({ error: 'Imagem não encontrada.' }, 404);
  const bucket = r2BucketAdapter(env.MEDIA);
  if (!bucket) return json({ error: 'Armazenamento de mídia R2 não configurado.' }, 503);
  const object = await bucket.get(parsed.key);
  if (!object) return json({ error: 'Imagem não encontrada.' }, 404);
  const headers = {
    'Content-Type': object.contentType || parsed.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...(object.etag ? { ETag: object.etag } : {}),
  };
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

async function handleApi(request, env, url) {
  const { pathname } = url;

  if (pathname.startsWith('/api/media/')) {
    return handleMediaGet(request, env, url);
  }

  if (pathname.startsWith('/api/profile/media/')) {
    return handleProfileMedia(request, env, url);
  }

  if (pathname.startsWith('/api/profile/')) {
    if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET' });
    return handleProfile(request, env, url);
  }

  if (pathname === '/api/companion' || pathname.startsWith('/api/companion/')) {
    return handleCompanion(request, env, url);
  }
  if (pathname === '/api/friends' || pathname.startsWith('/api/friends/')) {
    return handleFriends(request, env, url);
  }

  if (pathname === '/api/me') {
    if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET' });
    const user = await currentUser(request, env);
    // 200 com user nulo evita ruído de erro no console de quem não está logado.
    return json({ authenticated: Boolean(user), user: user ? publicUser(user) : null });
  }

  if (pathname === '/api/logout') {
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { Allow: 'POST' });
    if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);
    return handleLogout(request, env, url);
  }

  if (pathname === '/api/state') {
    if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET, PUT' });
    if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);
    return request.method === 'GET' ? handleStateGet(request, env) : handleStatePut(request, env);
  }

  const handler = routes.get(pathname);
  const importHandler = importRoutes.get(pathname);
  if (!handler && !importHandler) return json({ error: 'Rota não encontrada.' }, 404);
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { Allow: 'POST' });
  if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);

  const clientKey = request.headers.get('CF-Connecting-IP') ?? 'desconhecido';
  // Análise de link é mais cara que login: limite próprio, sem tocar no de autenticação.
  if (importHandler) {
    if (await rateLimited(env, `import|${clientKey}|${pathname}`)) {
      return json({ error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.', code: 'rate_limited' }, 429);
    }
    try {
      return await importHandler(request, env);
    } catch (error) {
      if (error instanceof ImportError) return json({ error: error.message, code: error.code }, error.status);
      throw error;
    }
  }
  if (await rateLimited(env, `${clientKey}|${pathname}`)) {
    return json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }, 429);
  }

  return handler(request, env, url);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      return await handleApi(request, env, url);
    } catch (error) {
      if (error instanceof ValidationError) {
        return json({ error: error.message, field: error.field }, 400);
      }
      if (error instanceof ImportError) {
        return json({ error: error.message, code: error.code }, error.status);
      }
      if (error instanceof CompanionError) {
        return json({ error: error.message, code: error.code }, error.status);
      }
      if (error instanceof FriendsError) {
        return json({ error: error.message, code: error.code }, error.status);
      }
      if (error instanceof MediaError) {
        return json({ error: error.message, code: error.code }, error.status);
      }
      if (error?.status) {
        return json({ error: error.message }, error.status);
      }
      console.error(JSON.stringify({
        event: 'unhandled_error',
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }));
      return json({ error: 'Não foi possível concluir a operação.' }, 500);
    }
  },
};
