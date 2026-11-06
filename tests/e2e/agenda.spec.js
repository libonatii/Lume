import { test, expect } from '@playwright/test';
import { createInitialState, addCourse } from '../../public/domain.js';
import { createAppointment } from '../../public/agenda-domain.js';
import { addTask } from '../../public/tasks-domain.js';
import { seedAccount, readAccount } from './library-helpers.js';

const initial = () => ({ ...createInitialState(), onboarded: true });
const headers = { origin: 'http://127.0.0.1:4187' };
async function saveForm(page) {
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByRole('region', { name: /^(Novo|Editar) compromisso$/ })).toHaveCount(0);
  return readAccount(page);
}

test('atividade com checklist, sobreposição, três visões e reagendamento persistente', async ({ page }, testInfo) => {
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await page.getByLabel('Título do compromisso').fill('Revisão constitucional');
  await page.getByLabel('Início (opcional)').fill('19:00');
  await page.getByLabel('Fim (opcional)').fill('20:00');
  await page.getByLabel('Novas tarefas (uma por linha)').fill('Ler anotações\nResolver questões');
  const saved = await saveForm(page);
  expect(saved.agenda).toHaveLength(1);
  expect(saved.tasks).toHaveLength(2);
  const day = saved.agenda[0].date;
  await page.getByRole('checkbox', { name: 'Concluir tarefa Ler anotações' }).check();
  await expect(page.getByRole('article', { name: 'Revisão constitucional' })).toContainText('Parcial');
  await readAccount(page);

  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await page.getByLabel('Título do compromisso').fill('Consulta');
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('personal');
  await page.getByLabel('Início (opcional)').fill('19:30');
  await page.getByLabel('Fim (opcional)').fill('20:30');
  await saveForm(page);
  await expect(page.getByRole('article', { name: 'Consulta', exact: true })).toContainText('Sobreposição');
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await expect(page.getByLabel('Calendário: semana')).toContainText('Revisão constitucional');
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  await expect(page.getByLabel('Calendário: mês')).toContainText('Consulta');
  await page.screenshot({ path: testInfo.outputPath('agenda-month.png'), fullPage: true });
  await page.getByRole('button', { name: 'Dia', exact: true }).click();

  const card = page.getByRole('article', { name: 'Consulta', exact: true });
  await card.getByText('Ações do compromisso', { exact: true }).click();
  await card.getByRole('button', { name: 'Editar / reagendar' }).click();
  await page.getByLabel('Início (opcional)').fill('21:00');
  await page.getByLabel('Fim (opcional)').fill('22:00');
  await saveForm(page);
  await expect(card).not.toContainText('Sobreposição');
  await page.reload();
  await expect(page.getByRole('article', { name: 'Consulta', exact: true })).toContainText('21:00');
  const after = await readAccount(page);
  expect(after.agenda[0].date).toBe(day);
  expect(after.tasks[0].done).toBe(true);
  // Calendário pode rolar internamente; a página não deve estourar a tela no celular.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('agenda-day.png'), fullPage: true });
});

test('tarefas antigas são agendadas sem cópia e Plano mantém apenas Cronograma e Roteiro', async ({ page, isMobile }) => {
  const state = addTask(initial(), { title: 'Tarefa preservada', dueDate: '2030-12-01', priority: 1 });
  await seedAccount(page, state);
  await page.goto('/#tarefas');
  await page.getByRole('button', { name: 'Agendar tarefa Tarefa preservada' }).click();
  await expect(page.getByLabel('Título do compromisso')).toHaveValue('Tarefa preservada');
  await saveForm(page);
  const saved = await readAccount(page);
  expect(saved.tasks).toHaveLength(1);
  expect(saved.tasks[0].id).toBe(state.tasks[0].id);
  expect(saved.tasks[0].dueDate).toBe('2030-12-01');
  await page.goto('/#plano');
  await expect(page.getByRole('link', { name: 'Cronograma', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roteiro', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tarefas', exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Navegação', exact: true }).getByRole('link', { name: 'Agenda', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Tarefas', exact: true })).toBeVisible();
  if (isMobile) {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(await page.locator('.nav-short').evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});

test('recorrência recebe checklist novo e edição futura preserva a ocorrência concluída', async ({ page }) => {
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await page.getByLabel('Título do compromisso').fill('Revisão diária');
  await page.getByLabel('Novas tarefas (uma por linha)').fill('Revisar notas');
  await page.getByRole('combobox', { name: 'Repetição', exact: true }).selectOption('daily');
  await page.getByLabel('Ocorrências').fill('3');
  const saved = await saveForm(page);
  expect(saved.agenda).toHaveLength(3);
  expect(saved.tasks).toHaveLength(3);
  await page.getByRole('checkbox', { name: 'Concluir tarefa Revisar notas' }).check();
  const card = page.getByRole('article', { name: 'Revisão diária' });
  await card.getByText('Ações do compromisso', { exact: true }).click();
  await card.getByRole('button', { name: 'Encerrar atividade' }).click();
  await readAccount(page);
  await page.getByRole('button', { name: 'Próximo período' }).click();
  await expect(page.getByRole('checkbox', { name: 'Concluir tarefa Revisar notas' })).not.toBeChecked();
  // Editar a série a partir da ocorrência encerrada não encerra as futuras.
  await page.getByRole('button', { name: 'Período anterior' }).click();
  await card.getByText('Ações do compromisso', { exact: true }).click();
  await card.getByRole('button', { name: 'Editar / reagendar' }).click();
  await page.getByLabel('Título do compromisso').fill('Revisão ajustada');
  await page.getByLabel('Aplicar alteração').selectOption('future');
  await saveForm(page);
  const after = await readAccount(page);
  expect(after.agenda.map((item) => item.title)).toEqual(['Revisão diária', 'Revisão ajustada', 'Revisão ajustada']);
  expect(after.tasks.map((item) => item.done)).toEqual([true, false, false]);
  expect(after.agenda.map((item) => item.done)).toEqual([true, false, false]);
});

test('sugestão só vira compromisso ao salvar; formulário sobrevive à falha de gravação', async ({ page }) => {
  const state = addCourse(initial(), { title: 'Curso', steps: ['Aula sugerida'] }, 'c');
  state.plan.availability = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 };
  await seedAccount(page, state);
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Revisar sugestão' }).click();
  expect((await readAccount(page)).agenda).toEqual([]);
  await page.getByLabel('Início (opcional)').fill('10:00');
  await page.getByLabel('Fim (opcional)').fill('10:30');
  await page.route('**/api/library/actions', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Indisponível' }) }));
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByLabel('Título do compromisso')).toHaveValue('Aula sugerida');
  await expect(page.getByText('Resolva a gravação pendente antes de sair.')).toBeVisible();
  await page.unroute('**/api/library/actions');
  await page.getByRole('button', { name: 'Recarregar ou tentar novamente' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/library', { headers })).json()).state.agenda.length).toBe(1);
  const saved = (await (await page.request.get('/api/library', { headers })).json()).state;
  expect(saved.tasks[0].lessonId).toBe('c-0');
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByLabel('Título do compromisso')).toHaveCount(0);
  expect((await readAccount(page)).agenda).toHaveLength(1);
});

test('lembrete real da API aparece internamente, chama notificação e não repete ao navegar', async ({ page }) => {
  // O canal do sistema é substituído aqui; a reivindicação no servidor é real.
  await page.addInitScript(() => {
    window.sentNotifications = [];
    class FakeNotification {
      static permission = 'granted';
      static requestPermission() { return Promise.resolve('granted'); }
      constructor(title, options) { window.sentNotifications.push({ title, options }); }
      close() {}
    }
    window.Notification = FakeNotification;
  });
  const now = new Date(), end = new Date(now.getTime() + 3600000);
  const state = createAppointment(initial(), { title: 'Lembrete de consulta', category: 'personal', date: now.toISOString().slice(0, 10), start: now.toISOString().slice(11, 16), end: end.toISOString().slice(11, 16), endDate: end.toISOString().slice(0, 10), timeZone: 'UTC', reminder: 0 });
  await seedAccount(page, state);
  await page.goto('/#agenda');
  await expect(page.getByLabel('Lembretes da Agenda')).toContainText('Lembrete de consulta', { timeout: 25000 });
  expect(await page.evaluate(() => window.sentNotifications.length)).toBe(1);
  await page.getByRole('navigation', { name: 'Navegação', exact: true }).getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByLabel('Lembretes da Agenda')).toContainText('Lembrete de consulta');
  expect((await (await page.request.post('/api/agenda/reminders', { headers })).json()).reminders).toEqual([]);
  await page.getByRole('button', { name: 'Dispensar lembrete Lembrete de consulta' }).click();
  await expect(page.getByLabel('Lembretes da Agenda')).toHaveCount(0);
});

test('teclado cria compromisso sem horário; permissão negada é explicada', async ({ page }) => {
  await page.addInitScript(() => {
    class DeniedNotification { static permission = 'denied'; static requestPermission() { return Promise.resolve('denied'); } }
    window.Notification = DeniedNotification;
  });
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Título do compromisso')).toBeFocused();
  await page.keyboard.type('Leitura livre');
  await page.getByRole('button', { name: 'Salvar compromisso' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article', { name: 'Leitura livre' })).toContainText('Sem horário');
  await readAccount(page);
  await page.getByRole('button', { name: 'Ativar notificações no computador' }).click();
  await expect(page.getByText(/Notificações bloqueadas/)).toBeVisible();
  expect((await readAccount(page)).agenda[0].title).toBe('Leitura livre');
});

test('conflito exige recarga e repetição explícita, preservando o formulário', async ({ page }) => {
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await page.getByLabel('Título do compromisso').fill('Atividade após conflito');
  await page.route('**/api/library/actions', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Revisão mudou', code: 'library_conflict' }) }));
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText('Resolva a gravação pendente antes de sair.')).toBeVisible();
  await page.unroute('**/api/library/actions');
  await page.getByRole('button', { name: 'Recarregar ou tentar novamente' }).click();
  await expect(page.locator('.sync-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText('A alteração não foi gravada ou mudou após a recarga. Revise os campos e salve novamente.')).toBeVisible();
  await expect(page.getByLabel('Título do compromisso')).toHaveValue('Atividade após conflito');
  await expect(page.getByLabel('Título do compromisso')).toBeEnabled();
  expect((await readAccount(page)).agenda).toHaveLength(0);
  await saveForm(page);
  expect((await readAccount(page)).agenda).toHaveLength(1);
});
