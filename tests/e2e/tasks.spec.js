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

test('prioridade e atraso aparecem na lista e na Hoje e sobrevivem ao recarregamento', async ({ page }) => {
  const state = { ...createInitialState(), onboarded: true };
  state.courses = [{ id: 'const', title: 'Direito Constitucional', category: 'Direito', art: 'nature', url: '', example: false, paused: false, steps: [{ id: 'const-1', title: 'Direitos fundamentais' }] }];
  state.tasks = [
    { id: 'late', title: 'Revisar controle de constitucionalidade', courseId: 'const', dueDate: '2020-01-10', priority: 0, done: false, createdAt: '2020-01-01T10:00:00.000Z', completedAt: null },
    { id: 'plain', title: 'Separar súmulas vinculantes', courseId: '', dueDate: '', priority: 0, done: false, createdAt: '2020-01-02T10:00:00.000Z', completedAt: null },
  ];
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, value: state });

  await page.goto('/#hoje');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Direitos fundamentais', exact: true })).toBeVisible();
  await expect(page.getByText('Uma tarefa passou do prazo. Reorganize a semana para manter seu objetivo.')).toBeVisible();
  await expect(page.getByText(/estimativa/).first()).toBeVisible();

  await page.goto('/#tarefas');
  await page.getByLabel('Prioridade de Separar súmulas vinculantes').selectOption('1');
  await expect(page.getByText(/Prioridade alta/)).toBeVisible();
  const items = page.locator('.todo-item');
  await expect(items.first()).toContainText('Revisar controle de constitucionalidade');
  await expect(items.first()).toContainText('Atrasada');

  await page.reload();
  await expect(page.getByLabel('Prioridade de Separar súmulas vinculantes')).toHaveValue('1');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.tasks.find((task) => task.id === 'plain').priority).toBe(1);
  expect(saved.history).toEqual([]);
});
