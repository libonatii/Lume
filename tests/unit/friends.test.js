import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FriendsError, acceptInvite, createInvite, formatInviteCode, generateInviteCode,
  friendshipPolicy, normalizeInviteCode, removeFriend,
} from '../../api/domain/friends.js';
import { hashSessionToken } from '../../api/domain/auth.js';

test('convite é um código longo, legível e guardado como hash', async () => {
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
  const cleanup = saved.find((call) => call.sql.includes('DELETE FROM friend_invites'));
  assert.ok(cleanup, 'convite anterior em vigor é invalidado');
  assert.ok(cleanup.sql.includes('expires_at >'), 'o histórico expirado não é apagado');
});

function fakeDb({ invite = null, friendsCount = 0, existing = null, friendName = 'Bia' } = {}) {
  const calls = { friendships: [], uses: [] };
  return {
    calls,
    async run(sql, params) {
      if (sql.includes('friend_invite_uses')) calls.uses.push(params);
      if (sql.includes('friendships')) calls.friendships.push(params);
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

test('aceitar convite cria amizade nos dois sentidos e registra o uso', async () => {
  const db = fakeDb({ invite: await rowFor(CODE) });
  const result = await acceptInvite(db, 'guest', CODE, NOW);
  assert.equal(result.alreadyFriends, false);
  assert.equal(result.friend.name, 'Bia');
  assert.equal(db.calls.friendships.length, 2);
  assert.deepEqual(db.calls.friendships[0].slice(0, 2), ['guest', 'owner']);
  assert.deepEqual(db.calls.friendships[1].slice(0, 2), ['owner', 'guest']);
  assert.equal(db.calls.uses.length, 1);
  assert.equal(db.calls.uses[0][1], 'guest');
  assert.equal(db.calls.uses[0][0], await hashSessionToken(normalizeInviteCode(CODE)));
});

test('o mesmo convite serve para várias pessoas até expirar', async () => {
  const row = await rowFor(CODE);
  const first = await acceptInvite(fakeDb({ invite: row }), 'guest_1', CODE, NOW);
  const second = await acceptInvite(fakeDb({ invite: row }), 'guest_2', CODE, NOW + 1000);
  const third = await acceptInvite(fakeDb({ invite: row }), 'guest_3', CODE, NOW + 60000);
  assert.equal(first.alreadyFriends, false);
  assert.equal(second.alreadyFriends, false);
  assert.equal(third.alreadyFriends, false);
  assert.equal(first.friend.id, second.friend.id);
  assert.equal(friendshipPolicy().invitesAreSingleUse, false);
});

test('convite não pode ser aceito pelo próprio autor, expirado ou inexistente', async () => {
  const validRow = await rowFor(CODE);
  await assert.rejects(
    () => acceptInvite(fakeDb({ invite: validRow }), 'owner', CODE, NOW),
    (error) => error instanceof FriendsError && error.code === 'self_invite',
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

test('aceitar de novo não duplica amizade nem registra outro uso', async () => {
  const validRow = await rowFor(CODE);
  const db = fakeDb({ invite: validRow, existing: { ok: 1 } });
  const again = await acceptInvite(db, 'guest', CODE, NOW);
  assert.equal(again.alreadyFriends, true);
  assert.equal(db.calls.friendships.length, 0);
  assert.equal(db.calls.uses.length, 0);
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
