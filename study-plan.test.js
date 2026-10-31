import test from 'node:test';
import assert from 'node:assert/strict';
import { addCourse, completeMission, createInitialState } from './public/domain.js';
import { applyCourseImport, completeLesson, normalizePayload } from './public/import-domain.js';
import { studyPlan } from './public/study-plan.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');

function withCourse(state, title, steps, id) {
  return addCourse(state, { title, steps }, id);
}

test('cursos de exemplo não entram no roteiro', () => {
  const plan = studyPlan(createInitialState(), { now: NOW });
  assert.equal(plan.totals.remaining, 0);
  assert.deepEqual(plan.steps, []);
  assert.match(plan.note, /Nenhum curso em andamento/);
});

test('primeiro passo vem antes de material em andamento', () => {
  let state = createInitialState();
  state = withCourse(state, 'Curso começado', ['Aula 1', 'Aula 2', 'Aula 3', 'Aula 4'], 'started');
  state = completeMission(state, 'started', 'started-0', { now: new Date(NOW - 30 * 24 * 3600 * 1000).toISOString() }).state;
  state = withCourse(state, 'Curso novo', ['Aula 1', 'Aula 2'], 'fresh');

  const plan = studyPlan(state, { now: NOW });
  assert.equal(plan.totals.remaining, 5);
  assert.equal(plan.courses[0].id, 'fresh');
  assert.equal(plan.courses[0].reason.id, 'start');
  assert.equal(plan.courses[1].id, 'started');
  assert.equal(plan.courses[1].reason.id, 'close', 'poucas aulas e sem estudo recente');
  assert.equal(plan.steps[0].courseId, 'fresh');
  assert.equal(plan.steps[0].title, 'Aula 1');
});

test('continuidade recente lidera o roteiro', () => {
  let state = createInitialState();
  state = withCourse(state, 'Retomada', ['Aula 1', 'Aula 2', 'Aula 3', 'Aula 4', 'Aula 5'], 'recent');
  state = withCourse(state, 'Parado', ['Aula 1', 'Aula 2', 'Aula 3', 'Aula 4', 'Aula 5'], 'old');
  state = completeMission(state, 'recent', 'recent-0', { now: new Date(NOW - 2 * 3600 * 1000).toISOString() }).state;
  const plan = studyPlan(state, { now: NOW });
  assert.equal(plan.courses[0].id, 'recent');
  assert.equal(plan.courses[0].reason.id, 'continuity');
  assert.match(plan.criteria, /continuidade/i);
});

test('pausados e concluídos ficam fora do roteiro, mas continuam contabilizados', () => {
  let state = createInitialState();
  state = withCourse(state, 'Pausado', ['A', 'B'], 'paused');
  state = withCourse(state, 'Concluído', ['A'], 'done');
  state = withCourse(state, 'Ativo', ['A', 'B', 'C'], 'active');
  state.courses = state.courses.map((course) => course.id === 'paused' ? { ...course, paused: true } : course);
  state = completeMission(state, 'done', 'done-0', { now: new Date(NOW).toISOString() }).state;

  const plan = studyPlan(state, { now: NOW });
  assert.equal(plan.totals.pausedCourses, 1);
  assert.equal(plan.totals.completedCourses, 1);
  assert.equal(plan.totals.activeCourses, 1);
  assert.equal(plan.totals.remaining, 3);
  assert.deepEqual(plan.courses.map((course) => course.id), ['active']);
});

test('roteiro intercala cursos e respeita o limite de passos', () => {
  let state = createInitialState();
  state = withCourse(state, 'Um', ['1.1', '1.2', '1.3'], 'c1');
  state = withCourse(state, 'Dois', ['2.1', '2.2', '2.3'], 'c2');
  const plan = studyPlan(state, { now: NOW, limit: 4 });
  assert.equal(plan.steps.length, 4);
  assert.deepEqual(plan.steps.map((step) => step.courseId), ['c1', 'c2', 'c1', 'c2']);
  assert.deepEqual(plan.steps.map((step) => step.title), ['1.1', '2.1', '1.2', '2.2']);
});

test('curso importado entra no roteiro com as aulas selecionadas e a origem', () => {
  const payload = normalizePayload({
    title: 'OAB — Gran',
    provider: { id: 'grancursos' },
    sourceUrl: 'https://www.grancursosonline.com.br/curso/oab',
    disciplines: [{ title: 'Direito Constitucional', modules: [{ title: 'M1', lessons: [{ title: 'Aula 1' }, { title: 'Aula 2' }] }] }],
  });
  let state = applyCourseImport(createInitialState(), payload);
  const course = state.courses.at(-1);
  state = completeLesson(state, course.id, course.steps[0].id, { now: new Date(NOW - 3600 * 1000).toISOString() }).state;

  const plan = studyPlan(state, { now: NOW });
  assert.equal(plan.totals.remaining, 1);
  assert.equal(plan.courses[0].id, course.id);
  assert.equal(plan.courses[0].source, 'Gran Cursos Online');
  assert.equal(plan.courses[0].partial, true);
  assert.equal(plan.courses[0].reason.id, 'continuity');
  assert.equal(plan.steps[0].title, 'Aula 2');
  assert.equal(plan.steps[0].discipline, 'Direito Constitucional');
});
