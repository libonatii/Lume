import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applyMigrations, sqliteAdapter } from '../../api/adapters/sqlite.js';
import {
  MessagesError, blockContact, getThread, listConversations, markThreadRead,
  messagePreferences, sendMessage, unblockContact, unreadSummary, updateMessagePreferences,
} from '../../api/domain/messages.js';
import { messageAlert } from '../../public/social-domain.js';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite, fileURLToPath(new URL('../../migrations/', import.meta.url)));
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

test('conversa e cabeçalho da conversa trazem a foto saneada da amizade', async () => {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  const db = sqliteAdapter(sqlite);
  for (const [id, name] of [['u1', 'Ana'], ['u2', 'Bia'], ['u3', 'Carla']]) {
    sqlite.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(id, name, `${id}@example.test`, 'x', '2026-10-31T12:00:00Z');
  }
  for (const [a, b] of [['u1', 'u2'], ['u2', 'u1'], ['u1', 'u3'], ['u3', 'u1']]) {
    sqlite.prepare('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)').run(a, b, '2026-10-31T12:00:00Z');
  }
  const doc = sqlite.prepare('INSERT INTO account_documents (user_id, data, updated_at) VALUES (?, ?, ?)');
  doc.run('u2', JSON.stringify({ profile: { avatar: '/api/media/profiles/u2/avatar-1.webp' } }), '2026-10-31T12:00:00Z');
  doc.run('u3', JSON.stringify({ profile: { avatar: 'javascript:alert(1)' } }), '2026-10-31T12:00:00Z');
  const list = await listConversations(db, 'u1');
  const byId = Object.fromEntries(list.conversations.map((item) => [item.id, item]));
  assert.equal(byId.u2.avatar, '/api/media/profiles/u2/avatar-1.webp');
  assert.equal(byId.u3.avatar, '');
  const thread = await getThread(db, 'u1', 'u2');
  assert.equal(thread.friend.avatar, '/api/media/profiles/u2/avatar-1.webp');
});

test('aviso de mensagem nova: mais recente, uma vez, nunca da conversa aberta nem silenciado', () => {
  const conversations = [
    { id: 'u2', name: 'Bia', avatar: '/api/media/profiles/u2/avatar-1.webp', unread: 1, lastMessage: { id: 'm2', fromMe: false, preview: 'Oi!\n  Vamos   estudar?', at: '2026-10-31T12:05:00Z' } },
    { id: 'u3', name: 'Carla', avatar: '', unread: 2, lastMessage: { id: 'm1', fromMe: false, preview: 'Mais cedo', at: '2026-10-31T12:00:00Z' } },
    { id: 'u4', name: 'Duda', unread: 0, lastMessage: { id: 'm3', fromMe: false, preview: 'Lida', at: '2026-10-31T12:10:00Z' } },
    { id: 'u5', name: 'Eva', unread: 1, lastMessage: { id: 'm4', fromMe: true, preview: 'Minha', at: '2026-10-31T12:20:00Z' } },
  ];
  assert.deepEqual(messageAlert(conversations), {
    messageId: 'm2', from: { id: 'u2', name: 'Bia', avatar: '/api/media/profiles/u2/avatar-1.webp' }, preview: 'Oi! Vamos estudar?',
  });
  assert.equal(messageAlert(conversations, { seen: new Set(['m2']) }).from.id, 'u3');
  assert.equal(messageAlert(conversations, { openContactId: 'u2' }), null, 'conversa aberta não avisa');
  assert.equal(messageAlert(conversations, { notifications: false }), null, 'notificações desligadas não avisam');
  assert.equal(messageAlert(conversations, { seen: new Set(['m1', 'm2']) }), null);
  const long = messageAlert([{ id: 'u2', name: 'Bia', unread: 1, lastMessage: { id: 'x', fromMe: false, preview: 'a'.repeat(200), at: '1' } }]);
  assert.equal(long.preview.length, 91);
  assert.ok(long.preview.endsWith('…'));
});
