import test from 'node:test';
import { stepUnits } from '../../public/material-model.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { addCourse, createInitialState } from '../../public/domain.js';
import { sqliteAdapter } from '../../api/adapters/sqlite.js';
import {
  CollaborationError, cancelCollaborationInvite, createCollaborationInvite,
  listCollaborationInvites, respondCollaborationInvite,
} from '../../api/domain/collaboration.js';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0002_user_state.sql', '0004_friends.sql', '0007_state_revision.sql', '0010_collaboration.sql', '0012_library.sql']) {
    sqlite.exec(readFileSync(new URL(`../../migrations/${file}`, import.meta.url), 'utf8'));
  }
  const db = sqliteAdapter(sqlite);
  for (const [id, name] of [['u1', 'Ana'], ['u2', 'Bia']]) {
    sqlite.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, `${id}@example.test`, 'x', '2026-10-31T12:00:00Z');
  }
  for (const [a, b] of [['u1', 'u2'], ['u2', 'u1']]) {
    sqlite.prepare('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)')
      .run(a, b, '2026-10-31T12:00:00Z');
  }
  return { sqlite, db };
}

async function saveProject(db, ownerId) {
  let state = addCourse(createInitialState(), { title: 'Projeto de API', steps: ['Implementar autenticação', 'Publicar documentação'] });
  state.onboarded = true;
  state.courses[0].type = 'project';
  state.courses[0].id = 'p1';
  state.courses[0].units = stepUnits([{ id: 'p1-0', title: 'Implementar autenticação' }, { id: 'p1-1', title: 'Publicar documentação' }]);
  await db.run('INSERT INTO user_state (user_id, state, updated_at) VALUES (?, ?, ?)', [ownerId, JSON.stringify(state), '2026-10-31T12:00:00Z']);
  return state;
}

test('convite de colaboração exige amizade, projeto e entrega em aberto', async () => {
  const { db } = makeDb();
  await saveProject(db, 'u1');
  const created = await createCollaborationInvite(db, 'u1', { friendId: 'u2', courseId: 'p1', stepId: 'p1-0', note: 'Pode revisar comigo?' }, Date.parse('2026-10-31T12:00:00Z'));
  assert.equal(created.invite.status, 'pending');
  assert.equal(created.invite.person, 'Bia');
  assert.equal(created.invite.stepTitle, 'Implementar autenticação');
  await assert.rejects(
    () => createCollaborationInvite(db, 'u1', { friendId: 'u3', courseId: 'p1', stepId: 'p1-0' }),
    (error) => error instanceof CollaborationError && error.code === 'not_friends',
  );
  await assert.rejects(
    () => createCollaborationInvite(db, 'u1', { friendId: 'u2', courseId: 'p1', stepId: 'nao-existe' }),
    (error) => error.code === 'step_not_found',
  );
});

test('convite só pode ser respondido pelo destinatário e não copia o projeto', async () => {
  const { db } = makeDb();
  await saveProject(db, 'u1');
  const created = await createCollaborationInvite(db, 'u1', { friendId: 'u2', courseId: 'p1', stepId: 'p1-0' }, Date.parse('2026-10-31T12:00:00Z'));
  const inbox = await listCollaborationInvites(db, 'u2');
  assert.equal(inbox.pendingReceived, 1);
  assert.equal(inbox.received[0].courseTitle, 'Projeto de API');
  await assert.rejects(
    () => respondCollaborationInvite(db, 'u1', created.invite.id, { accept: true }),
    (error) => error.code === 'not_found',
  );
  const accepted = await respondCollaborationInvite(db, 'u2', created.invite.id, { accept: true }, Date.parse('2026-10-31T13:00:00Z'));
  assert.equal(accepted.status, 'accepted');
  const again = await respondCollaborationInvite(db, 'u2', created.invite.id, { accept: false });
  assert.equal(again.status, 'accepted', 'responder de novo mantém a primeira resposta');
  const friendState = await db.first('SELECT state FROM user_state WHERE user_id = ?', ['u2']);
  assert.equal(friendState, null, 'aceitar não copia o projeto para a biblioteca da outra pessoa');
});

test('cancelar convite pendente preserva o histórico', async () => {
  const { db } = makeDb();
  await saveProject(db, 'u1');
  const created = await createCollaborationInvite(db, 'u1', { friendId: 'u2', courseId: 'p1', stepId: 'p1-0' });
  const cancelled = await cancelCollaborationInvite(db, 'u1', created.invite.id);
  assert.equal(cancelled.status, 'cancelled');
  const sent = await listCollaborationInvites(db, 'u1');
  assert.equal(sent.sent[0].status, 'cancelled');
  await assert.rejects(
    () => cancelCollaborationInvite(db, 'u2', created.invite.id),
    (error) => error.code === 'not_found',
  );
});
