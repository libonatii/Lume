import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { sqliteAdapter } from './api/adapters/sqlite.js';
import {
  MessagesError, blockContact, getThread, listConversations, markThreadRead,
  messagePreferences, sendMessage, unblockContact, unreadSummary, updateMessagePreferences,
} from './messages.js';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0004_friends.sql', '0008_messages.sql']) {
    sqlite.exec(readFileSync(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
  }
  const db = sqliteAdapter(sqlite);
  for (const [id, name] of [['u1', 'Ana'], ['u2', 'Bia'], ['u3', 'Carla']]) {
    sqlite.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, `${id}@example.test`, 'x', '2026-10-31T12:00:00Z');
  }
  for (const [a, b] of [['u1', 'u2'], ['u2', 'u1']]) {
    sqlite.prepare('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)')
      .run(a, b, '2026-10-31T12:00:00Z');
  }
  return db;
}

const NOW = Date.parse('2026-10-31T12:00:00Z');

test('conversa entre amizades lista, envia, marca lida e não aceita desconhecido', async () => {
  const db = makeDb();
  const initial = await listConversations(db, 'u1');
  assert.equal(initial.conversations.length, 1);
  assert.equal(initial.conversations[0].name, 'Bia');
  assert.equal(initial.conversations[0].lastMessage, null);

  const sent = await sendMessage(db, 'u1', 'u2', { body: 'Oi, vamos estudar?' }, NOW);
  assert.equal(sent.message.fromMe, true);
  const list = await listConversations(db, 'u2');
  assert.equal(list.conversations[0].unread, 1);
  assert.match(list.conversations[0].lastMessage.preview, /estudar/);

  const thread = await getThread(db, 'u2', 'u1');
  assert.equal(thread.messages.length, 1);
  assert.equal(thread.messages[0].fromMe, false);
  assert.equal(thread.canMessage, true);

  const read = await markThreadRead(db, 'u2', 'u1', NOW + 1000);
  assert.equal(read.read, 1);
  assert.equal((await unreadSummary(db, 'u2')).unread, 0);

  await assert.rejects(
    () => sendMessage(db, 'u1', 'u3', { body: 'Oi' }, NOW),
    (error) => error instanceof MessagesError && error.code === 'not_friends',
  );
});

test('bloqueio interrompe novas mensagens nos dois sentidos e preserva o histórico', async () => {
  const db = makeDb();
  await sendMessage(db, 'u1', 'u2', { body: 'Mensagem antiga' }, NOW);
  await blockContact(db, 'u2', 'u1', NOW + 1000);
  await assert.rejects(
    () => sendMessage(db, 'u1', 'u2', { body: 'Nova' }, NOW + 2000),
    (error) => error.code === 'blocked_by_them',
  );
  await assert.rejects(
    () => sendMessage(db, 'u2', 'u1', { body: 'Nova' }, NOW + 2000),
    (error) => error.code === 'blocked_by_me',
  );
  const thread = await getThread(db, 'u2', 'u1');
  assert.equal(thread.messages.length, 1);
  assert.equal(thread.canMessage, false);
  await unblockContact(db, 'u2', 'u1');
  const after = await sendMessage(db, 'u1', 'u2', { body: 'Voltamos' }, NOW + 3000);
  assert.equal(after.message.body, 'Voltamos');
});

test('referência é saneada e preferência de notificação é persistida', async () => {
  const db = makeDb();
  const sent = await sendMessage(db, 'u1', 'u2', {
    body: '',
    reference: { type: 'project', id: 'curso-1', title: 'API de Biblioteca', url: 'https://privado.example/segredo' },
  }, NOW);
  assert.deepEqual(sent.message.reference, { type: 'project', id: 'curso-1', title: 'API de Biblioteca' });
  assert.equal((await messagePreferences(db, 'u2')).notifications, true);
  await updateMessagePreferences(db, 'u2', { notifications: false }, NOW);
  assert.equal((await messagePreferences(db, 'u2')).notifications, false);
  assert.equal((await unreadSummary(db, 'u2')).notifications, false);
  await assert.rejects(
    () => sendMessage(db, 'u1', 'u2', {}, NOW),
    (error) => error.code === 'empty_message',
  );
});
