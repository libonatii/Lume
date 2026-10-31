import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FriendsError, acceptInvite, createInvite, formatInviteCode, generateInviteCode,
  normalizeInviteCode, removeFriend,
} from './friends.js';
import { hashSessionToken } from './auth.js';

test('convite é um código longo, legível e de uso único', async () => {
  const code = generateInviteCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  assert.equal(code.length, 12);
  assert.match(code, /^[A-HJ-NP-Z2-9]{12}$/);
  assert.equal(formatInviteCode('abcd efgh ijkl'), 'ABCD-EFGH-IJKL');
  assert.equal(normalizeInviteCode('ab-cd efgh ijkl'), 'ABCDEFGHIJKL');

  const saved = [];
  const db = {
    async run(sql, params) { saved.push({ sql, params }); return 1; },
    async first() { return null; },
    async all() { return []; },
  };
  const invite = await createInvite(db, 'user_1', Date.parse('2026-10-31T12:00:00Z'));
  assert.match(invite.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(invite.ttlSeconds, 7 * 24 * 3600);
  const insert = saved.find((call) => call.sql.includes('INSERT INTO friend_invites'));
  assert.ok(insert.params[0] !== invite.code.replace(/-/g, ''), 'o código não é guardado em claro');
  assert.ok(saved.some((call) => call.sql.includes('DELETE FROM friend_invites')), 'convite anterior é invalidado');
});

function fakeDb({ invite = null, friendsCount = 0, existing = null, consume = 1, friendName = 'Bia' } = {}) {
  const calls = { friendships: [], consumed: null };
  return {
    calls,
    async run(sql, params) {
      if (sql.includes('UPDATE friend_invites')) { calls.consumed = params; return consume; }
      if (sql.includes('INSERT INTO friendships')) calls.friendships.push(params);
      return 1;
    },
    async first(sql) {
      if (sql.includes('FROM friend_invites')) return invite;
      if (sql.includes('COUNT(*)')) return { total: friendsCount };
      if (sql.includes('FROM friendships')) return existing;
      if (sql.includes('FROM users')) return { id: invite?.user_id || 'u2', name: friendName };
      return null;
    },
    async all() { return []; },
  };
}

async function rowFor(code, overrides = {}) {
  return {
    code_hash: await hashSessionToken(normalizeInviteCode(code)),
    user_id: 'owner',
    expires_at: '2026-11-07T12:00:00Z',
    used_at: null,
    ...overrides,
  };
}

const NOW = Date.parse('2026-10-31T12:00:00Z');
const CODE = 'ABCD-EFGH-IJKL';

test('aceitar convite cria amizade nos dois sentidos e consome o código', async () => {
  const db = fakeDb({ invite: await rowFor(CODE) });
  const result = await acceptInvite(db, 'guest', CODE, NOW);
  assert.equal(result.alreadyFriends, false);
  assert.equal(result.friend.name, 'Bia');
  assert.equal(db.calls.friendships.length, 2);
  assert.deepEqual(db.calls.friendships[0].slice(0, 2), ['guest', 'owner']);
  assert.deepEqual(db.calls.friendships[1].slice(0, 2), ['owner', 'guest']);
  assert.equal(db.calls.consumed[1], 'guest');
});

test('convite não pode ser aceito pelo próprio autor, usado ou expirado', async () => {
  const validRow = await rowFor(CODE);
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: validRow }), 'owner', CODE, NOW),
    (error) => error instanceof FriendsError && error.code === 'self_invite',
  );
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: { ...validRow, used_at: '2026-10-30T12:00:00Z' } }), 'guest', CODE, NOW),
    (error) => error.code === 'used_code',
  );
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: { ...validRow, expires_at: '2026-10-01T12:00:00Z' } }), 'guest', CODE, NOW),
    (error) => error.code === 'expired_code',
  );
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: null }), 'guest', CODE, NOW),
    (error) => error.code === 'invalid_code',
  );
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: validRow }), 'guest', 'ABCD', NOW),
    (error) => error.code === 'invalid_code',
  );
});

test('corrida no uso do convite não cria amizade duplicada', async () => {
  const validRow = await rowFor(CODE);
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: validRow, consume: 0 }), 'guest', CODE, NOW),
    (error) => error.code === 'used_code',
  );
  const already = await acceptInvite(fakeDb({ invite: validRow, existing: { ok: 1 } }), 'guest', CODE, NOW);
  assert.equal(already.alreadyFriends, true);
});

test('limite de amigos e remoção', async () => {
  const validRow = await rowFor(CODE);
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: validRow, friendsCount: 200 }), 'guest', CODE, NOW),
    (error) => error.code === 'friend_limit',
  );
  const db = fakeDb();
  db.first = async (sql) => (sql.includes('FROM friendships') ? { ok: 1 } : null);
  const removed = await removeFriend(db, 'guest', 'friend_1');
  assert.equal(removed.removed, true);
  await assert.rejects(
    () => removeFriend({ first: async () => null }, 'guest', 'friend_1'),
    (error) => error.code === 'not_found',
  );
});
