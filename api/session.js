// Sessão por cookie e limite de tentativas, sobre o adaptador de banco
// ({ run, first, all, batch }) — o mesmo código no SQLite local e no D1.

import { SESSION_TTL_MS, createSessionToken, hashSessionToken, parseCookies } from '../auth.js';
import { ATTEMPT_CLEANUP_MS, ATTEMPT_WINDOW_MS } from './config.js';

export function sessionTokenFrom(request) {
  return parseCookies(request.headers.get('Cookie')).lume_session || '';
}

export async function currentUser(db, request, now = Date.now()) {
  const token = sessionTokenFrom(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  const session = await db.first('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?', [tokenHash]);
  if (!session) return null;
  if (Date.parse(session.expires_at) <= now) {
    await db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    return null;
  }
  return db.first('SELECT id, name, email, created_at FROM users WHERE id = ?', [session.user_id]);
}

export async function startSession(db, userId, now = Date.now()) {
  const { token, tokenHash } = await createSessionToken();
  await db.run(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [tokenHash, userId, new Date(now).toISOString(), new Date(now + SESSION_TTL_MS).toISOString()],
  );
  return token;
}

export function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

// Janela fixa por chave. A limpeza das chaves antigas é amostrada para não
// custar uma escrita extra em toda requisição.
export async function tooManyAttempts(db, key, limit, now = Date.now()) {
  const windowStart = now - ATTEMPT_WINDOW_MS;
  await db.run(
    `INSERT INTO rate_limits (key, count, started_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN started_at < ? THEN 1 ELSE count + 1 END,
       started_at = CASE WHEN started_at < ? THEN ? ELSE started_at END`,
    [key, now, windowStart, windowStart, now],
  );
  const row = await db.first('SELECT count FROM rate_limits WHERE key = ?', [key]);
  if (Math.random() < 0.05) {
    await db.run('DELETE FROM rate_limits WHERE started_at < ?', [now - ATTEMPT_CLEANUP_MS]);
  }
  return (row?.count ?? 0) > limit;
}
