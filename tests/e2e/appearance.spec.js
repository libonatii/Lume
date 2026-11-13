import { test, expect } from '@playwright/test';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

for (const palette of ['moderno', 'variante2']) {
  for (const theme of ['dark', 'light']) {
    test(`botões em cápsula preservam foco, hover e estado desativado (${palette}, ${theme})`, async ({ page }, testInfo) => {
      const state = { ...createInitialState(), onboarded: true };
      state.preferences = { ...state.preferences, palette, theme };
      await seedAccount(page, state);
      // Contexto novo do Playwright: sem assets antigos do service worker.
      await page.goto('/#biblioteca');
      const toolbar = page.locator('.library-root > .page-heading');
      const primary = toolbar.getByRole('button', { name: 'Adicionar curso', exact: true });
      const secondary = toolbar.getByRole('button', { name: 'Anexar PDF', exact: true });
      await expect(primary).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      for (const button of [primary, secondary]) {
        const initial = await button.evaluate((element) => {
          const style = getComputedStyle(element);
          return { radius: parseFloat(style.borderTopLeftRadius), height: element.offsetHeight };
        });
        expect(initial.radius).toBeGreaterThanOrEqual(initial.height / 2);
        if (testInfo.project.name === 'desktop') {
          await button.hover();
          await expect.poll(() => button.evaluate((element) => getComputedStyle(element, '::before').opacity)).toBe('1');
          const start = await button.evaluate((element) => getComputedStyle(element, '::before').backgroundImage);
          // Verifica movimento real do destaque, não só a presença de uma classe.
          await expect.poll(() => button.evaluate((element) => getComputedStyle(element, '::before').backgroundImage)).not.toBe(start);
          expect(await button.evaluate((element) => element.offsetHeight)).toBe(initial.height);
          await page.mouse.move(0, 0);
          await expect.poll(() => button.evaluate((element) => getComputedStyle(element, '::before').opacity)).toBe('0');
          expect(await button.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
        } else {
          // Um toque não deve deixar uma animação de hover rodando no celular.
          await button.hover();
          expect(await button.evaluate((element) => getComputedStyle(element, '::before').animationName)).toBe('none');
        }
      }

      await page.mouse.move(0, 0);
      await secondary.focus();
      await page.keyboard.press('Tab');
      await expect(primary).toBeFocused();
      expect(await primary.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await primary.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
      expect(await primary.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);

      // O novo contorno não bloqueia o clique nem a abertura do diálogo.
      await secondary.click();
      const submit = page.getByRole('dialog').getByRole('button', { name: 'Anexar PDF', exact: true });
      await expect(submit).toBeDisabled();
      await submit.hover();
      expect(await submit.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}

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
