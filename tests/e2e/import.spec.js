import { test, expect } from '@playwright/test';
import { materialSteps } from '../../public/material-model.js';
import { seedAccount, readAccount } from './library-helpers.js';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

// Cenários de importação. O fluxo por texto usa a API real do servidor local
// (organizador determinístico, sem IA). A análise por link é simulada por
// interceptação de rota para cobrir fonte protegida e falha de rede sem
// depender de acesso real às plataformas nesta execução.

async function openLibrary(page) {
  await seedAccount(page, { ...createInitialState(), onboarded: true });
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
  await page.getByRole('button', { name: /Colar a página aberta na conta/ }).click();
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
  await page.getByRole('button', { name: /Colar a página aberta na conta/ }).click();
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
  const firstLesson = (await readAccount(page)).progress.filter((event) => event.type === 'completion' && !event.revertedAt).at(-1).unitId;

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
  const state = await readAccount(page);
  expect(state.courses.filter(course => course.title === 'Preparatório OAB')).toHaveLength(1);
  expect(state.progress.filter((event) => !event.revertedAt).map((event) => event.unitId)).toContain(firstLesson);
  expect(state.progress).toHaveLength(1);
  expect(state.progress[0].origin).toBe('manual');
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
    await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: /^Menu da conta/ }).click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();

  await register(emailB);
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Curso da conta A,/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Qual área você quer estudar?' })).toBeVisible();
});

test('biblioteca vazia pergunta a área e cria a primeira trilha sem XP', async ({ page }) => {
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: 'Qual área você quer estudar?' })).toBeVisible();
  await page.getByLabel('Área de atuação').fill('Direito');
  await page.getByLabel('Primeiro passo (opcional)').fill('Ler a introdução de processo penal');
  await page.getByRole('button', { name: 'Criar minha trilha' }).click();

  await expect(page.getByRole('button', { name: /^Direito,/ })).toBeVisible();
  const state = await readAccount(page);
  expect(state.courses).toHaveLength(1);
  expect(state.courses[0].title).toBe('Direito');
  expect(state.courses[0].origin).toBe('manual');
  expect(materialSteps(state.courses[0])[0].title).toBe('Ler a introdução de processo penal');
  expect(state.progress.filter((event) => event.origin === 'manual' || event.legacyXp)).toEqual([]);
});

test('página copiada da conta vira revisão sem enviar sessão', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await page.getByRole('tab', { name: 'Colar a grade' }).click();

  let sent = null;
  await page.route('**/api/import/analyze', route => {
    sent = route.request().postDataJSON();
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        payload: {
          title: 'OAB — 1ª fase',
          provider: { id: 'grancursos' },
          sourceUrl: 'https://www.grancursosonline.com.br/curso/oab',
          completeness: 'partial',
          extraction: { kind: 'page-snapshot', confidence: 'low', notes: [] },
          disciplines: [{
            title: 'Conteúdo do curso',
            modules: [{ title: 'Direito Constitucional', lessons: [{ title: 'Aula 1 — Conceito e fontes' }] }],
          }],
        },
        ai: { used: false },
      }),
    });
  });

  await page.getByLabel('Link do curso (opcional)').fill('https://www.grancursosonline.com.br/curso/oab');
  const filler = '<p>Conteúdo do painel do curso com a conta da pessoa.</p>'.repeat(40);
  const snapshot = `<html><body><div class="sidebar"><h1>OAB — 1ª fase</h1><h3>Direito Constitucional</h3><ul>
    <li><a href="/curso/123/aula/456">Aula 1 — Conceito e fontes</a></li>
    <li><a href="/curso/123/aula/457">Aula 2 — Direitos fundamentais</a></li>
    <li><a href="/curso/123/aula/458">Aula 3 — Remédios constitucionais</a></li>
    </ul>${filler}</div></body></html>`;
  await page.evaluate((html) => {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', 'OAB — 1ª fase\nAula 1 — Conceito e fontes');
    document.querySelector('textarea[name="import-text"]')
      .dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, snapshot);

  await expect(page.getByRole('heading', { name: 'OAB — 1ª fase' })).toBeVisible();
  expect(sent?.url).toBe('https://www.grancursosonline.com.br/curso/oab');
  expect(sent?.html).toContain('/aula/456');
  expect(sent?.html).not.toMatch(/cookie|session/i);
  await expect(page.getByText('Página copiada da sua conta')).toBeVisible();
  await page.unroute('**/api/import/analyze');
});

test('link sem https é detectado e adicionado sem abrir a revisão', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await page.route('**/api/import/analyze', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      payload: {
        title: 'React Básico',
        provider: { id: 'coursera' },
        sourceUrl: 'https://www.coursera.org/learn/react-basics',
        completeness: 'complete',
        extraction: { kind: 'structured-data', confidence: 'high', notes: [] },
        disciplines: [{ title: 'Semana 1', modules: [{ title: 'Fundamentos', lessons: [{ title: 'Componentes' }, { title: 'Estado' }] }] }],
      },
      ai: { used: false },
    }),
  }));
  await page.getByLabel('Link do curso').fill('www.coursera.org/learn/react-basics');
  await expect(page.getByText(/Coursera detectado/)).toBeVisible();
  await page.getByRole('button', { name: 'Detectar e adicionar' }).click();
  await expect(page.getByText('Importação concluída')).toBeVisible();
  await expect(page.getByText(/Detectado e adicionado automaticamente/)).toBeVisible();
  await page.getByRole('button', { name: 'Ver o curso' }).click();
  await expect(page.locator('#dialog-title')).toHaveText('React Básico');
  const state = await readAccount(page);
  expect(state.courses).toHaveLength(1);
  expect(materialSteps(state.courses[0])).toHaveLength(2);
  expect(state.progress.filter((event) => event.origin === 'manual' || event.legacyXp)).toEqual([]);
  await page.unroute('**/api/import/analyze');
});
