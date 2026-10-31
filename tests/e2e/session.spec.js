import { test, expect } from '@playwright/test';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

// Sessão declarada: relógio de continuidade iniciado pela pessoa. Não é
// observação, não conclui aula e não gera XP.

test('sessão declarada persiste ao recarregar, pausa, retoma e encerra sem XP', async ({ page }) => {
  const seeded = createInitialState();
  seeded.onboarded = true;
  seeded.courses = [{ id: 'design', title: 'Design de interfaces', category: 'Design', art: 'design', url: '', example: false, paused: false, steps: [{ id: 'design-1', title: 'Abrir o material e conhecer o curso' }] }];
  seeded.selectedCourseId = 'design';
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, state: seeded });
  await page.goto('/#hoje');
  await expect(page.getByRole('heading', { name: /Que bom ter você aqui/ })).toBeVisible();

  await expect(page.getByText('Não é observação de atividade e não gera XP.')).toBeVisible();
  await page.getByRole('button', { name: 'Começar sessão' }).click();
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

  await page.getByRole('link', { name: 'Meu Caminho' }).click();
  await expect(page.getByRole('heading', { name: 'Sessões declaradas' })).toBeVisible();
  await expect(page.getByText(/tempo declarado/).first()).toBeVisible();

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.studySessions).toHaveLength(1);
  expect(state.studySessions[0].origin).toBe('declared');
  expect(state.activeSession).toBeNull();
  expect(state.history).toHaveLength(0);
});
