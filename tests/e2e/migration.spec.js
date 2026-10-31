import { test, expect } from '@playwright/test';
import { createInitialState, completeMission, STORAGE_KEY } from '../../public/domain.js';

// A biblioteca real começa vazia. Estes cenários de dados antigos precisam de
// trilhas próprias para conferir busca, pausa e restauração.
function seededState() {
  const steps = (prefix, count) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}`, title: `Etapa ${index + 1}` }));
  const state = createInitialState();
  state.courses = [
    { id: 'design', title: 'Design de interfaces', category: 'Design & criatividade', art: 'design', url: '', example: false, paused: false, steps: steps('design', 4) },
    { id: 'python', title: 'Primeiros passos em Python', category: 'Tecnologia & programação', art: 'code', url: '', example: false, paused: false, steps: steps('python', 4) },
  ];
  state.selectedCourseId = 'design';
  return state;
}

test('prévia, dados legados, busca, filtros, teclado, curso e progresso', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const oldState = completeMission(seededState(), 'design', 'design-1').state;
  oldState.onboarded = true;
  oldState.preferences.essential = true;
  oldState.supports = ['calm'];
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, state: oldState });
  await page.goto('/#hoje');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Etapa 2', exact: true })).toBeVisible();
  await expect(page.getByText('Continuidade.', { exact: true })).toBeVisible();
  await expect(page.getByText('Modo Essencial', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await expect(page.locator('#main > div')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: `data/lume-${testInfo.project.name}-library.png`, fullPage: true });
  const search = page.getByRole('searchbox');
  await search.fill('Python');
  await expect(page.locator('#library-results .course-card')).toHaveCount(1);
  await expect(search).toBeFocused();
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(search).toBeFocused();
  await page.getByRole('button', { name: /^Concluídos \(/ }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum material neste filtro.' })).toBeVisible();
  await page.getByRole('button', { name: /^Todos \(/ }).click();
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar curso', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await page.getByRole('tab', { name: 'Colar a grade' }).click();
  await page.getByLabel('Nome do curso (opcional)').fill('Leitura React');
  await page.getByLabel('Grade do curso').fill('Disciplina: Componentes\nMódulo: Fundamentos\nAula 1 — Props e estado\nAula 2 — Efeitos');
  await page.getByRole('button', { name: 'Organizar grade' }).click();
  await expect(page.getByRole('heading', { name: 'Leitura React' })).toBeVisible();
  await page.getByRole('button', { name: /Adicionar 2 aulas à biblioteca/ }).click();
  await expect(page.getByText('Importação concluída')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();
  await page.getByRole('button', { name: /^Leitura React,/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Concluí esta aula' }).click();
  await expect(page.getByText('registro manual').first()).toBeVisible();
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await expect(page.getByRole('button', { name: /^Leitura React,/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(restored.history).toHaveLength(1);
  expect(restored.studyLog).toHaveLength(1);
  expect(restored.studyLog[0].origin).toBe('manual');
  expect(restored.completed).toContain('design-1');
  expect(restored.preferences.essential).toBe(true); // Guardado como legado, sem efeito visual.
  await page.getByRole('button', { name: /^Menu da conta/ }).click();
  await page.getByRole('menuitem', { name: 'Meu Perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Colecionador de estudos', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Atividade recente', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conquistas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByLabel('Selecionar foto de perfil do computador').setInputFiles('public/assets/stitch/calm.png');
  await page.getByLabel('Selecionar imagem de capa (header) do computador').setInputFiles('public/assets/stitch/detail.png');
  await page.getByLabel(/Apresentação e metas/).fill('Estudando React e Arquitetura\nMeta: 3 sessões por semana');
  await page.getByRole('button', { name: 'Salvar apresentação' }).click();
  await expect(page.getByText('Estudando React e Arquitetura')).toBeVisible();
  await expect.poll(async () => {
    const p = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).profile, STORAGE_KEY);
    return `${p?.avatar || ''}|${p?.header || ''}`;
  }).toMatch(/^\/api\/media\/profiles\/preview\/avatar-\d+\.(webp|png|jpg)\|\/api\/media\/profiles\/preview\/header-\d+\.(webp|png|jpg)$/);
  await page.screenshot({ path: `data/lume-${testInfo.project.name}-profile.png`, fullPage: true });
  await page.getByRole('link', { name: 'Configurações' }).click();
  await page.getByRole('combobox', { name: /^Tema/ }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByText(/movimento reduzido|modo essencial/i)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: `data/lume-${testInfo.project.name}-preferences.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('cadastro, saída, login, sincronização e recuperação na API local', async ({ page }, testInfo) => {
  const email = `react-${testInfo.project.name}-${Date.now()}@example.test`;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta ao Lume.' })).toBeVisible();
  await expect(page.locator('#main > div')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: `data/lume-${testInfo.project.name}-login.png`, fullPage: true });
  await page.getByRole('button', { name: 'Criar conta', exact: true }).first().click();
  await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa de teste');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-local-teste-123');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await page.getByRole('button', { name: 'Explorar sem personalizar agora' }).click();
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.locator('#main > div')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: `data/lume-${testInfo.project.name}-home.png`, fullPage: true });
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar curso', exact: true }).click();
  await page.getByRole('tab', { name: 'Colar a grade' }).click();
  await page.getByLabel('Nome do curso (opcional)').fill('Curso da minha conta');
  await page.getByLabel('Grade do curso').fill('Aula 1 — Primeira aula');
  await page.getByRole('button', { name: 'Organizar grade' }).click();
  await page.getByRole('button', { name: /Adicionar 1 aula à biblioteca/ }).click();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();
  await page.getByRole('button', { name: /^Menu da conta/ }).click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta ao Lume.' })).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-local-teste-123');
  await page.getByRole('button', { name: 'Entrar e ir além' }).click();
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Curso da minha conta,/ })).toBeVisible();
  await page.getByRole('button', { name: /^Menu da conta/ }).click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Solicitar recuperação' }).click();
  await expect(page.getByText(/pedido de recuperação foi registrado/)).toBeVisible();
  await page.getByRole('link', { name: 'Link de recuperação de teste' }).click();
  await page.getByLabel('Nova senha', { exact: true }).fill('nova-senha-local-123');
  await page.getByLabel('Repita a senha').fill('nova-senha-local-123');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('heading', { name: 'Acesso validado.' })).toBeVisible();
});

test('jornada 3 preserva a rotina e não gera XP ao configurar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar a prévia' }).click();
  await page.getByRole('heading', { name: 'Estudo com frequência', exact: true }).click();

  // Etapa 1: áreas
  await expect(page.getByRole('heading', { name: 'Quais áreas e trilhas você acompanha?' })).toBeVisible();
  await page.getByLabel('Áreas e trilhas').fill('programação');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Etapa 2: rotina
  await page.getByLabel('Rotina ou meta atual').fill('3 noites por semana, 40 minutos');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Etapa 3: em andamento
  await page.getByLabel('Em andamento').fill('curso de algoritmos');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Etapa 4: acompanhamento
  await page.getByText('Conclusões', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Revisão e material
  await expect(page.getByRole('heading', { name: 'Seu plano inicial' })).toBeVisible();
  await page.getByRole('button', { name: /Criar material e continuar/ }).click();
  await page.getByRole('button', { name: /Concluir e ir para Hoje/ }).click();

  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByText('Próxima ação · curso de algoritmos')).toBeVisible();

  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.onboarded).toBe(true);
  expect(state.onboarding.status).toBe('done');
  expect(state.onboarding.journey).toBe('often');
  expect(state.history).toEqual([]);
  expect(state.courses.some(course => course.title === 'curso de algoritmos' && course.origin === 'onboarding')).toBe(true);

  // Navegação das telas restantes continua funcionando
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: /^curso de algoritmos,/ }).click();
  await page.getByRole('button', { name: 'Pausar curso' }).click();
  await expect(page.getByRole('button', { name: 'Retomar curso' })).toBeVisible();
  await page.getByRole('button', { name: 'Retomar curso' }).click();
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  // Cinco destinos no menu; as telas secundárias ficam nas abas de cada seção.
  const menu = page.getByRole('navigation', { name: 'Navegação' });
  await expect(menu.getByRole('link')).toHaveCount(5);
  for (const [section, tab, heading] of [['Plano', 'Roteiro', 'Roteiro'], ['Plano', 'Tarefas', 'Tarefas'], ['Perfil', 'Conquistas', 'Sua vitrine de conquistas'], ['Perfil', 'Meu caminho', 'Meu caminho'], ['Amigos', 'Ranking', 'Ranking']]) {
    await menu.getByRole('link', { name: section, exact: true }).click();
    await page.getByRole('navigation', { name: `Seções de ${section}` }).getByRole('link', { name: tab, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  // O endereço antigo de Missões continua abrindo o Roteiro.
  await page.goto('/#missoes');
  await expect(page.getByRole('heading', { name: 'Roteiro', exact: true })).toBeVisible();
});


test('jornada 1 leva a uma primeira atividade concreta sem XP', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar a prévia' }).click();
  await page.getByRole('heading', { name: 'Quero começar', exact: true }).click();

  await page.getByLabel('Assunto').fill('fundamentos de redes');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Resultado esperado').fill('concluir a primeira aula');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByText('Já tenho um material', { exact: false }).click();
  await page.getByLabel('Nome do material').fill('Curso de redes — módulo 1');
  await page.getByLabel('Primeira atividade').fill('Assistir à aula 1 completa');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByRole('button', { name: '20 minutos' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Criar material e continuar/ }).click();
  await page.getByRole('button', { name: /Concluir e ir para Hoje/ }).click();

  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.onboarding.journey).toBe('starting');
  expect(state.history).toEqual([]);
  const material = state.courses.find(course => course.title === 'Curso de redes — módulo 1');
  expect(material.type).toBe('lesson');
  expect(material.steps[0].title).toBe('Assistir à aula 1 completa');
  // A Hoje aponta a atividade criada e usa o tempo de sessão escolhido como estimativa rotulada.
  await expect(page.getByRole('heading', { name: 'Assistir à aula 1 completa', exact: true })).toBeVisible();
  await expect(page.getByText('Reserve 20 minutos para avançar.', { exact: false })).toBeVisible();
  await expect(page.getByText('estimativa', { exact: true })).toBeVisible();
});

test('jornada 2 registra o ponto de retomada', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar a prévia' }).click();
  await page.getByRole('heading', { name: 'Estudo de vez em quando', exact: true }).click();

  await page.getByLabel('Materiais em andamento').fill('Curso de estatística');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Curso de estatística', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Onde você parou?').fill('aula 3');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByText('Esquecer onde parei', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /Criar material e continuar/ }).click();
  await page.getByRole('button', { name: /Concluir e ir para Hoje/ }).click();

  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.onboarding.journey).toBe('sometimes');
  expect(state.history).toEqual([]);
  const material = state.courses.find(course => course.title === 'Curso de estatística');
  expect(material.resumeAt).toBe('aula 3');
  expect(material.steps[0].title).toBe('Retomar em: aula 3');
});
