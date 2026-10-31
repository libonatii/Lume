import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile, normalizeSharing } from './public/profile-domain.js';
import { createInitialState, restoreState } from './public/domain.js';

function fixture() {
  const base = createInitialState();
  return {
    ...base,
    onboarded: true,
    courses: [
      { id: 'c1', title: 'Curso de redes', type: 'course', url: 'https://exemplo.test/redes', steps: [{ id: 's1', title: 'Aula 1' }, { id: 's2', title: 'Aula 2' }] },
      { id: 'p1', title: 'Projeto público', type: 'project', shared: true, url: '', steps: [{ id: 's3', title: 'Entrega' }] },
      { id: 'p2', title: 'Projeto privado', type: 'project', url: '', steps: [{ id: 's4', title: 'Entrega' }] },
      { id: 'e1', title: 'Curso de exemplo', type: 'course', example: true, url: '', steps: [{ id: 's5', title: 'Aula' }] },
      { id: 'c2', title: 'Curso concluído', type: 'course', url: '', steps: [{ id: 's6', title: 'Aula' }] },
    ],
    completed: ['s1', 's6'],
    history: [],
  };
}

function withSharing(sharing) {
  const state = fixture();
  return { ...state, preferences: { ...state.preferences, sharing } };
}

test('perfil padrão compartilha biblioteca, fila, progresso e XP', () => {
  const profile = buildProfile(fixture());
  assert.deepEqual(profile.sharing, { library: true, queue: true, progress: true, xp: true });
  assert.ok(profile.studying.length > 0);
  assert.ok(profile.queue.length > 0);
  assert.equal(profile.stats.level, 1);
  assert.equal(profile.stats.doneLessons, 2);
});

test('materiais de exemplo não entram no perfil', () => {
  const profile = buildProfile(fixture());
  const titles = [...profile.studying, ...profile.completed, ...profile.projects].map((item) => item.title);
  assert.equal(titles.includes('Curso de exemplo'), false);
  assert.equal(profile.stats.lessons, 4);
});

test('só projetos marcados como públicos aparecem, em nenhuma seção', () => {
  const profile = buildProfile(fixture());
  assert.deepEqual(profile.projects.map((project) => project.title), ['Projeto público']);
  const serialized = JSON.stringify(profile);
  assert.equal(serialized.includes('Projeto privado'), false);
  assert.equal(profile.queue.some((step) => step.course === 'Projeto privado'), false);
});

test('desligar progresso esconde percentuais e números', () => {
  const profile = buildProfile(withSharing({ progress: false }));
  assert.equal(profile.sharing.progress, false);
  assert.equal(profile.studying[0].progress, null);
  assert.equal(profile.projects[0].progress, null);
  assert.equal(profile.stats.doneLessons, null);
  assert.equal(profile.stats.lessons, null);
  assert.equal(profile.stats.completedCourses, null);
  assert.equal(profile.stats.activeCourses, 3);
});

test('desligar biblioteca esvazia o que está estudando e o que foi concluído', () => {
  const profile = buildProfile(withSharing({ library: false }));
  assert.deepEqual(profile.studying, []);
  assert.deepEqual(profile.completed, []);
});

test('desligar fila esvazia o roteiro', () => {
  const profile = buildProfile(withSharing({ queue: false }));
  assert.deepEqual(profile.queue, []);
});

test('desligar XP esconde nível e total', () => {
  const profile = buildProfile(withSharing({ xp: false }));
  assert.equal(profile.stats.xp, null);
  assert.equal(profile.stats.level, null);
});

test('perfil não carrega e-mail, links nem senha', () => {
  const serialized = JSON.stringify(buildProfile(fixture()));
  assert.equal(serialized.includes('@'), false);
  assert.equal(serialized.includes('https://'), false);
  assert.equal(serialized.includes('password'), false);
});

test('escolhas ausentes voltam ao padrão compartilhado', () => {
  assert.deepEqual(normalizeSharing(undefined), { library: true, queue: true, progress: true, xp: true });
  assert.deepEqual(normalizeSharing({ xp: false }), { library: true, queue: true, progress: true, xp: false });
});

test('restauração preserva as escolhas e cobre estados antigos', () => {
  const state = withSharing({ library: false, queue: true, progress: false, xp: true });
  const restored = restoreState(JSON.stringify(state));
  assert.deepEqual(restored.preferences.sharing, { library: false, queue: true, progress: false, xp: true });

  const legacy = { ...state, preferences: { ...state.preferences } };
  delete legacy.preferences.sharing;
  const migrated = restoreState(JSON.stringify(legacy));
  assert.deepEqual(migrated.preferences.sharing, { library: true, queue: true, progress: true, xp: true });
});
