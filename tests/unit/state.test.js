import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { StateError, parseStateBody, readState, writeState } from '../../api/domain/state.js';
import { createInitialState } from '../../public/domain.js';
import { sqliteAdapter } from '../../api/adapters/sqlite.js';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../migrations/0001_init.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0002_user_state.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../../migrations/0007_state_revision.sql', import.meta.url), 'utf8'));
  sqlite.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('u1', 'Ana', 'ana@example.test', 'x', '2026-10-31T12:00:00Z');
  return sqliteAdapter(sqlite);
}

test('primeira gravação cria revisão 1 e leitura devolve o estado', async () => {
  const db = makeDb();
  const state = createInitialState();
  const result = await writeState(db, 'u1', { state, text: JSON.stringify(state), baseRevision: 0 }, { now: Date.parse('2026-10-31T12:00:00Z') });
  assert.equal(result.conflict, false);
  assert.equal(result.revision, 1);
  const read = await readState(db, 'u1');
  assert.equal(read.revision, 1);
  assert.equal(read.state.version, 2);
});

test('revisão antiga recebe conflito e o estado atual, sem sobrescrever', async () => {
  const db = makeDb();
  const state = createInitialState();
  await writeState(db, 'u1', { state, text: JSON.stringify(state), baseRevision: 0 });
  const second = await writeState(db, 'u1', { state: { ...state, onboarded: true }, text: JSON.stringify({ ...state, onboarded: true }), baseRevision: 1 });
  assert.equal(second.revision, 2);
  const stale = await writeState(db, 'u1', { state, text: JSON.stringify(state), baseRevision: 1 });
  assert.equal(stale.conflict, true);
  assert.equal(stale.current.revision, 2);
  assert.equal(stale.current.state.onboarded, true);
  assert.equal((await readState(db, 'u1')).state.onboarded, true);
});

test('formato antigo sem baseRevision continua aceito e incrementa a revisão', async () => {
  const db = makeDb();
  const state = createInitialState();
  const parsed = parseStateBody(JSON.stringify(state));
  assert.equal(parsed.baseRevision, null);
  const result = await writeState(db, 'u1', parsed);
  assert.equal(result.conflict, false);
  assert.equal(result.revision, 1);
});

test('corpo inválido ou grande demais é recusado', () => {
  assert.throws(() => parseStateBody('{'), (error) => error instanceof StateError && error.code === 'invalid_state');
  assert.throws(() => parseStateBody('[]'), (error) => error.code === 'invalid_state');
  assert.throws(() => parseStateBody('x'.repeat(320 * 1024 + 1)), (error) => error.code === 'state_too_large');
});

test('cliente antigo não grava o formato v1 por cima de um documento v2', async () => {
  const db = makeDb();
  const state = createInitialState();
  await writeState(db, 'u1', { state, text: JSON.stringify(state), baseRevision: 0 });
  const old = { version: 1, courses: [], completed: [], history: [] };
  await assert.rejects(
    () => writeState(db, 'u1', { state: old, text: JSON.stringify(old), baseRevision: 1 }),
    (error) => error.code === 'client_outdated' && error.status === 409,
  );
  assert.equal((await readState(db, 'u1')).state.version, 2);
});
