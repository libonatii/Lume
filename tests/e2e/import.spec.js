import { test, expect } from '@playwright/test';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

// Cenários de importação. O fluxo por texto usa a API real do servidor local
// (organizador determinístico, sem IA). A análise por link é simulada por
// interceptação de rota para cobrir fonte protegida e falha de rede sem
// depender de acesso real às plataformas nesta execução.

async function openLibrary(page) {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, state: { ...createInitialState(), onboarded: true } });
  await page.goto('/#biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
}

test('erro de link, fonte protegida e falha de rede preservam a escolha', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();

  // Link inválido: erro recuperável, sem perder o que foi digitado.
  await page.getByLabel('Link do curso').fill('nao-e-um-link');
  await page.getByRole('button', { name: 'Analisar link' }).click();
  await expect(page.getByRole('heading', { name: 'Confira o link' })).toBeVisible();
  await page.getByRole('button', { name: /Colar a grade ou enviar arquivo/ }).click();
  await page.getByRole('tab', { name: 'Link do curso' }).click();
  await expect(page.getByLabel('Link do curso')).toHaveValue('nao-e-um-link');

  // Fonte protegida: a mensagem explica o que foi possível e não pede senha.
  await page.route('**/api/import/analyze', route => route.fulfill({
    status: 422,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'A fonte exige acesso à conta para mostrar a grade. O Lume não pede sua senha: cole a grade ou envie um arquivo.', code: 'protected' }),
  }));
  await page.getByLabel('Link do curso').fill('https://www.grancursosonline.com.br/curso/oab');
  await page.getByRole('button', { name: 'Analisar link' }).click();
  await expect(page.getByRole('heading', { name: 'Essa fonte pede acesso à conta' })).toBeVisible();
  await expect(page.getByText(/não contorna login/i)).toBeVisible();

  // Falha de rede: mensagem recuperável e link preservado.
  await page.unroute('**/api/import/analyze');
  await page.route('**/api/import/analyze', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('heading', { name: 'Não consegui falar com a fonte' })).toBeVisible();
  await page.getByRole('button', { name: /Colar a grade ou enviar arquivo/ }).click();
  await page.getByRole('tab', { name: 'Link do curso' }).click();
  await expect(page.getByLabel('Link do curso')).toHaveValue('https://www.grancursosonline.com.br/curso/oab');
  await page.unroute('**/api/import/analyze');

  // Recuperação pelo caminho assistido, sem digitar aula por aula.
  await page.getByRole('tab', { name: 'Colar a grade' }).click();
  await page.getByLabel('Nome do curso (opcional)').fill('OAB — recuperado');
  await page.getByLabel('Grade do curso', { exact: true }).fill('Disciplina: Direito Constitucional\nMódulo: Princípios\nAula 1 — Conceito');
  await page.getByRole('button', { name: 'Organizar grade' }).click();
  await expect(page.getByRole('heading', { name: 'OAB — recuperado' })).toBeVisible();
  await page.getByRole('button', { name: /Adicionar 1 aula à biblioteca/ }).click();
  await expect(page.getByText('XP concedido agora: 0')).toBeVisible();
});

test('seleção parcial, reimportação sem duplicata e progresso preservado', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await page.getByRole('tab', { name: 'Colar a grade' }).click();
  await page.getByLabel('Nome do curso (opcional)').fill('Preparatório OAB');
  await page.getByLabel('Grade do curso', { exact: true }).fill([
    'Disciplina: Direito Constitucional',
    'Módulo: Princípios',
    'Aula 1 — Conceito e fontes',
    'Aula 2 — Direitos fundamentais',
    'Disciplina: Direito Penal',
    'Módulo: Parte geral',
    'Aula 1 — Aplicação da lei',
  ].join('\n'));
  await page.getByRole('button', { name: 'Organizar grade' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'aulas selecionadas' })).toHaveText('3 de 3 aulas selecionadas');

  // Selecionar apenas uma área não conclui o curso inteiro.
  await page.getByRole('checkbox', { name: 'Selecionar a área Direito Penal' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'aulas selecionadas' })).toHaveText('2 de 3 aulas selecionadas');
  await page.getByRole('button', { name: /Adicionar 2 aulas à biblioteca/ }).click();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();

  await page.getByRole('button', { name: /^Preparatório OAB,/ }).click();
  await expect(page.getByText('Grade parcial', { exact: true })).toBeVisible();
  await expect(page.getByText(/não representa a conclusão do curso inteiro/i)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Concluí esta aula' }).click();
  await expect(page.getByText('registro manual').first()).toBeVisible();
  const firstLesson = await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key));
    return state.completed.at(-1);
  }, STORAGE_KEY);

  // Reimportação: a mesma identidade atualiza o curso, sem duplicar.
  await page.getByRole('dialog').getByRole('button', { name: 'Atualizar grade' }).click();
  await page.getByRole('tab', { name: 'Colar a grade' }).click();
  await page.getByLabel('Nome do curso (opcional)').fill('Preparatório OAB');
  await page.getByLabel('Grade do curso', { exact: true }).fill([
    'Disciplina: Direito Constitucional',
    'Módulo: Princípios',
    'Aula 2 — Direitos fundamentais',
    'Aula 3 — Remédios constitucionais',
    'Disciplina: Direito Tributário',
    'Módulo: Obrigação',
    'Aula 1 — Fato gerador',
  ].join('\n'));
  await page.getByRole('button', { name: 'Organizar grade' }).click();
  await page.getByRole('button', { name: 'Atualizar curso' }).click();
  await expect(page.getByText('Importação concluída')).toBeVisible();
  await page.getByRole('button', { name: 'Ver o curso' }).click();
  await expect(page.getByText(/Algumas aulas não aparecem mais na fonte/)).toBeVisible();
  await page.getByRole('button', { name: 'Fechar janela' }).click();

  await expect(page.locator('#library-results .course-card').filter({ hasText: 'Preparatório OAB' })).toHaveCount(1);
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.courses.filter(course => course.title === 'Preparatório OAB')).toHaveLength(1);
  expect(state.completed).toContain(firstLesson);
  expect(state.studyLog).toHaveLength(1);
  expect(state.history).toHaveLength(0);
  expect(state.imports.at(-1).mode).toBe('update');
});

test('duas contas não compartilham cursos importados', async ({ page }, testInfo) => {
  const stamp = Date.now();
  const emailA = `importa-${testInfo.project.name}-${stamp}@example.test`;
  const emailB = `importb-${testInfo.project.name}-${stamp}@example.test`;
  async function register(email) {
    await page.getByRole('button', { name: 'Criar conta', exact: true }).first().click();
    await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa de teste');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('senha-local-teste-123');
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await page.getByRole('button', { name: 'Explorar sem personalizar agora' }).click();
    await expect(page.getByRole('heading', { name: /Que bom ter você aqui/ })).toBeVisible();
  }

  await page.goto('/');
  await register(emailA);
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await page.getByRole('tab', { name: 'Colar a grade' }).click();
  await page.getByLabel('Nome do curso (opcional)').fill('Curso da conta A');
  await page.getByLabel('Grade do curso', { exact: true }).fill('Aula única da conta A');
  await page.getByRole('button', { name: 'Organizar grade' }).click();
  await page.getByRole('button', { name: /Adicionar 1 aula à biblioteca/ }).click();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();
  await expect(page.getByRole('button', { name: /^Curso da conta A,/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();

  await register(emailB);
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Curso da conta A,/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Design de interfaces,/ })).toBeVisible();
});
