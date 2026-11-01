import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCourse, addMaterial, completeMission, createInitialState, deleteCourse, formatVideoTime, normalizePosition,
  positionLabel, parseVideoTime, updateCourse, replaceCourseSteps, restoreState,
} from '../../public/domain.js';
import {
  addSlide, completeDeck, markSlideSeen, moveSlide, normalizeSlides, removeSlide, slidesSummary, updateSlide,
} from '../../public/slides-domain.js';
import { deleteSlideObject, parseMediaKeyFromPath, sanitizeSlideImage, uploadSlideObject } from '../../api/domain/media.js';
import { completedUnitIds, isCompleted } from '../../public/progress-domain.js';

function courseState() {
  const state = addCourse(createInitialState(), { title: 'Direito Constitucional', steps: ['Ler a introdução', 'Resolver exercícios', 'Revisar'] });
  const course = state.courses[0];
  let next = completeMission(state, course.id, `${course.id}-0`).state;
  next = completeMission(next, course.id, `${course.id}-1`).state;
  return { state: next, course };
}

test('editar material altera título, tipo e ponto de retomada sem perder etapas', () => {
  const { state, course } = courseState();
  const next = updateCourse(state, course.id, { title: 'Constitucional — revisão', type: 'book', resumeAt: 'capítulo 2' });
  const updated = next.courses[0];
  assert.equal(updated.title, 'Constitucional — revisão');
  assert.equal(updated.type, 'book');
  assert.equal(updated.resumeAt, 'capítulo 2');
  assert.equal(updated.steps.length, 3);
  assert.deepEqual(completedUnitIds(next), completedUnitIds(state));
});

test('renomear etapa mantém o progresso e remover apaga só o registro daquela etapa', () => {
  const { state, course } = courseState();
  const renamed = replaceCourseSteps(state, course.id, ['Ler a introdução completa', 'Resolver exercícios', 'Revisar']);
  assert.equal(renamed.courses[0].steps[0].id, `${course.id}-0`);
  assert.ok(isCompleted(renamed, `${course.id}-0`));
  const removed = replaceCourseSteps(renamed, course.id, ['Ler a introdução completa', 'Revisar']);
  assert.equal(removed.courses[0].steps.length, 2);
  assert.ok(isCompleted(removed, `${course.id}-0`));
  assert.equal(isCompleted(removed, `${course.id}-1`), false);
});

test('excluir material remove curso e progresso dependente, mantendo o restante', () => {
  const { state, course } = courseState();
  const other = addCourse(state, { title: 'Outro material', steps: ['Passo'] });
  const next = deleteCourse(other, course.id);
  assert.equal(next.courses.some((item) => item.id === course.id), false);
  assert.equal(next.courses.some((item) => item.title === 'Outro material'), true);
  assert.equal(completedUnitIds(next).size, 0);
  assert.equal(next.progress.length, 0);
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

test('posição é estruturada por tipo e continua legível na restauração', () => {
  const { state, course } = courseState();
  assert.equal(parseVideoTime('1:02:03'), 3723);
  assert.equal(parseVideoTime('12:30'), 750);
  assert.equal(formatVideoTime(750), '12:30');
  const video = updateCourse(state, course.id, { type: 'video', position: { kind: 'video', value: '12:30' } });
  assert.equal(video.courses[0].position.seconds, 750);
  assert.equal(video.courses[0].resumeAt, '12:30');
  assert.equal(positionLabel('video', video.courses[0].position), '12:30');

  const article = updateCourse(video, course.id, { type: 'article', position: { page: '12', section: 'seção 3' } });
  assert.deepEqual(article.courses[0].position, { kind: 'page', page: '12', section: 'seção 3' });
  assert.equal(article.courses[0].resumeAt, 'seção 3 · p. 12');

  const exercise = updateCourse(article, course.id, { type: 'exercise', position: { current: 'questão 8', attempts: 2 } });
  assert.deepEqual(exercise.courses[0].position, { kind: 'exercise', current: 'questão 8', attempts: 2 });
  assert.match(exercise.courses[0].resumeAt, /questão 8/);

  const restored = restoreState(JSON.stringify(exercise));
  assert.deepEqual(restored.courses[0].position, { kind: 'exercise', current: 'questão 8', attempts: 2 });
  assert.equal(normalizePosition({ page: '12' }, 'video'), null, 'posição incompatível com o tipo não é inventada');
});

test('imagem de slide é validada, substituída no bucket e removida', async () => {
  const objects = new Map();
  const bucket = {
    async put(key, bytes, contentType) { objects.set(key, { bytes, contentType }); },
    async delete(key) { objects.delete(key); },
    async listKeys(prefix) { return [...objects.keys()].filter((key) => key.startsWith(prefix)); },
  };
  const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 73, 72, 68, 82]);
  const first = await uploadSlideObject(bucket, { ownerId: 'u1', courseId: 'c1', slideId: 's1', bytes: png, now: 1000 });
  assert.match(first.url, /^\/api\/media\/slides\/u1\/c1\/s1-1000\.png$/);
  assert.equal(sanitizeSlideImage(first.url), first.url);
  assert.equal(parseMediaKeyFromPath(first.url)?.kind, 'slide');
  assert.equal(sanitizeSlideImage('/api/media/slides/../../secret.png'), '');
  const second = await uploadSlideObject(bucket, { ownerId: 'u1', courseId: 'c1', slideId: 's1', bytes: png, now: 2000 });
  assert.equal(objects.size, 1);
  assert.notEqual(second.url, first.url);
  await deleteSlideObject(bucket, { ownerId: 'u1', courseId: 'c1', slideId: 's1' });
  assert.equal(objects.size, 0);
  const state = addCourse(createInitialState(), { title: 'Curso', steps: ['Aula'] });
  state.courses[0].slides = [{ id: 's1', title: 'Slide', body: '', image: second.url }];
  assert.equal(normalizeSlides(restoreState(JSON.stringify(state)).courses[0].slides)[0].image, second.url);
});
