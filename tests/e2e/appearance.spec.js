import { test, expect } from '@playwright/test';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

test('Aparência troca a paleta, aplica no documento e preserva a escolha ao recarregar', async ({ page }) => {
  await seedAccount(page, { ...createInitialState(), onboarded: true });

  await page.goto('/#hoje');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'moderno');
  await page.getByRole('button', { name: 'Conforto visual' }).click();
  const group = page.locator('#comfort-popover').getByRole('radiogroup', { name: 'Paleta de cores' });
  await expect(group.getByRole('radio', { name: 'Azul' })).toBeChecked();

  await group.getByRole('radio', { name: 'Roxo' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'variante2');
  const action = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--action').trim());
  expect(action).toBe('#7c3aed');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'variante2');
  await page.getByRole('button', { name: 'Conforto visual' }).click();
  await expect(page.locator('#comfort-popover').getByRole('radiogroup', { name: 'Paleta de cores' }).getByRole('radio', { name: 'Roxo' })).toBeChecked();
  const saved = (await readAccount(page)).preferences.palette;
  expect(saved).toBe('variante2');

  await page.goto('/#configuracoes');
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Paleta de cores' }).getByRole('radio', { name: /^Roxo/ })).toBeChecked();
  await page.getByRole('group', { name: 'Paleta de cores' }).getByRole('radio', { name: /^Azul/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'moderno');
  const moderno = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--action').trim());
  expect(moderno).toBe('#4d8eff');
});
