import { test, expect } from '@playwright/test';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

function seeded() {
  const state = createInitialState();
  state.onboarded = true;
  state.courses = [{
    id: 'constitucional',
    title: 'Direito Constitucional',
    type: 'course',
    planning: false,
    category: 'Direito',
    art: 'nature',
    url: '',
    example: false,
    paused: false,
    resumeAt: '',
    slides: [],
    slideProgress: { seen: [], lastId: '', completedAt: null },
    steps: [
      { id: 'constitucional-0', title: 'Ler a introdução' },
      { id: 'constitucional-1', title: 'Resolver exercícios' },
    ],
  }];
  state.selectedCourseId = 'constitucional';
  return state;
}

async function openCourse(page) {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, state: seeded() });
  await page.goto('/#biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Direito Constitucional,/ }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Direito Constitucional' })).toBeVisible();
}

test('editar material muda título, tipo, retomada e etapas sem perder o curso', async ({ page }) => {
  await openCourse(page);
  await page.getByRole('button', { name: 'Editar material' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Constitucional — revisão');
  await page.getByLabel('Tipo de material').selectOption('book');
  await page.getByLabel('Página, seção ou capítulo').fill('capítulo 2');
  await page.getByRole('button', { name: 'Adicionar etapa' }).click();
  await page.getByRole('textbox', { name: 'Etapa 3' }).fill('Fazer um resumo do capítulo');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByRole('button', { name: /^Constitucional — revisão,/ })).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.courses[0].title).toBe('Constitucional — revisão');
  expect(saved.courses[0].type).toBe('book');
  expect(saved.courses[0].resumeAt).toBe('capítulo 2');
  expect(saved.courses[0].steps).toHaveLength(3);
});

test('criar slides, abrir no programa e concluir uma vez com cobertura do deck', async ({ page }) => {
  await openCourse(page);
  await page.getByText('Apresentação e slides', { exact: true }).click();
  await page.getByRole('button', { name: 'Criar o primeiro slide' }).click();
  await page.getByLabel('Título do slide').fill('Conceito');
  await page.getByLabel('Conteúdo').fill('A jurisdição é o poder de dizer o direito.');
  await page.getByRole('button', { name: 'Adicionar slide' }).last().click();
  await page.getByRole('button', { name: 'Adicionar slide' }).click();
  await page.getByLabel('Título do slide').fill('Resumo');
  await page.getByLabel('Conteúdo').fill('Recapitulando o conceito.');
  await page.getByRole('button', { name: 'Adicionar slide' }).last().click();

  await page.getByRole('button', { name: 'Abrir apresentação (2)' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Direito Constitucional' })).toBeVisible();
  await expect(page.getByText('1 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'Próximo', exact: true }).click();
  await expect(page.getByText('2 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir apresentação' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.courses[0].slides).toHaveLength(2);
  expect(saved.courses[0].slideProgress.seen).toHaveLength(2);
  expect(saved.courses[0].slideProgress.completedAt).toBeTruthy();
});

test('criar material manualmente com tipo e etapas próprias', async ({ page }) => {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, state: { ...createInitialState(), onboarded: true } });
  await page.goto('/#biblioteca');
  await page.getByRole('button', { name: 'Criar manualmente' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Processo Penal');
  await page.getByLabel('Tipo de material').selectOption('article');
  await page.getByLabel(/Etapas, uma por linha/).fill('Ler a introdução\nFazer um resumo');
  await page.getByRole('button', { name: 'Criar material' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Processo Penal' })).toBeVisible();
  await expect(page.getByText('0 de 2 etapas concluídas')).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.courses[0].type).toBe('article');
  expect(saved.courses[0].steps).toHaveLength(2);
});

test('excluir material pede confirmação e remove o progresso dependente', async ({ page }) => {
  await openCourse(page);
  await page.getByRole('button', { name: 'Editar material' }).click();
  await page.getByRole('button', { name: 'Excluir material' }).click();
  await expect(page.getByText(/Remove o material, as etapas e o progresso registrado nele/)).toBeVisible();
  await page.getByRole('button', { name: 'Sim, excluir' }).click();
  await expect(page.getByRole('heading', { name: 'Qual área você quer estudar?' })).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.courses).toHaveLength(0);
  expect(saved.progress.filter((event) => event.type === 'completion' && !event.revertedAt)).toHaveLength(0);
});
