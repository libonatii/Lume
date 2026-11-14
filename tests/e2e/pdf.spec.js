import { test, expect } from '@playwright/test';
import { createInitialState } from '../../public/domain.js';
import { addSubject } from '../../public/subject-domain.js';
import { penalPdf } from '../fixtures/sample-pdf.js';
import { seedAccount, readAccount } from './library-helpers.js';

function seeded() {
  return addSubject({ ...createInitialState(), onboarded: true }, { title: 'Processo Penal', keywords: ['inquerito', 'prisao preventiva'] }, 'penal');
}

test('anexar PDF, vincular à disciplina, ler no leitor e retomar na página depois de recarregar', async ({ page }) => {
  await seedAccount(page, seeded());
  await page.goto('/#biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Anexar PDF', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'apostila-penal.pdf', mimeType: 'application/pdf', buffer: penalPdf() });
  await expect(dialog.getByText(/6 páginas · .* · sumário com 2 itens/)).toBeVisible();
  await expect(dialog.getByLabel('Título')).toHaveValue('Apostila de Processo Penal');
  // Sugestão determinística: o texto do PDF cita as palavras-chave da disciplina.
  await expect(dialog.getByLabel('Disciplina')).toHaveValue('penal');
  await dialog.getByRole('button', { name: 'Anexar PDF' }).click();

  await expect(dialog.getByRole('heading', { name: 'Apostila de Processo Penal' })).toBeVisible();
  await expect(dialog.getByLabel('Página atual')).toHaveValue('1');
  await expect(dialog.locator('.pdf-page canvas')).toBeVisible();
  await dialog.getByRole('button', { name: 'Sumário', exact: true }).click();
  const outline = dialog.getByRole('navigation', { name: 'Sumário do PDF' });
  await expect(outline.getByRole('button', { name: /Capitulo 1 - Inquerito/ })).toBeVisible();
  await expect(outline.getByRole('button', { name: /Capitulo 2 - Prisao preventiva/ })).toBeVisible();
  const panel = dialog.getByRole('complementary', { name: 'Painel do documento' });
  await panel.getByRole('tab', { name: 'Detalhes' }).click();
  const section = panel.locator('dt', { hasText: 'Seção' }).locator('xpath=following-sibling::dd');
  await expect(section).toHaveText('Capitulo 1 - Inquerito');
  for (let index = 0; index < 3; index += 1) await dialog.getByRole('button', { name: 'Próxima página' }).click();
  await expect(dialog.getByLabel('Página atual')).toHaveValue('4');
  await expect(section).toHaveText('Capitulo 2 - Prisao preventiva');
  await expect(panel.locator('.pdf-subject-field select')).toHaveValue('penal');

  await expect.poll(async () => (await readAccount(page)).courses[0]?.reading?.page, { timeout: 15000 }).toBe(4);
  const saved = await readAccount(page);
  expect(saved.courses[0]).toMatchObject({ type: 'pdf', subjectId: 'penal', resumeAt: 'p. 4 de 6 · Capitulo 2 - Prisao preventiva' });

  await page.goto('/#hoje');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Continuar Apostila de Processo Penal na página 4' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar na p. 4' }).click();
  await expect(page.getByRole('dialog').getByLabel('Página atual')).toHaveValue('4');
  await page.getByRole('dialog').getByRole('button', { name: 'Voltar para a biblioteca' }).click();

  await page.goto('/#disciplinas');
  const card = page.locator('.subject-card').filter({ hasText: 'Processo Penal' });
  await expect(card.getByText(/1 material · 0 concluídos · até p\. 4 de 6/)).toBeVisible();
  await expect(card.getByRole('button', { name: /Continuar: Apostila de Processo Penal · p\. 4/ })).toBeVisible();
});

test('concluir o PDF registra a leitura uma vez e excluir libera o arquivo', async ({ page }) => {
  await seedAccount(page, seeded());
  await page.goto('/#biblioteca');
  await page.getByRole('button', { name: 'Anexar PDF', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'apostila-penal.pdf', mimeType: 'application/pdf', buffer: penalPdf() });
  await expect(dialog.getByText(/6 páginas/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Anexar PDF' }).click();
  await dialog.getByRole('button', { name: 'Concluir leitura' }).click();
  await expect(dialog.getByText('Concluída', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').getByText(/Leitura concluída: Apostila de Processo Penal/)).toBeVisible();

  await expect.poll(async () => {
    const response = await page.request.get('/api/xp', { headers: { origin: 'http://127.0.0.1:4187' } });
    return (await response.json()).summary.totalXP;
  }, { timeout: 15000 }).toBe(100);

  const before = await (await page.request.get('/api/library/files', { headers: { origin: 'http://127.0.0.1:4187' } })).json();
  expect(before.files).toBe(1);
  await dialog.getByRole('complementary', { name: 'Painel do documento' }).getByRole('tab', { name: 'Detalhes' }).click();
  await dialog.getByRole('button', { name: 'Excluir PDF' }).click();
  await dialog.getByRole('button', { name: 'Sim, excluir PDF' }).click();
  await expect.poll(async () => (await readAccount(page)).courses.length, { timeout: 15000 }).toBe(0);
  const after = await (await page.request.get('/api/library/files', { headers: { origin: 'http://127.0.0.1:4187' } })).json();
  expect(after).toMatchObject({ files: 0, used: 0 });
});

test('PDF recém-anexado fica não iniciado e o marca-texto marca, troca a cor e apaga', async ({ page }) => {
  await seedAccount(page, seeded());
  await page.goto('/#biblioteca');
  await page.getByRole('button', { name: 'Anexar PDF', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles({ name: 'apostila-penal.pdf', mimeType: 'application/pdf', buffer: penalPdf() });
  await expect(dialog.getByText(/6 páginas/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Anexar PDF' }).click();
  await expect(dialog.locator('.pdf-page canvas')).toBeVisible();
  await expect(dialog.locator('.textLayer span').first()).toBeVisible();

  await dialog.getByRole('button', { name: 'Marca-texto' }).click();
  await dialog.getByRole('radio', { name: 'Verde' }).click();
  await dialog.locator('.textLayer span').first().selectText();
  await dialog.locator('.textLayer span').first().dispatchEvent('pointerup');
  await expect(dialog.locator('.pdf-highlight.marker-verde').first()).toBeVisible();
  const marks = dialog.getByRole('tabpanel', { name: 'Marcações' });
  await marks.getByRole('button', { name: 'Cor Rosa' }).click();
  await expect(dialog.locator('.pdf-highlight.marker-rosa').first()).toBeVisible();
  await expect.poll(async () => (await readAccount(page)).courses[0]?.highlights?.map((item) => item.color), { timeout: 15000 }).toEqual(['rosa']);

  await dialog.getByRole('button', { name: /Borracha/ }).click();
  const box = await dialog.locator('.pdf-highlight').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(dialog.locator('.pdf-highlight')).toHaveCount(0);
  await expect.poll(async () => (await readAccount(page)).courses[0]?.highlights?.length, { timeout: 15000 }).toBe(0);

  await page.getByRole('dialog').getByRole('button', { name: 'Voltar para a biblioteca' }).click();
  const saved = await readAccount(page);
  expect(saved.courses[0].reading).toBeNull();
  const row = page.locator('.reading-row').filter({ hasText: 'Apostila de Processo Penal' });
  await expect(row.getByText(/6 páginas · não iniciado/)).toBeVisible();
  await expect(row.getByText('0%')).toBeVisible();
});
