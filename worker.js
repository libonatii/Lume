import {
  ValidationError, SESSION_TTL_MS, RESET_TTL_MS, DEFAULT_ITERATIONS,
  validateName, validateEmail, validatePassword, normalizeEmail,
  hashPassword, verifyPassword, createSessionToken, hashSessionToken,
  sessionCookie, clearedSessionCookie, parseCookies,
} from './auth.js';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_STATE_BYTES = 256 * 1024;
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

function iterations(env) {
  const configured = Number(env.PBKDF2_ITERATIONS);
  return Number.isInteger(configured) && configured >= 1000 ? configured : DEFAULT_ITERATIONS;
}

// O plano gratuito não tem CPU para PBKDF2 seguro; em produção o cookie vai com Secure.
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
  const passwordHash = await hashPassword(password, iterations(env));
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

  const passwordHash = await hashPassword(password, iterations(env));
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

async function handleApi(request, env, url) {
  const { pathname } = url;

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
  if (!handler) return json({ error: 'Rota não encontrada.' }, 404);
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { Allow: 'POST' });
  if (!sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);

  const clientKey = request.headers.get('CF-Connecting-IP') ?? 'desconhecido';
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
