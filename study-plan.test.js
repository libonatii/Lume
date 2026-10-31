import test from 'node:test';
import assert from 'node:assert/strict';
import { addCourse, completeMission, createInitialState } from './public/domain.js';
import { applyCourseImport, completeLesson, normalizePayload } from './public/import-domain.js';
import { DEFAULT_SESSION_MINUTES, nextAction, studyPlan } from './public/study-plan.js';

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

test('próxima ação da Hoje segue o mesmo roteiro e diferencia duração conhecida de estimada', () => {
  const payload = normalizePayload({
    title: 'OAB — Gran',
    provider: { id: 'grancursos' },
    sourceUrl: 'https://www.grancursosonline.com.br/curso/oab',
    disciplines: [{ title: 'Direito Constitucional', modules: [{ title: 'Direitos fundamentais', lessons: [
      { title: 'Aula 1', duration: '25:00', url: 'https://www.grancursosonline.com.br/aula/1' },
      { title: 'Aula 2', duration: 1800 },
      { title: 'Aula 3' },
    ] }] }],
  });
  let state = applyCourseImport(createInitialState(), payload);
  state = withCourse(state, 'Trilha manual', ['Etapa 1', 'Etapa 2', 'Etapa 3', 'Etapa 4', 'Etapa 5'], 'manual');
  const course = state.courses.find((item) => item.source);

  const first = nextAction(state, { now: NOW });
  assert.equal(first.lessonId, studyPlan(state, { now: NOW }).steps[0].lessonId, 'Hoje e Companion indicam a mesma aula');
  assert.equal(first.courseId, course.id);
  assert.equal(first.title, 'Aula 1');
  assert.equal(first.minutes, 25);
  assert.equal(first.durationKnown, true);
  assert.equal(first.url, 'https://www.grancursosonline.com.br/aula/1');
  assert.equal(first.remaining, 3);
  assert.equal(first.remainingKnownMinutes, 55);
  assert.equal(first.remainingWithoutDuration, 1);

  // Concluir a aula muda a próxima ação; o critério passa a ser continuidade.
  state = completeLesson(state, course.id, course.steps[0].id, { now: new Date(NOW - 60 * 1000).toISOString() }).state;
  state = completeLesson(state, course.id, course.steps[1].id, { now: new Date(NOW - 30 * 1000).toISOString() }).state;
  const third = nextAction(state, { now: NOW });
  assert.equal(third.title, 'Aula 3');
  assert.equal(third.reason.id, 'continuity');
  assert.equal(third.durationKnown, false, 'sem duração da fonte, o tempo é estimado');
  assert.equal(third.minutes, DEFAULT_SESSION_MINUTES);
  assert.equal(third.remaining, 1);
});

test('estimativa usa o tempo de sessão escolhido e exemplos não viram próxima ação', () => {
  assert.equal(nextAction(createInitialState(), { now: NOW }), null);
  let state = withCourse(createInitialState(), 'Leitura de processo penal', ['Seção 1', 'Seção 2'], 'penal');
  state = { ...state, onboarding: { ...state.onboarding, answers: { sessionMinutes: 45 } } };
  const action = nextAction(state, { now: NOW });
  assert.equal(action.courseId, 'penal');
  assert.equal(action.minutes, 45);
  assert.equal(action.durationKnown, false);
  assert.equal(action.imported, false);
});
