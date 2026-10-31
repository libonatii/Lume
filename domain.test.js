import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, restoreState, completeMission, totalXP, courseProgress, courseStatus, nextMission, achievements, addCourse, safeCourseURL, weekCount } from './public/domain.js';
import { applyStudyRhythm, studyRhythm, startJourney, saveOnboardingAnswer, completeJourney, normalizeOnboarding, addMaterial, journeyPlan } from './public/domain.js';

test('comeÃ§a sem XP, com uma prÃ³xima aÃ§Ã£o concreta', () => {
  const state = createInitialState();
  assert.equal(totalXP(state), 0);
  assert.equal(nextMission(state).step.id, 'design-1');
  assert.equal(achievements(state).filter((item) => item.unlocked).length, 0);
});

test('ritmo inicial e apoios mudam sugestÃµes e plano, preservando cursos e XP', () => {
  const previous = completeMission(createInitialState(), 'design', 'design-1').state;
  const state = applyStudyRhythm(previous, { habit: 'starting', supports: ['calm', 'initiation'] });
  assert.equal(state.preferences.weeklyGoal, 2);
  assert.equal(state.preferences.essential, true);
  assert.equal(studyRhythm(state).prepareFirst, true);
  assert.equal(state.onboarded, true);
  assert.equal(totalXP(state), 10);
  assert.equal(courseProgress(state, state.courses[0]).done, 1);
  assert.equal(totalXP(previous), 10);
  assert.equal(previous.onboarded, false);
});

test('revisar o mesmo ritmo preserva plano e conforto ajustados manualmente', () => {
  const state = applyStudyRhythm(createInitialState(), { habit: 'sometimes', supports: ['calm'] });
  state.preferences.weeklyGoal = 6;
  state.preferences.essential = false;
  const reviewed = applyStudyRhythm(state, { habit: 'sometimes', supports: ['calm'] });
  assert.equal(reviewed.preferences.weeklyGoal, 6);
  assert.equal(reviewed.preferences.essential, false);
  const changed = applyStudyRhythm(reviewed, { habit: 'often', supports: ['chunking'] });
  assert.equal(changed.preferences.weeklyGoal, 5);
  assert.equal(studyRhythm(changed).prepareFirst, true);
});

test('apoios e ritmo sobrevivem Ã  restauraÃ§Ã£o sem duplicatas nem valores desconhecidos', () => {
  const state = applyStudyRhythm(createInitialState(), { habit: 'often', supports: ['return', 'return', 'unknown'] });
  assert.deepEqual(state.supports, ['return']);
  const restored = restoreState(JSON.stringify(state));
  assert.deepEqual(restored.supports, ['return']);
  assert.equal(restored.habit, 'often');
  assert.match(studyRhythm(restored).message, /retomar/);
  assert.throws(() => applyStudyRhythm(state, { habit: 'unknown' }));
  const oldState = createInitialState();
  delete oldState.supports;
  assert.deepEqual(restoreState(JSON.stringify(oldState)).supports, []);
});

test('conclusÃ£o dÃ¡ XP uma Ãºnica vez e avanÃ§a a prÃ³xima etapa', () => {
  const { state } = completeMission(createInitialState(), 'design', 'design-1');
  assert.equal(totalXP(state), 10);
  assert.equal(nextMission(state).step.id, 'design-2');
  assert.equal(courseProgress(state, state.courses[0]).done, 1);
  assert.equal(completeMission(state, 'design', 'design-1').added, false);
  assert.equal(achievements(state)[0].unlocked, true);
});

test('tornar menor nÃ£o conclui a aula nem permite XP duplicado', () => {
  const result = completeMission(createInitialState(), 'design', 'design-1', { preparation: true });
  assert.equal(result.xp, 5);
  assert.equal(result.state.completed.length, 0);
  assert.equal(nextMission(result.state).step.id, 'design-1');
  assert.equal(courseStatus(result.state, result.state.courses[0]), 'active');
  assert.equal(completeMission(result.state, 'design', 'design-1', { preparation: true }).added, false);
  assert.equal(totalXP(completeMission(result.state, 'design', 'design-1').state), 15);
});

test('curso concluÃ­do nÃ£o volta Ã s sugestÃµes', () => {
  let state = createInitialState();
  for (const step of state.courses[0].steps) state = completeMission(state, 'design', step.id).state;
  assert.equal(courseStatus(state, state.courses[0]), 'completed');
  assert.equal(nextMission(state).course.id, 'python');
  assert.equal(achievements(state).find((item) => item.id === 'course').unlocked, true);
});

test('pausar um curso preserva progresso e muda a sugestÃ£o', () => {
  const state = completeMission(createInitialState(), 'design', 'design-1').state;
  state.courses[0].paused = true;
  assert.equal(nextMission(state).course.id, 'python');
  assert.equal(courseProgress(state, state.courses[0]).done, 1);
  assert.equal(completeMission(state, 'design', 'design-2').added, false);
  state.courses[0].paused = false;
  assert.equal(nextMission(state).step.id, 'design-2');
});

test('cursos prÃ³prios validam links e ganham etapas Ãºnicas', () => {
  assert.equal(safeCourseURL('javascript:alert(1)'), null);
  assert.equal(safeCourseURL('https://user:secret@example.com'), null);
  assert.equal(safeCourseURL('https://example.com/aula'), 'https://example.com/aula');
  const state = addCourse(createInitialState(), { title: ' Meu curso ', steps: [' Abrir material ', '', 'Praticar'] }, 'custom');
  assert.equal(state.courses.at(-1).steps.length, 2);
  assert.equal(nextMission(state).course.title, 'Meu curso');
  assert.equal(achievements(state).find((item) => item.id === 'own').unlocked, true);
  assert.throws(() => addCourse(state, { title: 'X', steps: [], url: '' }));
});

test('histÃ³rico semanal usa a semana local e exclui datas futuras de outra semana', () => {
  let state = createInitialState();
  state = completeMission(state, 'design', 'design-1', { now: new Date(2026, 9, 26, 10).toISOString() }).state;
  state = completeMission(state, 'design', 'design-2', { now: new Date(2026, 9, 25, 10).toISOString() }).state;
  state = completeMission(state, 'design', 'design-3', { now: new Date(2026, 10, 2, 10).toISOString() }).state;
  assert.equal(weekCount(state, new Date(2026, 9, 30, 12)), 1);
});

test('pausas nÃ£o reduzem XP nem apagam conquistas', () => {
  let state = completeMission(createInitialState(), 'design', 'design-1', { now: '2026-01-01T12:00:00Z' }).state;
  state = completeMission(state, 'design', 'design-2', { now: '2026-10-30T12:00:00Z' }).state;
  assert.equal(totalXP(state), 20);
  assert.equal(achievements(state)[0].unlocked, true);
});

test('armazenamento invÃ¡lido nÃ£o quebra o inÃ­cio e preferÃªncias sÃ£o normalizadas', () => {
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

test('preferÃªncia antiga de reduzir movimentos Ã© descartada e nÃ£o volta ao estado', () => {
  const legacy = createInitialState();
  legacy.preferences.reducedMotion = true;
  const restored = restoreState(JSON.stringify(legacy));
  assert.equal('reducedMotion' in restored.preferences, false);
  assert.equal('reducedMotion' in createInitialState().preferences, false);
  assert.equal(restored.preferences.theme, 'dark');
});

test('cada jornada inicia uma sequência própria e retoma de onde parou', () => {
  const initial = createInitialState();
  const starting = startJourney(initial, 'starting');
  assert.equal(starting.habit, 'starting');
  assert.equal(starting.onboarding.status, 'active');
  assert.equal(starting.onboarding.step, 1);

  const inProgress = saveOnboardingAnswer(starting, { subject: 'redes' }, 2);
  assert.equal(inProgress.onboarding.answers.subject, 'redes');
  assert.equal(inProgress.onboarding.step, 2);

  // Mesma jornada retoma a etapa; trocar de jornada recomeça a sequência.
  assert.equal(startJourney(inProgress, 'starting').onboarding.step, 2);
  assert.equal(startJourney(inProgress, 'often').onboarding.step, 1);
  assert.throws(() => startJourney(initial, 'inexistente'));
});

test('onboarding interrompido sobrevive à restauração do estado', () => {
  const interrupted = saveOnboardingAnswer(startJourney(createInitialState(), 'sometimes'), { studying: 'estatística' }, 2);
  const restored = restoreState(JSON.stringify(interrupted));
  assert.equal(restored.onboarding.status, 'active');
  assert.equal(restored.onboarding.journey, 'sometimes');
  assert.equal(restored.onboarding.step, 2);
  assert.equal(restored.onboarding.answers.studying, 'estatística');
  assert.equal(normalizeOnboarding({ journey: 'nada', step: 99 }).status, 'pending');
});

test('concluir a jornada não concede XP nem apaga materiais', () => {
  const withMaterial = addMaterial(createInitialState(), { title: 'Curso de redes', type: 'lesson', firstActivity: 'Assistir à aula 1' });
  const done = completeJourney(saveOnboardingAnswer(startJourney(withMaterial, 'starting'), { subject: 'redes' }, 5));
  assert.equal(done.onboarded, true);
  assert.equal(done.onboarding.status, 'done');
  assert.equal(totalXP(done), 0);
  assert.equal(done.courses.length, withMaterial.courses.length);
  assert.equal(done.preferences.weeklyGoal, 2);
  assert.equal(done.preferences.weeklyGoalSource, 'suggested');
});

test('meta ajustada à mão não é substituída ao revisar o ritmo', () => {
  const initial = createInitialState();
  initial.preferences.weeklyGoal = 6;
  initial.preferences.weeklyGoalSource = 'manual';
  const done = completeJourney(startJourney(initial, 'often'));
  assert.equal(done.preferences.weeklyGoal, 6);
  const reviewed = applyStudyRhythm(done, { habit: 'starting', supports: [] });
  assert.equal(reviewed.preferences.weeklyGoal, 6);
});

test('material do onboarding guarda tipo e ponto de retomada sem gerar histórico', () => {
  const next = addMaterial(createInitialState(), { title: 'Artigo de processo penal', type: 'article', resumeAt: 'página 12', firstActivity: 'Ler a seção 2' });
  const created = next.courses.at(-1);
  assert.equal(created.title, 'Artigo de processo penal');
  assert.equal(created.type, 'article');
  assert.equal(created.resumeAt, 'página 12');
  assert.equal(created.origin, 'onboarding');
  assert.deepEqual(next.history, []);
  assert.equal(totalXP(next), 0);
  assert.equal(journeyPlan(next).firstActivity !== null, true);
});