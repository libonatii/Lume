import { test, expect } from '@playwright/test';
import { createInitialState } from '../../public/domain.js';
import { stepUnits, materialSteps } from '../../public/material-model.js';
import { libraryActions } from '../../public/library-actions.js';

const PASSWORD = 'senha-local-teste-123';

async function register(requestContext, baseURL, name, prefix) {
  const email = `${prefix}-${Date.now()}@example.test`;
  const response = await requestContext.post('/api/register', {
    data: { name, email, password: PASSWORD },
    headers: { origin: baseURL },
  });
  expect(response.status()).toBe(201);
  return { email, user: (await response.json()).user };
}

function courseState(completedIds = ['c1-0']) {
  const state = createInitialState();
  state.onboarded = true;
  state.courses = [{
    id: 'c1',
    title: 'Curso de teste',
    type: 'course',
    planning: false,
    example: false,
    paused: false,
    art: 'nature',
    url: '',
    category: 'Teste',
    resumeAt: '',
    slides: [],
    slideProgress: { seen: [], lastId: '', completedAt: null },
    units: stepUnits([
      { id: 'c1-0', title: 'Aula 1' },
      { id: 'c1-1', title: 'Aula 2' },
      { id: 'c1-2', title: 'Aula 3' },
    ]),
  }];
  state.selectedCourseId = 'c1';
  // Formato v1, como uma conta criada antes do registro único de progresso.
  state.progress = completedIds.map((stepId) => ({
    id: `step:${stepId}`,
    materialId: 'c1',
    unitId: stepId,
    title: materialSteps(state.courses[0]).find((step) => step.id === stepId)?.title || 'Aula',
    materialTitle: 'Curso de teste',
    type: 'completion',
    origin: 'manual',
    historical: false,
    at: new Date(Date.now() + 1000).toISOString(),
  }));
  return state;
}

test('XP é concedido uma vez pelo servidor, com bônus, tempo e extrato', async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  await register(page.request, baseURL, 'Ana XP', 'xp-server');
  const settings = await (await page.request.get('/api/xp?timeZone=UTC', { headers: { origin: baseURL } })).json();
  expect(settings.settings.eligibleSince).toBeTruthy();

  const state = courseState(['c1-0', 'c1-1', 'c1-2']);
  await page.request.put('/api/state', { data: state, headers: { origin: baseURL } });

  const first = await page.request.post('/api/xp/complete', { data: { courseId: 'c1', stepId: 'c1-0' }, headers: { origin: baseURL } });
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.added).toBe(true);
  const replay = await page.request.post('/api/xp/complete', { data: { courseId: 'c1', stepId: 'c1-0' }, headers: { origin: baseURL } });
  expect((await replay.json()).duplicate).toBe(true);
  await page.request.post('/api/xp/complete', { data: { courseId: 'c1', stepId: 'c1-1' }, headers: { origin: baseURL } });
  await page.request.post('/api/xp/complete', { data: { courseId: 'c1', stepId: 'c1-2' }, headers: { origin: baseURL } });
  const bonus = await page.request.post('/api/xp/bonus', { data: { courseId: 'c1' }, headers: { origin: baseURL } });
  expect((await bonus.json()).added).toBe(true);
  const bonusReplay = await page.request.post('/api/xp/bonus', { data: { courseId: 'c1' }, headers: { origin: baseURL } });
  expect((await bonusReplay.json()).duplicate).toBe(true);

  const now = Date.now();
  const time = await page.request.post('/api/xp/time', {
    data: {
      sessionId: 'sess-e2e-1',
      startedAt: new Date(now - 1800 * 1000).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationSeconds: 1800,
    },
    headers: { origin: baseURL },
  });
  expect((await time.json()).grantedXP).toBe(25);

  const overview = await (await page.request.get('/api/xp?timeZone=UTC', { headers: { origin: baseURL } })).json();
  expect(overview.summary.totalXP).toBe(825);
  expect(overview.summary.level).toBe(2);
  expect(overview.summary.coursesCompleted).toBe(1);
  expect(overview.achievements.some((item) => item.title === 'Curso de teste')).toBe(true);
  expect(overview.events.some((event) => event.kind === 'time_block')).toBe(true);
  expect(overview.events.filter((event) => event.kind === 'lesson')).toHaveLength(3);
});

test('ranking exige opt-in, mostra o próprio XP validado e pode ser desligado', async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  await register(page.request, baseURL, 'Ana Ranking', 'xp-ranking');
  await (await page.request.get('/api/xp?timeZone=UTC', { headers: { origin: baseURL } })).json();
  const state = courseState(['c1-0']);
  const initial = await (await page.request.get('/api/library', { headers: { origin: baseURL } })).json();
  const grant = await page.request.post('/api/library/actions', { data: { id: 'study', revision: initial.revision, actions: libraryActions(initial.state, state) }, headers: { origin: baseURL } });
  expect(grant.status()).toBe(200);

  await page.goto('/#hoje');
  await page.getByRole('button', { name: /^Menu da conta/ }).click();
  await expect(page.locator('#account-popover').getByText(/100 \/ 500 XP/)).toBeVisible();

  await page.goto('/#conquistas');
  await expect(page.locator('.achievement-summary')).toContainText('100 XP elegível');

  await page.goto('/#ranking');
  await expect(page.getByRole('heading', { name: 'Ranking', exact: true })).toBeVisible();
  await expect(page.getByText('Você ainda não aparece no ranking.')).toBeVisible();
  await page.getByRole('button', { name: 'Participar do ranking' }).click();
  await expect(page.getByText('Você está no ranking de amigos.')).toBeVisible();
  await expect(page.getByText('Ana Ranking · você')).toBeVisible();

  await page.getByRole('button', { name: 'Sair do ranking' }).click();
  await expect(page.getByText('Você ainda não aparece no ranking.')).toBeVisible();
});
