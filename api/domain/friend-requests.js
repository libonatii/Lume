// Solicitações de amizade por @usuário.
//
// - o @usuário é a única forma de achar alguém pelo nome; não há busca por
//   e-mail e a busca exige o @ exato (sem lista nem sugestão);
// - a amizade só começa quando a outra pessoa aceita; se as duas se pedirem ao
//   mesmo tempo, vira amizade na hora;
// - pedir, aceitar ou recusar não concedem XP; quem bloqueou (ou foi bloqueada)
//   não aparece na busca.

import { AppError } from '../errors.js';
import { sanitizeProfileImage } from '../../public/domain.js';
import { normalizeSharing } from '../../public/profile-domain.js';
import { MAX_FRIENDS } from './friends.js';

export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._]{2,23}$/;
export const MAX_PENDING_SENT = 50;

function iso(now) { return new Date(now).toISOString(); }

export function normalizeHandle(value) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase();
}

export function slugifyHandle(name) {
  const slug = String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 20);
  return slug.length >= 3 ? slug : `${slug || 'lume'}.estudo`.slice(0, 20);
}

function parseJson(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function person(db, userId) {
  const row = await db.first(
    `SELECT u.id, u.name, h.handle, ad.data AS account_doc
       FROM users u
       LEFT JOIN user_handles h ON h.user_id = u.id
       LEFT JOIN account_documents ad ON ad.user_id = u.id
      WHERE u.id = ?`,
    [userId],
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    handle: row.handle || null,
    avatar: sanitizeProfileImage(parseJson(row.account_doc)?.profile?.avatar),
  };
}

export async function userIdByHandle(db, raw) {
  const handle = normalizeHandle(raw);
  if (!HANDLE_PATTERN.test(handle)) return null;
  return (await db.first('SELECT user_id FROM user_handles WHERE handle = ?', [handle]))?.user_id || null;
}

export async function getHandle(db, userId) {
  const row = await db.first('SELECT handle FROM user_handles WHERE user_id = ?', [userId]);
  return row?.handle || null;
}

// Cria o @usuário a partir do nome, na primeira vez em que a pessoa usa o recurso.
export async function ensureHandle(db, userId, now = Date.now()) {
  const current = await getHandle(db, userId);
  if (current) return current;
  const user = await db.first('SELECT name FROM users WHERE id = ?', [userId]);
  if (!user) throw new AppError('Conta não encontrada.', 'not_found', 404);
  const base = slugifyHandle(user.name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? '' : String(Math.floor(Math.random() * 900) + 100);
    const handle = `${base.slice(0, 24 - suffix.length)}${suffix}`;
    const taken = await db.first('SELECT 1 AS ok FROM user_handles WHERE handle = ?', [handle]);
    if (taken) continue;
    await db.run('INSERT OR IGNORE INTO user_handles (user_id, handle, created_at) VALUES (?, ?, ?)', [userId, handle, iso(now)]);
    return (await getHandle(db, userId)) || handle;
  }
  throw new AppError('Não foi possível criar seu @usuário agora. Escolha um manualmente.', 'handle_unavailable', 409);
}

// Disponibilidade para o cadastro e para a troca em Configurações. O @usuário que
// já é da própria pessoa conta como disponível.
export async function checkHandle(db, raw, userId = null) {
  const handle = normalizeHandle(raw);
  if (!HANDLE_PATTERN.test(handle) || handle.endsWith('.')) {
    return { handle, available: false, reason: 'invalid', message: 'Use de 3 a 24 letras minúsculas, números, ponto ou sublinhado.' };
  }
  const taken = await db.first('SELECT user_id FROM user_handles WHERE handle = ?', [handle]);
  if (taken && taken.user_id !== userId) return { handle, available: false, reason: 'taken', message: 'Esse @usuário já está em uso.' };
  return { handle, available: true, message: 'Disponível.' };
}

export async function setHandle(db, userId, raw, now = Date.now()) {
  const handle = normalizeHandle(raw);
  if (!HANDLE_PATTERN.test(handle) || handle.endsWith('.')) {
    throw new AppError('Use de 3 a 24 letras minúsculas, números, ponto ou sublinhado.', 'invalid_handle', 400);
  }
  const taken = await db.first('SELECT user_id FROM user_handles WHERE handle = ?', [handle]);
  if (taken && taken.user_id !== userId) throw new AppError('Esse @usuário já está em uso.', 'handle_taken', 409);
  await db.run(
    `INSERT INTO user_handles (user_id, handle, created_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET handle = excluded.handle`,
    [userId, handle, iso(now)],
  );
  return { handle };
}

async function blockedBetween(db, a, b) {
  const row = await db.first(
    'SELECT 1 AS ok FROM contact_blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)',
    [a, b, b, a],
  );
  return Boolean(row);
}

async function relation(db, userId, otherId) {
  if (userId === otherId) return { status: 'self' };
  if (await db.first('SELECT 1 AS ok FROM friendships WHERE user_id = ? AND friend_id = ?', [userId, otherId])) return { status: 'friends' };
  const sent = await db.first('SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?', [userId, otherId]);
  if (sent) return { status: 'sent', requestId: sent.id };
  const received = await db.first('SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?', [otherId, userId]);
  if (received) return { status: 'received', requestId: received.id };
  return { status: 'none' };
}

// Perfil público vem ligado (preferences.sharing.public); desligado, a pessoa não
// aparece na busca por @usuário e só amigos abrem o perfil.
async function isPublicProfile(db, userId) {
  // Só a preferência: não precisa montar a biblioteca inteira para isso.
  const row = await db.first('SELECT data FROM account_documents WHERE user_id = ?', [userId]);
  return normalizeSharing(parseJson(row?.data)?.preferences?.sharing).public;
}

export async function searchByHandle(db, userId, raw) {
  const handle = normalizeHandle(raw);
  if (!HANDLE_PATTERN.test(handle)) throw new AppError('Digite o @usuário completo, com pelo menos 3 caracteres.', 'invalid_handle', 400);
  const found = await db.first('SELECT user_id FROM user_handles WHERE handle = ?', [handle]);
  if (!found || await blockedBetween(db, userId, found.user_id)) {
    throw new AppError('Nenhuma pessoa com esse @usuário. Confira como ele está escrito.', 'not_found', 404);
  }
  const publicProfile = await isPublicProfile(db, found.user_id);
  const link = await relation(db, userId, found.user_id);
  // Quem fechou o perfil não é achada pelo @usuário por quem não tem nenhum vínculo com ela.
  if (!publicProfile && link.status === 'none') {
    throw new AppError('Nenhuma pessoa com esse @usuário. Confira como ele está escrito.', 'not_found', 404);
  }
  return { user: await person(db, found.user_id), publicProfile, ...link };
}

async function becomeFriends(db, a, b, now) {
  await db.run('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', [a, b, iso(now)]);
  await db.run('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', [b, a, iso(now)]);
  await db.run('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', [a, b, b, a]);
}

async function assertRoom(db, userId) {
  const count = await db.first('SELECT COUNT(*) AS total FROM friendships WHERE user_id = ?', [userId]);
  if (Number(count?.total ?? 0) >= MAX_FRIENDS) throw new AppError(`A lista já tem ${MAX_FRIENDS} amigos.`, 'friend_limit', 409);
}

export async function sendRequest(db, userId, body, now = Date.now()) {
  const target = await searchByHandle(db, userId, body?.handle);
  if (target.status === 'self') throw new AppError('Esse é o seu próprio @usuário.', 'self_request', 400);
  if (target.status === 'friends') throw new AppError(`Você e ${target.user.name} já são amigos.`, 'already_friends', 409);
  if (target.status === 'sent') return { status: 'sent', requestId: target.requestId, user: target.user };
  await assertRoom(db, userId);
  if (target.status === 'received') {
    await assertRoom(db, target.user.id);
    await becomeFriends(db, userId, target.user.id, now);
    return { status: 'friends', user: target.user };
  }
  const pending = await db.first('SELECT COUNT(*) AS total FROM friend_requests WHERE from_id = ?', [userId]);
  if (Number(pending?.total ?? 0) >= MAX_PENDING_SENT) {
    throw new AppError('Você já tem muitas solicitações enviadas. Espere respostas ou cancele alguma.', 'too_many_requests', 409);
  }
  const id = crypto.randomUUID();
  await db.run('INSERT OR IGNORE INTO friend_requests (id, from_id, to_id, created_at) VALUES (?, ?, ?, ?)', [id, userId, target.user.id, iso(now)]);
  return { status: 'sent', requestId: id, user: target.user, toId: target.user.id };
}

export async function listRequests(db, userId) {
  const handle = await ensureHandle(db, userId);
  const rows = await db.all(
    `SELECT r.id, r.from_id, r.to_id, r.created_at FROM friend_requests r
      WHERE r.from_id = ? OR r.to_id = ? ORDER BY r.created_at DESC LIMIT 200`,
    [userId, userId],
  );
  const received = [];
  const sent = [];
  for (const row of rows) {
    const otherId = row.from_id === userId ? row.to_id : row.from_id;
    if (await blockedBetween(db, userId, otherId)) continue;
    const other = await person(db, otherId);
    if (!other) continue;
    (row.to_id === userId ? received : sent).push({ id: row.id, createdAt: row.created_at, user: other });
  }
  return { handle, received, sent };
}

export async function respondRequest(db, userId, requestId, body, now = Date.now()) {
  const row = await db.first('SELECT id, from_id, to_id FROM friend_requests WHERE id = ? AND to_id = ?', [requestId, userId]);
  if (!row) throw new AppError('Solicitação não encontrada. Ela pode ter sido cancelada.', 'not_found', 404);
  if (body?.action === 'decline') {
    await db.run('DELETE FROM friend_requests WHERE id = ?', [row.id]);
    return { status: 'declined', fromId: row.from_id };
  }
  if (body?.action !== 'accept') throw new AppError('Resposta inválida.', 'invalid_action', 400);
  await assertRoom(db, userId);
  await assertRoom(db, row.from_id);
  await becomeFriends(db, userId, row.from_id, now);
  return { status: 'friends', friend: await person(db, row.from_id), fromId: row.from_id };
}

export async function cancelRequest(db, userId, requestId) {
  const row = await db.first('SELECT id FROM friend_requests WHERE id = ? AND from_id = ?', [requestId, userId]);
  if (!row) throw new AppError('Solicitação não encontrada.', 'not_found', 404);
  await db.run('DELETE FROM friend_requests WHERE id = ?', [row.id]);
  return { cancelled: true };
}
