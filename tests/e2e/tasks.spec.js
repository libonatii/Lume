import { test, expect } from '@playwright/test';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

test('tarefa de prova é criada, concluída com XP uma vez e sobrevive ao recarregamento', async ({ page }) => {
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, state: { ...createInitialState(), onboarded: true } });

  await page.goto('/#tarefas');
  await expect(page.getByRole('heading', { name: 'Tarefas', exact: true })).toBeVisible();
  await page.getByLabel('Tarefa', { exact: true }).fill('Resolver 10 questões de constitucional');
  await page.getByRole('button', { name: 'Adicionar tarefa' }).click();
  await expect(page.getByText('Resolver 10 questões de constitucional')).toBeVisible();

  await page.getByRole('checkbox', { name: 'Concluir tarefa Resolver 10 questões de constitucional' }).click();
  await expect(page.getByText(/\+10 XP de legado/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Concluídas/ })).toBeVisible();

  const completed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(completed.tasks).toHaveLength(1);
  expect(completed.tasks[0].done).toBe(true);
  expect(completed.history).toEqual([]);

  await page.reload();
  await expect(page.getByText('Resolver 10 questões de constitucional')).toBeVisible();
  await expect(page.getByText(/\+10 XP de legado/).first()).toBeVisible();

  // Reabrir retira o XP; concluir de novo não acumula uma segunda vez.
  await page.getByRole('checkbox', { name: 'Reabrir tarefa Resolver 10 questões de constitucional' }).click();
  await expect(page.getByText(/\+10 XP de legado/)).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Concluir tarefa Resolver 10 questões de constitucional' }).click();
  const again = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(again.tasks[0].done).toBe(true);
});
