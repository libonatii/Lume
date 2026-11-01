// Mensagens diretas entre amizades aceitas.
//
// Regras de produto:
// - só existe conversa entre pessoas com amizade registrada nos dois sentidos;
// - bloquear interrompe novas mensagens nos dois sentidos, mas preserva o
//   histórico; desbloquear reabre a conversa;
// - mensagens, referências e notificações não geram XP;
// - referências compartilhadas carregam apenas tipo, id e título, nunca o
//   conteúdo privado do material.

import { AppError } from '../errors.js';

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_MESSAGES_PER_THREAD = 200;
export const MAX_REFERENCE_TITLE = 160;
export const MESSAGE_WINDOW_LIMIT = 120;

export class MessagesError extends AppError {
  constructor(message, code = 'messages_error', status = 400) {
    super(message, code, status);
    this.name = 'MessagesError';
  }
}

function iso(now) {
  return new Date(now).toISOString();
}

function cleanId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value) ? value : '';
}

function cleanBody(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, MAX_MESSAGE_LENGTH);
}

function cleanReference(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const type = ['course', 'lesson', 'article', 'book', 'exercise', 'project', 'slide'].includes(value.type) ? value.type : 'course';
  const id = cleanId(value.id);
  const title = String(value.title ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_REFERENCE_TITLE);
  if (!id || !title) return null;
  return { type, id, title };
}

function serializeReference(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return cleanReference(parsed);
  } catch {
    return null;
  }
}

function serializeMessage(row, userId) {
  return {
    id: row.id,
    fromMe: row.sender_id === userId,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    reference: serializeReference(row.reference),
    at: row.created_at,
    readAt: row.read_at || null,
  };
}

async function assertFriendship(db, userId, friendId) {
  if (!userId || !friendId || userId === friendId) {
    throw new MessagesError('Escolha uma amizade para conversar.', 'invalid_contact', 400);
  }
  const linked = await db.first(
    'SELECT 1 AS linked FROM friendships WHERE user_id = ? AND friend_id = ?',
    [userId, friendId],
  );
  if (!linked) {
    throw new MessagesError('Mensagens diretas existem apenas entre amizades aceitas.', 'not_friends', 403);
  }
}

async function blockState(db, userId, friendId) {
  const mine = await db.first('SELECT 1 AS blocked FROM contact_blocks WHERE user_id = ? AND blocked_id = ?', [userId, friendId]);
  const theirs = await db.first('SELECT 1 AS blocked FROM contact_blocks WHERE user_id = ? AND blocked_id = ?', [friendId, userId]);
  return { blockedByMe: Boolean(mine), blockedMe: Boolean(theirs) };
}

function assertCanMessage(blocks) {
  if (blocks.blockedByMe) throw new MessagesError('Você bloqueou esta pessoa. Desbloqueie para enviar mensagens.', 'blocked_by_me', 403);
  if (blocks.blockedMe) throw new MessagesError('Esta pessoa não está aceitando mensagens suas agora.', 'blocked_by_them', 403);
}

export async function listConversations(db, userId, now = Date.now()) {
  if (!userId) throw new MessagesError('Entre na sua conta para ver suas mensagens.', 'unauthenticated', 401);
  const friends = await db.all(
    `SELECT u.id, u.name, f.created_at AS since
       FROM friendships f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ?
      ORDER BY u.name COLLATE NOCASE`,
    [userId],
  );
  const rows = [];
  for (const friend of friends) {
    const last = await db.first(
      `SELECT id, sender_id, recipient_id, body, created_at
         FROM direct_messages
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
        ORDER BY created_at DESC, id DESC LIMIT 1`,
      [userId, friend.id, friend.id, userId],
    );
    const unread = await db.first(
      `SELECT COUNT(*) AS total FROM direct_messages
        WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`,
      [friend.id, userId],
    );
    const blocks = await blockState(db, userId, friend.id);
    rows.push({
      id: friend.id,
      name: friend.name,
      since: friend.since,
      lastMessage: last ? {
        id: last.id,
        fromMe: last.sender_id === userId,
        preview: last.body.length > 120 ? `${last.body.slice(0, 120)}…` : last.body,
        at: last.created_at,
      } : null,
      unread: Number(unread?.total || 0),
      blockedByMe: blocks.blockedByMe,
      blockedMe: blocks.blockedMe,
      canMessage: !blocks.blockedByMe && !blocks.blockedMe,
    });
  }
  rows.sort((left, right) => {
    const a = left.lastMessage?.at || '';
    const b = right.lastMessage?.at || '';
    if (a !== b) return b.localeCompare(a);
    return left.name.localeCompare(right.name, 'pt-BR');
  });
  return { conversations: rows, count: rows.length };
}

export async function getThread(db, userId, friendId) {
  await assertFriendship(db, userId, friendId);
  const blocks = await blockState(db, userId, friendId);
  const rows = await db.all(
    `SELECT id, sender_id, recipient_id, body, reference, created_at, read_at
       FROM direct_messages
      WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
      ORDER BY created_at DESC, id DESC LIMIT ?`,
    [userId, friendId, friendId, userId, MAX_MESSAGES_PER_THREAD],
  );
  const friend = await db.first('SELECT id, name FROM users WHERE id = ?', [friendId]);
  return {
    friend: friend ? { id: friend.id, name: friend.name } : { id: friendId, name: 'Pessoa do Lume' },
    messages: rows.reverse().map((row) => serializeMessage(row, userId)),
    blockedByMe: blocks.blockedByMe,
    blockedMe: blocks.blockedMe,
    canMessage: !blocks.blockedByMe && !blocks.blockedMe,
  };
}

export async function sendMessage(db, userId, friendId, { body, reference } = {}, now = Date.now()) {
  await assertFriendship(db, userId, friendId);
  const blocks = await blockState(db, userId, friendId);
  assertCanMessage(blocks);
  const text = cleanBody(body);
  const ref = cleanReference(reference);
  if (!text && !ref) throw new MessagesError('Escreva uma mensagem ou escolha um material.', 'empty_message', 400);
  const id = crypto.randomUUID();
  await db.run(
    `INSERT INTO direct_messages (id, sender_id, recipient_id, body, reference, created_at, read_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [id, userId, friendId, text, ref ? JSON.stringify(ref) : null, iso(now)],
  );
  const row = await db.first('SELECT * FROM direct_messages WHERE id = ?', [id]);
  return { message: serializeMessage(row, userId) };
}

export async function markThreadRead(db, userId, friendId, now = Date.now()) {
  await assertFriendship(db, userId, friendId);
  const read = await db.run(
    'UPDATE direct_messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL',
    [iso(now), friendId, userId],
  );
  return { read };
}

export async function unreadSummary(db, userId) {
  if (!userId) throw new MessagesError('Entre na sua conta para ver suas notificações.', 'unauthenticated', 401);
  const row = await db.first(
    `SELECT COUNT(*) AS total FROM direct_messages m
      WHERE m.recipient_id = ? AND m.read_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM contact_blocks b WHERE b.user_id = ? AND b.blocked_id = m.sender_id)`,
    [userId, userId],
  );
  const preferences = await messagePreferences(db, userId);
  return { unread: Number(row?.total || 0), notifications: preferences.notifications };
}

export async function messagePreferences(db, userId) {
  let row = await db.first('SELECT notifications FROM message_preferences WHERE user_id = ?', [userId]);
  if (!row) {
    await db.run(
      'INSERT OR IGNORE INTO message_preferences (user_id, notifications, updated_at) VALUES (?, 1, ?)',
      [userId, iso(Date.now())],
    );
    row = await db.first('SELECT notifications FROM message_preferences WHERE user_id = ?', [userId]);
  }
  return { notifications: row ? Number(row.notifications) !== 0 : true };
}

export async function updateMessagePreferences(db, userId, { notifications }, now = Date.now()) {
  if (typeof notifications !== 'boolean') throw new MessagesError('Escolha se quer receber notificações.', 'invalid_preference', 400);
  await db.run(
    `INSERT INTO message_preferences (user_id, notifications, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET notifications = excluded.notifications, updated_at = excluded.updated_at`,
    [userId, notifications ? 1 : 0, iso(now)],
  );
  return { notifications };
}

export async function blockContact(db, userId, friendId, now = Date.now()) {
  if (!userId || !friendId || userId === friendId) throw new MessagesError('Contato inválido.', 'invalid_contact', 400);
  const target = await db.first('SELECT 1 AS found FROM users WHERE id = ?', [friendId]);
  if (!target) throw new MessagesError('Pessoa não encontrada.', 'not_found', 404);
  await db.run(
    'INSERT OR IGNORE INTO contact_blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)',
    [userId, friendId, iso(now)],
  );
  return { blocked: true, blockedId: friendId };
}

export async function unblockContact(db, userId, friendId) {
  if (!userId || !friendId) throw new MessagesError('Contato inválido.', 'invalid_contact', 400);
  await db.run('DELETE FROM contact_blocks WHERE user_id = ? AND blocked_id = ?', [userId, friendId]);
  return { blocked: false, blockedId: friendId };
}

export async function listBlocks(db, userId) {
  const rows = await db.all(
    `SELECT b.blocked_id, u.name, b.created_at FROM contact_blocks b
       JOIN users u ON u.id = b.blocked_id
      WHERE b.user_id = ? ORDER BY b.created_at DESC`,
    [userId],
  );
  return { blocks: rows.map((row) => ({ id: row.blocked_id, name: row.name, since: row.created_at })) };
}
