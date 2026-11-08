import { test, expect } from '@playwright/test';
import { stepUnits } from '../../public/material-model.js';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

test('tarefa sem aula é concluída sem XP e sobrevive ao recarregamento', async ({ page }) => {
  await seedAccount(page, { ...createInitialState(), onboarded: true });

  await page.goto('/#tarefas');
  await expect(page.getByRole('heading', { name: 'Tarefas', exact: true })).toBeVisible();
  await page.getByLabel('Tarefa', { exact: true }).fill('Resolver 10 questões de constitucional');
  await page.getByRole('button', { name: 'Adicionar tarefa' }).click();
  await expect(page.getByText('Resolver 10 questões de constitucional')).toBeVisible();

  await page.getByRole('checkbox', { name: 'Concluir tarefa Resolver 10 questões de constitucional' }).click();
  await expect(page.getByText(/\+10 XP de legado/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Concluídas/ })).toBeVisible();

  const completed = await readAccount(page);
  expect(completed.tasks).toHaveLength(1);
  expect(completed.tasks[0].done).toBe(true);
  expect(completed.progress).toEqual([]);

  await page.reload();
  await expect(page.getByText('Resolver 10 questões de constitucional')).toBeVisible();
  await expect(page.getByText(/\+10 XP de legado/)).toHaveCount(0);

  // Reabrir e concluir novamente continuam sem XP próprio.
  await page.getByRole('checkbox', { name: 'Reabrir tarefa Resolver 10 questões de constitucional' }).click();
  await expect(page.getByText(/\+10 XP de legado/)).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Concluir tarefa Resolver 10 questões de constitucional' }).click();
  const again = await readAccount(page);
  expect(again.tasks[0].done).toBe(true);
});

test('prioridade e atraso aparecem na lista e na Hoje e sobrevivem ao recarregamento', async ({ page }) => {
  const state = { ...createInitialState(), onboarded: true };
  state.courses = [{ id: 'const', title: 'Direito Constitucional', category: 'Direito', art: 'nature', url: '', example: false, paused: false, units: stepUnits([{ id: 'const-1', title: 'Direitos fundamentais' }]) }];
  state.tasks = [
    { id: 'late', title: 'Revisar controle de constitucionalidade', courseId: 'const', dueDate: '2020-01-10', priority: 0, done: false, createdAt: '2020-01-01T10:00:00.000Z', completedAt: null },
    { id: 'plain', title: 'Separar súmulas vinculantes', courseId: '', dueDate: '', priority: 0, done: false, createdAt: '2020-01-02T10:00:00.000Z', completedAt: null },
  ];
  await seedAccount(page, state);

  await page.goto('/#hoje');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Direitos fundamentais', exact: true })).toBeVisible();
  await expect(page.getByText('Uma tarefa passou do prazo. Reorganize a semana para manter seu objetivo.')).toBeVisible();
  await expect(page.getByText(/estimativa/).first()).toBeVisible();

  await page.goto('/#tarefas');
  await page.getByLabel('Prioridade de Separar súmulas vinculantes').selectOption('1');
  await expect(page.getByLabel('Prioridade de Separar súmulas vinculantes')).toHaveValue('1');
  const items = page.locator('.todo-item');
  await expect(items.first()).toContainText('Revisar controle de constitucionalidade');
  await expect(items.first()).toContainText('Atrasada');

  await page.reload();
  await expect(page.getByLabel('Prioridade de Separar súmulas vinculantes')).toHaveValue('1');
  const saved = await readAccount(page);
  expect(saved.tasks.find((task) => task.id === 'plain').priority).toBe(1);
  expect(saved.progress).toEqual([]);
});
