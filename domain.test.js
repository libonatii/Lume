import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, restoreState, completeMission, totalXP, courseProgress, courseStatus, nextMission, achievements, addCourse, safeCourseURL, weekCount } from './public/domain.js';
import { studyRhythm, startJourney, saveOnboardingAnswer, completeJourney, normalizeOnboarding, addMaterial, journeyPlan, STATE_VERSION } from './public/domain.js';
import { completedUnitIds, isCompleted, progressFromV1 } from './public/progress-domain.js';

// Estado de teste com trilhas próprias. A biblioteca real começa vazia.
function seededState() {
  const steps = (prefix, count) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}`, title: `Etapa ${index + 1}` }));
  const state = createInitialState();
  state.courses = [
    { id: 'design', title: 'Design de interfaces', category: 'Design & criatividade', art: 'design', url: '', example: false, paused: false, steps: steps('design', 4) },
    { id: 'python', title: 'Primeiros passos em Python', category: 'Tecnologia & programação', art: 'code', url: '', example: false, paused: false, steps: steps('python', 4) },
  ];
  state.selectedCourseId = 'design';
  return state;
}

test('começa sem XP, sem cursos de exemplo e sem próxima ação inventada', () => {
  const state = createInitialState();
  assert.equal(totalXP(state), 0);
  assert.equal(state.courses.length, 0);
  assert.equal(nextMission(state), null);
  assert.equal(achievements(state).filter((item) => item.unlocked).length, 0);
});

test('apoios e ritmo sobrevivem à restauração sem duplicatas nem valores desconhecidos', () => {
  const state = { ...createInitialState(), habit: 'often', supports: ['return', 'return', 'unknown'] };
  const restored = restoreState(JSON.stringify(state));
  assert.deepEqual(restored.supports, ['return']);
  assert.equal(restored.habit, 'often');
  assert.match(studyRhythm(restored).message, /Retome pela próxima aula/);
  assert.equal(restoreState(JSON.stringify({ ...state, habit: 'unknown' })).habit, null);
  const oldState = createInitialState();
  delete oldState.supports;
  assert.deepEqual(restoreState(JSON.stringify(oldState)).supports, []);
});

test('conclusão é registrada uma única vez e avança a próxima etapa sem saldo legado novo', () => {
  const { state } = completeMission(seededState(), 'design', 'design-1');
  assert.equal(totalXP(state), 0);
  assert.equal(state.progress[0].legacyXp, undefined);
  assert.equal(nextMission(state).step.id, 'design-2');
  assert.equal(courseProgress(state, state.courses[0]).done, 1);
  assert.equal(completeMission(state, 'design', 'design-1').added, false);
  assert.equal(achievements(state)[0].unlocked, true);
});

test('tornar menor não conclui a aula nem concede XP de preparação', () => {
  const result = completeMission(seededState(), 'design', 'design-1', { preparation: true });
  assert.equal(result.xp, 0);
  assert.equal(result.state.progress[0].type, 'preparation');
  assert.equal(result.state.progress[0].legacyXp, undefined);
  assert.equal(completedUnitIds(result.state).size, 0);
  assert.equal(nextMission(result.state).step.id, 'design-1');
  assert.equal(courseStatus(result.state, result.state.courses[0]), 'active');
  assert.equal(completeMission(result.state, 'design', 'design-1', { preparation: true }).added, false);
  assert.equal(totalXP(completeMission(result.state, 'design', 'design-1').state), 0);
});

test('curso concluído não volta às sugestões', () => {
  let state = seededState();
  for (const step of state.courses[0].steps) state = completeMission(state, 'design', step.id).state;
  assert.equal(courseStatus(state, state.courses[0]), 'completed');
  assert.equal(nextMission(state).course.id, 'python');
  assert.equal(achievements(state).find((item) => item.id === 'course').unlocked, true);
});

test('pausar um curso preserva progresso e muda a sugestão', () => {
  const state = completeMission(seededState(), 'design', 'design-1').state;
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
  let state = seededState();
  state = completeMission(state, 'design', 'design-1', { now: new Date(2026, 9, 26, 10).toISOString() }).state;
  state = completeMission(state, 'design', 'design-2', { now: new Date(2026, 9, 25, 10).toISOString() }).state;
  state = completeMission(state, 'design', 'design-3', { now: new Date(2026, 10, 2, 10).toISOString() }).state;
  assert.equal(weekCount(state, new Date(2026, 9, 30, 12)), 1);
});

test('pausas não reduzem o saldo legado nem apagam conquistas', () => {
  // Histórico antigo do protótipo (documento v1): continua aceito e preservado.
  let state = restoreState({
    ...seededState(),
    version: 1,
    history: [{ id: 'step:design-1', courseId: 'design', stepId: 'design-1', title: 'Etapa 1', courseTitle: 'Design de interfaces', preparation: false, xp: 10, at: '2026-01-01T12:00:00Z' }],
    completed: ['design-1'],
  });
  assert.equal(state.progress[0].origin, 'legacy');
  assert.equal(state.progress[0].legacyXp, 10);
  state = completeMission(state, 'design', 'design-2', { now: '2026-10-30T12:00:00Z' }).state;
  assert.equal(totalXP(state), 10);
  assert.equal(state.progress.at(-1).legacyXp, undefined);
  assert.equal(achievements(state)[0].unlocked, true);
});

test('armazenamento inválido não quebra o início e preferências são normalizadas', () => {
  assert.equal(restoreState('{').version, STATE_VERSION);
  assert.equal(restoreState('null').progress.length, 0);
  const state = completeMission(seededState(), 'design', 'design-1').state;
  state.preferences.weeklyGoal = 999;
  const restored = restoreState(JSON.stringify(state));
  assert.equal(totalXP(restored), 0);
  assert.equal(restored.progress[0].legacyXp, undefined);
  assert.equal(restored.preferences.weeklyGoal, 3);
  const legacy = { ...restored, progress: [{ ...restored.progress[0], origin: 'legacy', legacyXp: 10 }] };
  assert.equal(totalXP(restoreState(JSON.stringify(legacy))), 10);
  // Registro repetido é descartado sozinho: o resto do progresso continua.
  state.progress.push(state.progress[0]);
  const deduped = restoreState(JSON.stringify(state));
  assert.equal(deduped.progress.length, 1);
  assert.equal(isCompleted(deduped, 'design-1'), true);
  // Um curso estragado não apaga os outros.
  const broken = { ...state, courses: [...state.courses, { id: 'quebrado', title: 3, steps: [] }] };
  assert.deepEqual(restoreState(JSON.stringify(broken)).courses.map((course) => course.id), ['design', 'python']);
});

test('preferência antiga de reduzir movimentos é descartada e não volta ao estado', () => {
  const legacy = createInitialState();
  legacy.preferences.reducedMotion = true;
  const restored = restoreState(JSON.stringify(legacy));
  assert.equal('reducedMotion' in restored.preferences, false);
  assert.equal('reducedMotion' in createInitialState().preferences, false);
  assert.equal(restored.preferences.theme, 'dark');
});

test('cada jornada inicia uma sequ�ncia pr�pria e retoma de onde parou', () => {
  const initial = createInitialState();
  const starting = startJourney(initial, 'starting');
  assert.equal(starting.habit, 'starting');
  assert.equal(starting.onboarding.status, 'active');
  assert.equal(starting.onboarding.step, 1);

  const inProgress = saveOnboardingAnswer(starting, { subject: 'redes' }, 2);
  assert.equal(inProgress.onboarding.answers.subject, 'redes');
  assert.equal(inProgress.onboarding.step, 2);

  // Mesma jornada retoma a etapa; trocar de jornada recome�a a sequ�ncia.
  assert.equal(startJourney(inProgress, 'starting').onboarding.step, 2);
  assert.equal(startJourney(inProgress, 'often').onboarding.step, 1);
  assert.throws(() => startJourney(initial, 'inexistente'));
});

test('onboarding interrompido sobrevive � restaura��o do estado', () => {
  const interrupted = saveOnboardingAnswer(startJourney(createInitialState(), 'sometimes'), { studying: 'estat�stica' }, 2);
  const restored = restoreState(JSON.stringify(interrupted));
  assert.equal(restored.onboarding.status, 'active');
  assert.equal(restored.onboarding.journey, 'sometimes');
  assert.equal(restored.onboarding.step, 2);
  assert.equal(restored.onboarding.answers.studying, 'estat�stica');
  assert.equal(normalizeOnboarding({ journey: 'nada', step: 99 }).status, 'pending');
});

test('concluir a jornada n�o concede XP nem apaga materiais', () => {
  const withMaterial = addMaterial(createInitialState(), { title: 'Curso de redes', type: 'lesson', firstActivity: 'Assistir � aula 1' });
  const done = completeJourney(saveOnboardingAnswer(startJourney(withMaterial, 'starting'), { subject: 'redes' }, 5));
  assert.equal(done.onboarded, true);
  assert.equal(done.onboarding.status, 'done');
  assert.equal(totalXP(done), 0);
  assert.equal(done.courses.length, withMaterial.courses.length);
  assert.equal(done.preferences.weeklyGoal, 2);
  assert.equal(done.preferences.weeklyGoalSource, 'suggested');
});

test('meta ajustada � m�o n�o � substitu�da ao revisar o ritmo', () => {
  const initial = createInitialState();
  initial.preferences.weeklyGoal = 6;
  initial.preferences.weeklyGoalSource = 'manual';
  const done = completeJourney(startJourney(initial, 'often'));
  assert.equal(done.preferences.weeklyGoal, 6);
  const reviewed = completeJourney(startJourney(done, 'starting'));
  assert.equal(reviewed.preferences.weeklyGoal, 6);
});

test('material do onboarding guarda tipo e ponto de retomada sem gerar hist�rico', () => {
  const next = addMaterial(createInitialState(), { title: 'Artigo de processo penal', type: 'article', resumeAt: 'p�gina 12', firstActivity: 'Ler a se��o 2' });
  const created = next.courses.at(-1);
  assert.equal(created.title, 'Artigo de processo penal');
  assert.equal(created.type, 'article');
  assert.equal(created.resumeAt, 'p�gina 12');
  assert.equal(created.origin, 'onboarding');
  assert.deepEqual(next.progress, []);
  assert.equal(totalXP(next), 0);
  assert.equal(journeyPlan(next).firstActivity !== null, true);
});

test('exemplos antigos sem uso saem da biblioteca; com progresso permanecem', () => {
  const untouched = seededState();
  untouched.courses = untouched.courses.map((course) => ({ ...course, example: true }));
  const restored = restoreState(JSON.stringify(untouched));
  assert.equal(restored.courses.length, 0);
  assert.equal(restored.selectedCourseId, null);

  const used = completeMission(seededState(), 'design', 'design-1').state;
  used.courses = used.courses.map((course) => ({ ...course, example: true }));
  const kept = restoreState(JSON.stringify(used));
  assert.deepEqual(kept.courses.map((course) => course.id), ['design']);
  assert.equal(isCompleted(kept, 'design-1'), true);
  assert.equal(kept.selectedCourseId, 'design');
});
test('paleta da Aparência começa no Redesign Moderno e valores desconhecidos voltam ao padrão', () => {
  assert.equal(createInitialState().preferences.palette, 'moderno');
  const chosen = createInitialState();
  chosen.preferences.palette = 'variante2';
  assert.equal(restoreState(JSON.stringify(chosen)).preferences.palette, 'variante2');
  chosen.preferences.palette = 'neon';
  assert.equal(restoreState(JSON.stringify(chosen)).preferences.palette, 'moderno');
  const old = createInitialState();
  delete old.preferences.palette;
  assert.equal(restoreState(JSON.stringify(old)).preferences.palette, 'moderno');
});

test('documento v1 é convertido sem perder conclusões, preparações nem o saldo legado', () => {
  const v1 = {
    ...seededState(),
    version: 1,
    completed: ['design-1', 'design-2', 'python-1'],
    history: [
      { id: 'prepare:design-1', courseId: 'design', stepId: 'design-1', title: 'Preparar', courseTitle: 'Design de interfaces', preparation: true, xp: 5, at: '2026-01-01T10:00:00Z' },
      { id: 'step:design-1', courseId: 'design', stepId: 'design-1', title: 'Etapa 1', courseTitle: 'Design de interfaces', preparation: false, xp: 10, at: '2026-01-01T12:00:00Z' },
      { id: 'step:design-2', courseId: 'design', stepId: 'design-2', title: 'Etapa 2', courseTitle: 'Design de interfaces', preparation: false, xp: 0, policy: 'v1', at: '2026-10-30T12:00:00Z' },
      { id: 'prepare:design-3', courseId: 'design', stepId: 'design-3', title: 'Preparar', courseTitle: 'Design de interfaces', preparation: true, xp: 0, at: '2026-10-30T13:00:00Z' },
    ],
    studyLog: [],
  };
  const converted = restoreState(JSON.stringify(v1));
  assert.equal(converted.version, STATE_VERSION);
  assert.equal('completed' in converted || 'history' in converted || 'studyLog' in converted, false);
  // Invariante: o conjunto concluído é exatamente o do v1.
  assert.deepEqual([...completedUnitIds(converted)].sort(), ['design-1', 'design-2', 'python-1']);
  // Preparação continua preparação; nunca vira aula concluída.
  assert.equal(isCompleted(converted, 'design-3'), false);
  assert.equal(converted.progress.filter((event) => event.type === 'preparation').length, 2);
  // Saldo legado preservado: 5 (preparação) + 10 (etapa).
  assert.equal(totalXP(converted), 15);
  // Concluída sem registro (python-1) entra como histórico sem data.
  const orphan = converted.progress.find((event) => event.unitId === 'python-1');
  assert.equal(orphan.origin, 'legacy');
  assert.equal(orphan.historical, true);
  assert.equal(orphan.at, null);
  // Converter de novo o resultado não muda nada.
  assert.deepEqual(restoreState(JSON.stringify(converted)).progress, converted.progress);
  assert.deepEqual(progressFromV1({}), []);
});
