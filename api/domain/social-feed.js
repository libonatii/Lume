// Feed privado: a visibilidade é reavaliada em cada leitura, inclusive nos
// anexos. Desfazer amizade ou bloquear interrompe o acesso nos dois sentidos.
import { AppError } from '../errors.js';
import { sanitizeProfileImage } from '../../public/domain.js';
import { socialText, socialFileName, SOCIAL_POST_LIMIT, SOCIAL_COMMENT_LIMIT, SOCIAL_PDF_BYTES, SOCIAL_STORAGE_BYTES, SOCIAL_PAGE_SIZE } from '../../public/social-domain.js';
import { detectImageType } from './media.js';
import { isPdf, storagePlan } from './library-files.js';
import { formatBytes } from '../../public/pdf-domain.js';

export class SocialError extends AppError {
  constructor(message, code = 'social_error', status = 400) { super(message, code, status); }
}

function idOf(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new SocialError('Identificador inválido.', 'invalid_id');
  return value;
}

function textOf(value, limit) {
  const text = socialText(value);
  if (text.length > limit) throw new SocialError(`Use até ${limit} caracteres.`, 'text_too_long');
  return text;
}

// IDs e datas do cursor são valores parametrizados, nunca trechos de SQL.
function cursorOf(value) {
  if (!value) return null;
  const [at, id, extra] = String(value).split('|');
  if (extra || !at || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) throw new SocialError('Página inválida.', 'invalid_cursor');
  return { at, id: idOf(id) };
}

function visibility(userId, alias = 'p') {
  return { sql: `(${alias}.user_id = ? OR (
    EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = ? AND f.friend_id = ${alias}.user_id)
    AND EXISTS (SELECT 1 FROM friendships f WHERE f.user_id = ${alias}.user_id AND f.friend_id = ?)))
    AND NOT EXISTS (SELECT 1 FROM contact_blocks b WHERE
      (b.user_id = ? AND b.blocked_id = ${alias}.user_id) OR (b.user_id = ${alias}.user_id AND b.blocked_id = ?))`,
  params: [userId, userId, userId, userId, userId] };
}

async function visiblePost(db, userId, postId) {
  const access = visibility(userId);
  const post = await db.first(`SELECT p.* FROM social_posts p WHERE p.id = ? AND p.ready = 1 AND ${access.sql}`, [idOf(postId), ...access.params]);
  if (!post) throw new SocialError('Publicação não encontrada ou indisponível para você.', 'post_not_found', 404);
  return post;
}

function author(row) {
  return { id: row.user_id, name: row.name, avatar: sanitizeProfileImage(row.avatar) };
}

function commentView(row, userId, ownerId) {
  return { id: row.id, body: row.body, at: row.created_at, author: author(row), canDelete: row.user_id === userId || ownerId === userId };
}

const AUTHOR_JOIN = `JOIN users u ON u.id = p.user_id LEFT JOIN account_documents d ON d.user_id = p.user_id`;
const POST_SELECT = `p.*, u.name, json_extract(d.data, '$.profile.avatar') AS avatar,
  (SELECT COUNT(*) FROM social_reactions r WHERE r.post_id = p.id) AS reactions,
  (SELECT COUNT(*) FROM social_comments c WHERE c.post_id = p.id) AS comments,
  a.material_title AS achievement_title, a.criterion AS achievement_criterion`;

async function postView(db, row, userId) {
  const reacted = await db.first('SELECT 1 AS yes FROM social_reactions WHERE post_id=? AND user_id=?', [row.id, userId]);
  return {
    id: row.id, body: row.body, kind: row.kind, at: row.created_at, author: author(row), canDelete: row.user_id === userId,
    reactions: Number(row.reactions), reacted: Boolean(reacted), comments: Number(row.comments),
    achievement: row.achievement_title ? { title: row.achievement_title, criterion: row.achievement_criterion } : null,
    attachment: row.attachment_key ? { name: row.attachment_name, type: row.attachment_type, size: row.attachment_size, url: `/api/social/posts/${row.id}/attachment` } : null,
  };
}

export async function listSocialPosts(db, userId, { cursor = '' } = {}) {
  const access = visibility(userId);
  const after = cursorOf(cursor);
  const rows = await db.all(`SELECT ${POST_SELECT} FROM social_posts p ${AUTHOR_JOIN}
    LEFT JOIN user_achievements a ON a.id=p.achievement_id AND a.user_id=p.user_id AND a.revoked_at IS NULL
    WHERE p.ready = 1 AND ${access.sql} ${after ? 'AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?))' : ''}
    ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
  [...access.params, ...(after ? [after.at, after.at, after.id] : []), SOCIAL_PAGE_SIZE + 1]);
  const selected = rows.slice(0, SOCIAL_PAGE_SIZE);
  const posts = [];
  for (const row of selected) posts.push(await postView(db, row, userId));
  const last = selected.at(-1);
  return { posts, nextCursor: rows.length > SOCIAL_PAGE_SIZE ? `${last.created_at}|${last.id}` : null };
}

export async function createSocialPost(db, bucket, userId, input = {}, file = null, now = Date.now(), config = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SocialError('Publicação inválida.', 'invalid_post');
  const id = idOf(input.id);
  const previous = await db.first('SELECT user_id, ready FROM social_posts WHERE id=?', [id]);
  if (previous) {
    if (previous.user_id !== userId) throw new SocialError('Identificador de publicação já usado.', 'id_conflict', 409);
    if (!previous.ready) throw new SocialError('Esta publicação está sendo enviada. Tente novamente em instantes.', 'post_pending', 409);
    return { id };
  }
  const body = textOf(input.body, SOCIAL_POST_LIMIT);
  let kind = input.kind === 'question' ? 'question' : 'post';
  let achievementId = null;
  let attachment = null;
  if (input.achievementId) {
    if (file) throw new SocialError('Escolha uma conquista ou um arquivo por publicação.', 'one_attachment');
    const earned = await db.first('SELECT id FROM user_achievements WHERE id=? AND user_id=? AND revoked_at IS NULL', [idOf(input.achievementId), userId]);
    if (!earned) throw new SocialError('Escolha uma conquista validada da sua conta.', 'invalid_achievement');
    achievementId = earned.id; kind = 'achievement';
  }
  if (file) {
    if (!bucket) throw new SocialError('Armazenamento indisponível. Tente novamente mais tarde.', 'storage_unavailable', 503);
    const bytes = file.bytes;
    if (isPdf(bytes)) {
      if (bytes.byteLength > SOCIAL_PDF_BYTES) throw new SocialError('O PDF pode ter até 10 MB.', 'file_too_large', 413);
      attachment = { type: 'application/pdf', ext: 'pdf' }; kind = 'material';
    } else { attachment = detectImageType(bytes); kind = 'image'; }
    attachment = { ...attachment, type: attachment.type || attachment.contentType, name: socialFileName(file.name), size: bytes.byteLength };
    attachment.key = `social/${idOf(userId)}/${id}.${attachment.ext}`;
  }
  if (!body && !attachment && !achievementId) throw new SocialError('Escreva algo ou escolha um anexo.', 'empty_post');
  // Reserva atômica de cota unificada (Biblioteca + Social); o post só entra no feed depois que o objeto existe.
  let reserved;
  if (attachment) {
    const plan = await storagePlan(db, userId, config);
    reserved = await db.run(`INSERT INTO social_posts
      (id,user_id,body,kind,achievement_id,attachment_key,attachment_name,attachment_type,attachment_size,ready,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,0,? WHERE
        (SELECT COALESCE(SUM(attachment_size),0) FROM social_posts WHERE user_id=?)
        + (SELECT COALESCE(SUM(size),0) FROM library_files WHERE user_id=?)
        + ? <= ?
      ON CONFLICT(id) DO NOTHING`,
    [id, userId, body, kind, achievementId, attachment.key, attachment.name, attachment.type, attachment.size, new Date(now).toISOString(), userId, userId, attachment.size, plan.accountBytes]);
    if (!reserved) throw new SocialError(`O armazenamento da conta (${formatBytes(plan.accountBytes)}) não comporta este anexo. Exclua arquivos antigos para liberar espaço.`, 'post_not_reserved', 409);
  } else {
    reserved = await db.run(`INSERT INTO social_posts
      (id,user_id,body,kind,achievement_id,attachment_key,attachment_name,attachment_type,attachment_size,ready,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,0,?)
      ON CONFLICT(id) DO NOTHING`,
    [id, userId, body, kind, achievementId, null, null, null, 0, new Date(now).toISOString()]);
    if (!reserved) throw new SocialError('A publicação já está em envio. Aguarde um instante.', 'post_not_reserved', 409);
  }
  try {
    if (attachment) await bucket.put(attachment.key, file.bytes, attachment.type);
    await db.run('UPDATE social_posts SET ready=1 WHERE id=? AND user_id=?', [id, userId]);
  } catch (error) {
    if (attachment) await bucket.delete(attachment.key).catch(() => {});
    await db.run('DELETE FROM social_posts WHERE id=? AND user_id=?', [id, userId]);
    throw error;
  }
  return { id };
}

export async function deleteSocialPost(db, bucket, userId, postId) {
  const post = await visiblePost(db, userId, postId);
  if (post.user_id !== userId) throw new SocialError('Você só pode excluir suas publicações.', 'not_owner', 403);
  if (post.attachment_key) {
    if (!bucket) throw new SocialError('Armazenamento indisponível. Tente novamente.', 'storage_unavailable', 503);
    await bucket.delete(post.attachment_key);
  }
  await db.run('DELETE FROM social_posts WHERE id=? AND user_id=?', [post.id, userId]);
  return { removed: true };
}

export async function readSocialAttachment(db, bucket, userId, postId) {
  const post = await visiblePost(db, userId, postId);
  if (!post.attachment_key) throw new SocialError('Anexo não encontrado.', 'file_not_found', 404);
  const object = await bucket?.get(post.attachment_key);
  if (!object) throw new SocialError('Anexo indisponível.', 'file_not_found', 404);
  return { object, name: post.attachment_name, type: post.attachment_type };
}

export async function reactToSocialPost(db, userId, postId, liked, now = Date.now()) {
  const post = await visiblePost(db, userId, postId);
  if (liked) await db.run('INSERT OR IGNORE INTO social_reactions (post_id,user_id,created_at) VALUES (?,?,?)', [post.id, userId, new Date(now).toISOString()]);
  else await db.run('DELETE FROM social_reactions WHERE post_id=? AND user_id=?', [post.id, userId]);
  return { reacted: liked };
}

export async function listSocialComments(db, userId, postId, { cursor = '' } = {}) {
  const post = await visiblePost(db, userId, postId);
  const after = cursorOf(cursor);
  const rows = await db.all(`SELECT c.*, u.name, json_extract(d.data, '$.profile.avatar') AS avatar FROM social_comments c
    JOIN users u ON u.id=c.user_id LEFT JOIN account_documents d ON d.user_id=c.user_id
    WHERE c.post_id=? AND NOT EXISTS (SELECT 1 FROM contact_blocks b WHERE
      (b.user_id=? AND b.blocked_id=c.user_id) OR (b.user_id=c.user_id AND b.blocked_id=?))
    ${after ? 'AND (c.created_at > ? OR (c.created_at = ? AND c.id > ?))' : ''}
    ORDER BY c.created_at, c.id LIMIT 51`, [post.id, userId, userId, ...(after ? [after.at, after.at, after.id] : [])]);
  const selected = rows.slice(0, 50);
  const last = selected.at(-1);
  return { comments: selected.map(row => commentView(row, userId, post.user_id)), nextCursor: rows.length > 50 ? `${last.created_at}|${last.id}` : null };
}

export async function createSocialComment(db, userId, postId, input = {}, now = Date.now()) {
  await visiblePost(db, userId, postId);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SocialError('Comentário inválido.', 'invalid_comment');
  const body = textOf(input.body, SOCIAL_COMMENT_LIMIT);
  if (!body) throw new SocialError('Escreva um comentário.', 'empty_comment');
  const id = idOf(input.id);
  const existing = await db.first('SELECT post_id,user_id FROM social_comments WHERE id=?', [id]);
  if (existing && (existing.user_id !== userId || existing.post_id !== postId)) throw new SocialError('Identificador já usado.', 'id_conflict', 409);
  await db.run('INSERT OR IGNORE INTO social_comments (id,post_id,user_id,body,created_at) VALUES (?,?,?,?,?)', [id, postId, userId, body, new Date(now).toISOString()]);
  return { id };
}

export async function deleteSocialComment(db, userId, postId, commentId) {
  const post = await visiblePost(db, userId, postId);
  const comment = await db.first('SELECT user_id FROM social_comments WHERE id=? AND post_id=?', [idOf(commentId), postId]);
  if (!comment) throw new SocialError('Comentário não encontrado.', 'comment_not_found', 404);
  if (comment.user_id !== userId && post.user_id !== userId) throw new SocialError('Você não pode excluir este comentário.', 'not_owner', 403);
  await db.run('DELETE FROM social_comments WHERE id=? AND post_id=?', [commentId, postId]);
  return { removed: true };
}
