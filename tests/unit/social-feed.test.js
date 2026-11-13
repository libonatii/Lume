import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applyMigrations, sqliteAdapter } from '../../api/adapters/sqlite.js';
import { createSocialPost, listSocialPosts, deleteSocialPost, reactToSocialPost, createSocialComment, listSocialComments, deleteSocialComment, readSocialAttachment } from '../../api/domain/social-feed.js';
import { SOCIAL_STORAGE_BYTES } from '../../public/social-domain.js';

function fixture(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  applyMigrations(sql, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  for (const [id, name] of [['ana', 'Ana'], ['bia', 'Bia'], ['carla', 'Carla']]) sql.prepare('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run(id, name, `${id}@example.test`, 'x', '2026-11-12T12:00:00Z');
  sql.exec("INSERT INTO friendships VALUES ('ana','bia','2026-11-12'), ('bia','ana','2026-11-12')");
  const objects = new Map();
  const bucket = { async put(key, bytes) { objects.set(key, bytes); }, async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }, async delete(key) { objects.delete(key); } };
  return { db: sqliteAdapter(sql), sql, bucket, objects };
}

test('feed é privado entre amigos; remover ou bloquear revoga leitura e interação', async t => {
  const { db, sql, bucket } = fixture(t);
  await createSocialPost(db, bucket, 'ana', { id: 'post', body: 'Revisando matrizes' });
  assert.equal((await listSocialPosts(db, 'ana')).posts.length, 1);
  assert.equal((await listSocialPosts(db, 'bia')).posts[0].author.name, 'Ana');
  assert.equal((await listSocialPosts(db, 'carla')).posts.length, 0);
  await assert.rejects(() => reactToSocialPost(db, 'carla', 'post', true), { code: 'post_not_found' });
  sql.exec("INSERT INTO contact_blocks (user_id,blocked_id,created_at) VALUES ('bia','ana','2026-11-12')");
  assert.equal((await listSocialPosts(db, 'bia')).posts.length, 0);
  await assert.rejects(() => createSocialComment(db, 'bia', 'post', { id: 'blocked', body: 'Oi' }), { code: 'post_not_found' });
  sql.exec('DELETE FROM contact_blocks; DELETE FROM friendships');
  assert.equal((await listSocialPosts(db, 'bia')).posts.length, 0);
});

test('envios e reações repetidos são idempotentes e não geram XP', async t => {
  const { db, sql, bucket } = fixture(t);
  for (let i = 0; i < 2; i++) await createSocialPost(db, bucket, 'ana', { id: 'post', body: '<script>texto literal</script>' });
  for (let i = 0; i < 2; i++) await reactToSocialPost(db, 'bia', 'post', true);
  for (let i = 0; i < 2; i++) await createSocialComment(db, 'bia', 'post', { id: 'comment', body: 'Bom estudo!' });
  const result = await listSocialPosts(db, 'bia');
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].body, '<script>texto literal</script>');
  assert.equal(result.posts[0].reactions, 1);
  assert.equal(result.posts[0].comments, 1);
  assert.equal(result.posts[0].reacted, true);
  assert.equal(sql.prepare('SELECT COUNT(*) AS total FROM xp_events').get().total, 0);
  await reactToSocialPost(db, 'bia', 'post', false);
  assert.equal((await listSocialPosts(db, 'bia')).posts[0].reactions, 0);
});

test('exclusão protege autoria e autor da publicação pode moderar comentários', async t => {
  const { db, bucket } = fixture(t);
  await createSocialPost(db, bucket, 'ana', { id: 'post', body: 'Dúvida', kind: 'question' });
  await createSocialComment(db, 'bia', 'post', { id: 'comment', body: 'Resposta' });
  assert.equal((await listSocialComments(db, 'ana', 'post')).comments[0].canDelete, true);
  await assert.rejects(() => deleteSocialPost(db, bucket, 'bia', 'post'), { code: 'not_owner' });
  await deleteSocialComment(db, 'ana', 'post', 'comment');
  assert.equal((await listSocialComments(db, 'bia', 'post')).comments.length, 0);
  await createSocialComment(db, 'bia', 'post', { id: 'another', body: 'Outra' });
  await deleteSocialPost(db, bucket, 'ana', 'post');
  await assert.rejects(() => listSocialComments(db, 'bia', 'post'), { code: 'post_not_found' });
});

test('foto fica privada; excluir publicação remove objeto e libera cota', async t => {
  const { db, bucket, objects, sql } = fixture(t);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await createSocialPost(db, bucket, 'ana', { id: 'photo', body: 'Meu resumo' }, { name: 'resumo.png', bytes });
  assert.equal(objects.size, 1);
  assert.equal((await readSocialAttachment(db, bucket, 'bia', 'photo')).type, 'image/png');
  await assert.rejects(() => readSocialAttachment(db, bucket, 'carla', 'photo'), { code: 'post_not_found' });
  sql.exec('DELETE FROM friendships');
  await assert.rejects(() => readSocialAttachment(db, bucket, 'bia', 'photo'), { code: 'post_not_found' });
  await deleteSocialPost(db, bucket, 'ana', 'photo');
  assert.equal(objects.size, 0);
});

test('valida limites, conquista própria e cota de anexos; falha de upload não publica', async t => {
  const { db, sql, bucket } = fixture(t);
  await assert.rejects(() => createSocialPost(db, bucket, 'ana', { id: 'empty', body: '  ' }), { code: 'empty_post' });
  await assert.rejects(() => createSocialPost(db, bucket, 'ana', { id: 'long', body: 'a'.repeat(2001) }), { code: 'text_too_long' });
  await assert.rejects(() => createSocialPost(db, bucket, 'ana', { id: 'fake', achievementId: 'fake' }), { code: 'invalid_achievement' });
  sql.prepare(`INSERT INTO user_achievements (id,user_id,event_id,kind,material_id,material_title,criterion,policy_version,origin,earned_at)
    VALUES ('badge','ana','event','reading','book','Leitura concluída','Leitura delimitada concluída','2','manual','2026-11-12')`).run();
  await assert.rejects(() => createSocialPost(db, bucket, 'bia', { id: 'stolen', achievementId: 'badge' }), { code: 'invalid_achievement' });
  await createSocialPost(db, bucket, 'ana', { id: 'earned', achievementId: 'badge' });
  assert.equal((await listSocialPosts(db, 'bia')).posts[0].achievement.title, 'Leitura concluída');
  sql.prepare("UPDATE user_achievements SET revoked_at='2026-11-12' WHERE id='badge'").run();
  assert.equal((await listSocialPosts(db, 'bia')).posts[0].achievement, null);
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await assert.rejects(() => createSocialPost(db, { ...bucket, async put() { throw new Error('Falha no R2'); } }, 'ana', { id: 'failed' }, { name: 'a.png', bytes }), /Falha no R2/);
  assert.equal(sql.prepare("SELECT COUNT(*) AS total FROM social_posts WHERE id='failed'").get().total, 0);
  sql.prepare("UPDATE social_posts SET attachment_size=? WHERE id='earned'").run(SOCIAL_STORAGE_BYTES);
  await assert.rejects(() => createSocialPost(db, bucket, 'ana', { id: 'full' }, { name: 'a.png', bytes }), { code: 'post_not_reserved' });
});

test('paginação do feed não repete publicações com a mesma data', async t => {
  const { db, bucket } = fixture(t);
  for (let i = 0; i < 23; i++) await createSocialPost(db, bucket, 'ana', { id: `post-${String(i).padStart(2, '0')}`, body: 'Estudo' }, null, 1794484800000);
  const first = await listSocialPosts(db, 'bia');
  const second = await listSocialPosts(db, 'bia', { cursor: first.nextCursor });
  assert.equal(first.posts.length, 20);
  assert.equal(second.posts.length, 3);
  assert.equal(new Set([...first.posts, ...second.posts].map(p => p.id)).size, 23);
  assert.equal(second.nextCursor, null);
  await assert.rejects(() => listSocialPosts(db, 'bia', { cursor: 'inválido' }), { code: 'invalid_cursor' });
});
