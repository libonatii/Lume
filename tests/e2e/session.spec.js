import { test, expect } from '@playwright/test';
import { stepUnits } from '../../public/material-model.js';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

// Sessão declarada: relógio de continuidade iniciado pela pessoa. O servidor
// confirma blocos de 30 minutos; a sessão não comprova estudo.

test('sessão declarada persiste ao recarregar, pausa, retoma e encerra sem conceder XP local', async ({ page }) => {
  const seeded = createInitialState();
  seeded.onboarded = true;
  seeded.courses = [{ id: 'design', title: 'Design de interfaces', category: 'Design', art: 'design', url: '', example: false, paused: false, units: stepUnits([{ id: 'design-1', title: 'Abrir o material e conhecer o curso' }]) }];
  seeded.selectedCourseId = 'design';
  await seedAccount(page, seeded);
  await page.goto('/#hoje');
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Iniciar sessão de foco' }).click();
  await expect(page.getByRole('heading', { name: 'Sessão de foco', exact: true })).toBeVisible();
  await expect(page.getByText(/confirma os blocos completos de 30 minutos/i)).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar foco' }).click();
  await expect(page.getByText('Em foco', { exact: true })).toBeVisible();
  await expect(page.getByText('Abrir o material e conhecer o curso').first()).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();

  // Recarregar não perde a sessão em andamento.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();

  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByRole('button', { name: 'Retomar' })).toBeVisible();
  await page.getByRole('button', { name: 'Retomar' }).click();
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();

  // Anotações rápidas no modo Zen e Escudo de foco absoluto persistem nas preferências.
  await page.getByLabel('Anotações rápidas da sessão').fill('Revisar heurísticas de usabilidade');
  await page.getByRole('button', { name: 'Salvar nota' }).click();
  await page.getByRole('switch', { name: /Escudo de foco absoluto/ }).click();

  await page.getByRole('button', { name: 'Finalizar com resumo' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar foco' })).toBeVisible();


  const state = await readAccount(page);
  expect(state.studySessions).toHaveLength(1);
  expect(state.studySessions[0].origin).toBe('declared');
  expect(state.activeSession).toBeNull();
  expect(state.progress).toHaveLength(0);
  expect(state.preferences.focusNotes).toBe('Revisar heurísticas de usabilidade');
  expect(state.preferences.focusShield).toBe(true);
});
