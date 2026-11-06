// Convites de colaboração em entregas de projeto.
//
// Regras:
// - só entre amizades aceitas;
// - apenas uma etapa de um material do tipo projeto;
// - aceitar é um acordo de ajuda: não copia o curso, não concede acesso ao
//   GitHub e não gera XP para nenhum dos lados;
// - o histórico do convite permanece após recusa ou cancelamento.

import { restoreState } from '../../public/domain.js';
import { AppError } from '../errors.js';
import { materialSteps } from '../../public/material-model.js';
import { isCompleted } from '../../public/progress-domain.js';

export const MAX_COLLABORATION_NOTE = 400;

export class CollaborationError extends AppError {
  constructor(message, code = 'collaboration_error', status = 400) {
    super(message, code, status);
    this.name = 'CollaborationError';
  }
}

function iso(now) {
  return new Date(now).toISOString();
}

function cleanNote(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, MAX_COLLABORATION_NOTE);
}

async function assertFriendship(db, ownerId, friendId) {
  if (!ownerId || !friendId || ownerId === friendId) throw new CollaborationError('Escolha uma amizade para convidar.', 'invalid_friend', 400);
  const linked = await db.first('SELECT 1 AS linked FROM friendships WHERE user_id = ? AND friend_id = ?', [ownerId, friendId]);
  if (!linked) throw new CollaborationError('Colaboração acontece apenas entre amizades aceitas.', 'not_friends', 403);
}

function serializeInvite(row, perspective) {
  const other = perspective === 'sent' ? row.friend_name : row.owner_name;
  return {
    id: row.id,
    direction: perspective,
    person: other || 'Pessoa do Lume',
    courseId: row.course_id,
    courseTitle: row.course_title,
    stepId: row.step_id,
    stepTitle: row.step_title,
    note: row.note || '',
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at || null,
  };
}

export async function createCollaborationInvite(db, ownerId, { friendId, courseId, stepId, note }, now = Date.now()) {
  await assertFriendship(db, ownerId, friendId);
  const { readStoredLibrary } = await import('./library-store.js');
  const stateRow = await readStoredLibrary(db, ownerId);
  if (!stateRow?.state) throw new CollaborationError('Salve seu progresso antes de convidar alguém.', 'state_missing', 409);
  let state;
  try { state = stateRow.state; } catch { throw new CollaborationError('Não foi possível ler sua biblioteca.', 'state_invalid', 409); }
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) throw new CollaborationError('Material não encontrado.', 'course_not_found', 404);
  if (course.type !== 'project') throw new CollaborationError('Convites de colaboração existem em projetos.', 'not_project', 400);
  const step = materialSteps(course).find((item) => item.id === stepId);
  if (!step) throw new CollaborationError('Entrega não encontrada.', 'step_not_found', 404);
  if (isCompleted(state, stepId)) throw new CollaborationError('Essa entrega já foi concluída.', 'already_completed', 409);

  const existing = await db.first(
    'SELECT * FROM delivery_invites WHERE owner_id = ? AND friend_id = ? AND course_id = ? AND step_id = ?',
    [ownerId, friendId, courseId, stepId],
  );
  if (existing && existing.status === 'accepted') {
    const row = await db.first(
      `SELECT i.*, u.name AS friend_name FROM delivery_invites i JOIN users u ON u.id = i.friend_id WHERE i.id = ?`,
      [existing.id],
    );
    return { invite: serializeInvite(row, 'sent'), alreadyAccepted: true };
  }
  const id = existing?.id || crypto.randomUUID();
  const clean = cleanNote(note);
  if (existing) {
    await db.run(
      'UPDATE delivery_invites SET status = ?, note = ?, created_at = ?, responded_at = NULL WHERE id = ?',
      ['pending', clean, iso(now), id],
    );
  } else {
    await db.run(
      `INSERT INTO delivery_invites
        (id, owner_id, friend_id, course_id, course_title, step_id, step_title, note, status, created_at, responded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)`,
      [id, ownerId, friendId, courseId, course.title, stepId, step.title, clean, iso(now)],
    );
  }
  const row = await db.first(
    `SELECT i.*, u.name AS friend_name FROM delivery_invites i JOIN users u ON u.id = i.friend_id WHERE i.id = ?`,
    [id],
  );
  return { invite: serializeInvite(row, 'sent'), alreadyAccepted: false };
}

export async function listCollaborationInvites(db, userId) {
  const sent = await db.all(
    `SELECT i.*, u.name AS friend_name FROM delivery_invites i
       JOIN users u ON u.id = i.friend_id
      WHERE i.owner_id = ? ORDER BY i.created_at DESC LIMIT 50`,
    [userId],
  );
  const received = await db.all(
    `SELECT i.*, u.name AS owner_name FROM delivery_invites i
       JOIN users u ON u.id = i.owner_id
      WHERE i.friend_id = ? ORDER BY i.created_at DESC LIMIT 50`,
    [userId],
  );
  return {
    sent: sent.map((row) => serializeInvite(row, 'sent')),
    received: received.map((row) => serializeInvite(row, 'received')),
    pendingReceived: received.filter((row) => row.status === 'pending').length,
  };
}

export async function respondCollaborationInvite(db, userId, inviteId, { accept }, now = Date.now()) {
  if (typeof accept !== 'boolean') throw new CollaborationError('Escolha aceitar ou recusar.', 'invalid_response', 400);
  const row = await db.first('SELECT * FROM delivery_invites WHERE id = ?', [inviteId]);
  if (!row || row.friend_id !== userId) throw new CollaborationError('Convite não encontrado.', 'not_found', 404);
  if (row.status !== 'pending') return { inviteId, status: row.status, respondedAt: row.responded_at || null };
  await db.run(
    'UPDATE delivery_invites SET status = ?, responded_at = ? WHERE id = ? AND status = ?',
    [accept ? 'accepted' : 'declined', iso(now), inviteId, 'pending'],
  );
  return { inviteId, status: accept ? 'accepted' : 'declined', respondedAt: iso(now) };
}

export async function cancelCollaborationInvite(db, userId, inviteId, now = Date.now()) {
  const row = await db.first('SELECT * FROM delivery_invites WHERE id = ?', [inviteId]);
  if (!row || row.owner_id !== userId) throw new CollaborationError('Convite não encontrado.', 'not_found', 404);
  if (row.status !== 'pending') throw new CollaborationError('Só é possível cancelar um convite pendente.', 'not_pending', 409);
  await db.run('UPDATE delivery_invites SET status = ?, responded_at = ? WHERE id = ?', ['cancelled', iso(now), inviteId]);
  return { inviteId, status: 'cancelled', respondedAt: iso(now) };
}
