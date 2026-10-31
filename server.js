import http from 'node:http';
import dns from 'node:dns/promises';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  ValidationError, SESSION_TTL_MS, RESET_TTL_MS, bcryptRounds,
  validateName, validateEmail, validatePassword, normalizeEmail,
  hashPassword, verifyPassword, createSessionToken, hashSessionToken,
  sessionCookie, clearedSessionCookie, parseCookies,
} from './auth.js';
import { ImportError, analyzeUrl, analyzeText } from './import-server.js';
import { normalizePayload, detectProvider } from './public/import-domain.js';
import {
  CompanionError, authenticateDevice, clearPresence, companionSelf, createPairCode,
  listCompanion, redeemPairCode, reportPresence, revokeDevice, studySnapshot,
} from './companion.js';
import {
  FriendsError, acceptInvite, createInvite, listFriends, removeFriend,
} from './friends.js';
import {
  MediaError, MAX_MEDIA_BYTES, deleteProfileObject, parseMediaKeyFromPath,
  uploadProfileObject,
} from './media.js';
import { buildProfile } from './public/profile-domain.js';
import { createInitialState, restoreState } from './public/domain.js';

// Servidor local (Node) com o mesmo contrato de API do Worker em worker.js.
// Serve o build estático do Astro e guarda contas em data/lume.db.

const port = Number(process.env.PORT || 4173);
const MAX_BODY_BYTES = 16 * 1024;
const MAX_STATE_BYTES = 256 * 1024;
const MAX_IMPORT_BYTES = 96 * 1024;
const ATTEMPT_LIMIT = Math.max(1, Math.min(Number(process.env.LUME_ATTEMPT_LIMIT) || 10, 1000));
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const BCRYPT_ROUNDS = bcryptRounds(process.env.BCRYPT_ROUNDS);

const staticFiles = new Map();
const mime = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', json: 'application/json' };
const dist = fileURLToPath(new URL('./dist/', import.meta.url));
if (existsSync(dist)) {
  for (const file of readdirSync(dist, { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || file.name.startsWith('_') || file.name.startsWith('.')) continue;
    const absolute = join(file.parentPath, file.name);
    const relative = absolute.slice(dist.length).replaceAll('\\', '/');
    const extension = file.name.split('.').pop();
    staticFiles.set(`/${relative}`, [absolute, mime[extension] || 'application/octet-stream']);
  }
  if (staticFiles.has('/index.html')) staticFiles.set('/', staticFiles.get('/index.html'));
}
const headersFile = join(dist, '_headers');
const builtCsp = existsSync(headersFile) ? readFileSync(headersFile, 'utf8').match(/Content-Security-Policy: (.+)/)?.[1] : null;

const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': builtCsp || "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

// ---------- Banco local ----------

const dataDirectory = process.env.LUME_DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url));
mkdirSync(dataDirectory, { recursive: true });
const db = new DatabaseSync(join(dataDirectory, 'lume.db'));
const migrationsDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));
for (const file of readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql')).sort()) {
  db.exec(readFileSync(join(migrationsDirectory, file), 'utf8'));
}
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
const findState = db.prepare('SELECT state, updated_at FROM user_state WHERE user_id = ?');
const saveState = db.prepare(
  `INSERT INTO user_state (user_id, state, updated_at) VALUES (?, ?, ?)
   ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
);

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

function readRawBytes(request, limit = MAX_MEDIA_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Corpo grande demais.'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    request.on('error', reject);
  });
}

function readRawBody(request, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Corpo grande demais.'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

async function readJsonBody(request, limit = MAX_BODY_BYTES) {
  const text = await readRawBody(request, limit);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('JSON inválido.'), { status: 400 });
  }
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

function tooManyAttempts(key, limit = ATTEMPT_LIMIT) {
  const now = Date.now();
  insertAttempt.run(key, now, now - ATTEMPT_WINDOW_MS, now - ATTEMPT_WINDOW_MS, now);
  const row = findAttempt.get(key);
  clearOldAttempts.run(now - 24 * 60 * 60 * 1000);
  return (row?.count ?? 0) > limit;
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
  const passwordHash = await hashPassword(password, BCRYPT_ROUNDS);
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

  updatePassword.run(await hashPassword(password, BCRYPT_ROUNDS), reset.user_id);
  useReset.run(new Date().toISOString(), tokenHash);
  deleteUserSessions.run(reset.user_id);
  return send(response, 200, { message: 'Senha alterada. Você já pode entrar com a nova senha.' });
}

async function handleStateGet(request, response) {
  const user = await currentUser(request);
  if (!user) return send(response, 401, { error: 'Entre na sua conta para ver seu progresso.' });
  const row = findState.get(user.id);
  if (!row) return send(response, 200, { state: null, updatedAt: null });
  try {
    return send(response, 200, { state: JSON.parse(row.state), updatedAt: row.updated_at });
  } catch {
    return send(response, 200, { state: null, updatedAt: row.updated_at });
  }
}

async function handleStatePut(request, response) {
  const user = await currentUser(request);
  if (!user) return send(response, 401, { error: 'Entre na sua conta para salvar seu progresso.' });

  const raw = await readRawBody(request, MAX_STATE_BYTES);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return send(response, 400, { error: 'Progresso em formato inválido.' });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return send(response, 400, { error: 'Progresso em formato inválido.' });
  }

  const updatedAt = new Date().toISOString();
  saveState.run(user.id, raw, updatedAt);
  return send(response, 200, { saved: true, updatedAt });
}

const apiRoutes = new Map([
  ['/api/register', handleRegister],
  ['/api/login', handleLogin],
  ['/api/password/request', handlePasswordRequest],
  ['/api/password/reset', handlePasswordReset],
]);

// ---------- Importação de cursos ----------

// Resolve o domínio antes de conectar: impede apontar para a rede interna.
async function lookupPublicHost(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function importFailure(response, error) {
  const status = error instanceof ImportError ? error.status : 422;
  return send(response, status, { error: error.message, code: error.code || 'import_failed' });
}

async function handleImportAnalyze(request, response) {
  const body = await readJsonBody(request, MAX_IMPORT_BYTES);
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) return send(response, 400, { error: 'Cole o link do curso para analisar.', code: 'missing_url' });
  try {
    const analysis = await analyzeUrl(url, { lookup: lookupPublicHost });
    const payload = normalizePayload(analysis, { sourceUrl: analysis.sourceUrl || url });
    return send(response, 200, { status: 'ok', payload, ai: { used: false, reason: 'not_requested' } });
  } catch (error) {
    if (error instanceof ImportError) return importFailure(response, error);
    throw error;
  }
}

async function handleImportOrganize(request, response) {
  const body = await readJsonBody(request, MAX_IMPORT_BYTES);
  const text = typeof body.text === 'string' ? body.text : '';
  const title = typeof body.title === 'string' ? body.title : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!text.trim()) return send(response, 400, { error: 'Cole a grade do curso para organizar.', code: 'empty_text' });
  try {
    const { payload: raw, ai } = await analyzeText(text, { title, env: process.env });
    const payload = normalizePayload(
      { ...raw, provider: { id: url ? detectProvider(url).id : 'unknown' }, sourceUrl: url },
      { sourceUrl: url },
    );
    return send(response, 200, { status: 'ok', payload, ai: { used: ai.used, reason: ai.reason || null } });
  } catch (error) {
    if (error instanceof ImportError) return importFailure(response, error);
    throw error;
  }
}

const importRoutes = new Map([
  ['/api/import/analyze', handleImportAnalyze],
  ['/api/import/organize', handleImportOrganize],
]);

// ---------- Lume Companion ----------

function companionDb() {
  return {
    run: async (sql, params = []) => Number(db.prepare(sql).run(...params).changes ?? 0),
    first: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
    all: async (sql, params = []) => db.prepare(sql).all(...params),
  };
}

function bearerToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function requireCompanionDevice(request, response) {
  const device = await authenticateDevice(companionDb(), bearerToken(request));
  if (!device) {
    send(response, 401, { error: 'Este programa não está mais conectado. Gere um novo código no Lume.', code: 'device_unauthorized' });
    return null;
  }
  return device;
}

// Sempre responde: quem chama só precisa saber que a rota é do Companion.
async function handleCompanionRoute(request, response, pathname) {
  const method = request.method;
  const dbAdapter = companionDb();

  if (pathname === '/api/companion/redeem') {
    if (method !== 'POST') return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'POST' });
    if (tooManyAttempts(`companion-redeem|${request.socket.remoteAddress}`, 20)) {
      return send(response, 429, { error: 'Muitas tentativas de conexão. Aguarde alguns minutos.', code: 'rate_limited' });
    }
    const body = await readJsonBody(request, 8 * 1024);
    return send(response, 201, await redeemPairCode(dbAdapter, { code: body.code, deviceName: body.deviceName }));
  }

  if (pathname === '/api/companion/presence' || pathname === '/api/companion/me' || pathname === '/api/companion/study') {
    const device = await requireCompanionDevice(request, response);
    if (!device) return true;
    if (pathname === '/api/companion/me') {
      if (method !== 'GET') return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'GET' });
      return send(response, 200, await companionSelf(dbAdapter, device));
    }
    if (pathname === '/api/companion/study') {
      if (method !== 'GET') return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'GET' });
      return send(response, 200, await studySnapshot(dbAdapter, device));
    }
    if (method === 'PUT') {
      const body = await readJsonBody(request, 8 * 1024);
      return send(response, 200, await reportPresence(dbAdapter, device, {
        app: body.app, category: body.category, since: body.since,
      }));
    }
    if (method === 'DELETE') {
      await clearPresence(dbAdapter, device.id);
      return send(response, 204, undefined);
    }
    return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'PUT, DELETE' });
  }

  // Daqui para baixo, a autoridade é a sessão do navegador.
  const user = await currentUser(request);
  if (!user) return send(response, 401, { error: 'Entre na sua conta para gerenciar o Companion.' });
  if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });

  if (pathname === '/api/companion' && method === 'GET') {
    return send(response, 200, await listCompanion(dbAdapter, user.id));
  }
  if (pathname === '/api/companion/pair' && method === 'POST') {
    return send(response, 201, await createPairCode(dbAdapter, user.id));
  }
  if (pathname.startsWith('/api/companion/devices/') && method === 'DELETE') {
    const deviceId = decodeURIComponent(pathname.slice('/api/companion/devices/'.length));
    return send(response, 200, await revokeDevice(dbAdapter, user.id, deviceId));
  }
  return send(response, 404, { error: 'Rota não encontrada.' });
}

// ---------- Amigos ----------

async function handleFriendsRoute(request, response, pathname) {
  const method = request.method;
  const user = await currentUser(request);
  if (!user) return send(response, 401, { error: 'Entre na sua conta para convidar amigos.' });
  if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });

  if (pathname === '/api/friends' && method === 'GET') {
    return send(response, 200, await listFriends(companionDb(), user.id));
  }
  if (pathname === '/api/friends/invite' && method === 'POST') {
    return send(response, 201, await createInvite(companionDb(), user.id));
  }
  if (pathname === '/api/friends/accept' && method === 'POST') {
    if (tooManyAttempts(`friends-accept|${user.id}`, 20)) {
      return send(response, 429, { error: 'Muitas tentativas de convite. Aguarde alguns minutos.', code: 'rate_limited' });
    }
    const body = await readJsonBody(request, 4 * 1024);
    return send(response, 200, await acceptInvite(companionDb(), user.id, body.code));
  }
  if (pathname.startsWith('/api/friends/') && method === 'DELETE') {
    const friendId = decodeURIComponent(pathname.slice('/api/friends/'.length));
    return send(response, 200, await removeFriend(companionDb(), user.id, friendId));
  }
  return send(response, 404, { error: 'Rota não encontrada.' });
}

async function handleProfileRoute(request, response, pathname) {
  const user = await currentUser(request);
  if (!user) return send(response, 401, { error: 'Entre na sua conta para ver perfis.' });
  if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });
  if (request.method !== 'GET') return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'GET' });

  const friendId = decodeURIComponent(pathname.slice('/api/profile/'.length));
  if (!friendId) return send(response, 404, { error: 'Perfil não encontrado.' });

  const linked = db.prepare('SELECT 1 AS linked FROM friendships WHERE user_id = ? AND friend_id = ?').get(user.id, friendId);
  if (!linked) return send(response, 403, { error: 'Você só vê o perfil de quem está na sua lista de amigos.' });

  const target = findUserById.get(friendId);
  if (!target) return send(response, 404, { error: 'Perfil não encontrado.' });

  const row = db.prepare('SELECT state, updated_at FROM user_state WHERE user_id = ?').get(friendId);
  let state = createInitialState();
  if (row?.state) {
    try { state = restoreState(row.state); } catch { state = createInitialState(); }
  }

  return send(response, 200, {
    profile: {
      user: { id: target.id, name: target.name },
      updatedAt: row?.updated_at ?? null,
      ...buildProfile(state),
    },
  });
}

const mediaRoot = join(dataDirectory, 'media');
mkdirSync(mediaRoot, { recursive: true });

const localMediaBucket = {
  async put(key, bytes) {
    const targetPath = join(mediaRoot, ...key.split('/'));
    mkdirSync(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, bytes);
  },
  async get(key) {
    const targetPath = join(mediaRoot, ...key.split('/'));
    if (!existsSync(targetPath)) return null;
    const body = await readFile(targetPath);
    return { body, contentType: null, etag: null };
  },
  async delete(key) {
    const targetPath = join(mediaRoot, ...key.split('/'));
    await rm(targetPath, { force: true });
  },
  async listKeys(prefix) {
    const parts = prefix.split('/');
    const filenamePrefix = parts.pop() || '';
    const folderPath = join(mediaRoot, ...parts);
    if (!existsSync(folderPath)) return [];
    const folderKey = parts.join('/');
    return readdirSync(folderPath, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.startsWith(filenamePrefix))
      .map(entry => `${folderKey}/${entry.name}`);
  },
};

async function handleProfileMediaRoute(request, response, pathname) {
  const slot = decodeURIComponent(pathname.slice('/api/profile/media/'.length));
  if (!['PUT', 'DELETE'].includes(request.method)) {
    return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'PUT, DELETE' });
  }
  if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });
  const user = await currentUser(request);
  const ownerId = user?.id || 'preview';

  if (request.method === 'DELETE') {
    const result = await deleteProfileObject(localMediaBucket, { ownerId, slot });
    return send(response, 200, result);
  }

  const bytes = await readRawBytes(request, MAX_MEDIA_BYTES);
  const uploaded = await uploadProfileObject(localMediaBucket, { ownerId, slot, bytes });
  return send(response, 201, uploaded);
}

async function handleMediaGetRoute(request, response, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'GET, HEAD' });
  }
  const parsed = parseMediaKeyFromPath(pathname);
  if (!parsed) return send(response, 404, { error: 'Imagem não encontrada.' });
  const object = await localMediaBucket.get(parsed.key);
  if (!object) return send(response, 404, { error: 'Imagem não encontrada.' });
  response.writeHead(200, {
    ...baseHeaders,
    'Content-Type': object.contentType || parsed.contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  response.end(request.method === 'HEAD' ? undefined : object.body);
}

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
    if (pathname === '/api/state') {
      if (!['GET', 'PUT'].includes(request.method)) {
        return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'GET, PUT' });
      }
      if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });
      return request.method === 'GET' ? await handleStateGet(request, response) : await handleStatePut(request, response);
    }

    if (pathname.startsWith('/api/media/')) {
      return await handleMediaGetRoute(request, response, pathname);
    }

    if (pathname.startsWith('/api/profile/media/')) {
      return await handleProfileMediaRoute(request, response, pathname);
    }

    if (pathname.startsWith('/api/profile/')) {
      return await handleProfileRoute(request, response, pathname);
    }
    if (pathname.startsWith('/api/companion')) {
      return await handleCompanionRoute(request, response, pathname);
    }
    if (pathname.startsWith('/api/friends')) {
      return await handleFriendsRoute(request, response, pathname);
    }

    if (pathname.startsWith('/api/')) {
      const importHandler = importRoutes.get(pathname);
      if (importHandler) {
        if (request.method !== 'POST') return send(response, 405, { error: 'Método não permitido.' }, { Allow: 'POST' });
        if (!sameOrigin(request)) return send(response, 403, { error: 'Origem não autorizada.' });
        const importKey = `import|${request.socket.remoteAddress}|${pathname}`;
        if (tooManyAttempts(importKey, 30)) {
          return send(response, 429, { error: 'Muitas análises em pouco tempo. Aguarde alguns minutos.', code: 'rate_limited' });
        }
        return await importHandler(request, response);
      }
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
    const data = await readFile(entry[0]);
    response.writeHead(200, { ...baseHeaders, 'Content-Type': entry[1] });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error instanceof ValidationError) return send(response, 400, { error: error.message, field: error.field });
    if (error instanceof ImportError) return send(response, error.status, { error: error.message, code: error.code });
    if (error instanceof CompanionError) return send(response, error.status, { error: error.message, code: error.code });
    if (error instanceof FriendsError) return send(response, error.status, { error: error.message, code: error.code });
    if (error instanceof MediaError) return send(response, error.status, { error: error.message, code: error.code });
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
