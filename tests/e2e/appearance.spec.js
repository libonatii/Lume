import { test, expect } from '@playwright/test';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

test('Aparência troca a paleta, aplica no documento e preserva a escolha ao recarregar', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, value: { ...createInitialState(), onboarded: true } });

  await page.goto('/#hoje');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'moderno');
  await page.getByRole('link', { name: 'Aparência' }).click();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  const group = page.getByRole('group', { name: 'Paleta de cores' });
  await expect(group.getByRole('radio', { name: /^Azul/ })).toBeChecked();

  await group.getByRole('radio', { name: /^Roxo/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'variante2');
  const action = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--action').trim());
  expect(action).toBe('#7c3aed');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'variante2');
  await expect(page.getByRole('group', { name: 'Paleta de cores' }).getByRole('radio', { name: /^Roxo/ })).toBeChecked();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).preferences.palette, STORAGE_KEY);
  expect(saved).toBe('variante2');

  await page.getByRole('group', { name: 'Paleta de cores' }).getByRole('radio', { name: /^Azul/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'moderno');
  const moderno = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--action').trim());
  expect(moderno).toBe('#2563eb');
});
