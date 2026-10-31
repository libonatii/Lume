import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCourse, addMaterial, createInitialState, deleteCourse, updateCourse, replaceCourseSteps, restoreState,
} from './public/domain.js';
import {
  addSlide, completeDeck, markSlideSeen, moveSlide, normalizeSlides, removeSlide, slidesSummary, updateSlide,
} from './public/slides-domain.js';

function courseState() {
  const state = addCourse(createInitialState(), { title: 'Direito Constitucional', steps: ['Ler a introdução', 'Resolver exercícios', 'Revisar'] });
  const course = state.courses[0];
  return { state: { ...state, completed: [`${course.id}-0`, `${course.id}-1`] }, course };
}

test('editar material altera título, tipo e ponto de retomada sem perder etapas', () => {
  const { state, course } = courseState();
  const next = updateCourse(state, course.id, { title: 'Constitucional — revisão', type: 'book', resumeAt: 'capítulo 2' });
  const updated = next.courses[0];
  assert.equal(updated.title, 'Constitucional — revisão');
  assert.equal(updated.type, 'book');
  assert.equal(updated.resumeAt, 'capítulo 2');
  assert.equal(updated.steps.length, 3);
  assert.deepEqual(next.completed, state.completed);
});

test('renomear etapa mantém o progresso e remover apaga só o registro daquela etapa', () => {
  const { state, course } = courseState();
  const renamed = replaceCourseSteps(state, course.id, ['Ler a introdução completa', 'Resolver exercícios', 'Revisar']);
  assert.equal(renamed.courses[0].steps[0].id, `${course.id}-0`);
  assert.ok(renamed.completed.includes(`${course.id}-0`));
  const removed = replaceCourseSteps(renamed, course.id, ['Ler a introdução completa', 'Revisar']);
  assert.equal(removed.courses[0].steps.length, 2);
  assert.ok(removed.completed.includes(`${course.id}-0`));
  assert.equal(removed.completed.includes(`${course.id}-1`), false);
});

test('excluir material remove curso e progresso dependente, mantendo o restante', () => {
  const { state, course } = courseState();
  const other = addCourse(state, { title: 'Outro material', steps: ['Passo'] });
  const next = deleteCourse(other, course.id);
  assert.equal(next.courses.some((item) => item.id === course.id), false);
  assert.equal(next.courses.some((item) => item.title === 'Outro material'), true);
  assert.deepEqual(next.completed, []);
  assert.equal(next.selectedCourseId, next.courses[0].id);
});

test('slides são criados, editados, reordenados e removidos', () => {
  let state = createInitialState();
  state = addMaterial(state, { title: 'Apresentação de processo penal', type: 'article', planning: false }, 'manual');
  const courseId = state.courses[0].id;
  state = addSlide(state, courseId, { title: 'Conceito', body: 'Jurisdição é...' });
  state = addSlide(state, courseId, { title: 'Competência', body: 'A competência é...' });
  state = addSlide(state, courseId, { title: 'Resumo', body: 'Em síntese...' });
  assert.equal(normalizeSlides(state.courses[0].slides).length, 3);
  state = updateSlide(state, courseId, state.courses[0].slides[1].id, { title: 'Competência e foro', body: 'Atualizado' });
  assert.equal(state.courses[0].slides[1].title, 'Competência e foro');
  state = moveSlide(state, courseId, state.courses[0].slides[2].id, 'up');
  assert.equal(state.courses[0].slides[1].title, 'Resumo');
  const removed = removeSlide(state, courseId, state.courses[0].slides[0].id);
  assert.equal(removed.courses[0].slides.length, 2);
});

test('conclusão da apresentação exige 80% dos slides e o último slide', () => {
  let state = createInitialState();
  state = addMaterial(state, { title: 'Deck de estudo', type: 'article', planning: false }, 'manual');
  const courseId = state.courses[0].id;
  for (const title of ['Um', 'Dois', 'Três', 'Quatro', 'Cinco']) state = addSlide(state, courseId, { title, body: 'Conteúdo' });
  const slides = state.courses[0].slides;
  state = markSlideSeen(state, courseId, slides[0].id);
  state = markSlideSeen(state, courseId, slides[1].id);
  state = markSlideSeen(state, courseId, slides[2].id);
  assert.equal(slidesSummary(state.courses[0]).nearEnd, false);
  assert.equal(completeDeck(state, courseId).completed, false);
  state = markSlideSeen(state, courseId, slides[3].id);
  assert.equal(slidesSummary(state.courses[0]).nearEnd, true);
  assert.equal(slidesSummary(state.courses[0]).lastSeen, false);
  assert.equal(completeDeck(state, courseId).completed, false);
  state = markSlideSeen(state, courseId, slides[4].id);
  const done = completeDeck(state, courseId);
  assert.equal(done.completed, true);
  const summary = slidesSummary(done.state.courses[0]);
  assert.equal(summary.completed, true);
  assert.equal(summary.seenCount, 5);
  assert.equal(completeDeck(done.state, courseId).reason, 'already');
});

test('slides inválidos e estados antigos não quebram a restauração', () => {
  const state = addCourse(createInitialState(), { title: 'Curso', steps: ['Aula'] });
  state.courses[0].slides = [{ id: '../x', title: 'Válido', body: 'Texto' }, { title: '', body: '' }];
  const restored = restoreState(JSON.stringify(state));
  assert.equal(restored.courses[0].slides.length, 1);
  assert.equal(restored.courses[0].slides[0].title, 'Válido');
  assert.deepEqual(restored.courses[0].slideProgress.seen, []);
  const old = addCourse(createInitialState(), { title: 'Antigo', steps: ['Aula'] });
  delete old.courses[0].slides;
  assert.deepEqual(restoreState(JSON.stringify(old)).courses[0].slides, []);
});
