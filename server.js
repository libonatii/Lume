import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  ValidationError, SESSION_TTL_MS, RESET_TTL_MS, DEFAULT_ITERATIONS,
  validateName, validateEmail, validatePassword, normalizeEmail,
  hashPassword, verifyPassword, createSessionToken, hashSessionToken,
  sessionCookie, clearedSessionCookie, parseCookies,
} from './auth.js';

// Servidor local (Node) com o mesmo contrato de API do Worker em worker.js.
// Serve os arquivos de public/ e guarda contas em data/lume.db.

const port = Number(process.env.PORT || 4173);
const MAX_BODY_BYTES = 16 * 1024;
const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ITERATIONS = Number(process.env.PBKDF2_ITERATIONS) || DEFAULT_ITERATIONS;

const staticFiles = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['public/index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
  ['/neurofocus.css', ['public/neurofocus.css', 'text/css; charset=utf-8']],
  ['/entry.css', ['public/entry.css', 'text/css; charset=utf-8']],
  ['/motion.css', ['public/motion.css', 'text/css; charset=utf-8']],
  ['/stitch.css', ['public/stitch.css', 'text/css; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/domain.js', ['public/domain.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['public/favicon.svg', 'image/svg+xml']],
]);
for (const name of ['logo', 'calm', 'design', 'code', 'language', 'nature', 'detail', 'welcome']) {
  staticFiles.set(`/assets/stitch/${name}.png`, [`public/assets/stitch/${name}.png`, 'image/png']);
}
for (const name of ['plus-jakarta-sans-latin', 'plus-jakarta-sans-latin-ext']) {
  staticFiles.set(`/assets/fonts/${name}.woff2`, [`public/assets/fonts/${name}.woff2`, 'font/woff2']);
}

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

// ---------- Banco local ----------

const dataDirectory = fileURLToPath(new URL('./data/', import.meta.url));
mkdirSync(dataDirectory, { recursive: true });
const db = new DatabaseSync(fileURLToPath(new URL('./data/lume.db', import.meta.url)));
db.exec(readFileSync(fileURLToPath(new URL('./migrations/0001_init.sql', import.meta.url)), 'utf8'));
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const findUserById = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?');
const insertUser = db.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)');
const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
const findSession = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
const deleteUserSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
const insertReset = db.prepare('INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
const findReset = db.prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?');
const useReset = db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?');
const deleteUserResets = db.prepare('DELETE FROM password_resets WHERE user_id = ?');
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
const insertAttempt = db.prepare(
  `INSERT INTO rate_limits (key, count, started_at) VALUES (?, 1, ?)
   ON CONFLICT(key) DO UPDATE SET
     count = CASE WHEN started_at < ? THEN 1 ELSE count + 1 END,
     started_at = CASE WHEN started_at < ? THEN ? ELSE started_at END`,
);
const findAttempt = db.prepare('SELECT count FROM rate_limits WHERE key = ?');
const clearOldAttempts = db.prepare('DELETE FROM rate_limits WHERE started_at < ?');

// ---------- Utilidades ----------

function send(response, status, body, extraHeaders = {}) {
  const payload = body === undefined ? null : JSON.stringify(body);
  response.writeHead(status, {
    ...baseHeaders,
    ...(payload ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    ...extraHeaders,
  });
  response.end(payload ?? undefined);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Corpo grande demais.'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON inválido.'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return request.headers['sec-fetch-site'] === 'same-origin';
  return origin === `http://${request.headers.host}` || origin === `https://${request.headers.host}`;
}

function secureCookies(request) {
  return request.headers['x-forwarded-proto'] === 'https';
}

function tooManyAttempts(key) {
  const now = Date.now();
  insertAttempt.run(key, now, now - ATTEMPT_WINDOW_MS, now - ATTEMPT_WINDOW_MS, now);
  const row = findAttempt.get(key);
  clearOldAttempts.run(now - 24 * 60 * 60 * 1000);
  return (row?.count ?? 0) > ATTEMPT_LIMIT;
}

async function currentUser(request) {
  const token = parseCookies(request.headers.cookie).lume_session;
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  const session = findSession.get(tokenHash);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    deleteSession.run(tokenHash);
    return null;
  }
  return findUserById.get(session.user_id) ?? null;
}

async function startSession(userId) {
  const { token, tokenHash } = await createSessionToken();
  const now = new Date();
  insertSession.run(tokenHash, userId, now.toISOString(), new Date(now.getTime() + SESSION_TTL_MS).toISOString());
  return token;
}

// ---------- Rotas ----------

async function handleRegister(request, response) {
  const body = await readJsonBody(request);
  const name = validateName(body.name);
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);

  if (findUserByEmail.get(email)) {
    return send(response, 409, { error: 'Este e-mail já tem uma conta no Lume.', field: 'email' });
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password, ITERATIONS);
  try {
    insertUser.run(id, name, email, passwordHash, new Date().toISOString());
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return send(response, 409, { error: 'Este e-mail já tem uma conta no Lume.', field: 'email' });
    }
    throw error;
  }

  const token = await startSession(id);
  return send(response, 201, { user: { id, name, email, createdAt: new Date().toISOString() } }, {
    'Set-Cookie': sessionCookie(token, { secure: secureCookies(request) }),
  });
}

async function handleLogin(request, response) {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const row = email ? findUserByEmail.get(email) : null;
  const valid = row ? await verifyPassword(password, row.password_hash) : false;
  if (!valid) return send(response, 401, { error: 'E-mail ou senha não conferem.' });

  const token = await startSession(row.id);
  return send(response, 200, { user: publicUser(row) }, {
    'Set-Cookie': sessionCookie(token, { secure: secureCookies(request) }),
  });
}

async function handleLogout(request, response) {
  const token = parseCookies(request.headers.cookie).lume_session;
  if (token) deleteSession.run(await hashSessionToken(token));
  send(response, 204, undefined, { 'Set-Cookie': clearedSessionCookie({ secure: secureCookies(request) }) });
}

async function handlePasswordRequest(request, response) {
  const body = await readJsonBody(request);
  const email = normalizeEmail(body.email);
  if (!email) return send(response, 400, { error: 'Escreva o e-mail da sua conta.', field: 'email' });

  const answer = { message: 'Se este e-mail tiver uma conta no Lume, um link de recuperação foi gerado. Ele vale por 30 minutos.' };
  const row = findUserByEmail.get(email);
  if (!row) return send(response, 200, answer);

  const { token, tokenHash } = await createSessionToken();
  const now = new Date();
  deleteUserResets.run(row.id);
  insertReset.run(tokenHash, row.id, now.toISOString(), new Date(now.getTime() + RESET_TTL_MS).toISOString());

  const link = `http://${request.headers.host}/#redefinir?token=${token}`;
  console.log(`Link de recuperação para ${row.email}: ${link}`);
  if (process.env.LUME_SHOW_RESET_LINK !== 'false') answer.resetUrl = link;
  return send(response, 200, answer);
}

async function handlePasswordReset(request, response) {
  const body = await readJsonBody(request);
  const token = typeof body.token === 'string' ? body.token : '';
  const password = validatePassword(body.password);
  if (!token) return send(response, 400, { error: 'Este link de recuperação está incompleto. Peça um novo.' });

  const tokenHash = await hashSessionToken(token);
  const reset = findReset.get(tokenHash);
  if (!reset || reset.used_at) return send(response, 400, { error: 'Este link não é mais válido. Peça uma nova recuperação.' });
  if (new Date(reset.expires_at).getTime() <= Date.now()) {
    return send(response, 400, { error: 'Este link expirou. Peça uma nova recuperação.' });
  }

  updatePassword.run(await hashPassword(password, ITERATIONS), reset.user_id);
  useReset.run(new Date().toISOString(), tokenHash);
  deleteUserSessions.run(reset.user_id);
  return send(response, 200, { message: 'Senha alterada. Você já pode entrar com a nova senha.' });
}

const apiRoutes = new Map([
  ['/api/register', handleRegister],
  ['/api/login', handleLogin],
  ['/api/password/request', handlePasswordRequest],
  ['/api/password/reset', handlePasswordReset],
]);

const server = http.createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');

  try {
    if (pathname === '/api/me' && request.method === 'GET') {
      const user = await currentUser(request);
      return send(response, 200, { authenticated: Boolean(user), user: user ? publicUser(user) : null });
    }
    if (pathname === '/api/logout' && request.method === 'POST') {
      if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });
      return await handleLogout(request, response);
    }

    if (pathname.startsWith('/api/')) {
      const handler = apiRoutes.get(pathname);
      if (!handler) return send(response, 404, { error: 'Rota não encontrada.' });
      if (request.method !== 'POST') return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'POST' });
      if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });
      const key = `${request.socket.remoteAddress}|${pathname}`;
      if (tooManyAttempts(key)) {
        return send(response, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
      }
      return await handler(request, response);
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { ...baseHeaders, Allow: 'GET, HEAD' });
      response.end();
      return;
    }
    const entry = staticFiles.get(pathname);
    if (!entry) {
      response.writeHead(404, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Página não encontrada.');
      return;
    }
    const data = await readFile(fileURLToPath(new URL(entry[0], import.meta.url)));
    response.writeHead(200, { ...baseHeaders, 'Content-Type': entry[1] });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error instanceof ValidationError) return send(response, 400, { error: error.message, field: error.field });
    if (error?.status) return send(response, error.status, { error: error.message });
    console.error(error);
    if (!response.headersSent) send(response, 500, { error: 'Não foi possível concluir a operação.' });
    else response.end();
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `A porta ${port} já está em uso. Escolha outra com a variável PORT.`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Lume está disponível em http://localhost:${port}`);
  console.log('Contas e sessões ficam em data/lume.db neste computador.');
});
