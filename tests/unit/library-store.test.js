import test from 'node:test';
import { materialSteps, materialStructure } from '../../public/material-model.js';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { sqliteAdapter, applyMigrations } from '../../api/adapters/sqlite.js';
import { readLibrary, readStoredLibrary, libraryStatements } from '../../api/domain/library-store.js';
import { applyLibraryActions } from '../../api/domain/library-actions.js';
import { libraryActions } from '../../public/library-actions.js';
import { addCourse, completeMission, createInitialState, restoreState } from '../../public/domain.js';
import { ensureXpSettings, getXpSnapshot, adjustEvent } from '../../api/domain/xp.js';
import { addTask, completeTask, reopenTask } from '../../public/tasks-domain.js';
import { completeLesson, revertLessonCompletion } from '../../public/import-domain.js';
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

test('disciplina completa recebe 200 XP e conquista uma vez; repetir ou reabrir não duplica', async (t) => {
  const { db } = fixture(t);
  const now = Date.now();
  await ensureXpSettings(db, 'u1', { now: now - 1000 });
  let current = await readLibrary(db, 'u1');
  const payload = normalizePayload({ title: 'Curso', completeness: 'complete', disciplines: [{ title: 'Direito', modules: [{ title: 'Módulo', lessons: [{ title: 'Aula 1' }, { title: 'Aula 2' }] }] }] });
  let next = applyCourseImport(current.state, payload);
  current = await applyLibraryActions(db, 'u1', { id: 'import', revision: current.revision, actions: libraryActions(current.state, next) });
  const course = current.state.courses[0];
  for (const step of materialSteps(course)) {
    next = completeLesson(current.state, course.id, step.id).state;
    current = await applyLibraryActions(db, 'u1', { id: step.id, revision: current.revision, actions: libraryActions(current.state, next) });
  }
  let snapshot = await getXpSnapshot(db, 'u1');
  assert.equal(snapshot.summary.totalXP, 900);
  assert.equal(snapshot.events.filter((event) => event.kind === 'discipline_bonus').length, 1);
  assert.equal(snapshot.achievements.filter((item) => item.kind === 'discipline').length, 1);
  next = revertLessonCompletion(current.state, course.id, materialSteps(course)[0].id).state;
  current = await applyLibraryActions(db, 'u1', { id: 'revert', revision: current.revision, actions: libraryActions(current.state, next) });
  next = completeLesson(current.state, course.id, materialSteps(course)[0].id).state;
  await applyLibraryActions(db, 'u1', { id: 'again', revision: current.revision, actions: libraryActions(current.state, next) });
  snapshot = await getXpSnapshot(db, 'u1');
  assert.equal(snapshot.summary.totalXP, 900);
});

test('seleção parcial de disciplina não recebe bônus mesmo com todas as aulas escolhidas concluídas', async (t) => {
  const { db } = fixture(t);
  await ensureXpSettings(db, 'u1', { now: Date.now() - 1000 });
  const current = await readLibrary(db, 'u1');
  const payload = normalizePayload({ title: 'Curso', completeness: 'complete', disciplines: [{ title: 'Direito', modules: [{ title: 'Módulo', lessons: [{ title: 'Aula 1' }, { title: 'Aula 2' }] }] }] });
  const id = payload.disciplines[0].modules[0].lessons[0].id;
  let next = applyCourseImport(current.state, payload, { selectedLessonIds: [id] });
  next = completeLesson(next, next.courses[0].id, id).state;
  await applyLibraryActions(db, 'u1', { id: 'partial', revision: current.revision, actions: libraryActions(current.state, next) });
  assert.equal((await getXpSnapshot(db, 'u1')).summary.totalXP, 100);
});

test('task.put conclui a aula no servidor; várias tarefas e reabertura não repetem XP', async (t) => {
  const { db } = fixture(t);
  await ensureXpSettings(db, 'u1', { now: Date.now() - 1000 });
  let current = await readLibrary(db, 'u1');
  let next = addCourse(current.state, { title: 'Aula', steps: ['Estudar'] }, 'c1');
  next = addTask(next, { title: 'Primeira', courseId: 'c1', lessonId: 'c1-0' });
  next = addTask(next, { title: 'Segunda', courseId: 'c1', lessonId: 'c1-0' });
  next = addTask(next, { title: 'Organizar' });
  current = await applyLibraryActions(db, 'u1', { id: 'setup', revision: current.revision, actions: libraryActions(current.state, next) });
  current = await applyLibraryActions(db, 'u1', { id: 'tasks-batch', revision: current.revision, actions: current.state.tasks.map((task) => ({ type: 'task.put', value: { ...task, done: true, completedAt: new Date().toISOString() } })) });
  assert.equal(current.state.progress.length, 1);
  assert.equal((await getXpSnapshot(db, 'u1')).summary.totalXP, 100);
  next = reopenTask(current.state, current.state.tasks[0].id);
  current = await applyLibraryActions(db, 'u1', { id: 'reopen', revision: current.revision, actions: libraryActions(current.state, next) });
  next = completeTask(current.state, current.state.tasks[0].id).state;
  await applyLibraryActions(db, 'u1', { id: 'redo', revision: current.revision, actions: libraryActions(current.state, next) });
  assert.equal((await getXpSnapshot(db, 'u1')).summary.totalXP, 100);
});

test('cargos derivam de eventos válidos, sobrevivem a pausas e respondem a correções', async (t) => {
  const { db } = fixture(t);
  await ensureXpSettings(db, 'u1', { now: Date.now() - 1000 });
  let current = await readLibrary(db, 'u1');
  let next = addCourse(current.state, { title: 'Curso', steps: ['1', '2', '3', '4', '5'] }, 'c1');
  for (const step of materialSteps(next.courses[0])) next = completeMission(next, 'c1', step.id).state;
  current = await applyLibraryActions(db, 'u1', { id: 'finish', revision: current.revision, actions: libraryActions(current.state, next) });
  const first = await getXpSnapshot(db, 'u1');
  assert.ok(first.titles.some((title) => title.id === 'student'));
  const later = await getXpSnapshot(db, 'u1', { now: Date.now() + 90 * 86400000 });
  assert.deepEqual(later.titles, first.titles);
  await adjustEvent(db, 'u1', { eventId: first.events.find((event) => event.kind === 'lesson').id, reason: 'Conclusão indevida' });
  assert.equal((await getXpSnapshot(db, 'u1')).titles.some((title) => title.id === 'student'), false);
});

test('conta com documento antigo entra com biblioteca vazia e preserva o arquivo', async (t) => {
  const { db } = fixture(t);
  const old = addCourse(createInitialState(), { title: 'Curso preservado', steps: ['Aula 1', 'Aula 2'] }, 'c1');
  await db.run('INSERT INTO user_state(user_id,state,revision,updated_at) VALUES (?,?,1,?)', ['u1', JSON.stringify(old), '2026-01-01']);
  const { state } = await readLibrary(db, 'u1');
  assert.equal(state.courses.length, 0);
  assert.equal((await db.all('SELECT * FROM units')).length, 0);
  assert.equal((await db.all('SELECT * FROM account_documents')).length, 1);
  assert.equal((await db.first('SELECT state FROM user_state')).state, JSON.stringify(old));
});

test('leitura compartilhada de documento antigo devolve estado vazio sem erro', async (t) => {
  const { db } = fixture(t);
  const old = { ...addCourse(createInitialState(), { title: 'Antes', steps: ['Aula'] }, 'c1'), version: 2 };
  await db.run('INSERT INTO user_state(user_id,state,revision,updated_at) VALUES (?,?,1,?)', ['u1', JSON.stringify(old), '2026-01-01']);
  assert.equal((await readStoredLibrary(db, 'u1')).state, null);
});

test('vínculo histórico inconsistente é preservado sem bloquear edição do material', async (t) => {
  const { db } = fixture(t);
  const old = addCourse(createInitialState(), { title: 'Antes', steps: ['Aula'] }, 'c1');
  old.progress = [{ id: 'legacy', type: 'completion', materialId: '', unitId: 'c1-0', origin: 'legacy', historical: true, at: null, title: '', materialTitle: '' }];
  await readLibrary(db, 'u1');
  await db.batch(libraryStatements('u1', createInitialState(), old));
  const current = await readLibrary(db, 'u1');
  const next = await applyLibraryActions(db, 'u1', { id: 'rename', revision: current.revision, actions: [{ type: 'material.put', value: { ...current.state.courses[0], title: 'Depois' } }] });
  assert.equal(next.state.courses[0].title, 'Depois');
  assert.deepEqual(next.state.progress, current.state.progress);
  assert.equal((await db.first('SELECT COUNT(*) AS n FROM xp_events')).n, 0);
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

test('edições inválidas não descartam aulas nem ligam progresso a outro material', async (t) => {
  const { db } = fixture(t);
  const initial = await readLibrary(db, 'u1');
  let state = addCourse(initial.state, { title: 'Primeiro', steps: ['Aula 1', 'Aula 2'] }, 'c1');
  state = addCourse(state, { title: 'Segundo', steps: ['Aula 3'] }, 'c2');
  const created = await applyLibraryActions(db, 'u1', { id: 'create', revision: initial.revision, actions: libraryActions(initial.state, state) });
  const course = created.state.courses[0];
  for (const [id, units] of [['invalid', [...course.units, { id: 'broken' }]], ['duplicate', [course.units[0], course.units[0]]]]) {
    await assert.rejects(applyLibraryActions(db, 'u1', { id, revision: created.revision, actions: [{ type: 'material.put', value: { ...course, units } }] }), { code: 'invalid_library_action' });
  }
  const completed = completeMission(created.state, 'c1', 'c1-0').state;
  completed.progress.at(-1).materialId = 'c2';
  await assert.rejects(applyLibraryActions(db, 'u1', { id: 'wrong-owner', revision: created.revision, actions: libraryActions(created.state, completed) }), { code: 'invalid_library_action' });
  const after = await readLibrary(db, 'u1');
  assert.equal(after.revision, created.revision);
  assert.deepEqual(after.state.courses, created.state.courses);
  assert.equal(after.state.progress.length, 0);
  assert.equal((await db.first('SELECT COUNT(*) AS n FROM xp_events')).n, 0);
});

test('identidade externa sobrevive à restauração e ao fallback sem externalId', () => {
  const input = { title: 'Curso', sourceUrl: 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/123', provider: { id: 'grancursos' }, disciplines: [{ title: 'Direito', externalId: 'd1', modules: [{ title: 'Aulas', lessons: [{ title: 'Aula 1', externalId: 'a1' }] }] }] };
  let state = restoreState(applyCourseImport(createInitialState(), normalizePayload(input)));
  const original = materialSteps(state.courses[0])[0].id;
  assert.equal(materialStructure(state.courses[0])[0].modules[0].lessons[0].externalId, 'a1');
  delete input.disciplines[0].modules[0].lessons[0].externalId;
  state = applyCourseImport(state, normalizePayload(input));
  assert.equal(materialSteps(state.courses[0]).length, 1);
  assert.equal(materialSteps(state.courses[0])[0].id, original);
  assert.equal(materialStructure(state.courses[0])[0].modules[0].lessons[0].externalId, 'a1');
});

test('reimportação adota identidade de disciplina e muda aula de módulo sem duplicar unidade', () => {
  const input = { title: 'Curso', sourceUrl: 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/123', provider: { id: 'grancursos' }, disciplines: [{ title: 'Direito', modules: [{ title: 'Antes', lessons: [{ title: 'Aula', externalId: 'a1' }] }] }] };
  let state = applyCourseImport(createInitialState(), normalizePayload(input));
  const disciplineId = state.courses[0].units.find((unit) => unit.kind === 'discipline').id;
  const lessonId = materialSteps(state.courses[0])[0].id;
  state = completeLesson(state, state.courses[0].id, lessonId).state;
  input.disciplines[0].externalId = 'd1';
  input.disciplines[0].modules[0].title = 'Depois';
  state = restoreState(applyCourseImport(state, normalizePayload(input)));
  assert.equal(state.courses.length, 1);
  assert.equal(state.courses[0].units.filter((unit) => unit.id === lessonId).length, 1);
  assert.equal(materialSteps(state.courses[0])[0].module, 'Depois');
  assert.equal(state.courses[0].units.find((unit) => unit.kind === 'discipline').id, disciplineId);
  assert.equal(state.progress[0].unitId, lessonId);
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
  await readLibrary(db, 'u1');
  await db.run('UPDATE account_documents SET data=? WHERE user_id=?', [JSON.stringify(state), 'u1']);
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
