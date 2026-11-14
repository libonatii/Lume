import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applyMigrations, sqliteAdapter } from '../../api/adapters/sqlite.js';
import { listNotifications, markNotificationsSeen } from '../../api/domain/notifications.js';
import { notificationFeed } from '../../public/notifications-domain.js';

const NOW = Date.parse('2026-11-13T15:00:00Z');

function fixture(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  applyMigrations(sql, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  for (const [id, name] of [['ana', 'Ana'], ['bia', 'Bia'], ['carla', 'Carla']]) sql.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run(id, name, `${id}@example.test`, 'x', '2026-11-01T12:00:00Z');
  sql.exec(`INSERT INTO friendships VALUES ('ana','bia','2026-11-13T10:00:00.000Z'), ('bia','ana','2026-11-13T10:00:00.000Z'),
    ('ana','carla','2026-11-13T11:00:00.000Z'), ('carla','ana','2026-11-13T11:00:00.000Z')`);
  sql.exec(`INSERT INTO social_posts (id,user_id,body,kind,ready,created_at) VALUES ('post','ana','Revisando','post',1,'2026-11-13T09:00:00.000Z')`);
  sql.exec(`INSERT INTO social_comments VALUES ('c1','post','bia','Boa!','2026-11-13T12:00:00.000Z'), ('c2','post','ana','Valeu','2026-11-13T12:30:00.000Z')`);
  sql.exec(`INSERT INTO social_reactions VALUES ('post','carla','2026-11-13T13:00:00.000Z')`);
  return { db: sqliteAdapter(sql), sql };
}

test('sino junta amizades, comentários e reações de outras pessoas e novidades', async t => {
  const { db } = fixture(t);
  const result = await listNotifications(db, 'ana', NOW);
  const kinds = result.items.map(item => item.kind);
  assert.ok(kinds.includes('friend') && kinds.includes('comment') && kinds.includes('reaction') && kinds.includes('news'));
  assert.equal(result.items.filter(item => item.kind === 'comment').length, 1, 'o próprio comentário não notifica');
  assert.equal(result.items[0].kind, 'reaction', 'mais recente primeiro');
  assert.ok(result.unseen > 0);
});

test('marcar como visto zera o contador e só o que chega depois volta a contar', async t => {
  const { db, sql } = fixture(t);
  await markNotificationsSeen(db, 'ana', NOW);
  assert.equal((await listNotifications(db, 'ana', NOW)).unseen, 0);
  await markNotificationsSeen(db, 'ana', NOW - 3600000);
  assert.equal((await listNotifications(db, 'ana', NOW)).unseen, 0, 'o marco não volta no tempo');
  sql.exec(`INSERT INTO social_comments VALUES ('c3','post','bia','Mais uma','2026-11-13T15:30:00.000Z')`);
  assert.equal((await listNotifications(db, 'ana', NOW + 3600000)).unseen, 1);
});

test('contato bloqueado não notifica', async t => {
  const { db, sql } = fixture(t);
  sql.exec("INSERT INTO contact_blocks (user_id,blocked_id,created_at) VALUES ('ana','bia','2026-11-13')");
  const result = await listNotifications(db, 'ana', NOW);
  assert.ok(!result.items.some(item => item.person?.id === 'bia'));
});

test('feed descarta itens fora da janela e o que antecede a conta não conta como novo', () => {
  const items = [
    { id: 'old', at: '2026-09-01T00:00:00.000Z' },
    { id: 'before', at: '2026-11-02T00:00:00.000Z' },
    { id: 'after', at: '2026-11-12T00:00:00.000Z' },
  ];
  const result = notificationFeed(items, { since: '2026-11-10T00:00:00.000Z', now: NOW });
  assert.deepEqual(result.items.map(item => [item.id, item.unread]), [['after', true], ['before', false]]);
  assert.equal(result.unseen, 1);
});

test('avisos de novidade abrem a página de novidades e têm a área do que mudou', async t => {
  const { db } = fixture(t);
  const news = (await listNotifications(db, 'ana', NOW)).items.filter(item => item.kind === 'news');
  assert.ok(news.length > 0);
  for (const item of news) {
    assert.match(item.href, /^#novidades\?id=/);
    assert.ok(['site', 'desktop', 'extensao'].includes(item.area));
  }
});
