import test from 'node:test';
import { stepUnits } from '../../public/material-model.js';
import assert from 'node:assert/strict';
import { buildProfile, normalizeSharing } from '../../public/profile-domain.js';
import { createInitialState, restoreState } from '../../public/domain.js';
import {
  MediaError, deleteProfileObject, detectImageType, parseMediaKeyFromPath, uploadProfileObject,
} from '../../api/domain/media.js';

function fixture() {
  const base = createInitialState();
  return {
    ...base,
    onboarded: true,
    courses: [
      { id: 'c1', title: 'Curso de redes', type: 'course', url: 'https://exemplo.test/redes', units: stepUnits([{ id: 's1', title: 'Aula 1' }, { id: 's2', title: 'Aula 2' }]) },
      { id: 'p1', title: 'Projeto público', type: 'project', shared: true, url: '', units: stepUnits([{ id: 's3', title: 'Entrega' }]) },
      { id: 'p2', title: 'Projeto privado', type: 'project', url: '', units: stepUnits([{ id: 's4', title: 'Entrega' }]) },
      { id: 'e1', title: 'Curso de exemplo', type: 'course', example: true, url: '', units: stepUnits([{ id: 's5', title: 'Aula' }]) },
      { id: 'c2', title: 'Curso concluído', type: 'course', url: '', units: stepUnits([{ id: 's6', title: 'Aula' }]) },
    ],
    progress: ['s1', 's6'].map((unitId, index) => ({ id: unitId, unitId, materialId: index ? 'c2' : 'c1', type: 'completion', origin: 'manual', historical: false, at: '2026-10-31T12:00:00Z' })),
  };
}

function withSharing(sharing) {
  const state = restoreState(fixture());
  return { ...state, preferences: { ...state.preferences, sharing } };
}

test('perfil padrão compartilha biblioteca, fila, progresso e XP', () => {
  const profile = buildProfile(restoreState(fixture()));
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

test('desligar XP esconde nível, conquistas e insígnia em destaque', () => {
  const profile = buildProfile(withSharing({ xp: false }));
  assert.equal(profile.stats.xp, null);
  assert.equal(profile.stats.level, null);
  assert.deepEqual(profile.achievements, []);
  assert.equal(profile.featuredBadge, null);
});

test('perfil inclui atividade recente, conquistas e personalização de foto/header via R2 sanitizada', () => {
  const sampleAvatarUrl = '/api/media/profiles/user_123/avatar-1730350000000.webp';
  const now = Date.parse('2026-10-31T12:00:00Z');
  const state = {
    ...fixture(),
    profile: {
      bio: 'Estudando Direito Processual\nFoco em projetos',
      avatar: sampleAvatarUrl,
      header: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    },
    progress: [
      { id: 'step:s1', materialId: 'c1', unitId: 's1', title: 'Aula 1', materialTitle: 'Curso de redes', type: 'completion', origin: 'manual', historical: false, at: '2026-10-29T15:00:00Z' },
    ],
  };
  const restored = restoreState(JSON.stringify(state));
  assert.equal(restored.profile.avatar, sampleAvatarUrl);
  assert.equal(restored.profile.header, '', 'base64 não é guardado no estado');
  assert.equal(restored.profile.bio, 'Estudando Direito Processual\nFoco em projetos');

  const profile = buildProfile(restored, { now });
  assert.equal(profile.customization.avatar, sampleAvatarUrl);
  assert.equal(profile.customization.header, '');
  assert.ok(profile.achievements.length > 0);
  assert.ok(profile.featuredBadge);
  assert.equal(profile.recentActivity[0].title, 'Curso de redes');
  assert.equal(profile.stats.recentStepsTwoWeeks, 1);
});

test('armazenamento de mídia valida assinatura binária, substitui objeto antigo no R2 e remove ao limpar', async () => {
  const objects = new Map();
  const fakeBucket = {
    async put(key, bytes, contentType) { objects.set(key, { bytes, contentType }); },
    async get(key) { return objects.get(key) || null; },
    async delete(key) { objects.delete(key); },
    async listKeys(prefix) { return [...objects.keys()].filter(key => key.startsWith(prefix)); },
  };
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 73, 72, 68, 82]);
  assert.deepEqual(detectImageType(pngBytes), { contentType: 'image/png', ext: 'png' });

  const first = await uploadProfileObject(fakeBucket, { ownerId: 'ana_1', slot: 'avatar', bytes: pngBytes, now: 1000 });
  assert.equal(first.url, '/api/media/profiles/ana_1/avatar-1000.png');
  assert.equal(objects.size, 1);

  const second = await uploadProfileObject(fakeBucket, { ownerId: 'ana_1', slot: 'avatar', bytes: pngBytes, now: 2000 });
  assert.equal(second.url, '/api/media/profiles/ana_1/avatar-2000.png');
  assert.equal(objects.size, 1, 'objeto anterior do mesmo slot foi removido');
  assert.equal(objects.has('profiles/ana_1/avatar-1000.png'), false);

  const parsed = parseMediaKeyFromPath(second.url);
  assert.equal(parsed?.key, 'profiles/ana_1/avatar-2000.png');
  assert.equal(parsed?.contentType, 'image/png');
  assert.equal(parseMediaKeyFromPath('/api/media/profiles/../secret.png'), null);

  await deleteProfileObject(fakeBucket, { ownerId: 'ana_1', slot: 'avatar' });
  assert.equal(objects.size, 0);

  await assert.rejects(
    () => uploadProfileObject(fakeBucket, { ownerId: 'ana_1', slot: 'avatar', bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) }),
    (error) => error instanceof MediaError && error.code === 'unsupported_format',
  );
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
