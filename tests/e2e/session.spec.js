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
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();

  await expect(page.getByText(/servidor confirma blocos de 30 minutos/i)).toBeVisible();
  await page.getByRole('button', { name: 'Começar sessão' }).click();
  await expect(page.getByRole('heading', { name: 'Sessão em andamento' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Abrir o material e conhecer o curso' })).toBeVisible();
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

  await page.getByRole('button', { name: 'Encerrar sessão' }).click();
  await expect(page.getByRole('button', { name: 'Começar sessão' })).toBeVisible();

  await page.getByRole('link', { name: 'Perfil', exact: true }).click();
  await page.getByRole('link', { name: 'Meu caminho' }).click();
  await expect(page.getByRole('heading', { name: 'Sessões declaradas' })).toBeVisible();
  await expect(page.getByText(/tempo declarado/).first()).toBeVisible();

  const state = await readAccount(page);
  expect(state.studySessions).toHaveLength(1);
  expect(state.studySessions[0].origin).toBe('declared');
  expect(state.activeSession).toBeNull();
  expect(state.progress).toHaveLength(0);
});
