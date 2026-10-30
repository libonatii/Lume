import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, restoreState, completeMission, totalXP, courseProgress, courseStatus, nextMission, achievements, addCourse, safeCourseURL, weekCount } from './domain.js';

test('começa sem XP, com uma próxima ação concreta', () => {
  const state = createInitialState();
  assert.equal(totalXP(state), 0);
  assert.equal(nextMission(state).step.id, 'design-1');
  assert.equal(achievements(state).filter((item) => item.unlocked).length, 0);
});

test('conclusão dá XP uma única vez e avança a próxima etapa', () => {
  const { state } = completeMission(createInitialState(), 'design', 'design-1');
  assert.equal(totalXP(state), 10);
  assert.equal(nextMission(state).step.id, 'design-2');
  assert.equal(courseProgress(state, state.courses[0]).done, 1);
  assert.equal(completeMission(state, 'design', 'design-1').added, false);
  assert.equal(achievements(state)[0].unlocked, true);
});

test('tornar menor não conclui a aula nem permite XP duplicado', () => {
  const result = completeMission(createInitialState(), 'design', 'design-1', { preparation: true });
  assert.equal(result.xp, 5);
  assert.equal(result.state.completed.length, 0);
  assert.equal(nextMission(result.state).step.id, 'design-1');
  assert.equal(courseStatus(result.state, result.state.courses[0]), 'active');
  assert.equal(completeMission(result.state, 'design', 'design-1', { preparation: true }).added, false);
  assert.equal(totalXP(completeMission(result.state, 'design', 'design-1').state), 15);
});

test('curso concluído não volta às sugestões', () => {
  let state = createInitialState();
  for (const step of state.courses[0].steps) state = completeMission(state, 'design', step.id).state;
  assert.equal(courseStatus(state, state.courses[0]), 'completed');
  assert.equal(nextMission(state).course.id, 'python');
  assert.equal(achievements(state).find((item) => item.id === 'course').unlocked, true);
});

test('pausar um curso preserva progresso e muda a sugestão', () => {
  const state = completeMission(createInitialState(), 'design', 'design-1').state;
  state.courses[0].paused = true;
  assert.equal(nextMission(state).course.id, 'python');
  assert.equal(courseProgress(state, state.courses[0]).done, 1);
  assert.equal(completeMission(state, 'design', 'design-2').added, false);
  state.courses[0].paused = false;
  assert.equal(nextMission(state).step.id, 'design-2');
});

test('cursos próprios validam links e ganham etapas únicas', () => {
  assert.equal(safeCourseURL('javascript:alert(1)'), null);
  assert.equal(safeCourseURL('https://user:secret@example.com'), null);
  assert.equal(safeCourseURL('https://example.com/aula'), 'https://example.com/aula');
  const state = addCourse(createInitialState(), { title: ' Meu curso ', steps: [' Abrir material ', '', 'Praticar'] }, 'custom');
  assert.equal(state.courses.at(-1).steps.length, 2);
  assert.equal(nextMission(state).course.title, 'Meu curso');
  assert.equal(achievements(state).find((item) => item.id === 'own').unlocked, true);
  assert.throws(() => addCourse(state, { title: 'X', steps: [], url: '' }));
});

test('histórico semanal usa a semana local e exclui datas futuras de outra semana', () => {
  let state = createInitialState();
  state = completeMission(state, 'design', 'design-1', { now: new Date(2026, 9, 26, 10).toISOString() }).state;
  state = completeMission(state, 'design', 'design-2', { now: new Date(2026, 9, 25, 10).toISOString() }).state;
  state = completeMission(state, 'design', 'design-3', { now: new Date(2026, 10, 2, 10).toISOString() }).state;
  assert.equal(weekCount(state, new Date(2026, 9, 30, 12)), 1);
});

test('pausas não reduzem XP nem apagam conquistas', () => {
  let state = completeMission(createInitialState(), 'design', 'design-1', { now: '2026-01-01T12:00:00Z' }).state;
  state = completeMission(state, 'design', 'design-2', { now: '2026-10-30T12:00:00Z' }).state;
  assert.equal(totalXP(state), 20);
  assert.equal(achievements(state)[0].unlocked, true);
});

test('armazenamento inválido não quebra o início e preferências são normalizadas', () => {
  assert.equal(restoreState('{').version, 1);
  assert.equal(restoreState('null').history.length, 0);
  const state = completeMission(createInitialState(), 'design', 'design-1').state;
  state.preferences.weeklyGoal = 999;
  const restored = restoreState(JSON.stringify(state));
  assert.equal(totalXP(restored), 10);
  assert.equal(restored.preferences.weeklyGoal, 3);
  state.history.push(state.history[0]);
  assert.equal(restoreState(JSON.stringify(state)).history.length, 0);
});
