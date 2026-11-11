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
  await expect(page.getByText(/Prioridade alta/)).toBeVisible();
  const items = page.locator('.todo-item');
  await expect(items.first()).toContainText('Revisar controle de constitucionalidade');
  await expect(items.first()).toContainText('Atrasada');

  await page.reload();
  await expect(page.getByLabel('Prioridade de Separar súmulas vinculantes')).toHaveValue('1');
  const saved = await readAccount(page);
  expect(saved.tasks.find((task) => task.id === 'plain').priority).toBe(1);
  expect(saved.progress).toEqual([]);
});

test('subtarefas são renomeadas e reordenadas pelo teclado e arrastando, sem XP', async ({ page }) => {
  const subtasks = ['Ler aula 6', 'Ler aula 7', 'Ler aula 8'].map((title, index) => ({ id: `s${index}`, title, done: false }));
  await seedAccount(page, { ...createInitialState(), onboarded: true, tasks: [
    { id: 'falencia', title: 'A2 - Falência', courseId: '', dueDate: '', priority: 1, done: false, createdAt: '2026-11-01T10:00:00.000Z', completedAt: null, subtasks },
  ] });
  await page.goto('/#tarefas');

  await page.getByRole('button', { name: 'Renomear subtarefa Ler aula 7' }).click();
  const rename = page.getByLabel('Novo nome da subtarefa Ler aula 7');
  await rename.fill('Ler aula 7 e fazer resumo');
  await rename.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Ler aula 7 e fazer resumo' })).toBeVisible();

  await page.getByRole('button', { name: 'Mover subtarefa Ler aula 8', exact: true }).press('ArrowUp');
  await expect(page.locator('.subtask-list li').first()).not.toContainText('Ler aula 8');
  await expect(page.locator('.subtask-list li').nth(1)).toContainText('Ler aula 8');

  // Arrasta "Ler aula 6" pela alça até o fim da lista.
  await page.locator('.subtask-list').scrollIntoViewIfNeeded();
  // Mede só depois que a animação do movimento anterior assentar.
  await page.waitForFunction(() => [...document.querySelectorAll('.subtask-list li')].every((li) => getComputedStyle(li).transform === 'none'));
  const handle = page.getByRole('button', { name: 'Mover subtarefa Ler aula 6', exact: true });
  const from = await handle.boundingBox();
  const to = await page.locator('.subtask-list li').last().boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height - 4, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('.subtask-list li').last()).toContainText('Ler aula 6');

  const saved = await readAccount(page);
  expect(saved.tasks[0].subtasks.map((item) => item.title)).toEqual(['Ler aula 8', 'Ler aula 7 e fazer resumo', 'Ler aula 6']);
  expect(saved.progress).toEqual([]);
  await page.reload();
  await expect(page.locator('.subtask-list li').first()).toContainText('Ler aula 8');
});
