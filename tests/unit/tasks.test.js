import test from 'node:test';
import assert from 'node:assert/strict';
import { addCourse, createInitialState, restoreState, totalXP, weekCount } from '../../public/domain.js';
import {
  MAX_TASKS, TASK_XP, addTask, completeTask, isOverdue, normalizeTasks, priorityLabel, removeTask, reopenTask,
  setTaskPriority, sortTasks, taskAgenda,
} from '../../public/tasks-domain.js';

function stateWithTask() {
  const course = addCourse(createInitialState(), { title: 'Concurso', steps: ['Ler edital'] }, 'concurso');
  return addTask(course, { title: 'Resolver 10 questões', courseId: 'concurso', dueDate: '2026-11-10' }, '2026-10-31T10:00:00Z');
}

test('criar tarefa não gera XP e guarda curso e prazo', () => {
  const state = stateWithTask();
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].title, 'Resolver 10 questões');
  assert.equal(state.tasks[0].courseId, 'concurso');
  assert.equal(state.tasks[0].dueDate, '2026-11-10');
  assert.equal(state.tasks[0].done, false);
  assert.equal(totalXP(state), 0);
  assert.throws(() => addTask(state, { title: '   ' }));
  const unknown = addTask(createInitialState(), { title: 'Tarefa', courseId: 'nao-existe', dueDate: '10/11/2026' });
  assert.equal(unknown.tasks[0].courseId, '');
  assert.equal(unknown.tasks[0].dueDate, '');
});

test('concluir uma tarefa vale XP uma vez e reabrir não duplica', () => {
  const state = stateWithTask();
  const result = completeTask(state, state.tasks[0].id, '2026-10-31T11:00:00Z');
  assert.equal(result.added, true);
  assert.equal(result.xp, TASK_XP);
  assert.equal(totalXP(result.state), TASK_XP);
  assert.equal(result.state.tasks[0].completedAt, '2026-10-31T11:00:00.000Z');
  assert.equal(completeTask(result.state, state.tasks[0].id).added, false);

  const reopened = reopenTask(result.state, state.tasks[0].id);
  assert.equal(reopened.tasks[0].done, false);
  assert.equal(totalXP(reopened), 0);
  const again = completeTask(reopened, state.tasks[0].id, '2026-10-31T12:00:00Z');
  assert.equal(totalXP(again.state), TASK_XP, 'reabrir e concluir não acumula duas vezes');
});

test('remover tarefa apaga apenas o registro escolhido', () => {
  let state = stateWithTask();
  state = addTask(state, { title: 'Outra tarefa' });
  state = completeTask(state, state.tasks[0].id).state;
  const next = removeTask(state, state.tasks[1].id);
  assert.equal(next.tasks.length, 1);
  assert.equal(next.tasks[0].title, 'Resolver 10 questões');
});

test('tarefas sobrevivem à restauração e dados inválidos são descartados', () => {
  const base = stateWithTask();
  const state = completeTask(base, base.tasks[0].id).state;
  const restored = restoreState(JSON.stringify(state));
  assert.equal(restored.tasks.length, 1);
  assert.equal(restored.tasks[0].done, true);
  assert.equal(totalXP(restored), TASK_XP);

  const legacy = createInitialState();
  delete legacy.tasks;
  assert.deepEqual(restoreState(JSON.stringify(legacy)).tasks, []);

  const broken = { ...state, tasks: [{ id: 'x' }, { id: 'y', title: 'Válida' }] };
  assert.deepEqual(restoreState(JSON.stringify(broken)).tasks.map((task) => task.title), ['Válida']);
  assert.equal(normalizeTasks(new Array(MAX_TASKS + 5).fill(0)).length, 0);
});

test('tarefa concluída conta no ritmo da semana', () => {
  const base = stateWithTask();
  const state = completeTask(base, base.tasks[0].id, '2026-10-28T12:00:00Z').state;
  assert.equal(weekCount(state, new Date('2026-10-29T12:00:00Z')), 1);
  assert.equal(weekCount(state, new Date('2026-11-05T12:00:00Z')), 0);
});

test('ordenação coloca pendentes primeiro, com prazo mais próximo antes', () => {
  let state = addTask(createInitialState(), { title: 'Sem prazo' }, '2026-10-31T10:00:00Z');
  state = addTask(state, { title: 'Amanhã', dueDate: '2026-11-01' }, '2026-10-31T11:00:00Z');
  state = addTask(state, { title: 'Hoje', dueDate: '2026-10-31' }, '2026-10-31T12:00:00Z');
  assert.deepEqual(sortTasks(state.tasks).map((task) => task.title), ['Hoje', 'Amanhã', 'Sem prazo']);
});

test('prioridade e atraso ordenam a ação sem alterar XP', () => {
  const today = '2026-11-05';
  let state = addTask(createInitialState(), { title: 'Baixa sem prazo', priority: 3 }, '2026-10-31T10:00:00Z');
  state = addTask(state, { title: 'Sem prioridade', dueDate: '2026-11-06' }, '2026-10-31T10:01:00Z');
  state = addTask(state, { title: 'Alta', priority: 1, dueDate: '2026-11-20' }, '2026-10-31T10:02:00Z');
  state = addTask(state, { title: 'Atrasada', priority: 2, dueDate: '2026-11-01' }, '2026-10-31T10:03:00Z');
  const before = totalXP(state);
  const reordered = setTaskPriority(state, state.tasks[1].id, 1);
  assert.equal(totalXP(reordered), before, 'priorizar é organização');
  assert.deepEqual(sortTasks(state.tasks, today).map((task) => task.title), ['Atrasada', 'Alta', 'Baixa sem prazo', 'Sem prioridade']);
  assert.equal(isOverdue(state.tasks[3], today), true);
  assert.equal(isOverdue(state.tasks[3], '2026-11-01'), false, 'o dia do prazo ainda não é atraso');

  const agenda = taskAgenda(state, { today, limit: 2 });
  assert.equal(agenda.pending, 4);
  assert.equal(agenda.overdue, 1);
  assert.deepEqual(agenda.next.map((task) => task.title), ['Atrasada', 'Alta']);
});

test('prioridade sobrevive à restauração e valores inválidos viram "sem prioridade"', () => {
  const state = addTask(createInitialState(), { title: 'Revisar súmulas', priority: 2 }, '2026-10-31T10:00:00Z');
  const restored = restoreState(JSON.stringify(state));
  assert.equal(restored.tasks[0].priority, 2);
  assert.equal(priorityLabel(restored.tasks[0].priority), 'Média');
  assert.equal(normalizeTasks([{ id: 'a', title: 'Antiga sem campo' }])[0].priority, 0);
  assert.equal(normalizeTasks([{ id: 'b', title: 'Inválida', priority: 9 }])[0].priority, 0);
});
