import { test, expect } from '@playwright/test';
import { createInitialState, addCourse } from '../../public/domain.js';
import { createAppointment, shiftDate } from '../../public/agenda-domain.js';
import { addTask, localDate } from '../../public/tasks-domain.js';
import { seedAccount, readAccount } from './library-helpers.js';

const initial = () => ({ ...createInitialState(), onboarded: true });
const headers = { origin: 'http://127.0.0.1:4187' };
const dialog = (page) => page.getByRole('dialog');
async function saveForm(page) {
  await dialog(page).getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(dialog(page)).toHaveCount(0);
  return readAccount(page);
}
async function hours(page, start, end) {
  await page.getByRole('checkbox', { name: 'Sem horário', exact: true }).uncheck();
  await page.getByLabel('Início', { exact: true }).selectOption(start);
  await page.getByLabel('Fim', { exact: true }).selectOption(end);
}
async function openEvent(page, title) {
  await page.getByLabel(`Abrir compromisso ${title}`, { exact: true }).first().click();
  await expect(dialog(page)).toBeVisible();
}

test('calendário mensal, criação, checklist editável e sobreposição', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
  await expect(page.getByLabel('Calendário: mês', { exact: true })).toBeVisible();
  // Só a visão mensal: não há seletor de Dia, 3 dias, Semana ou Lista.
  await expect(page.getByRole('group', { name: 'Visualização' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await expect(page.getByLabel('Título do compromisso')).toBeFocused();
  await expect(page.getByLabel('Fuso do compromisso')).not.toBeVisible();
  // Tipo, lembrete e repetição ficam à vista; só o fuso fica recolhido.
  await expect(page.getByRole('radio', { name: 'Estudo', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Lembrete', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Repetição', exact: true })).toBeVisible();
  await page.getByLabel('Título do compromisso').fill('Revisão constitucional');
  await hours(page, '09:00', '10:00');
  await page.getByRole('button', { name: '+ Adicionar checklist', exact: true }).click();
  await page.getByLabel('Item 1', { exact: true }).fill('Ler anotações');
  await page.getByRole('button', { name: '+ Adicionar checklist', exact: true }).click();
  await page.getByLabel('Item 2', { exact: true }).fill('Resolver questões');
  const saved = await saveForm(page);
  expect(saved.agenda).toHaveLength(1);
  expect(saved.tasks).toHaveLength(2);
  await openEvent(page, 'Revisão constitucional');
  await page.getByRole('checkbox', { name: 'Concluir tarefa Ler anotações' }).check();
  await expect(dialog(page)).toContainText('Checklist · 1/2');
  await readAccount(page);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Item 2', { exact: true }).fill('Resolver dez questões');
  await page.getByRole('button', { name: '+ Adicionar checklist', exact: true }).click();
  await page.getByLabel('Item 3', { exact: true }).fill('Revisar erros');
  const edited = await saveForm(page);
  expect(edited.tasks[0]).toEqual(expect.objectContaining({ id: saved.tasks[0].id, done: true }));
  expect(edited.tasks[1].id).toBe(saved.tasks[1].id);
  expect(edited.tasks[1].title).toBe('Resolver dez questões');
  expect(edited.tasks).toHaveLength(3);

  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await page.getByLabel('Título do compromisso').fill('Consulta');
  await hours(page, '09:30', '10:00');
  await expect(dialog(page)).toContainText('Sobreposição');
  await page.getByRole('radio', { name: 'Pessoal', exact: true }).check();
  await saveForm(page);
  await expect(page.getByLabel('Calendário: mês')).toContainText('Consulta');
  await page.screenshot({ path: testInfo.outputPath('agenda-month.png'), fullPage: true });
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await openEvent(page, 'Consulta');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await hours(page, '11:00', '11:30');
  await saveForm(page);
  await page.reload();
  await openEvent(page, 'Consulta');
  await expect(dialog(page)).toContainText('11:00');
  await expect(dialog(page)).not.toContainText('Sobreposição');
  await page.getByRole('button', { name: 'Fechar painel' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('tarefas existentes são agendadas sem cópia e menu continua legível', async ({ page, isMobile }) => {
  const state = addTask(initial(), { title: 'Tarefa preservada', dueDate: '2030-12-01', priority: 1 });
  await seedAccount(page, state);
  await page.goto('/#tarefas');
  await page.getByRole('button', { name: 'Agendar tarefa Tarefa preservada' }).click();
  await expect(page.getByLabel('Título do compromisso')).toHaveValue('Tarefa preservada');
  const saved = await saveForm(page);
  expect(saved.tasks).toEqual(state.tasks);
  expect(saved.agenda[0].taskIds).toEqual([state.tasks[0].id]);
  await page.goto('/#plano');
  await expect(page.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Calendário', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roteiro', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tarefas', exact: true })).toBeVisible();
  await page.goto('/#agenda');
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
  await page.getByRole('button', { name: '+ Adicionar checklist', exact: true }).click();
  await page.getByLabel('Item 1', { exact: true }).fill('Revisar notas');
  await page.getByRole('combobox', { name: 'Repetição', exact: true }).selectOption('daily');
  await page.getByLabel('Ocorrências').fill('3');
  const saved = await saveForm(page);
  expect(saved.agenda).toHaveLength(3);
  expect(saved.tasks).toHaveLength(3);
  await openEvent(page, 'Revisão diária');
  await page.getByRole('checkbox', { name: 'Concluir tarefa Revisar notas' }).check();
  await readAccount(page);
  await page.getByText('Mais ações', { exact: true }).click();
  await page.getByRole('button', { name: 'Encerrar atividade' }).click();
  await readAccount(page);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Título do compromisso').fill('Revisão ajustada');
  await page.getByLabel('Aplicar alteração').selectOption('future');
  await saveForm(page);
  const after = await readAccount(page);
  expect(after.agenda.map((item) => item.title)).toEqual(['Revisão diária', 'Revisão ajustada', 'Revisão ajustada']);
  expect(after.tasks.map((item) => item.done)).toEqual([true, false, false]);
  expect(after.agenda.map((item) => item.done)).toEqual([true, false, false]);
});

test('sugestão só vira compromisso ao salvar; falha temporária preserva formulário sem duplicação', async ({ page }) => {
  const state = addCourse(initial(), { title: 'Curso', steps: ['Aula sugerida'] }, 'c');
  state.plan.availability = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 };
  await seedAccount(page, state);
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Para agendar', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar sugestão' }).click();
  expect((await readAccount(page)).agenda).toEqual([]);
  await hours(page, '10:00', '10:30');
  await page.route('**/api/library/actions', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Indisponível' }) }));
  await dialog(page).getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByLabel('Título do compromisso')).toHaveValue('Aula sugerida');
  await expect(page.getByText('Resolva a gravação pendente antes de sair.')).toBeVisible();
  await page.unroute('**/api/library/actions');
  await dialog(page).getByRole('button', { name: 'Recarregar ou tentar novamente' }).click();
  await expect.poll(async () => (await (await page.request.get('/api/library', { headers })).json()).state.agenda.length).toBe(1);
  await saveForm(page);
  const saved = await readAccount(page);
  expect(saved.tasks[0].lessonId).toBe('c-0');
  expect(saved.agenda).toHaveLength(1);
});

test('lembrete real da API aparece internamente, chama notificação e não repete ao navegar', async ({ page }) => {
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
  await page.goto('/#biblioteca');
  await expect(page.getByLabel('Lembretes da Agenda')).toContainText('Lembrete de consulta');
  expect((await (await page.request.post('/api/agenda/reminders', { headers })).json()).reminders).toEqual([]);
  await page.getByRole('button', { name: 'Dispensar lembrete Lembrete de consulta' }).click();
  await expect(page.getByLabel('Lembretes da Agenda')).toHaveCount(0);
});

test('teclado cria compromisso com título; painel devolve foco e permissão negada é explicada', async ({ page }) => {
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
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo compromisso', exact: true })).toBeFocused();
  await openEvent(page, 'Leitura livre');
  await expect(dialog(page)).toContainText('Sem horário');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Lembretes', exact: true }).click();
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
  await dialog(page).getByRole('button', { name: 'Recarregar ou tentar novamente' }).click();
  await expect(page.locator('.sync-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar compromisso' }).click();
  await expect(page.getByText('A alteração não foi gravada ou mudou após a recarga. Revise os campos e salve novamente.')).toBeVisible();
  await expect(page.getByLabel('Título do compromisso')).toBeEnabled();
  expect((await readAccount(page)).agenda).toHaveLength(0);
  await saveForm(page);
  expect((await readAccount(page)).agenda).toHaveLength(1);
});

test('clicar num dia do mês cria compromisso sem horário', async ({ page, isMobile }) => {
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  const cell = page.locator('.agenda-calendar [data-date]').last();
  await cell.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const bounds = await cell.boundingBox();
  if (isMobile) await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height - 8);
  else await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height - 8);
  await expect(page.getByRole('checkbox', { name: 'Sem horário', exact: true })).toBeChecked();
  await page.getByLabel('Título do compromisso').fill('Dia livre');
  await saveForm(page);
  expect((await readAccount(page)).agenda).toHaveLength(1);
});

test('arrastar tarefa existente para um dia do mês agenda sem cópia', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Gestos de mouse no computador; toque e edição acessível cobertos nos dois tamanhos.');
  await page.setViewportSize({ width: 1600, height: 1000 });
  const state = addTask(initial(), { title: 'Tarefa para arrastar', dueDate: '2030-12-01' });
  await seedAccount(page, state);
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Para agendar (1)', exact: true }).click();
  const today = localDate();
  const source = await page.locator('[data-task-id]').boundingBox();
  const target = await page.locator(`.agenda-calendar [data-date="${today}"]`).boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 25 });
  await page.mouse.up();
  await expect(page.getByLabel('Título do compromisso')).toHaveValue('Tarefa para arrastar');
  await saveForm(page);
  const saved = await readAccount(page);
  expect(saved.tasks).toEqual(state.tasks);
  expect(saved.agenda[0]).toEqual(expect.objectContaining({ date: today, start: '', taskIds: [state.tasks[0].id] }));
});

test('arrastar série pede escopo antes de gravar; cancelar preserva datas', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Escopo do arrasto com mouse; editor de série também é testado no celular.');
  await page.setViewportSize({ width: 1600, height: 1000 });
  const date = localDate();
  const state = createAppointment(initial(), { title: 'Estudo recorrente', category: 'study', date, endDate: date, start: '09:00', end: '10:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, recurrence: 'daily', count: 3 });
  await seedAccount(page, state);
  await page.goto('/#agenda');
  const next = shiftDate(date, 1);
  async function drag() {
    const box = await page.getByLabel('Abrir compromisso Estudo recorrente').first().boundingBox();
    const target = await page.locator(`.agenda-calendar [data-date="${next}"]`).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height - 10, { steps: 20 });
    await page.mouse.up();
  }
  await drag();
  await expect(page.getByLabel('Aplicar alteração')).toBeVisible();
  expect((await readAccount(page)).agenda).toEqual(state.agenda);
  await page.getByRole('button', { name: 'Cancelar edição' }).click();
  expect((await readAccount(page)).agenda).toEqual(state.agenda);
  await drag();
  await page.getByLabel('Aplicar alteração').selectOption('future');
  await saveForm(page);
  const moved = (await readAccount(page)).agenda;
  expect(moved.map((item) => item.date)).toEqual([next, shiftDate(date, 2), shiftDate(date, 3)]);
  expect(moved.map((item) => item.start)).toEqual(['', '', '']);
});

test('criação, filtro por tipo e exclusão com desfazer', async ({ page }) => {
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await expect(page.getByText('Sua agenda está livre')).toBeVisible();
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await page.getByLabel('Título do compromisso').fill('Prova de direito');
  await hours(page, '10:00', '10:30');
  await page.getByRole('radio', { name: 'Prova', exact: true }).check();
  const saved = await saveForm(page);
  expect(saved.agenda[0]).toEqual(expect.objectContaining({ title: 'Prova de direito', category: 'exam', start: '10:00', end: '10:30' }));
  await expect(page.getByText('Compromisso agendado.')).toBeVisible();
  await expect(page.getByText('Sua agenda está livre')).toHaveCount(0);
  const event = page.getByLabel('Abrir compromisso Prova de direito', { exact: true });
  await page.getByRole('button', { name: 'Prova', exact: true }).click();
  await expect(event).toHaveCount(0);
  await page.getByRole('button', { name: 'Prova', exact: true }).click();
  await event.first().click();
  await dialog(page).getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(async () => (await readAccount(page)).agenda.length).toBe(0);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect.poll(async () => (await readAccount(page)).agenda).toEqual(saved.agenda);
  await expect(page.getByLabel('Calendário: mês')).toContainText('Prova de direito');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('arrastar no mês move o dia e remove o horário', async ({ page, isMobile }) => {
  test.skip(isMobile, 'gesto de arrasto com mouse é exclusivo do computador');
  const state = createAppointment({ ...createInitialState(), onboarded: true }, {
    title: 'Bloco com hora', category: 'study', date: '2026-11-10', start: '14:00', end: '15:00', timeZone: 'America/Sao_Paulo', taskIds: [],
  });
  await seedAccount(page, state);
  await page.goto('/#agenda');
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
  const event = page.getByLabel('Abrir compromisso Bloco com hora', { exact: true }).first();
  await expect(event).toBeVisible();
  const source = await event.boundingBox();
  const target = await page.locator('[data-date="2026-11-18"]').boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + 40, { steps: 12 });
  await page.mouse.up();
  const saved = await readAccount(page);
  expect(saved.agenda[0]).toEqual(expect.objectContaining({ date: '2026-11-18', endDate: '2026-11-18', start: '', end: '' }));
});
