import { test, expect } from '@playwright/test';
import { createInitialState } from '../../public/domain.js';

test('gravação com revisão antiga recebe conflito e o estado atual', async ({ page }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  const email = `conflito-${Date.now()}@example.test`;
  const registered = await page.request.post('/api/register', {
    data: { name: 'Ana Conflito', email, password: 'senha-local-teste-123' },
    headers: { origin: baseURL },
  });
  expect(registered.status()).toBe(201);

  const initial = await page.request.get('/api/state', { headers: { origin: baseURL } });
  expect(initial.status()).toBe(200);
  const base = await initial.json();
  expect(base.revision).toBe(0);

  const stateA = { ...createInitialState(), onboarded: true, preferences: { ...createInitialState().preferences, weeklyGoal: 2 } };
  const first = await page.request.put('/api/state', {
    data: { state: stateA, baseRevision: 0 },
    headers: { origin: baseURL },
  });
  expect(first.status()).toBe(200);
  expect((await first.json()).revision).toBe(1);

  const stateB = { ...createInitialState(), onboarded: true, preferences: { ...createInitialState().preferences, weeklyGoal: 7 } };
  const stale = await page.request.put('/api/state', {
    data: { state: stateB, baseRevision: 0 },
    headers: { origin: baseURL },
  });
  expect(stale.status()).toBe(409);
  const body = await stale.json();
  expect(body.code).toBe('state_conflict');
  expect(body.state.preferences.weeklyGoal).toBe(2);
  expect(body.revision).toBe(1);
});
