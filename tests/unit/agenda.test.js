import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createInitialState, addCourse, restoreState } from '../../public/domain.js';
import { addTask, completeTask, removeTask } from '../../public/tasks-domain.js';
import { createAppointment, updateAppointment, saveAppointment, movePending, conflictsFor, zonedInstant, dueReminders, reminderKey, agendaSuggestions, appointmentRange } from '../../public/agenda-domain.js';
import { calendarEvent, calendarPatch } from '../../src/features/agenda/calendar-model.js';
import { readBackup, mergeBackup } from '../../public/backup-domain.js';
import { libraryActions } from '../../public/library-actions.js';
import { buildProfile } from '../../public/profile-domain.js';
import { sqliteAdapter, applyMigrations } from '../../api/adapters/sqlite.js';
import { readLibrary } from '../../api/domain/library-store.js';
import { applyLibraryActions } from '../../api/domain/library-actions.js';
import { claimReminders } from '../../api/domain/agenda.js';
import { ensureXpSettings, getXpSnapshot } from '../../api/domain/xp.js';

const input = (patch = {}) => ({ title: 'Revisar', category: 'study', date: '2026-11-10', start: '19:00', end: '20:00', timeZone: 'America/Sao_Paulo', taskIds: [], reminder: 15, ...patch });
function database(t) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  applyMigrations(sqlite, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  for (const id of ['u1', 'u2']) sqlite.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run(id, 'Pessoa', `${id}@example.test`, 'x', '2026-01-01');
  return sqliteAdapter(sqlite);
}
async function save(db, current, next, id = crypto.randomUUID()) {
  return applyLibraryActions(db, 'u1', { id, revision: current.revision, actions: libraryActions(current.state, next) });
}

test('agendamento usa a tarefa existente sem copiar ou alterar prazo, vínculo e subtarefas', () => {
  const initial = addTask(createInitialState(), { title: 'Questões', dueDate: '2026-11-20', priority: 1 });
  initial.tasks[0].subtasks = [{ id: 's', title: 'Ler', done: true }];
  const next = createAppointment(initial, input({ taskIds: [initial.tasks[0].id] }));
  assert.deepEqual(next.tasks, initial.tasks);
  assert.deepEqual(next.agenda[0].taskIds, [initial.tasks[0].id]);
  assert.deepEqual(restoreState(next).agenda, next.agenda);
  assert.deepEqual(removeTask(next, initial.tasks[0].id).agenda[0].taskIds, []);
});
test('repetição mensal preserva o dia original, cria checklists desmarcados e não altera histórico', () => {
  let state = addTask(createInitialState(), { title: 'Revisão', dueDate: '2026-01-31' });
  const id = state.tasks[0].id;
  state = completeTask(state, id).state;
  state.tasks[0].subtasks = [{ id: 's', title: 'Ler', done: true }];
  const next = createAppointment(state, input({ date: '2026-01-31', recurrence: 'monthly', count: 3, taskIds: [id] }));
  assert.deepEqual(next.agenda.map((item) => item.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(next.tasks[0].done, true);
  assert.equal(next.tasks[1].done, false);
  assert.equal(next.tasks[1].subtasks[0].done, false);
  assert.equal(next.tasks[1].dueDate, '');
  assert.equal(new Set(next.agenda.flatMap((item) => item.taskIds)).size, 3);
});
test('editar/cancelar futuras preserva as passadas, concluídas e os checklists de cada ocorrência', () => {
  let state = createAppointment(createInitialState(), input({ recurrence: 'daily', count: 4, tasks: [{ title: 'Ler' }] }));
  state = updateAppointment(state, state.agenda[2].id, { done: true });
  const old = structuredClone(state);
  const changed = updateAppointment(state, state.agenda[0].id, { title: 'Novo título', cancelled: true }, 'future', '2026-11-11');
  assert.deepEqual(changed.agenda[0], old.agenda[0]);
  assert.deepEqual(changed.agenda[2], old.agenda[2]);
  assert.equal(changed.agenda[1].cancelled, true);
  assert.equal(changed.agenda[3].title, 'Novo título');
  assert.deepEqual(changed.tasks, old.tasks);
});
test('mover pendências preserva a data e tarefas concluídas da atividade anterior', () => {
  let state = createAppointment(createInitialState(), input({ tasks: [{ title: 'A' }, { title: 'B' }] }));
  state = completeTask(state, state.tasks[0].id).state;
  const moved = movePending(state, state.agenda[0].id, '2026-11-20');
  assert.equal(moved.agenda[0].date, '2026-11-10');
  assert.deepEqual(moved.agenda[0].taskIds, [state.tasks[0].id]);
  assert.deepEqual(moved.agenda[1].taskIds, [state.tasks[1].id]);
  assert.equal(moved.tasks.length, 2);
  assert.equal(moved.agenda[1].date, '2026-11-20');
});
test('horários atravessam meia-noite, respeitam fuso e recusam data impossível e lacuna sazonal', () => {
  assert.equal(new Date(zonedInstant('2026-11-10', '19:00', 'America/Sao_Paulo')).toISOString(), '2026-11-10T22:00:00.000Z');
  assert.throws(() => zonedInstant('2026-02-30', '10:00', 'UTC'), /Revise/);
  assert.throws(() => zonedInstant('2026-03-08', '02:30', 'America/New_York'), /não existe/);
  assert.equal(new Date(zonedInstant('2026-11-01', '01:30', 'America/New_York')).toISOString(), '2026-11-01T05:30:00.000Z');
  const state = createAppointment(createInitialState(), input({ start: '23:30', end: '00:30', endDate: '2026-11-11' }));
  assert.equal(state.agenda.length, 1);
  assert.throws(() => createAppointment(createInitialState(), input({ start: '23:30', end: '00:30' })), /posterior/);
});
test('sobreposição avisa inclusive entre fusos diferentes, sem impedir salvar', () => {
  let state = createAppointment(createInitialState(), input());
  state = createAppointment(state, input({ title: 'Consulta', timeZone: 'UTC', start: '22:30', end: '23:30', category: 'personal' }));
  assert.equal(conflictsFor(state.agenda[0], state.agenda).length, 1);
  state = updateAppointment(state, state.agenda[1].id, { cancelled: true });
  assert.equal(conflictsFor(state.agenda[0], state.agenda).length, 0);
});
test('dia sem horário aceita mudança sazonal à meia-noite sem quebrar o calendário', () => {
  const state = createAppointment(createInitialState(), input({ date: '2018-11-04', start: '', end: '' }));
  const [start, end] = appointmentRange(state.agenda[0]);
  assert.equal(end - start, 23 * 3600000);
  assert.equal(new Date(start).toISOString(), '2018-11-04T03:00:00.000Z');
});
test('limite de tarefas é recusado sem apagar as antigas; checklist enorme não é truncado', () => {
  let state = createInitialState();
  for (let i = 0; i < 199; i++) state = addTask(state, { title: `Tarefa ${i}` });
  assert.throws(() => createAppointment(state, input({ tasks: [{ title: 'Nova' }], recurrence: 'weekly', count: 2 })), /limite/);
  assert.equal(state.tasks.length, 199);
  assert.throws(() => createAppointment(state, input({ tasks: Array.from({ length: 51 }, () => ({ title: 'Item' })) })), /50/);
});
test('backup preserva compromissos e recorrência; mesclagem é idempotente e rejeita referência perdida', () => {
  const state = createAppointment(createInitialState(), input({ tasks: [{ title: 'Ler' }], recurrence: 'weekly', count: 2 }));
  const read = readBackup(JSON.stringify(state));
  assert.deepEqual(read.agenda, state.agenda);
  const merged = mergeBackup(createInitialState(), read);
  assert.deepEqual(mergeBackup(merged, read), merged);
  assert.throws(() => readBackup(JSON.stringify({ ...state, tasks: [] })), /tarefa/);
  assert.throws(() => readBackup(JSON.stringify({ ...state, agenda: [{ ...state.agenda[0], date: '2026-02-30' }] })), /inválidos/);
});
test('perfil de amigos não contém compromissos nem suas tarefas pessoais', () => {
  const state = createAppointment(createInitialState(), input({ title: 'Consulta privada', category: 'personal', tasks: [{ title: 'Documento privado' }] }));
  const profile = JSON.stringify(buildProfile(state));
  assert.equal(profile.includes('Consulta privada'), false);
  assert.equal(profile.includes('Documento privado'), false);
});
test('sugestões não duplicam aulas agendadas e não alteram compromissos', () => {
  let state = addCourse(createInitialState(), { title: 'Curso', steps: ['Aula'] }, 'c');
  state.plan.availability = { 1: 60, 2: 60, 3: 60, 4: 60, 5: 60 };
  assert.equal(agendaSuggestions(state, '2026-11-10').length, 1);
  state = createAppointment(state, input({ tasks: [{ title: 'Aula', courseId: 'c', lessonId: 'c-0' }] }));
  const before = structuredClone(state);
  assert.equal(agendaSuggestions(state, '2026-11-10').length, 0);
  assert.deepEqual(state, before);
});
test('API persiste Agenda, mantém tarefas e recusa conflito e dados inválidos atomicamente', async (t) => {
  const db = database(t);
  const current = await readLibrary(db, 'u1');
  const next = createAppointment(current.state, input({ tasks: [{ title: 'Ler' }] }));
  const stored = await save(db, current, next, 'agenda');
  assert.deepEqual(stored.state.agenda, next.agenda);
  assert.deepEqual((await readLibrary(db, 'u2')).state.agenda, []);
  assert.equal((await save(db, current, next, 'agenda')).duplicate, true);
  await assert.rejects(save(db, current, next, 'stale'), { code: 'library_conflict' });
  await assert.rejects(applyLibraryActions(db, 'u1', { id: 'invalid', revision: stored.revision, actions: [{ type: 'appointment.put', value: { ...next.agenda[0], taskIds: ['missing'] } }] }), { code: 'invalid_library_action' });
  assert.deepEqual((await readLibrary(db, 'u1')).state, stored.state);
});
test('recorrências vinculadas concluem a mesma aula uma vez; encerramento de atividade não concede XP', async (t) => {
  const db = database(t);
  await ensureXpSettings(db, 'u1', { now: Date.now() - 1000 });
  let current = await readLibrary(db, 'u1');
  let next = addCourse(current.state, { title: 'Material', steps: ['Aula'] }, 'c');
  next = createAppointment(next, input({ recurrence: 'weekly', count: 2, tasks: [{ title: 'Estudar', courseId: 'c', lessonId: 'c-0' }] }));
  current = await save(db, current, next);
  current = await save(db, current, updateAppointment(current.state, current.state.agenda[0].id, { done: true }));
  assert.equal((await getXpSnapshot(db, 'u1')).summary.totalXP, 0);
  for (const task of current.state.tasks) current = await applyLibraryActions(db, 'u1', { id: crypto.randomUUID(), revision: current.revision, actions: [{ type: 'task.put', value: { ...task, done: true, completedAt: new Date().toISOString() } }] });
  assert.equal((await getXpSnapshot(db, 'u1')).summary.totalXP, 100);
  assert.equal(current.state.progress.length, 1);
});
test('lembretes: reivindicação única entre dispositivos, cancelamento, edição e expiração', async (t) => {
  const db = database(t);
  let current = await readLibrary(db, 'u1');
  current = await save(db, current, createAppointment(current.state, input()));
  const now = Date.parse('2026-11-10T21:45:00Z');
  assert.equal(dueReminders(current.state, now - 1).length, 0);
  const claims = await Promise.all([claimReminders(db, 'u1', { now }), claimReminders(db, 'u1', { now })]);
  assert.equal(claims.flat().length, 1);
  assert.equal((await claimReminders(db, 'u2', { now })).length, 0);
  const id = current.state.agenda[0].id, oldKey = reminderKey(current.state.agenda[0]);
  current = await save(db, current, updateAppointment(current.state, id, { start: '19:30', end: '20:30' }));
  assert.notEqual(reminderKey(current.state.agenda[0]), oldKey);
  current = await save(db, current, updateAppointment(current.state, id, { cancelled: true }));
  assert.equal((await claimReminders(db, 'u1', { now: now + 30 * 60000 })).length, 0);
  current = await save(db, current, updateAppointment(current.state, id, { cancelled: false }));
  assert.equal((await claimReminders(db, 'u1', { now: now + 46 * 60000 })).length, 0);
  assert.equal((await claimReminders(db, 'u1', { now: now + 30 * 60000 })).length, 1);
});
test('lembrete sem horário ocorre às 09h no fuso do compromisso; conclusão cancela', () => {
  const state = createAppointment(createInitialState(), input({ start: '', end: '', reminder: 0 }));
  assert.equal(dueReminders(state, Date.parse('2026-11-10T12:00:00Z')).length, 1);
  const done = updateAppointment(state, state.agenda[0].id, { done: true });
  assert.equal(dueReminders(done, Date.parse('2026-11-10T12:00:00Z')).length, 0);
});
test('edição concorrente aborta a reivindicação do lembrete sem consumir o aviso', async (t) => {
  const db = database(t);
  let current = await readLibrary(db, 'u1');
  current = await save(db, current, createAppointment(current.state, input()));
  const changing = { ...db, batch: async (statements) => {
    await save(db, current, updateAppointment(current.state, current.state.agenda[0].id, { cancelled: true }));
    return db.batch(statements);
  } };
  await assert.rejects(claimReminders(changing, 'u1', { now: Date.parse('2026-11-10T21:45:00Z') }), { code: 'agenda_conflict' });
  assert.equal((await db.all('SELECT * FROM agenda_reminders')).length, 0);
});

test('editor salva tarefas individualmente com vínculos distintos e preserva conclusões e ids', async (t) => {
  const db = database(t);
  let current = await readLibrary(db, 'u1');
  let state = addCourse(current.state, { title: 'Curso', steps: ['Aula A', 'Aula B'] }, 'c');
  state = saveAppointment(state, input({ tasks: [{ title: 'Assistir A', courseId: 'c', lessonId: 'c-0' }, { title: 'Assistir B', courseId: 'c', lessonId: 'c-1' }] }));
  current = await save(db, current, state);
  state = completeTask(current.state, state.tasks[0].id).state;
  current = await save(db, current, state);
  const first = current.state.tasks[0];
  state = saveAppointment(current.state, { ...current.state.agenda[0], taskChanges: [{ ...first, title: 'Não sobrescrever conclusão' }, { ...current.state.tasks[1], title: 'Rever B' }], tasks: [{ title: 'Revisar notas' }] });
  current = await save(db, current, state);
  assert.deepEqual(current.state.tasks[0], first);
  assert.equal(current.state.tasks[1].title, 'Rever B');
  assert.equal(current.state.tasks[1].lessonId, 'c-1');
  assert.equal(current.state.tasks.length, 3);
  assert.equal(current.state.agenda[0].taskIds.length, 3);
  assert.equal(current.state.progress.length, 1);
});

test('editor não modifica tarefas de outro compromisso nem perde dados ao exceder limites', () => {
  const state = createAppointment(createInitialState(), input({ tasks: [{ title: 'Original' }] }));
  assert.throws(() => saveAppointment(state, { ...state.agenda[0], taskChanges: [{ id: 'outra', title: 'Outra' }] }), /não pertence/);
  assert.throws(() => saveAppointment(state, { ...state.agenda[0], tasks: Array.from({ length: 50 }, () => ({ title: 'Nova' })) }), /Lista de tarefas inválida/);
  assert.equal(state.tasks.length, 1);
  assert.equal(state.agenda[0].taskIds.length, 1);
});

test('calendário conserva instantes, fuso, virada do dia e data civil sem horário', () => {
  const state = createAppointment(createInitialState(), input({ date: '2026-11-10', start: '23:30', endDate: '2026-11-11', end: '00:30' }));
  const item = state.agenda[0];
  const event = calendarEvent(item, []);
  assert.equal(event.start, '2026-11-11T02:30:00.000Z');
  assert.deepEqual(calendarPatch({ ...event, start: new Date(event.start), end: new Date(event.end) }, item.timeZone), {
    date: item.date, endDate: item.endDate, start: item.start, end: item.end, timeZone: item.timeZone,
  });
  assert.deepEqual(calendarPatch({ allDay: true, startStr: '2026-11-12' }, item.timeZone), { date: '2026-11-12', endDate: '2026-11-12', start: '', end: '', timeZone: item.timeZone });
  const allDay = calendarEvent({ ...item, date: '2026-11-12', endDate: '2026-11-12', start: '', end: '' }, []);
  assert.equal(allDay.start, '2026-11-12');
  assert.equal(allDay.end, '2026-11-13');
});
