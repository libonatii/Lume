import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { sqliteAdapter, applyMigrations } from '../../api/adapters/sqlite.js';
import { readLibrary } from '../../api/domain/library-store.js';
import { applyLibraryActions } from '../../api/domain/library-actions.js';
import { libraryActions } from '../../public/library-actions.js';
import { addCourse, completeMission, createInitialState, restoreState } from '../../public/domain.js';
import { ensureXpSettings } from '../../api/domain/xp.js';
import { normalizePayload, applyCourseImport } from '../../public/import-domain.js';
import { writeState } from '../../api/domain/state.js';

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  applyMigrations(sqlite, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  const db = sqliteAdapter(sqlite);
  sqlite.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run('u1', 'Teste', 'u1@example.test', 'x', '2026-01-01');
  return { db, sqlite };
}

test('converte só o documento do servidor, preserva o arquivo e passa a ler tabelas', async (t) => {
  const { db } = fixture(t);
  const old = addCourse(createInitialState(), { title: 'Curso preservado', steps: ['Aula 1', 'Aula 2'] }, 'c1');
  await db.run('INSERT INTO user_state(user_id,state,revision,updated_at) VALUES (?,?,1,?)', ['u1', JSON.stringify(old), '2026-01-01']);
  const first = await readLibrary(db, 'u1');
  assert.equal(first.state.courses[0].title, 'Curso preservado');
  const raw = JSON.parse((await db.first('SELECT data FROM materials WHERE user_id=?', ['u1'])).data);
  assert.equal('steps' in raw, false);
  assert.equal('structure' in raw, false);
  assert.equal((await db.all('SELECT * FROM units')).length, 2);
  assert.equal((await db.first('SELECT state FROM user_state')).state, JSON.stringify(old));
  await assert.rejects(writeState(db, 'u1', { state: old, baseRevision: 1 }), { code: 'client_outdated' });
});

test('conversão refaz a leitura se um cliente antigo salvar durante a migração', async (t) => {
  const { db } = fixture(t);
  const old = addCourse(createInitialState(), { title: 'Antes', steps: ['Aula'] }, 'c1');
  const updated = { ...old, courses: old.courses.map((course) => ({ ...course, title: 'Última gravação' })) };
  await db.run('INSERT INTO user_state(user_id,state,revision,updated_at) VALUES (?,?,1,?)', ['u1', JSON.stringify(old), '2026-01-01']);
  let raced = false;
  const racingDb = { ...db, async batch(statements) {
    if (!raced) {
      raced = true;
      await db.run('UPDATE user_state SET state=?,revision=2 WHERE user_id=?', [JSON.stringify(updated), 'u1']);
    }
    return db.batch(statements);
  } };
  assert.equal((await readLibrary(racingDb, 'u1')).state.courses[0].title, 'Última gravação');
});

test('mutações concedem XP uma vez e conflito não sobrescreve alterações', async (t) => {
  const { db } = fixture(t);
  const now = Date.now();
  await ensureXpSettings(db, 'u1', { now: now - 10000 });
  const initial = await readLibrary(db, 'u1');
  const added = addCourse(initial.state, { title: 'Curso', steps: ['Aula 1', 'Aula 2'] }, 'c1');
  const created = await applyLibraryActions(db, 'u1', { id: 'create', revision: initial.revision, actions: libraryActions(initial.state, added) }, { now });
  const completed = completeMission(created.state, 'c1', 'c1-0', { now: new Date(now).toISOString() }).state;
  const operation = { id: 'complete', revision: created.revision, actions: libraryActions(created.state, completed) };
  await applyLibraryActions(db, 'u1', operation, { now });
  await applyLibraryActions(db, 'u1', operation, { now });
  assert.equal((await db.first('SELECT SUM(xp) AS total FROM xp_events')).total, 100);
  await assert.rejects(applyLibraryActions(db, 'u1', { id: 'stale', revision: created.revision, actions: [{ type: 'material.delete', id: 'c1' }] }), { code: 'library_conflict' });
  assert.equal((await readLibrary(db, 'u1')).state.courses.length, 1);
  const latest = await readLibrary(db, 'u1');
  await assert.rejects(applyLibraryActions(db, 'u1', { id: 'erase', revision: latest.revision, actions: [{ type: 'progress.delete', id: latest.state.progress[0].id }] }), { code: 'invalid_library_action' });
});

test('falha ao gravar conquista reverte material, progresso e XP no mesmo batch', async (t) => {
  const { db, sqlite } = fixture(t);
  const now = Date.now();
  await ensureXpSettings(db, 'u1', { now: now - 10000 });
  const initial = await readLibrary(db, 'u1');
  let next = addCourse(initial.state, { title: 'Leitura', steps: ['Artigo'] }, 'c1');
  next.courses[0].type = 'article';
  next = completeMission(next, 'c1', 'c1-0', { now: new Date(now).toISOString() }).state;
  sqlite.exec("CREATE TRIGGER fail_achievement BEFORE INSERT ON user_achievements BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
  const operation = { id: 'atomic', revision: initial.revision, actions: libraryActions(initial.state, next) };
  await assert.rejects(applyLibraryActions(db, 'u1', operation, { now }), /falha simulada/);
  assert.equal((await db.first('SELECT COUNT(*) AS n FROM xp_events')).n, 0);
  assert.equal((await readLibrary(db, 'u1')).state.courses.length, 0);
  sqlite.exec('DROP TRIGGER fail_achievement');
  await applyLibraryActions(db, 'u1', operation, { now });
  assert.equal((await db.first('SELECT COUNT(*) AS n FROM user_achievements')).n, 1);
});

test('identidade externa sobrevive à restauração e ao fallback sem externalId', () => {
  const input = { title: 'Curso', sourceUrl: 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/123', provider: { id: 'grancursos' }, disciplines: [{ title: 'Direito', externalId: 'd1', modules: [{ title: 'Aulas', lessons: [{ title: 'Aula 1', externalId: 'a1' }] }] }] };
  let state = restoreState(applyCourseImport(createInitialState(), normalizePayload(input)));
  const original = state.courses[0].steps[0].id;
  assert.equal(state.courses[0].structure[0].modules[0].lessons[0].externalId, 'a1');
  delete input.disciplines[0].modules[0].lessons[0].externalId;
  state = applyCourseImport(state, normalizePayload(input));
  assert.equal(state.courses[0].steps.length, 1);
  assert.equal(state.courses[0].steps[0].id, original);
  assert.equal(state.courses[0].structure[0].modules[0].lessons[0].externalId, 'a1');
});

test('ordem da biblioteca sobrevive a inserções e reordenação', async (t) => {
  const { db } = fixture(t);
  let current = await readLibrary(db, 'u1');
  for (const id of ['c1', 'c2']) {
    const next = addCourse(current.state, { title: id, steps: ['Aula'] }, id);
    current = await applyLibraryActions(db, 'u1', { id: `add-${id}`, revision: current.revision, actions: libraryActions(current.state, next) });
    assert.deepEqual(current.state.courses.map((course) => course.id), next.courses.map((course) => course.id));
  }
  const reordered = { ...current.state, courses: [...current.state.courses].reverse() };
  await applyLibraryActions(db, 'u1', { id: 'reorder', revision: current.revision, actions: libraryActions(current.state, reordered) });
  assert.deepEqual((await readLibrary(db, 'u1')).state.courses.map((course) => course.id), reordered.courses.map((course) => course.id));
});

test('sessão esquecida volta pausada sem acumular tempo ausente', async (t) => {
  const { db } = fixture(t);
  const state = createInitialState();
  const at = new Date(Date.now() - 3600000).toISOString();
  state.activeSession = { id: 'old', status: 'active', startedAt: at, lastTickAt: at, accumulatedMs: 60000 };
  await db.run('INSERT INTO user_state(user_id,state,revision,updated_at) VALUES (?,?,1,?)', ['u1', JSON.stringify(state), at]);
  const current = await readLibrary(db, 'u1');
  assert.equal(current.state.activeSession.status, 'paused');
  assert.equal(current.state.activeSession.accumulatedMs, 60000);
});

test('tempo acumula sobras e falha de XP reverte a sessão junto com a biblioteca', async (t) => {
  const { db, sqlite } = fixture(t);
  const now = Date.now();
  await ensureXpSettings(db, 'u1', { now: now - 7200000 });
  let current = await readLibrary(db, 'u1');
  const session = (id, start, end) => ({ id, startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), durationMs: end - start, courseId: '', stepId: '', label: 'Estudo', origin: 'declared' });
  const first = session('first', now - 3600000, now - 2400000);
  current = await applyLibraryActions(db, 'u1', { id: 'first', revision: current.revision, actions: [{ type: 'session.put', value: first }] }, { now });
  assert.equal((await db.first('SELECT COUNT(*) AS n FROM xp_events')).n, 0);
  assert.equal((await db.first('SELECT consumed_seconds FROM xp_settings')).consumed_seconds, 1200);
  const second = session('second', now - 2400000, now - 1800000);
  const operation = { id: 'second', revision: current.revision, actions: [{ type: 'session.put', value: second }] };
  sqlite.exec("CREATE TRIGGER fail_time BEFORE INSERT ON xp_events BEGIN SELECT RAISE(ABORT, 'falha de tempo'); END");
  await assert.rejects(applyLibraryActions(db, 'u1', operation, { now }), /falha de tempo/);
  assert.equal((await readLibrary(db, 'u1')).state.studySessions.length, 1);
  assert.equal((await db.all('SELECT * FROM xp_time_sessions')).length, 1);
  sqlite.exec('DROP TRIGGER fail_time');
  await applyLibraryActions(db, 'u1', operation, { now });
  await applyLibraryActions(db, 'u1', operation, { now });
  assert.equal((await db.first('SELECT SUM(xp) AS xp FROM xp_events')).xp, 25);
  const latest = await readLibrary(db, 'u1');
  await applyLibraryActions(db, 'u1', { id: 'overlap', revision: latest.revision, actions: [{ type: 'session.put', value: session('overlap', now - 3600000, now - 1800000) }] }, { now });
  assert.equal((await db.first('SELECT SUM(xp) AS xp FROM xp_events')).xp, 25);
});

test('batch de sessões respeita o teto diário e ignora intervalos futuros', async (t) => {
  const { db } = fixture(t);
  const now = Date.now();
  await ensureXpSettings(db, 'u1', { now: now - 172800000 });
  const current = await readLibrary(db, 'u1');
  const actions = [0, 1, 2].map((index) => ({ type: 'session.put', value: {
    id: `long-${index}`, courseId: '', startedAt: new Date(now - 86400000 + index * 43200000).toISOString(),
    endedAt: new Date(now - 43200000 + index * 43200000).toISOString(), durationMs: 43200000, origin: 'declared',
  } }));
  await applyLibraryActions(db, 'u1', { id: 'long', revision: current.revision, actions }, { now });
  assert.equal((await db.first('SELECT SUM(xp) AS xp FROM xp_events')).xp, 200);
  assert.equal((await db.all('SELECT * FROM xp_time_sessions')).length, 2);
});
