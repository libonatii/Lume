import { test, expect } from '@playwright/test';
import { materialSteps } from '../../public/material-model.js';
import { seedAccount, readAccount, E2E_ORIGIN } from './library-helpers.js';
import { createInitialState } from '../../public/domain.js';
import { applyCourseImport, normalizePayload } from '../../public/import-domain.js';
import { createAppointment, shiftDate } from '../../public/agenda-domain.js';
import { localDate } from '../../public/tasks-domain.js';

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

test('cronograma distribui aulas, recalcula após conclusão e sobrevive ao recarregamento', async ({ page }) => {
  await seedAccount(page, seeded());

  await page.goto('/#hoje');
  await page.getByRole('navigation', { name: 'Navegação' }).getByRole('link', { name: 'Plano de Estudos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plano de Estudos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Usar segunda a sexta, 30 min por dia' }).click();
  await expect(page.getByRole('heading', { name: 'Distribuição dos blocos' })).toBeVisible();
  const items = page.locator('.plan-item');
  await expect(items.first()).toContainText('Aula 1 — Teoria geral');
  await expect(items.first()).toContainText('(duração da fonte)');
  // O dia em detalhe mostra os blocos daquele dia; a Aula 4 cai num dia seguinte da faixa.
  const aula4 = page.locator('.plan-item', { hasText: 'Aula 4' });
  for (let week = 0; week < 3 && !(await aula4.count()); week += 1) {
    for (const day of await page.locator('.plan-week-day').all()) {
      if (await aula4.count()) break;
      await day.click();
    }
    if (!(await aula4.count())) await page.getByRole('button', { name: 'Próxima semana' }).click();
  }
  await expect(aula4).toContainText('(estimativa)');
  await page.locator('.plan-controls').getByRole('button', { name: 'Hoje', exact: true }).click();

  // Concluir a primeira aula recalcula o cronograma a partir de hoje.
  await page.getByRole('button', { name: 'Estudar' }).click();
  await page.getByRole('button', { name: 'Concluí esta aula' }).click();
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await expect(items.first()).toContainText('Aula 2 — Direitos individuais');
  await expect(page.locator('.plan-item', { hasText: 'Aula 1 — Teoria geral' })).toHaveCount(0);

  // Adiar move a aula e as seguintes do curso; nada é concluído.
  await page.getByRole('button', { name: 'Adiar Aula 2 — Direitos individuais' }).click();
  await expect(page.getByText(/As aulas seguintes de Direito Constitucional — OAB acompanham/)).toBeVisible();
  const beforeReload = await readAccount(page);
  expect(Object.keys(beforeReload.plan.postponed)).toEqual([materialSteps(beforeReload.courses[0])[1].id]);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Disponibilidade e prazos' })).toHaveCount(0);
  const saved = await readAccount(page);
  const course = saved.courses[0];
  expect(saved.plan.availability).toEqual({ 1: 30, 2: 30, 3: 30, 4: 30, 5: 30 });
  expect(Object.keys(saved.plan.postponed)).toEqual([materialSteps(course)[1].id]);
  expect(saved.progress.filter((event) => event.type === 'completion' && !event.revertedAt).map((event) => event.unitId)).toEqual([materialSteps(course)[0].id]);
  expect(saved.progress.some((event) => event.legacyXp)).toBe(false);
});

test('tarefa vinculada conclui a aula uma vez; subtarefa vale 10 XP uma vez e reabertura não repete', async ({ page }) => {
  await seedAccount(page, seeded());

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
  const beforeReload = await readAccount(page);
  expect(beforeReload.tasks[0].subtasks[0].done).toBe(true);

  await page.reload();
  await expect(page.getByText('Subtarefas 1/1')).toBeVisible();
  const saved = await readAccount(page);
  expect(saved.tasks[0].lessonId).toBe(materialSteps(saved.courses[0])[0].id);
  expect(saved.tasks[0].subtasks).toEqual([expect.objectContaining({ title: 'Resolver 10 questões', done: true })]);
  expect(saved.tasks[0].done).toBe(false);
  expect(saved.progress).toEqual([]);
  await page.getByRole('checkbox', { name: 'Concluir tarefa Revisar Aula 1 com questões' }).click();
  await expect(page.getByRole('checkbox', { name: 'Reabrir tarefa Revisar Aula 1 com questões' })).toBeChecked();
  const completed = await readAccount(page);
  expect(completed.progress.filter((event) => !event.revertedAt)).toHaveLength(1);
  const xp = async () => (await (await page.request.get('/api/xp', { headers: { origin: E2E_ORIGIN } })).json()).summary.totalXP;
  expect(await xp()).toBe(110);
  await page.getByRole('checkbox', { name: 'Reabrir tarefa Revisar Aula 1 com questões' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir tarefa Revisar Aula 1 com questões' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Concluir tarefa Revisar Aula 1 com questões' }).click();
  await expect(page.getByRole('checkbox', { name: 'Reabrir tarefa Revisar Aula 1 com questões' })).toBeChecked();
  await readAccount(page);
  expect(await xp()).toBe(110);
  await page.goto('/#perfil');
  await expect(page.getByRole('region', { name: 'Cargos de estudo' })).toContainText('Iniciante');
});

test('próximos marcos mostram compromissos da Agenda de qualquer tipo', async ({ page }) => {
  const date = shiftDate(localDate(), 3);
  const base = { date, endDate: date, start: '', end: '', timeZone: 'America/Sao_Paulo', taskIds: [] };
  let state = createAppointment({ ...createInitialState(), onboarded: true }, { ...base, title: 'Simulado de Falência', category: 'study' });
  state = createAppointment(state, { ...base, title: 'Consulta médica', category: 'personal' });
  await seedAccount(page, state);
  await page.goto('/#plano');
  const milestones = page.getByRole('region', { name: 'Próximos Marcos' });
  await expect(milestones).toContainText('Simulado de Falência');
  await expect(milestones).toContainText('Consulta médica');
  await expect(milestones).toContainText('faltam 3 dias');
});
