import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FriendsError, acceptInvite, createInvite, formatInviteCode, generateInviteCode,
  friendshipPolicy, listFriends, listProfileFriends, normalizeInviteCode, removeFriend,
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

test('listFriends projeta presença real: Online, Estudando com disciplina e privacidade da biblioteca', async () => {
  const now = Date.parse('2026-11-13T00:00:00Z');
  const rows = [
    {
      id: 'f_online', handle: 'h_f_online',
      name: 'Gabriel',
      since: '2026-11-01T10:00:00Z',
      last_seen_at: new Date(now - 60_000).toISOString(),
      account_doc: null,
    },
    {
      id: 'f_studying', handle: 'h_f_studying',
      name: 'José Lucas da Silva',
      since: '2026-11-02T10:00:00Z',
      last_seen_at: new Date(now - 30_000).toISOString(),
      account_doc: JSON.stringify({
        activeSession: {
          status: 'active',
          courseId: 'mat_1',
          label: 'Aula 1',
          lastTickAt: new Date(now - 20_000).toISOString(),
        },
        preferences: { sharing: { library: true } },
        profile: { avatar: '/api/media/profiles/f_studying/avatar-1.webp' },
      }),
    },
    {
      id: 'f_private', handle: 'h_f_private',
      name: 'Mariana',
      since: '2026-11-03T10:00:00Z',
      last_seen_at: new Date(now - 20_000).toISOString(),
      account_doc: JSON.stringify({
        activeSession: {
          status: 'active',
          courseId: 'mat_1',
          label: 'Segredo',
          lastTickAt: new Date(now - 20_000).toISOString(),
        },
        preferences: { sharing: { library: false } },
        profile: { avatar: 'https://example.test/rastreio.png' },
      }),
    },
    {
      id: 'f_offline', handle: 'h_f_offline',
      name: 'Rafael',
      since: '2026-11-04T10:00:00Z',
      last_seen_at: new Date(now - 10 * 60_000).toISOString(),
      account_doc: null,
    },
  ];
  const db = {
    async all(sql) {
      if (sql.includes('FROM friendships')) return rows;
      return [];
    },
    async first(sql, params) {
      if (sql.includes('FROM materials') && params[0] === 'f_studying') {
        return { data: JSON.stringify({ id: 'mat_1', title: 'Curso Base', subjectId: 'sub_1' }) };
      }
      if (sql.includes('FROM study_subjects') && params[0] === 'f_studying') {
        return { data: JSON.stringify({ id: 'sub_1', title: 'Direito Tributário' }) };
      }
      return null;
    },
  };

  const result = await listFriends(db, 'viewer', now);
  const byId = Object.fromEntries(result.friends.map((item) => [item.id, item]));
  assert.deepEqual(byId.f_online.activity, { active: true, status: 'online', label: 'Online', topic: '' });
  assert.deepEqual(byId.f_studying.activity, { active: true, status: 'studying', label: 'Estudando', topic: 'Direito Tributário' });
  assert.deepEqual(byId.f_private.activity, { active: true, status: 'studying', label: 'Estudando', topic: '' });
  assert.deepEqual(byId.f_offline.activity, { active: false, status: 'offline', label: 'Offline', topic: '' });
  assert.equal(byId.f_studying.avatar, '/api/media/profiles/f_studying/avatar-1.webp');
  assert.equal(byId.f_private.avatar, '', 'endereço fora da mídia do Lume é descartado');
  assert.equal(byId.f_online.avatar, '');
});

function profileFriendsDb({ linked = false, targetPublic = true, blocked = false, friends = [] } = {}) {
  const doc = (isPublic) => JSON.stringify({ preferences: { sharing: { public: isPublic } } });
  return {
    async run() { return 1; },
    async first(sql) {
      if (sql.includes('FROM users')) return { id: 'alvo' };
      if (sql.includes('FROM account_documents')) return { data: doc(targetPublic) };
      if (sql.includes('FROM friendships')) return linked ? { ok: 1 } : null;
      if (sql.includes('FROM contact_blocks')) return blocked ? { ok: 1 } : null;
      return null;
    },
    async all() {
      return friends.map((item) => ({ id: item.id, name: item.name, handle: item.id, account_doc: doc(item.public) }));
    },
  };
}

test('aba Amigos do perfil lista só amigos com perfil público', async () => {
  const db = profileFriendsDb({ friends: [
    { id: 'ana', name: 'Ana', public: true },
    { id: 'beto', name: 'Beto', public: false },
  ] });
  const result = await listProfileFriends(db, 'visitante', 'alvo');
  assert.deepEqual(result.friends.map((item) => item.id), ['ana']);
});

test('aba Amigos respeita perfil fechado, bloqueio e a própria conta', async () => {
  const friends = [{ id: 'ana', name: 'Ana', public: true }];
  await assert.rejects(listProfileFriends(profileFriendsDb({ targetPublic: false, friends }), 'visitante', 'alvo'), { code: 'not_friends' });
  await assert.rejects(listProfileFriends(profileFriendsDb({ blocked: true, friends }), 'visitante', 'alvo'), { code: 'not_friends' });
  const asFriend = await listProfileFriends(profileFriendsDb({ targetPublic: false, linked: true, friends }), 'visitante', 'alvo');
  assert.equal(asFriend.friends.length, 1);
  const own = await listProfileFriends(profileFriendsDb({ targetPublic: false, friends }), 'alvo', 'alvo');
  assert.equal(own.friends.length, 1);
});
