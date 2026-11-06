import { test, expect } from '@playwright/test';
import { seedAccount, readAccount } from './library-helpers.js';

test('perfil processa foto, salva apresentação e remove a imagem na conta', async ({ page }) => {
  await seedAccount(page);
  await page.goto('/#perfil');
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Selecionar foto de perfil do computador', { exact: true }).setInputFiles({
    name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Remover foto', exact: true })).toBeVisible();
  const uploaded = await readAccount(page);
  expect(uploaded.profile.avatar).toMatch(/^\/api\/media\/profiles\//);
  expect((await page.request.get(uploaded.profile.avatar)).ok()).toBe(true);
  await page.getByLabel('Apresentação e metas').fill('Estudando arquitetura');
  await page.getByRole('button', { name: 'Salvar apresentação', exact: true }).click();
  expect((await readAccount(page)).profile.bio).toBe('Estudando arquitetura');
  await page.reload();
  await expect(page.getByText('Estudando arquitetura', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  const deletion = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().endsWith('/api/profile/media/avatar'));
  await page.getByRole('button', { name: 'Remover foto', exact: true }).click();
  expect((await deletion).ok()).toBe(true);
  expect((await readAccount(page)).profile.avatar).toBe('');
  await page.reload();
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remover foto', exact: true })).toHaveCount(0);
});
