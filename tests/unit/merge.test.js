import test from 'node:test';
import { stepUnits } from '../../public/material-model.js';
import assert from 'node:assert/strict';
import { addCourse, completeMission, createInitialState } from '../../public/domain.js';
import { completeLesson, revertLessonCompletion } from '../../public/import-domain.js';
import { completedUnitIds } from '../../public/progress-domain.js';
import { addTask, completeTask } from '../../public/tasks-domain.js';
import { mergeStates, statesDiffer } from '../../public/merge-domain.js';

function localState() {
  let state = addCourse(createInitialState(), { title: 'Curso compartilhado', steps: ['Aula 1', 'Aula 2'] });
  const course = state.courses[0];
  course.id = 'c1';
  course.units = stepUnits([{ id: 'c1-0', title: 'Aula 1' }, { id: 'c1-1', title: 'Aula 2' }]);
  state = completeMission(state, 'c1', 'c1-0', { now: '2026-10-31T12:00:00Z' }).state;
  state.courses[0].slides = [{ id: 's1', title: 'Um', body: '' }, { id: 's2', title: 'Dois', body: '' }];
  state.courses[0].slideProgress = { seen: ['s1'], lastId: 's1', completedAt: null };
  state = addTask(state, { title: 'Tarefa compartilhada' });
  state.preferences.weeklyGoal = 6;
  return state;
}

function remoteState(base = localState()) {
  const other = completeMission({ ...base, progress: [] }, 'c1', 'c1-1', { now: '2026-10-31T13:00:00Z' }).state;
  return {
    ...base,
    progress: other.progress,
    courses: base.courses.map((item) => ({ ...item, slideProgress: { seen: ['s1', 's2'], lastId: 's2', completedAt: null } })),
    tasks: base.tasks.map((task) => ({ ...task, done: true, completedAt: '2026-10-31T13:00:00Z' })),
    preferences: { ...base.preferences, weeklyGoal: 2 },
  };
}

test('conflito entre dispositivos une conclusões, histórico, slides e tarefas', () => {
  const local = localState();
  const remote = remoteState(local);
  const merged = mergeStates(local, remote);
  assert.equal(completedUnitIds(merged).size, 2);
  assert.equal(merged.progress.length, 2);
  assert.deepEqual(merged.courses[0].slideProgress.seen.sort(), ['s1', 's2']);
  assert.equal(merged.tasks[0].done, true);
  assert.equal(merged.preferences.weeklyGoal, 6, 'preferência da sessão atual prevalece');
  assert.equal(statesDiffer(local, remote), true);
});

test('mesclar não duplica materiais nem apaga curso que só existe de um lado', () => {
  const local = localState();
  const remote = {
    ...local,
    courses: [...local.courses, { id: 'remoto', title: 'Curso remoto', type: 'article', planning: false, url: '', example: false, paused: false, art: 'nature', units: stepUnits([{ id: 'remoto-0', title: 'Leitura' }]) }],
  };
  const merged = mergeStates(local, remote);
  assert.equal(merged.courses.length, 2);
  assert.ok(merged.courses.some((course) => course.title === 'Curso remoto'));
  const again = mergeStates(merged, remote);
  assert.equal(again.courses.length, 2);
});

test('reversão de aula importada em um dispositivo vence a conclusão antiga', () => {
  let local = { ...localState(), progress: [] };
  local.courses[0].source = { provider: 'x', providerLabel: 'X', identity: 'x|1', completeness: 'complete', structure: [] };
  local = completeLesson(local, 'c1', 'c1-0', { now: '2026-10-31T12:00:00Z' }).state;
  const remote = revertLessonCompletion(local, 'c1', 'c1-0', { now: '2026-10-31T13:00:00Z' }).state;
  const merged = mergeStates(local, remote);
  assert.equal(completedUnitIds(merged).has('c1-0'), false);
  assert.equal(merged.progress[0].revertedAt, '2026-10-31T13:00:00Z');
});
