// Amizades por convite.
//
// Decisões de privacidade:
// - não existe busca por e-mail: criar conta no Lume não fica descobrível;
// - o convite é um código que a pessoa compartilha como quiser: vale por 7 dias
//   e pode ser aceito por várias pessoas, sempre limitado ao prazo;
// - a amizade, sozinha, não expõe biblioteca, progresso ou XP: o perfil usa as
//   escolhas de compartilhamento de cada pessoa;
// - convidar, aceitar ou remover não concedem XP.

import { hashSessionToken } from './auth.js';
import { AppError } from '../errors.js';
import { createInitialState, restoreState, sanitizeProfileImage } from '../../public/domain.js';
import { buildProfile, normalizeSharing } from '../../public/profile-domain.js';
import { STALE_SESSION_MS } from '../../public/session-domain.js';
import { PRESENCE_TTL_MS, cleanAppLabel } from '../../companion/domain.mjs';
import { getXpSnapshot } from './xp.js';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_CODE_LENGTH = 12;
export const MAX_FRIENDS = 200;
export const ONLINE_PRESENCE_TTL_MS = 3 * 60 * 1000;
const STUDY_COMPANION_CATEGORIES = new Set(['study', 'reading', 'project']);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class FriendsError extends AppError {
  constructor(message, code = 'friends_error', status = 400) {
    super(message, code, status);
    this.name = 'FriendsError';
  }
}

function iso(now) {
  return new Date(now).toISOString();
}

export function generateInviteCode(randomValues = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH))) {
  let code = '';
  for (const byte of randomValues) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export function normalizeInviteCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatInviteCode(code) {
  return normalizeInviteCode(code).match(/.{1,4}/g)?.join('-') || '';
}

export async function createInvite(db, userId, now = Date.now()) {
  if (!userId) throw new FriendsError('Entre na sua conta para convidar alguém.', 'unauthenticated', 401);
  const code = generateInviteCode();
  const codeHash = await hashSessionToken(normalizeInviteCode(code));
  // Um convite válido por vez: o último gerado é o que vale, para não deixar
  // códigos esquecidos circulando. Os já expirados ficam no histórico.
  await db.run('DELETE FROM friend_invites WHERE user_id = ? AND expires_at > ?', [userId, iso(now)]);
  await db.run(
    'INSERT INTO friend_invites (code_hash, user_id, created_at, expires_at, used_at, used_by) VALUES (?, ?, ?, ?, NULL, NULL)',
    [codeHash, userId, iso(now), iso(now + INVITE_TTL_MS)],
  );
  return { code: formatInviteCode(code), expiresAt: iso(now + INVITE_TTL_MS), ttlSeconds: Math.round(INVITE_TTL_MS / 1000) };
}

export async function acceptInvite(db, userId, rawCode, now = Date.now()) {
  if (!userId) throw new FriendsError('Entre na sua conta para aceitar o convite.', 'unauthenticated', 401);
  const code = normalizeInviteCode(rawCode);
  if (code.length !== INVITE_CODE_LENGTH) {
    throw new FriendsError('O convite tem 12 caracteres. Confira e tente de novo.', 'invalid_code', 400);
  }
  const codeHash = await hashSessionToken(code);
  const invite = await db.first('SELECT user_id, expires_at FROM friend_invites WHERE code_hash = ?', [codeHash]);
  if (!invite) throw new FriendsError('Convite não encontrado. Peça um novo link a quem convidou.', 'invalid_code', 400);
  if (Date.parse(invite.expires_at) <= now) throw new FriendsError('Este convite expirou. Peça outro.', 'expired_code', 400);
  if (invite.user_id === userId) throw new FriendsError('Você não pode aceitar o seu próprio convite.', 'self_invite', 400);

  const count = await db.first('SELECT COUNT(*) AS total FROM friendships WHERE user_id = ?', [userId]);
  if (Number(count?.total ?? 0) >= MAX_FRIENDS) {
    throw new FriendsError(`Sua lista já tem ${MAX_FRIENDS} amigos.`, 'friend_limit', 409);
  }

  const existing = await db.first('SELECT 1 AS ok FROM friendships WHERE user_id = ? AND friend_id = ?', [userId, invite.user_id]);
  if (existing) {
    return { alreadyFriends: true, friend: await publicFriend(db, invite.user_id), friendId: invite.user_id };
  }

  // O convite vale até expirar: cada pessoa é registrada uma vez em
  // friend_invite_uses, para contar quantos entraram por ele. O INSERT OR IGNORE
  // mantém a operação repetível sem duplicar o registro.
  await db.run(
    'INSERT OR IGNORE INTO friend_invite_uses (code_hash, user_id, used_at) VALUES (?, ?, ?)',
    [codeHash, userId, iso(now)],
  );

  await db.run('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', [userId, invite.user_id, iso(now)]);
  await db.run('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', [invite.user_id, userId, iso(now)]);

  return { alreadyFriends: false, friend: await publicFriend(db, invite.user_id), friendId: invite.user_id };
}

async function publicFriend(db, userId) {
  const row = await db.first('SELECT id, name FROM users WHERE id = ?', [userId]);
  return row ? { id: row.id, name: row.name } : { id: userId, name: 'Pessoa do Lume' };
}

function parseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function touchUserPresence(db, userId, now = Date.now()) {
  if (!userId) return;
  await db.run(
    `INSERT INTO user_presence (user_id, last_seen_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    [userId, iso(now)],
  );
}

export async function clearUserPresence(db, userId) {
  if (!userId) return;
  await db.run('DELETE FROM user_presence WHERE user_id = ?', [userId]);
}

async function resolveStudyingTopic(db, userId, activeSession, allowTopic) {
  if (!allowTopic) return '';
  if (activeSession.courseId) {
    const matRow = await db.first(
      'SELECT data FROM materials WHERE user_id = ? AND id = ?',
      [userId, activeSession.courseId],
    );
    const material = parseJson(matRow?.data);
    if (material?.subjectId) {
      const subRow = await db.first(
        'SELECT data FROM study_subjects WHERE user_id = ? AND id = ?',
        [userId, material.subjectId],
      );
      const subjectTitle = cleanAppLabel(parseJson(subRow?.data)?.title);
      if (subjectTitle) return subjectTitle;
    }
    const materialTitle = cleanAppLabel(material?.title);
    if (materialTitle) return materialTitle;
  }
  const label = cleanAppLabel(activeSession.label);
  return label && label !== 'Sessão de estudo' ? label : '';
}

async function buildFriendActivity(db, row, companion, now) {
  const doc = parseJson(row.account_doc);
  const sharing = normalizeSharing(doc?.preferences?.sharing);
  const session = doc?.activeSession;
  const sessionTick = session?.status === 'active' ? Date.parse(session.lastTickAt) : NaN;
  const sessionActive = Boolean(session?.status === 'active' && Number.isFinite(sessionTick) && now - sessionTick < STALE_SESSION_MS);

  if (sessionActive) {
    const topic = await resolveStudyingTopic(db, row.id, session, sharing.library);
    return { active: true, status: 'studying', label: 'Estudando', topic };
  }

  const companionUpdated = companion ? Date.parse(companion.updated_at) : NaN;
  if (Number.isFinite(companionUpdated) && now - companionUpdated < PRESENCE_TTL_MS) {
    if (STUDY_COMPANION_CATEGORIES.has(companion.category)) {
      return {
        active: true,
        status: 'studying',
        label: 'Estudando',
        topic: sharing.library ? cleanAppLabel(companion.app) : '',
      };
    }
    return { active: true, status: 'online', label: 'Online', topic: '' };
  }

  const webSeen = row.last_seen_at ? Date.parse(row.last_seen_at) : NaN;
  if (Number.isFinite(webSeen) && now - webSeen < ONLINE_PRESENCE_TTL_MS) {
    return { active: true, status: 'online', label: 'Online', topic: '' };
  }

  return { active: false, status: 'offline', label: 'Offline', topic: '' };
}

export async function listFriends(db, userId, now = Date.now()) {
  if (!userId) throw new FriendsError('Entre na sua conta para ver seus amigos.', 'unauthenticated', 401);
  const friends = await db.all(
    `SELECT u.id, u.name, f.created_at AS since,
            up.last_seen_at AS last_seen_at,
            ad.data AS account_doc
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       LEFT JOIN user_presence up ON up.user_id = u.id
       LEFT JOIN account_documents ad ON ad.user_id = u.id
      WHERE f.user_id = ?
      ORDER BY u.name COLLATE NOCASE`,
    [userId],
  );
  const friendIds = friends.map((row) => row.id);
  const companions = new Map();
  if (friendIds.length) {
    const placeholders = friendIds.map(() => '?').join(', ');
    const rows = await db.all(
      `SELECT user_id, app, category, updated_at
         FROM companion_presence
        WHERE user_id IN (${placeholders})
        ORDER BY updated_at DESC`,
      friendIds,
    );
    for (const row of rows) {
      if (!companions.has(row.user_id)) companions.set(row.user_id, row);
    }
  }
  const friendItems = await Promise.all(friends.map(async (row) => ({
    id: row.id,
    name: row.name,
    avatar: sanitizeProfileImage(parseJson(row.account_doc)?.profile?.avatar),
    since: row.since,
    activity: await buildFriendActivity(db, row, companions.get(row.id) || null, now),
  })));
  const invites = await db.all(
    `SELECT i.created_at, i.expires_at,
            (SELECT COUNT(*) FROM friend_invite_uses u WHERE u.code_hash = i.code_hash) AS uses
       FROM friend_invites i
      WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 10`,
    [userId],
  );
  return {
    friends: friendItems,
    invites: invites.map((row) => ({
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      expired: Date.parse(row.expires_at) <= now,
      uses: Number(row.uses ?? 0),
    })),
    maxFriends: MAX_FRIENDS,
  };
}

export async function removeFriend(db, userId, friendId) {
  if (!userId) throw new FriendsError('Entre na sua conta.', 'unauthenticated', 401);
  if (!friendId || typeof friendId !== 'string') throw new FriendsError('Amizade inválida.', 'invalid_friend', 400);
  const exists = await db.first('SELECT 1 AS ok FROM friendships WHERE user_id = ? AND friend_id = ?', [userId, friendId]);
  if (!exists) throw new FriendsError('Essa pessoa não está na sua lista.', 'not_found', 404);
  await db.run('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', [userId, friendId, friendId, userId]);
  return { removed: true, friendId };
}

// Amizade não é compartilhamento: nada da biblioteca é exposto por aqui.
export function friendshipPolicy() {
  return {
    sharesLibrary: false,
    sharesProgress: false,
    grantsXp: false,
    invitesAreSingleUse: false,
    invitesReusableUntilExpiry: true,
    inviteTtlDays: Math.round(INVITE_TTL_MS / 86400000),
  };
}

// Perfil visto por uma amizade: só existe entre amigos, nunca expõe o e-mail
// e passa pelas escolhas de compartilhamento de quem é visto (buildProfile).
export async function readFriendProfile(db, viewerId, friendId) {
  if (!friendId) throw new FriendsError('Perfil não encontrado.', 'not_found', 404);
  const linked = await db.first('SELECT 1 AS linked FROM friendships WHERE user_id = ? AND friend_id = ?', [viewerId, friendId]);
  if (!linked) throw new FriendsError('Você só vê o perfil de quem está na sua lista de amigos.', 'not_friends', 403);
  const target = await db.first('SELECT id, name FROM users WHERE id = ?', [friendId]);
  if (!target) throw new FriendsError('Perfil não encontrado.', 'not_found', 404);
  const { readStoredLibrary } = await import('./library-store.js');
  const row = await readStoredLibrary(db, friendId);
  let state = createInitialState();
  if (row?.state) {
    state = row.state;
  }
  return {
    user: { id: target.id, name: target.name },
    updatedAt: row?.updatedAt ?? null,
    ...buildProfile(state, { validated: await validatedProfile(db, friendId) }),
  };
}

// Resumo validado no servidor (nível e conquistas); ausente se a pessoa não tem XP.
async function validatedProfile(db, userId) {
  try {
    const snapshot = await getXpSnapshot(db, userId, { create: false });
    return { ...snapshot.summary, achievements: snapshot.achievements, titles: snapshot.titles };
  } catch {
    return null;
  }
}
