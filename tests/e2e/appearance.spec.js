import { test, expect } from '@playwright/test';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState } from '../../public/domain.js';

for (const theme of ['dark', 'light']) {
  test(`botões com cantos de 12px preservam foco, hover e estado desativado (${theme})`, async ({ page }, testInfo) => {
    const state = { ...createInitialState(), onboarded: true };
    state.preferences = { ...state.preferences, theme };
    await seedAccount(page, state);
    // Contexto novo do Playwright: sem assets antigos do service worker.
    await page.goto('/#biblioteca');
    const toolbar = page.locator('.library-root > .page-heading');
    const primary = toolbar.getByRole('button', { name: 'Adicionar curso', exact: true });
    const secondary = toolbar.getByRole('button', { name: 'Anexar PDF', exact: true });
    await expect(primary).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    for (const button of [primary, secondary]) {
      const initial = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        return { radius: parseFloat(style.borderTopLeftRadius), height: element.offsetHeight };
      });
      expect(initial.radius).toBe(12);
      if (testInfo.project.name === 'desktop') await button.hover();
      // Sem órbita nem outro efeito em movimento no contorno.
      expect(await button.evaluate((element) => getComputedStyle(element, '::before').content)).toBe('none');
      expect(await button.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSAnimation).length)).toBe(0);
      expect(await button.evaluate((element) => element.offsetHeight)).toBe(initial.height);
    }
    // Primário dourado sólido; secundário só com contorno.
    const colors = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const probe = document.createElement('span');
      probe.style.color = root.getPropertyValue('--action');
      document.body.append(probe);
      const action = getComputedStyle(probe).color;
      probe.remove();
      return { action };
    });
    await page.mouse.move(0, 0);
    await expect.poll(() => primary.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(colors.action);
    await expect.poll(() => secondary.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');

    await secondary.focus();
    await page.keyboard.press('Tab');
    await expect(primary).toBeFocused();
    expect(await primary.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
    expect(await primary.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
    expect(await primary.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);

    await secondary.click();
    const submit = page.getByRole('dialog').getByRole('button', { name: 'Anexar PDF', exact: true });
    await expect(submit).toBeDisabled();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('identidade única: paleta antiga salva não muda as cores e a escolha de paleta não é oferecida', async ({ page }) => {
  const state = { ...createInitialState(), onboarded: true };
  state.preferences = { ...state.preferences, palette: 'variante2' };
  await seedAccount(page, state);

  await page.goto('/#hoje');
  await expect(page.locator('html')).not.toHaveAttribute('data-palette', /.*/);
  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { action: root.getPropertyValue('--action').trim(), bg: root.getPropertyValue('--bg').trim(), trail: root.getPropertyValue('--trail').trim() };
  });
  expect(tokens).toEqual({ action: '#f6c165', bg: '#0c111b', trail: '#9ec5ff' });
  await expect(page.locator('.app-header .logo-mark path')).toHaveAttribute('d', /^M12 0 L14\.3 9\.7/);

  // O atalho "Conforto visual" saiu do cabeçalho: tema e texto ficam em Configurações.
  await expect(page.getByRole('button', { name: 'Conforto visual' })).toHaveCount(0);

  await page.goto('/#configuracoes');
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Paleta de cores' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Claro' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('radio', { name: 'Claro' })).toBeChecked();

  const saved = await readAccount(page);
  // O campo continua aceito nos dados só por compatibilidade.
  expect(saved.preferences.palette).toBe('variante2');
  expect(saved.preferences.theme).toBe('light');
});
