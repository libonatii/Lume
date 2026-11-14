import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applyMigrations, sqliteAdapter } from '../../api/adapters/sqlite.js';
import {
  cancelRequest, checkHandle, ensureHandle, fillMissingHandles, getHandle, listRequests, normalizeHandle, respondRequest,
  searchByHandle, sendRequest, setHandle, slugifyHandle,
} from '../../api/domain/friend-requests.js';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  for (const [id, name] of [['u1', 'Ana'], ['u2', 'Marina Lima'], ['u3', 'Marina Lima']]) {
    sqlite.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, `${id}@example.test`, 'x', '2026-10-31T12:00:00Z');
  }
  return { db: sqliteAdapter(sqlite), sqlite };
}

test('@usuário é normalizado e criado a partir do nome sem repetir', async () => {
  assert.equal(normalizeHandle('  @Marina.Lima '), 'marina.lima');
  assert.equal(slugifyHandle('José da Conceição'), 'jose.da.conceicao');
  const { db } = makeDb();
  assert.equal(await ensureHandle(db, 'u2'), 'marina.lima');
  assert.equal(await ensureHandle(db, 'u2'), 'marina.lima', 'repetir devolve o mesmo');
  assert.notEqual(await ensureHandle(db, 'u3'), 'marina.lima', 'homônimo recebe outro @usuário');
  await assert.rejects(setHandle(db, 'u1', '@marina.lima'), { code: 'handle_taken' });
  await assert.rejects(setHandle(db, 'u1', '@a'), { code: 'invalid_handle' });
  assert.deepEqual(await setHandle(db, 'u1', '@Ana.Estuda'), { handle: 'ana.estuda' });
});

test('solicitação só vira amizade quando a outra pessoa aceita', async () => {
  const { db } = makeDb();
  await ensureHandle(db, 'u1');
  await ensureHandle(db, 'u2');
  await assert.rejects(searchByHandle(db, 'u1', '@ninguem'), { code: 'not_found' });
  assert.equal((await searchByHandle(db, 'u1', '@marina.lima')).status, 'none');
  assert.equal((await searchByHandle(db, 'u1', '@ana')).status, 'self');

  const sent = await sendRequest(db, 'u1', { handle: '@marina.lima' });
  assert.equal(sent.status, 'sent');
  assert.equal((await sendRequest(db, 'u1', { handle: '@marina.lima' })).requestId, sent.requestId, 'repetir não duplica');
  assert.equal(await db.first('SELECT 1 AS ok FROM friendships'), null, 'ainda não são amigas');

  const inbox = await listRequests(db, 'u2');
  assert.equal(inbox.received.length, 1);
  assert.equal((await listRequests(db, 'u1')).sent.length, 1);

  const accepted = await respondRequest(db, 'u2', sent.requestId, { action: 'accept' });
  assert.equal(accepted.status, 'friends');
  const rows = await db.all('SELECT user_id, friend_id FROM friendships ORDER BY user_id');
  assert.equal(rows.length, 2);
  assert.equal((await listRequests(db, 'u2')).received.length, 0);
  await assert.rejects(sendRequest(db, 'u1', { handle: '@marina.lima' }), { code: 'already_friends' });
});

test('recusar, cancelar e pedidos cruzados', async () => {
  const { db } = makeDb();
  await ensureHandle(db, 'u1');
  await ensureHandle(db, 'u2');
  const first = await sendRequest(db, 'u1', { handle: 'marina.lima' });
  await assert.rejects(respondRequest(db, 'u1', first.requestId, { action: 'accept' }), { code: 'not_found' }, 'quem pediu não aceita o próprio pedido');
  await respondRequest(db, 'u2', first.requestId, { action: 'decline' });
  assert.equal(await db.first('SELECT 1 AS ok FROM friendships'), null);

  const again = await sendRequest(db, 'u1', { handle: 'marina.lima' });
  assert.deepEqual(await cancelRequest(db, 'u1', again.requestId), { cancelled: true });
  assert.equal((await listRequests(db, 'u2')).received.length, 0);

  await sendRequest(db, 'u1', { handle: 'marina.lima' });
  const crossed = await sendRequest(db, 'u2', { handle: 'ana' });
  assert.equal(crossed.status, 'friends', 'pedidos cruzados viram amizade');
});

test('quem bloqueou não aparece na busca', async () => {
  const { db, sqlite } = makeDb();
  await ensureHandle(db, 'u1');
  await ensureHandle(db, 'u2');
  sqlite.prepare('INSERT INTO contact_blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').run('u2', 'u1', '2026-10-31T12:00:00Z');
  await assert.rejects(searchByHandle(db, 'u1', '@marina.lima'), { code: 'not_found' });
});

test('disponibilidade do @usuário no cadastro e na troca', async () => {
  const { db } = makeDb();
  await ensureHandle(db, 'u2');
  assert.equal((await checkHandle(db, '@Marina.Lima')).reason, 'taken');
  assert.equal((await checkHandle(db, 'marina.lima', 'u2')).available, true, 'o próprio @usuário conta como livre');
  assert.equal((await checkHandle(db, 'ab')).reason, 'invalid');
  assert.equal((await checkHandle(db, 'novo.usuario')).available, true);
});

test('contas antigas sem @usuário ganham um, distinto, ao aparecer em listas', async () => {
  const { db } = makeDb();
  const rows = [{ id: 'u2', handle: null }, { id: 'u3', handle: null }, { id: 'u1', handle: 'ana.fixa' }];
  await fillMissingHandles(db, rows);
  assert.equal(rows[2].handle, 'ana.fixa');
  assert.ok(rows[0].handle && rows[1].handle && rows[0].handle !== rows[1].handle);
  assert.equal(await getHandle(db, 'u2'), rows[0].handle);
});
