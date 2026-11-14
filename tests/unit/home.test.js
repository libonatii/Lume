import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../public/domain.js';
import { stepUnits, unitsFromStructure } from '../../public/material-model.js';
import { moduleTrail, shortDate, trailWindow, upcomingDeadlines, weekLights } from '../../public/home-domain.js';
import { addTask } from '../../public/tasks-domain.js';

function course(id, units) {
  return { id, title: id, type: 'course', planning: false, example: false, paused: false, art: 'design', url: '', units };
}

function completion(materialId, unitId) {
  return { id: `step:${unitId}`, type: 'completion', materialId, unitId, origin: 'manual', historical: false, at: '2026-11-10T10:00:00.000Z' };
}

test('a constelação usa só as aulas do módulo atual, com concluídas, atual e futuras', () => {
  const lessons = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, title: `Aula ${prefix}${i}` }));
  const structure = [{ id: 'd', title: 'Cálculo II', modules: [
    { id: 'm1', title: 'Módulo 1', lessons: lessons('a', 3) },
    { id: 'm2', title: 'Módulo 2', lessons: lessons('b', 5) },
  ] }];
  const state = { ...createInitialState(), courses: [course('calc', unitsFromStructure(structure, ['a0', 'a1', 'a2', 'b0', 'b1', 'b2', 'b4']))] };
  state.progress = ['a0', 'a1', 'a2', 'b0'].map((id) => completion('calc', id));

  const trail = moduleTrail(state, { courseId: 'calc', lessonId: 'b1' });
  assert.equal(trail.module, 'Módulo 2');
  // A aula b3 não foi selecionada no roteiro e fica fora da constelação.
  assert.deepEqual(trail.nodes.map((node) => [node.id, node.state]), [['b0', 'done'], ['b1', 'current'], ['b2', 'todo'], ['b4', 'todo']]);
  assert.equal(trail.remaining, 3);
  assert.equal(trail.position, 5);
  assert.equal(trail.total, 7);
});

test('material sem módulos usa as próprias etapas como trilha', () => {
  const state = { ...createInitialState(), courses: [course('livro', stepUnits([{ id: 's0', title: 'Cap. 1' }, { id: 's1', title: 'Cap. 2' }]))] };
  state.progress = [completion('livro', 's0')];
  const trail = moduleTrail(state, { courseId: 'livro', lessonId: 's1' });
  assert.equal(trail.module, '');
  assert.deepEqual(trail.nodes.map((node) => node.state), ['done', 'current']);
  assert.equal(trail.remaining, 1);
});

test('módulos longos mostram uma janela em torno da aula atual', () => {
  const nodes = Array.from({ length: 30 }, (_, index) => ({ id: `n${index}`, index }));
  assert.deepEqual(trailWindow(nodes, 15, 7).map((node) => node.index), [12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(trailWindow(nodes, 1, 7).map((node) => node.index), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(trailWindow(nodes, 29, 7).map((node) => node.index), [23, 24, 25, 26, 27, 28, 29]);
  assert.equal(trailWindow(nodes.slice(0, 5), 2, 7).length, 5);
});

test('o que vem aí junta provas, entregas e prazos de tarefas, sem sessões de estudo nem repetidos', () => {
  let state = createInitialState();
  state = addTask(state, { title: 'Lista 4', dueDate: '2026-11-18' }, '2026-11-10T10:00:00.000Z');
  state = addTask(state, { title: 'Sem prazo' }, '2026-11-10T10:00:00.000Z');
  state = addTask(state, { title: 'Atrasada', dueDate: '2026-11-01' }, '2026-11-10T10:00:00.000Z');
  state = addTask(state, { title: 'Ligada à prova', dueDate: '2026-11-20' }, '2026-11-10T10:00:00.000Z');
  const linked = state.tasks.find((task) => task.title === 'Ligada à prova').id;
  const entry = (id, title, category, date, extra = {}) => ({ id, title, category, date, start: '', end: '', endDate: date, timeZone: 'America/Sao_Paulo', taskIds: [], reminder: -1, seriesId: '', recurrence: 'none', originalDate: date, done: false, cancelled: false, ...extra });
  state.agenda = [
    entry('p', 'Prova de Cálculo', 'exam', '2026-11-20', { taskIds: [linked] }),
    entry('r', 'Relatório', 'delivery', '2026-11-16'),
    entry('s', 'Revisão', 'study', '2026-11-15'),
    entry('c', 'Cancelada', 'delivery', '2026-11-17', { cancelled: true }),
    entry('v', 'Passada', 'exam', '2026-11-01'),
  ];
  const result = upcomingDeadlines(state, '2026-11-14');
  assert.deepEqual(result.items.map((item) => item.title), ['Relatório', 'Lista 4', 'Prova de Cálculo']);
  assert.equal(result.total, 3);
  assert.equal(result.session.title, 'Revisão');
  assert.deepEqual(upcomingDeadlines(createInitialState(), '2026-11-14'), { items: [], total: 0, session: null });
});

test('a semana vai de segunda a domingo: dias com estudo acesos, sem estudo apagados, hoje e futuro à parte', () => {
  const now = new Date(2026, 10, 14, 20, 0).getTime(); // sábado
  const at = (day, hour, minutes) => {
    const start = new Date(2026, 10, day, hour, 0);
    return { id: `s${day}`, courseId: '', stepId: '', label: 'Estudo', startedAt: start.toISOString(), endedAt: new Date(start.getTime() + minutes * 60000).toISOString(), durationMs: minutes * 60000, origin: 'declared' };
  };
  const state = { ...createInitialState(), studySessions: [at(11, 19, 40), at(13, 19, 70), at(8, 19, 30)] };
  const week = weekLights(state, now);
  assert.deepEqual(week.days.map((day) => [shortDate(day.date).slice(0, 3), day.state]), [
    ['seg', 'off'], ['ter', 'off'], ['qua', 'lit'], ['qui', 'off'], ['sex', 'lit'], ['sáb', 'today'], ['dom', 'future'],
  ]);
  // A sessão do sábado anterior fica fora da semana.
  assert.equal(week.total, 110);
  assert.equal(week.lit, 2);
  assert.equal(shortDate('2026-11-14'), 'sáb 14 nov');
});
