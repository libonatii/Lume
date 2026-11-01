import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { applyMigrations, sqliteAdapter } from './api/adapters/sqlite.js';
import { createInitialState, restoreState } from './public/domain.js';
import {
  ensureXpSettings, getRanking, getXpSnapshot, recordTimeSession, updateXpSettings, adjustEvent, XpError,
} from './xp.js';
import { grantBonus, grantSlide, grantStep } from './rewards.js';
import { collectCompletionCandidates, levelProgress } from './public/xp-policy.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const DAY = '2026-10-31';

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyMigrations(sqlite, fileURLToPath(new URL('./migrations/', import.meta.url)));
  return { sqlite, db: sqliteAdapter(sqlite) };
}

async function addUser(db, id, name = id) {
  await db.run('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, name, `${id}@example.test`, 'x', new Date(NOW).toISOString()]);
}

async function saveState(db, userId, state) {
  await db.run(
    `INSERT INTO user_state (user_id, state, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
    [userId, JSON.stringify(state), new Date(NOW).toISOString()],
  );
}

function materialState({ type = 'course', steps = ['Aula 1', 'Aula 2'], courseId = 'c1' } = {}) {
  const state = createInitialState();
  state.onboarded = true;
  state.courses = [{
    id: courseId,
    title: 'Curso de teste',
    type,
    planning: false,
    example: false,
    paused: false,
    art: 'nature',
    url: '',
    category: 'Teste',
    steps: steps.map((title, index) => ({ id: `${courseId}-${index}`, title })),
    slides: [],
    slideProgress: { seen: [], lastId: '', completedAt: null },
  }];
  state.selectedCourseId = courseId;
  return state;
}

// Monta o progresso no formato v1 (completed + history) e passa pela leitura
// do estado, que converte para o registro único — como acontece com contas antigas.
function completeState(state, ids, at = NOW + 1000) {
  const course = state.courses[0];
  const completed = new Set(ids);
  return restoreState({
    ...state,
    version: 1,
    completed: [...completed],
    history: [...completed].map((stepId) => ({
      id: `step:${stepId}`,
      courseId: course.id,
      stepId,
      title: course.steps.find((step) => step.id === stepId)?.title || 'Aula',
      courseTitle: course.title,
      preparation: false,
      xp: 0,
      policy: 'v1',
      at: new Date(at).toISOString(),
    })),
  });
}

test('evento de etapa é único, deriva o tipo do estado e soma no nível novo', async () => {
  const { db } = makeDb();
  await addUser(db, 'u1');
  await ensureXpSettings(db, 'u1', { now: NOW });
  const state = completeState(materialState(), ['c1-0', 'c1-1']);
  await saveState(db, 'u1', state);

  const first = await grantStep(db, 'u1', { courseId: 'c1', stepId: 'c1-0' }, { now: NOW + 2000 });
  assert.equal(first.added, true);
  assert.equal(first.event.kind, 'lesson');
  assert.equal(first.event.xp, 100);
  const again = await grantStep(db, 'u1', { courseId: 'c1', stepId: 'c1-0' }, { now: NOW + 3000 });
  assert.equal(again.added, false);
  assert.equal(again.duplicate, true);

  const bonus = await grantBonus(db, 'u1', { courseId: 'c1' }, { now: NOW + 4000 });
  assert.equal(bonus.added, true);
  assert.equal(bonus.event.kind, 'course_bonus');
  assert.equal(bonus.event.xp, 500);
  const duplicateBonus = await grantBonus(db, 'u1', { courseId: 'c1' }, { now: NOW + 5000 });
  assert.equal(duplicateBonus.duplicate, true);

  const overview = await getXpSnapshot(db, 'u1', { now: NOW + 6000 });
  assert.equal(overview.summary.totalXP, 600);
  assert.equal(overview.summary.level, 2);
  assert.equal(overview.summary.coursesCompleted, 1);
  assert.equal(overview.achievements.length, 1);
  assert.equal(overview.achievements[0].title, 'Curso de teste');
  assert.equal(levelProgress(600).current, 100);
});

test('progresso anterior à política e progresso importado permanecem legado', async () => {
  const { db } = makeDb();
  await addUser(db, 'legacy');
  await ensureXpSettings(db, 'legacy', { now: NOW });
  const state = completeState(materialState(), ['c1-0'], NOW - 1000);
  await saveState(db, 'legacy', state);
  await assert.rejects(
    () => grantStep(db, 'legacy', { courseId: 'c1', stepId: 'c1-0' }, { now: NOW + 1000 }),
    (error) => error instanceof XpError && error.code === 'legacy_progress',
  );

  const imported = materialState({ courseId: 'imp' });
  imported.courses[0].source = { provider: 'coursera', providerLabel: 'Coursera', identity: 'coursera|https://example.test/c', completeness: 'complete', demo: false };
  imported.courses[0].structure = [{ id: 'd1', title: 'Área', modules: [{ id: 'm1', title: 'Módulo', lessons: [{ id: 'imp-0', title: 'Aula 1' }] }] }];
  imported.version = 1;
  imported.completed = ['imp-0'];
  imported.history = [];
  imported.studyLog = [{ id: 'import:imp-0', courseId: 'imp', stepId: 'imp-0', origin: 'import', historical: true, at: new Date(NOW + 1000).toISOString() }];
  await saveState(db, 'legacy', imported);
  await assert.rejects(
    () => grantStep(db, 'legacy', { courseId: 'imp', stepId: 'imp-0' }, { now: NOW + 2000 }),
    (error) => error.code === 'legacy_progress',
  );
  assert.equal((await getXpSnapshot(db, 'legacy', { now: NOW + 3000 })).summary.totalXP, 0);
});

test('bônus exige todas as etapas elegíveis e não aceita curso de uma etapa', async () => {
  const { db } = makeDb();
  await addUser(db, 'u2');
  await ensureXpSettings(db, 'u2', { now: NOW });
  const partial = completeState(materialState(), ['c1-0']);
  await saveState(db, 'u2', partial);
  await grantStep(db, 'u2', { courseId: 'c1', stepId: 'c1-0' }, { now: NOW + 1000 });
  await assert.rejects(
    () => grantBonus(db, 'u2', { courseId: 'c1' }, { now: NOW + 2000 }),
    (error) => error.code === 'course_not_complete',
  );

  const short = completeState(materialState({ steps: ['Única'] }), ['c1-0']);
  await saveState(db, 'u2', short);
  await grantStep(db, 'u2', { courseId: 'c1', stepId: 'c1-0' }, { now: NOW + 3000 });
  await assert.rejects(
    () => grantBonus(db, 'u2', { courseId: 'c1' }, { now: NOW + 4000 }),
    (error) => error.code === 'too_short',
  );
});

test('apresentação concede XP uma vez com cobertura de 80% e último slide', async () => {
  const { db } = makeDb();
  await addUser(db, 'slides');
  await ensureXpSettings(db, 'slides', { now: NOW });
  const state = materialState({ type: 'article', steps: ['Ler'], courseId: 'deck' });
  state.courses[0].slides = Array.from({ length: 5 }, (_, index) => ({ id: `slide-${index}`, title: `Slide ${index}`, body: 'Conteúdo' }));
  state.courses[0].slideProgress = { seen: ['slide-0', 'slide-1', 'slide-2'], lastId: 'slide-2', completedAt: null };
  await saveState(db, 'slides', state);
  await assert.rejects(
    () => grantSlide(db, 'slides', { courseId: 'deck' }, { now: NOW + 1000 }),
    (error) => error.code === 'deck_not_complete',
  );
  state.courses[0].slideProgress = { seen: ['slide-0', 'slide-1', 'slide-2', 'slide-3', 'slide-4'], lastId: 'slide-4', completedAt: new Date(NOW + 1000).toISOString() };
  await saveState(db, 'slides', state);
  const first = await grantSlide(db, 'slides', { courseId: 'deck' }, { now: NOW + 2000 });
  assert.equal(first.added, true);
  assert.equal(first.event.xp, 100);
  const again = await grantSlide(db, 'slides', { courseId: 'deck' }, { now: NOW + 3000 });
  assert.equal(again.duplicate, true);
  const overview = await getXpSnapshot(db, 'slides', { now: NOW + 4000 });
  assert.equal(overview.achievements[0].kind, 'slide');
});

test('correção cria ajuste negativo idempotente e revoga a conquista vinculada', async () => {
  const { db } = makeDb();
  await addUser(db, 'fix');
  await ensureXpSettings(db, 'fix', { now: NOW });
  const state = materialState({ type: 'article', steps: ['Ler'], courseId: 'deck' });
  state.courses[0].slides = [{ id: 's1', title: 'Um', body: '' }, { id: 's2', title: 'Dois', body: '' }];
  state.courses[0].slideProgress = { seen: ['s1', 's2'], lastId: 's2', completedAt: new Date(NOW + 1000).toISOString() };
  await saveState(db, 'fix', state);
  const granted = await grantSlide(db, 'fix', { courseId: 'deck' }, { now: NOW + 2000 });
  assert.equal(granted.added, true);
  const adjustment = await adjustEvent(db, 'fix', { eventId: granted.event.id, reason: 'Registro feito por engano' }, { now: NOW + 3000 });
  assert.equal(adjustment.added, true);
  assert.equal(adjustment.event.kind, 'adjustment');
  assert.equal(adjustment.event.xp, -100);
  assert.equal(adjustment.event.reason, 'Registro feito por engano');
  const again = await adjustEvent(db, 'fix', { eventId: granted.event.id, reason: 'Outro motivo' }, { now: NOW + 4000 });
  assert.equal(again.duplicate, true);
  const overview = await getXpSnapshot(db, 'fix', { now: NOW + 5000 });
  assert.equal(overview.summary.totalXP, 0);
  assert.equal(overview.achievements.length, 0);
  await assert.rejects(
    () => adjustEvent(db, 'fix', { eventId: granted.event.id, reason: '' }, { now: NOW + 6000 }),
    (error) => error instanceof XpError && error.code === 'reason_required',
  );
});

test('blocos de tempo são idempotentes, acumulam sobras e respeitam o teto diário', async () => {
  const { db } = makeDb();
  await addUser(db, 'time');
  await ensureXpSettings(db, 'time', { now: NOW });
  await saveState(db, 'time', createInitialState());

  const session = (id, offset) => {
    const ended = NOW + offset * 1000 + 1800 * 1000;
    return {
      sessionId: id,
      startedAt: new Date(ended - 1800 * 1000).toISOString(),
      endedAt: new Date(ended).toISOString(),
      durationSeconds: 1800,
    };
  };
  const first = await recordTimeSession(db, 'time', session('s1', 0), { now: NOW });
  assert.equal(first.grantedXP, 25);
  const duplicate = await recordTimeSession(db, 'time', session('s1', 0), { now: NOW });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.grantedXP, 25);

  let total = 25;
  for (let index = 2; index <= 8; index += 1) {
    const result = await recordTimeSession(db, 'time', session(`s${index}`, index * 10000), { now: NOW });
    assert.equal(result.grantedXP, 25);
    total += 25;
  }
  assert.equal(total, 200);
  const capped = await recordTimeSession(db, 'time', session('s9', 90000), { now: NOW });
  assert.equal(capped.grantedXP, 0);
  assert.equal(capped.discardedBlocks, 1);
  const summary = await getXpSnapshot(db, 'time', { now: NOW });
  assert.equal(summary.summary.dailyTimeXP, 200);
  assert.equal(summary.summary.carrySeconds, 0);
});

test('sessões sobrepostas não somam o mesmo relógio duas vezes', async () => {
  const { db } = makeDb();
  await addUser(db, 'overlap');
  await ensureXpSettings(db, 'overlap', { now: NOW });
  await saveState(db, 'overlap', createInitialState());
  const interval = {
    startedAt: new Date(NOW - 1200 * 1000).toISOString(),
    endedAt: new Date(NOW).toISOString(),
    durationSeconds: 1200,
  };
  const first = await recordTimeSession(db, 'overlap', { ...interval, sessionId: 'a' }, { now: NOW });
  assert.equal(first.effectiveSeconds, 1200);
  const second = await recordTimeSession(db, 'overlap', { ...interval, sessionId: 'b' }, { now: NOW });
  assert.equal(second.effectiveSeconds, 0);
  assert.equal(second.grantedXP, 0);
});

test('ranking tem três abas, empates compartilhados, opt-in e legado fora', async () => {
  const { db } = makeDb();
  for (const [id, name] of [['u1', 'Ana'], ['u2', 'Bia'], ['u3', 'Carla']]) await addUser(db, id, name);
  await db.run('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', ['u1', 'u2', new Date(NOW).toISOString()]);
  await db.run('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)', ['u1', 'u3', new Date(NOW).toISOString()]);
  await ensureXpSettings(db, 'u1', { now: NOW });
  await ensureXpSettings(db, 'u2', { now: NOW });
  await ensureXpSettings(db, 'u3', { now: NOW });
  await updateXpSettings(db, 'u1', { rankingOptIn: true, timeZone: 'UTC' });
  await updateXpSettings(db, 'u2', { rankingOptIn: true, timeZone: 'UTC' });
  await updateXpSettings(db, 'u3', { rankingOptIn: false, timeZone: 'UTC' });

  const event = (userId, key, kind, xp, at = NOW + 1000) => db.run(
    `INSERT INTO xp_events (id, user_id, event_key, kind, xp, origin, policy_version, local_day, granted_at)
     VALUES (?, ?, ?, ?, ?, 'manual', 'v1', ?, ?)`,
    [`${userId}-${key}`, userId, key, kind, xp, DAY, new Date(at).toISOString()],
  );
  await event('u1', 'lesson-1', 'lesson', 100);
  await event('u1', 'course-1', 'course_bonus', 500);
  await event('u1', 'time-1', 'time_block', 25);
  await event('u2', 'course-2', 'course_bonus', 500);
  await event('u2', 'course-3', 'course_bonus', 500);

  const level = await getRanking(db, 'u1', { tab: 'level', now: NOW, timeZone: 'UTC' });
  assert.equal(level.entries[0].id, 'u2');
  assert.equal(level.entries[0].position, 1);
  assert.equal(level.entries[1].id, 'u1');
  assert.equal(level.entries.some((entry) => entry.id === 'u3'), false, 'opt-out não aparece');
  assert.equal(level.self.optedIn, true);

  const courses = await getRanking(db, 'u1', { tab: 'courses', now: NOW, timeZone: 'UTC' });
  assert.equal(courses.entries[0].coursesCompleted, 2);
  assert.equal(courses.entries[1].coursesCompleted, 1);

  const effort = await getRanking(db, 'u1', { tab: 'effort', period: 'week', now: NOW, timeZone: 'UTC' });
  assert.equal(effort.entries[0].periodXP, 1000);
  assert.equal(effort.entries[1].periodXP, 625);

  // Empate nos critérios compartilha a posição.
  await event('u1', 'adjust-tie', 'adjustment', 375);
  const tied = await getRanking(db, 'u1', { tab: 'level', now: NOW, timeZone: 'UTC' });
  assert.deepEqual(tied.entries.map((entry) => entry.position), [1, 1]);

  await updateXpSettings(db, 'u1', { rankingOptIn: false });
  const out = await getRanking(db, 'u1', { tab: 'level', now: NOW, timeZone: 'UTC' });
  assert.deepEqual(out.entries.map((entry) => entry.id), ['u2']);
  assert.equal(out.self.optedIn, false);
  assert.equal(out.self.position, null);
});

test('candidatos do navegador ignoram legado e incluem apresentação concluída', () => {
  const state = completeState(materialState(), ['c1-0', 'c1-1']);
  state.courses[0].slides = [{ id: 's1', title: 'Um', body: '' }, { id: 's2', title: 'Dois', body: '' }];
  state.courses[0].slideProgress = { seen: ['s1', 's2'], lastId: 's2', completedAt: new Date(NOW + 1000).toISOString() };
  const candidates = collectCompletionCandidates(state, new Date(NOW).toISOString());
  assert.equal(candidates.steps.length, 2);
  assert.equal(candidates.bonuses.length, 1);
  assert.equal(candidates.slides.length, 1);
  const legacy = collectCompletionCandidates(state, new Date(NOW + 5000).toISOString());
  assert.equal(legacy.steps.length, 0);
  assert.equal(legacy.bonuses.length, 0);
  assert.equal(legacy.slides.length, 0);
});
