import { test, expect } from '@playwright/test';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';
import { applyCourseImport, normalizePayload } from '../../public/import-domain.js';

function seeded() {
  const payload = normalizePayload({
    title: 'Direito Constitucional — OAB',
    provider: { id: 'grancursos' },
    sourceUrl: 'https://www.grancursosonline.com.br/curso/constitucional',
    disciplines: [{ title: 'Direito Constitucional', modules: [{ title: 'Direitos fundamentais', lessons: [
      { title: 'Aula 1 — Teoria geral', duration: '30:00' },
      { title: 'Aula 2 — Direitos individuais', duration: '30:00' },
      { title: 'Aula 3 — Remédios constitucionais', duration: '30:00' },
      { title: 'Aula 4 — Nacionalidade' },
    ] }] }],
  });
  const state = applyCourseImport({ ...createInitialState(), onboarded: true }, payload);
  state.onboarding = { ...state.onboarding, status: 'done', answers: { sessionMinutes: 30 } };
  return state;
}

test('cronograma distribui aulas, explica conflito, recalcula após conclusão e sobrevive ao recarregamento', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, value: seeded() });

  await page.goto('/#hoje');
  await page.getByRole('navigation', { name: 'Navegação' }).getByRole('link', { name: 'Plano', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plano', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Usar segunda a sexta, 30 min por dia' }).click();
  await expect(page.getByRole('heading', { name: 'Próximos dias' })).toBeVisible();
  const items = page.locator('.plan-item');
  await expect(items.first()).toContainText('Aula 1 — Teoria geral');
  await expect(items.first()).toContainText('(duração da fonte)');
  await expect(page.locator('.plan-item', { hasText: 'Aula 4' })).toContainText('(estimativa)');

  // Prazo para hoje não cabe: o conflito mostra números e opções, sem aplicar nada sozinho.
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  await page.getByLabel('Prazo', { exact: true }).fill(today);
  await expect(page.getByRole('heading', { name: /não cabe no plano atual/ })).toBeVisible();
  await expect(page.locator('.plan-conflict').getByText(/Faltam 2 h de estudo/)).toBeVisible();
  await page.getByRole('button', { name: /^Mudar o prazo para/ }).click();
  await expect(page.getByRole('heading', { name: /não cabe no plano atual/ })).toHaveCount(0);

  // Concluir a primeira aula recalcula o cronograma a partir de hoje.
  await page.getByRole('button', { name: 'Estudar' }).click();
  await page.getByRole('button', { name: 'Concluí esta aula' }).click();
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await expect(items.first()).toContainText('Aula 2 — Direitos individuais');
  await expect(page.locator('.plan-item', { hasText: 'Aula 1 — Teoria geral' })).toHaveCount(0);

  // Adiar move a aula e as seguintes do curso; nada é concluído.
  await page.getByRole('button', { name: 'Adiar Aula 2 — Direitos individuais' }).click();
  await expect(page.getByText(/As aulas seguintes de Direito Constitucional — OAB acompanham/)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Segunda')).toHaveValue('30');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const course = saved.courses[0];
  expect(saved.plan.availability).toEqual({ 1: 30, 2: 30, 3: 30, 4: 30, 5: 30 });
  expect(saved.plan.goals[course.id].deadline).not.toBe('');
  expect(Object.keys(saved.plan.postponed)).toEqual([course.steps[1].id]);
  expect(saved.completed).toEqual([course.steps[0].id]);
  expect(saved.history).toEqual([]);
});

test('subtarefas e vínculo com aula não alteram XP e sobrevivem ao recarregamento', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, value: seeded() });

  await page.goto('/#tarefas');
  await page.getByLabel('Tarefa', { exact: true }).fill('Revisar Aula 1 com questões');
  await page.getByLabel('Curso ou prova (opcional)').selectOption({ label: 'Direito Constitucional — OAB' });
  await page.getByLabel('Aula ou etapa (opcional)').selectOption({ label: 'Aula 1 — Teoria geral' });
  await page.getByRole('button', { name: 'Adicionar tarefa' }).click();
  await expect(page.locator('.todo-item').first()).toContainText('Aula 1 — Teoria geral');

  await page.getByText('Dividir em subtarefas').click();
  await page.getByLabel('Nova subtarefa de Revisar Aula 1 com questões').fill('Resolver 10 questões');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Resolver 10 questões' }).check();
  await expect(page.getByText('Subtarefas 1/1')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Subtarefas 1/1')).toBeVisible();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.tasks[0].lessonId).toBe(saved.courses[0].steps[0].id);
  expect(saved.tasks[0].subtasks).toEqual([expect.objectContaining({ title: 'Resolver 10 questões', done: true })]);
  expect(saved.tasks[0].done).toBe(false);
  expect(saved.history).toEqual([]);
  expect(saved.completed).toEqual([]);
});
