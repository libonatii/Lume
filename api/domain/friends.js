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
import { createInitialState, restoreState } from '../../public/domain.js';
import { buildProfile } from '../../public/profile-domain.js';
import { getXpSnapshot } from './xp.js';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const INVITE_CODE_LENGTH = 12;
export const MAX_FRIENDS = 200;
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

export async function listFriends(db, userId, now = Date.now()) {
  if (!userId) throw new FriendsError('Entre na sua conta para ver seus amigos.', 'unauthenticated', 401);
  const friends = await db.all(
    `SELECT u.id, u.name, f.created_at AS since
       FROM friendships f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ?
      ORDER BY u.name COLLATE NOCASE`,
    [userId],
  );
  const invites = await db.all(
    `SELECT i.created_at, i.expires_at,
            (SELECT COUNT(*) FROM friend_invite_uses u WHERE u.code_hash = i.code_hash) AS uses
       FROM friend_invites i
      WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 10`,
    [userId],
  );
  return {
    friends: friends.map((row) => ({ id: row.id, name: row.name, since: row.since })),
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
    return { ...snapshot.summary, achievements: snapshot.achievements };
  } catch {
    return null;
  }
}
