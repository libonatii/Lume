import { test, expect } from '@playwright/test';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState } from '../../public/domain.js';
import { addTask } from '../../public/tasks-domain.js';

// Etapa 2 (registrar a aula e seguir em um passo; conclusão em lote) e
// etapa 3 (esqueleto enquanto a biblioteca da conta carrega).

async function importCourse(page) {
  await seedAccount(page, { ...createInitialState(), onboarded: true });
  await page.goto('/#biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await page.getByRole('tab', { name: 'Colar a grade' }).click();
  await page.getByLabel('Nome do curso (opcional)').fill('Curso em sequência');
  await page.getByLabel('Grade do curso', { exact: true }).fill([
    'Disciplina: Fundamentos',
    'Módulo: Começo',
    'Aula 1 — Apresentação',
    'Aula 2 — Conceitos',
    'Aula 3 — Exemplos',
    'Aula 4 — Exercícios',
    'Aula 5 — Revisão',
  ].join('\n'));
  await page.getByRole('button', { name: 'Organizar grade' }).click();
  await page.getByRole('button', { name: /Adicionar 5 aulas à biblioteca/ }).click();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();
  await page.getByRole('button', { name: /^Curso em sequência,/ }).click();
}

const completedTitles = (state) => state.progress
  .filter((event) => event.type === 'completion' && !event.revertedAt)
  .map((event) => event.title);

test('concluir e abrir a próxima registra a aula e já mostra a seguinte', async ({ page }) => {
  await importCourse(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Aula 1 — Apresentação' })).toBeVisible();
  await expect(dialog.getByText('Próxima: Aula 2 — Conceitos')).toBeVisible();
  await dialog.getByRole('button', { name: 'Concluir e abrir a próxima' }).click();

  await expect(dialog.getByRole('heading', { name: 'Aula 2 — Conceitos' })).toBeVisible();
  await expect(page.getByText(/Você concluiu Aula 1 — Apresentação\. Agora é Aula 2 — Conceitos/)).toBeVisible();
  expect(completedTitles(await readAccount(page))).toEqual(['Aula 1 — Apresentação']);

  // Registrar só esta aula continua disponível e volta para o curso.
  await dialog.getByRole('button', { name: 'Concluí esta aula' }).click();
  await expect(dialog.getByText('2 de 5 aulas selecionadas')).toBeVisible();
});

test('conclusão em lote registra as aulas em aberto até a escolhida, cada uma como registro próprio', async ({ page }) => {
  await importCourse(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Já assisti várias aulas em sequência').click();
  await dialog.getByLabel('Até a aula').selectOption({ label: '4. Aula 4 — Exercícios' });
  await dialog.getByRole('button', { name: 'Registrar 4 aulas' }).click();

  await expect(page.getByText(/4 aulas registradas por você, em sequência/)).toBeVisible();
  await expect(dialog.getByText('4 de 5 aulas selecionadas')).toBeVisible();
  const state = await readAccount(page);
  expect(completedTitles(state)).toEqual(['Aula 1 — Apresentação', 'Aula 2 — Conceitos', 'Aula 3 — Exemplos', 'Aula 4 — Exercícios']);
  expect(state.progress.every((event) => event.origin === 'manual')).toBe(true);

  // Com uma só aula em aberto, o lote não aparece.
  await expect(dialog.getByText('Já assisti várias aulas em sequência')).toHaveCount(0);
});

test('ao recarregar a biblioteca, a tela mostra a forma do conteúdo, não um estado vazio', async ({ page }) => {
  await seedAccount(page, addTask({ ...createInitialState(), onboarded: true }, { title: 'Revisar resumo' }, '2026-11-10T10:00:00Z'));
  await page.goto('/#hoje');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();

  // Uma gravação recusada pede recarga; a recarga fica presa até liberarmos.
  await page.route('**/api/library/actions', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'A biblioteca mudou.', code: 'revision_conflict' }) }), { times: 1 });
  await page.getByRole('checkbox', { name: 'Concluir tarefa Revisar resumo' }).click();
  const retry = page.getByRole('button', { name: 'Recarregar ou tentar novamente' });
  await expect(retry).toBeVisible();

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/library', async (route) => {
    if (route.request().method() === 'GET') await gate;
    await route.continue();
  });
  await retry.click();
  await expect(page.getByText('Carregando Hoje…')).toBeAttached();
  // A tela continua montada (para não perder rascunhos), mas oculta até a biblioteca chegar.
  await expect(page.getByText('Nenhum material em andamento.')).toBeHidden();
  release();
  await expect(page.getByText('Carregando Hoje…')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByText('Revisar resumo')).toBeVisible();
});

test('focar uma tarefa a coloca no cartão principal da Hoje, sobrevive ao recarregar e não a conclui', async ({ page }) => {
  await seedAccount(page, addTask({ ...createInitialState(), onboarded: true }, { title: 'A2 – Falência', dueDate: '2026-11-26', priority: 1 }, '2026-11-10T10:00:00Z'));
  await page.goto('/#hoje');
  await page.getByRole('button', { name: 'Focar em A2 – Falência na Hoje' }).click();

  const card = page.locator('section.next-action');
  await expect(card.getByText('Foco agora · escolhido por você')).toBeVisible();
  await expect(card.getByRole('heading', { name: 'A2 – Falência' })).toBeVisible();
  await expect(card.getByText('Sem curso vinculado.', { exact: false })).toBeVisible();
  let saved = await readAccount(page);
  expect(saved.focusTaskId).toBe(saved.tasks[0].id);
  expect(saved.tasks[0].done).toBe(false);

  await page.reload();
  await expect(page.locator('section.next-action').getByRole('heading', { name: 'A2 – Falência' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tirar A2 – Falência do foco' })).toHaveAttribute('aria-pressed', 'true');

  // A sessão de estudo leva o nome do foco.
  await page.getByRole('button', { name: 'Começar sessão' }).click();
  await expect(page.locator('.session-bar').getByText('A2 – Falência')).toBeVisible();
  await page.getByRole('button', { name: 'Encerrar sessão' }).click();

  await page.locator('section.next-action').getByRole('button', { name: 'Concluir tarefa' }).click();
  await expect(page.getByText('Tarefa concluída: A2 – Falência.')).toBeVisible();
  await expect(page.locator('section.next-action').getByText('Foco agora · escolhido por você')).toHaveCount(0);
  saved = await readAccount(page);
  expect(saved.focusTaskId).toBe(null);
  expect(saved.tasks[0].done).toBe(true);
});
