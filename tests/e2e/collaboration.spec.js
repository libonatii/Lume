import { test, expect } from '@playwright/test';
import { addMaterial, createInitialState } from '../../public/domain.js';
import { seedAccount, readAccount } from './library-helpers.js';

test('colaboração envia, aceita e cancela convites sem copiar projeto nem conceder XP', async ({ page, browser }, testInfo) => {
  const origin = testInfo.project.use.baseURL;
  const state = addMaterial({ ...createInitialState(), onboarded: true }, {
    title: 'Projeto colaborativo', type: 'project', steps: ['Revisar API', 'Revisar interface'],
  }, 'manual');
  await seedAccount(page, state);
  const guestContext = await browser.newContext({ baseURL: origin, viewport: testInfo.project.use.viewport });
  try {
    const guest = await guestContext.newPage();
    await seedAccount(guest);
    const invitation = await page.request.post('/api/friends/invite', { headers: { origin } });
    expect(invitation.status()).toBe(201);
    const accepted = await guest.request.post('/api/friends/accept', { headers: { origin }, data: { code: (await invitation.json()).code } });
    expect(accepted.ok()).toBe(true);

    await page.goto('/#biblioteca');
    await page.getByRole('button', { name: /^Projeto colaborativo,/ }).click();
    const panel = page.locator('.collab-panel');
    await panel.getByRole('combobox', { name: 'Amizade', exact: true }).selectOption({ label: 'Pessoa de teste' });
    await panel.getByRole('combobox', { name: 'Entrega', exact: true }).selectOption({ label: 'Revisar API' });
    await panel.getByRole('button', { name: 'Convidar para colaborar' }).click();
    await expect(panel.locator('.collab-row')).toContainText('aguardando');

    await guest.goto('/#amigos');
    const inbox = guest.locator('section', { has: guest.getByRole('heading', { name: 'Convites de colaboração' }) });
    await inbox.getByRole('button', { name: 'Aceitar', exact: true }).click();
    await expect(inbox).toHaveCount(0);
    expect((await readAccount(guest)).courses).toHaveLength(0);

    // Reabrir revalida o cache que continha o convite ainda pendente.
    await page.getByRole('button', { name: 'Fechar janela' }).click();
    await page.getByRole('button', { name: /^Projeto colaborativo,/ }).click();
    await expect(panel.locator('.collab-row')).toContainText('aceito');
    await panel.getByRole('combobox', { name: 'Amizade', exact: true }).selectOption({ label: 'Pessoa de teste' });
    await panel.getByRole('combobox', { name: 'Entrega', exact: true }).selectOption({ label: 'Revisar interface' });
    await panel.getByRole('button', { name: 'Convidar para colaborar' }).click();
    const pending = panel.locator('.collab-row', { hasText: 'Revisar interface' });
    await pending.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(pending).toContainText('cancelado');
    for (const current of [page, guest]) {
      expect((await readAccount(current)).progress).toHaveLength(0);
      const xp = await current.request.get('/api/xp', { headers: { origin } });
      expect(xp.ok()).toBe(true);
      expect((await xp.json()).summary.totalXP).toBe(0);
    }
  } finally {
    await guestContext.close();
  }
});
