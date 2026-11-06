import { test, expect } from '@playwright/test';
import { createInitialState, addCourse } from '../../public/domain.js';
import { createAppointment } from '../../public/agenda-domain.js';
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

test('calendário proporcional, criação rápida, checklist editável e sobreposição', async ({ page, isMobile }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
  await expect(page.getByLabel(`Calendário: ${isMobile ? 'dia' : 'semana'}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  await expect(page.getByLabel('Título do compromisso')).toBeFocused();
  await expect(page.getByLabel('Fuso do compromisso')).not.toBeVisible();
  await expect(page.getByLabel('Repetição', { exact: true })).not.toBeVisible();
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
  await page.getByText('Mais opções', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('personal');
  await saveForm(page);
  const long = await page.getByLabel('Abrir compromisso Revisão constitucional', { exact: true }).first().boundingBox();
  const short = await page.getByLabel('Abrir compromisso Consulta', { exact: true }).first().boundingBox();
  expect(long.height).toBeGreaterThan(short.height * 1.5);
  expect(Math.abs(long.x - short.x)).toBeGreaterThan(5);
  await page.screenshot({ path: testInfo.outputPath('agenda-week.png'), fullPage: true });
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  await expect(page.getByLabel('Calendário: mês')).toContainText('Consulta');
  await page.screenshot({ path: testInfo.outputPath('agenda-month.png'), fullPage: true });
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
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
  await expect(page.getByRole('link', { name: 'Cronograma', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roteiro', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tarefas', exact: true })).toHaveCount(0);
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
  await page.getByText('Mais opções', { exact: true }).click();
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

async function slotPoint(page, time) {
  const slot = page.locator(`.lume-time-slot[data-time="${time}:00"]`);
  await slot.scrollIntoViewIfNeeded();
  await slot.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const target = Math.max(180, Math.min(top, window.innerHeight - 150));
    window.scrollBy({ top: top - target, behavior: 'instant' });
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await slot.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + 3 };
}

test('selecionar horário abre criação já preenchida e mês cria sem horário', async ({ page, isMobile }, testInfo) => {
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  const point = await slotPoint(page, '09:00');
  if (isMobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect(page.getByLabel('Início', { exact: true })).toHaveValue('09:00');
  await expect(page.getByLabel('Fim', { exact: true })).toHaveValue('09:30');
  await page.getByLabel('Título do compromisso').fill('Criado na grade');
  await page.screenshot({ path: testInfo.outputPath('agenda-quick-add.png'), fullPage: true });
  await saveForm(page);
  // O aviso de confirmação fica sobre o canto da grade; fechá-lo libera a última célula.
  await page.getByRole('button', { name: 'Fechar aviso' }).click();
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  // A célula mensal oferece a mesma criação por seleção, sem horário artificial.
  const cell = page.locator('.agenda-calendar [data-date]').last();
  await cell.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const bounds = await cell.boundingBox();
  if (isMobile) await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height - 8);
  else await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height - 8);
  await expect(page.getByRole('checkbox', { name: 'Sem horário', exact: true })).toBeChecked();
  await page.getByLabel('Título do compromisso').fill('Dia livre');
  await saveForm(page);
  expect((await readAccount(page)).agenda).toHaveLength(2);
});

test('arrasto seleciona intervalo, move, redimensiona e agenda tarefa existente', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Gestos de mouse no computador; toque e edição acessível cobertos nos dois tamanhos.');
  await page.setViewportSize({ width: 1600, height: 1000 });
  const state = addTask(initial(), { title: 'Tarefa para arrastar', dueDate: '2030-12-01' });
  await seedAccount(page, state);
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  const a = await slotPoint(page, '09:00'), b = await slotPoint(page, '09:30');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByLabel('Início', { exact: true })).toHaveValue('09:00');
  await expect(page.getByLabel('Fim', { exact: true })).toHaveValue('10:00');
  await page.getByLabel('Título do compromisso').fill('Intervalo escolhido');
  await saveForm(page);
  const event = page.getByLabel('Abrir compromisso Intervalo escolhido', { exact: true });
  let bounds = await event.boundingBox();
  const hourHeight = (b.y - a.y) * 2;
  await page.route('**/api/library/actions', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Indisponível' }) }));
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 10);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 10 + hourHeight, { steps: 20 });
  await page.mouse.up();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByLabel('Início', { exact: true })).toHaveValue('10:00');
  await page.unroute('**/api/library/actions');
  await dialog(page).getByRole('button', { name: 'Recarregar ou tentar novamente' }).click();
  await expect(dialog(page).getByRole('button', { name: 'Recarregar ou tentar novamente' })).toHaveCount(0);
  await saveForm(page);
  await expect.poll(async () => (await readAccount(page)).agenda[0].start).toBe('10:00');
  bounds = await event.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height - 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height - 2 + hourHeight, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await readAccount(page)).agenda[0].end).toBe('12:00');
  await page.getByRole('button', { name: 'Para agendar (1)', exact: true }).click();
  const source = await page.locator('[data-task-id]').boundingBox();
  const target = await slotPoint(page, '14:00');
  await page.mouse.move(source.x + source.width / 2, source.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 25 });
  await page.mouse.up();
  await expect(page.getByLabel('Título do compromisso')).toHaveValue('Tarefa para arrastar');
  await expect(page.getByLabel('Início', { exact: true })).toHaveValue('14:00');
  await saveForm(page);
  const saved = await readAccount(page);
  expect(saved.tasks).toEqual(state.tasks);
  expect(saved.agenda[1].taskIds).toEqual([state.tasks[0].id]);
  await page.reload();
  expect((await readAccount(page)).agenda[0]).toEqual(expect.objectContaining({ start: '10:00', end: '12:00' }));
});

test('arrastar série pede escopo antes de gravar; cancelar preserva datas', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Escopo do arrasto com mouse; editor de série também é testado no celular.');
  await page.setViewportSize({ width: 1600, height: 1000 });
  const date = localDate();
  const state = createAppointment(initial(), { title: 'Estudo recorrente', category: 'study', date, endDate: date, start: '09:00', end: '10:00', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, recurrence: 'daily', count: 3 });
  await seedAccount(page, state);
  await page.goto('/#agenda');
  await page.getByRole('button', { name: 'Dia', exact: true }).click();
  async function drag() {
    const a = await slotPoint(page, '09:00'), b = await slotPoint(page, '10:00');
    const box = await page.getByLabel('Abrir compromisso Estudo recorrente').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 10 + b.y - a.y, { steps: 20 });
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
  expect((await readAccount(page)).agenda.map((item) => item.start)).toEqual(['10:00', '10:00', '10:00']);
});

test('criação rápida expande, filtro por tipo, exclusão com desfazer e visões Lista e 3 dias', async ({ page, isMobile }) => {
  await seedAccount(page, initial());
  await page.goto('/#agenda');
  await expect(page.getByText('Sua agenda está livre')).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
    await page.getByLabel('Título do compromisso').fill('Prova de direito');
    await hours(page, '10:00', '10:30');
    await page.getByText('Mais opções', { exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Dia', exact: true }).click();
    const point = await slotPoint(page, '10:00');
    await page.mouse.click(point.x, point.y);
    await expect(page.getByLabel('Início', { exact: true })).toHaveValue('10:00');
    await page.getByLabel('Título do compromisso').fill('Prova de direito');
    await dialog(page).getByRole('button', { name: 'Mais opções', exact: true }).click();
    await expect(page.getByLabel('Título do compromisso')).toHaveValue('Prova de direito');
  }
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('exam');
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
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.getByLabel('Calendário: lista')).toContainText('Prova de direito');
  await page.getByRole('button', { name: '3 dias', exact: true }).click();
  await expect(page.getByLabel('Calendário: 3 dias')).toContainText('Prova de direito');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
