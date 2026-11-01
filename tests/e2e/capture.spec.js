import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { createInitialState, STORAGE_KEY } from '../../public/domain.js';

// Leitor da extensão (extension/capture.js) contra páginas de exemplo no formato
// de cada plataforma, servidas por interceptação de rota. Elas reproduzem a
// estrutura esperada, NÃO páginas reais: o formato real de cada plataforma ainda
// precisa ser conferido com uma conta (docs/IMPORTACAO.md, seção 13).

const UDEMY = `<!doctype html><html><head><title>React do zero | Udemy</title></head><body>
<header><nav><a href="/">Udemy</a><a href="/cart/">Carrinho</a></nav></header>
<h1>React do zero</h1>
<div data-purpose="curriculum-section-container">
  <div data-purpose="section-heading"><button aria-expanded="false" data-toggle="p1"><span>Seção 1: Começando</span><span>2 / 2 | 8min</span></button></div>
  <ul id="p1" hidden>
    <li data-purpose="curriculum-item-link-1"><a href="/course/react-do-zero/learn/lecture/101"><input type="checkbox" data-purpose="progress-toggle-button" aria-label="Marcar como concluída" checked><span data-purpose="item-title">1. Boas-vindas</span><span>3min</span></a></li>
    <li data-purpose="curriculum-item-link-2"><a href="/course/react-do-zero/learn/lecture/102"><input type="checkbox" data-purpose="progress-toggle-button" aria-label="Marcar como concluída" checked><span data-purpose="item-title">2. Instalação</span><span>5min</span></a></li>
  </ul>
  <div data-purpose="section-heading"><button aria-expanded="false" data-toggle="p2"><span>Seção 2: Componentes</span><span>0 / 3 | 21min</span></button></div>
  <ul id="p2" hidden>
    <li data-purpose="curriculum-item-link-3"><a href="/course/react-do-zero/learn/lecture/201"><input type="checkbox" data-purpose="progress-toggle-button" aria-label="Marcar como concluída"><span data-purpose="item-title">3. Primeiro componente</span><span>8min</span></a></li>
    <li data-purpose="curriculum-item-link-4"><a href="/course/react-do-zero/learn/lecture/202"><input type="checkbox" data-purpose="progress-toggle-button" aria-label="Marcar como concluída"><span data-purpose="item-title">4. Props</span><span>1h 2min</span></a></li>
    <li data-purpose="curriculum-item-link-5"><a href="/course/react-do-zero/learn/lecture/203"><input type="checkbox" data-purpose="progress-toggle-button" aria-label="Marcar como concluída"><span data-purpose="item-title">5. Estado</span><span>12:30</span></a></li>
  </ul>
</div>
<script>document.querySelectorAll('[data-toggle]').forEach((b)=>b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!open));document.getElementById(b.dataset.toggle).hidden=open;}));</script>
</body></html>`;

const COURSERA = `<!doctype html><html><head><title>Fundamentos de React | Coursera</title></head><body>
<nav aria-label="Principal"><a href="/browse">Explorar</a><button aria-expanded="false" aria-label="Menu do perfil">Perfil</button></nav>
<h1>Fundamentos de React</h1>
<div class="sidebar"><ul class="modules">
  <li><button aria-expanded="true">Semana 1</button><ul>
    <li><a href="/learn/react-basics/lecture/aaa1/introducao">Introdução 4 min<svg><title>Concluído</title></svg></a></li>
    <li><a href="/learn/react-basics/lecture/aaa2/jsx">JSX na prática 11 min<svg><title>Concluído</title></svg></a></li>
    <li><a href="/learn/react-basics/quiz/aaa3/teste-1">Teste 1 10 min</a></li>
  </ul></li>
  <li><button aria-expanded="true">Semana 2</button><ul>
    <li><a href="/learn/react-basics/lecture/bbb1/estado">Estado local 9 min</a></li>
    <li><a href="/learn/react-basics/lecture/bbb2/efeitos">Efeitos 14 min</a></li>
  </ul></li>
</ul></div>
<a href="/learn/react-basics/lecture/bbb3/proxima">Próxima aula</a>
</body></html>`;

const ALURA = `<!doctype html><html><head><title>React: componentes | Alura</title></head><body>
<h1>React: componentes</h1>
<section class="task-menu">
  <h3>Seção 1: Primeiros passos</h3>
  <ul>
    <li class="task-menu-nav-item"><a class="task-menu-nav-item-link task-menu-nav-item-link-VIDEO" href="/course/react-componentes/task/1001"><span class="task-menu-nav-item-svg task-menu-nav-item-svg--done"></span><span class="task-menu-nav-item-title">Apresentação</span></a></li>
    <li class="task-menu-nav-item"><a class="task-menu-nav-item-link task-menu-nav-item-link-VIDEO" href="/course/react-componentes/task/1002"><span class="task-menu-nav-item-svg"></span><span class="task-menu-nav-item-title">Criando o projeto</span></a></li>
  </ul>
  <h3>Seção 2: Componentes</h3>
  <ul>
    <li class="task-menu-nav-item"><a class="task-menu-nav-item-link task-menu-nav-item-link-VIDEO" href="/course/react-componentes/task/1003"><span class="task-menu-nav-item-svg"></span><span class="task-menu-nav-item-title">Separando em componentes</span></a></li>
  </ul>
</section></body></html>`;

const MARKETING = `<!doctype html><html><head><title>Aprenda mais</title></head><body>
<h1>Aprenda programação</h1><ul><li><a href="/planos">Planos</a></li><li><a href="/entrar">Entrar</a></li></ul></body></html>`;

async function serve(page, url, html) {
  const { origin } = new URL(url);
  await page.route(`${origin}/**`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(url);
  await page.addScriptTag({ path: 'extension/capture.js' });
}

const read = (page, options = {}) => page.evaluate((extra) => globalThis.LumeCapture.run({ pageUrl: location.href, pageTitle: '', ...extra }), options);
const lessonsOf = (result) => result.payload.disciplines[0].modules.map((module) => ({ module: module.title, lessons: module.lessons.map((lesson) => lesson.title) }));

test('Udemy: abre as seções fechadas, lê aulas, durações e conclusões, e fecha de novo', async ({ page }) => {
  await serve(page, 'https://www.udemy.com/course/react-do-zero/learn/lecture/101', UDEMY);
  const result = await read(page);
  expect(result.ok).toBe(true);
  expect(result.payload.provider.id).toBe('udemy');
  expect(result.payload.sourceUrl).toBe('https://www.udemy.com/course/react-do-zero');
  expect(result.payload.title).toBe('React do zero');
  expect(lessonsOf(result)).toEqual([
    { module: 'Seção 1: Começando', lessons: ['1. Boas-vindas', '2. Instalação'] },
    { module: 'Seção 2: Componentes', lessons: ['3. Primeiro componente', '4. Props', '5. Estado'] },
  ]);
  const lessons = result.payload.disciplines[0].modules.flatMap((module) => module.lessons);
  expect(lessons.map((lesson) => lesson.completed)).toEqual([true, true, false, false, false]);
  expect(lessons.map((lesson) => lesson.duration)).toEqual([180, 300, 480, 3720, 750]);
  expect(lessons[0].url).toBe('https://www.udemy.com/course/react-do-zero/learn/lecture/101');
  expect(result.stats).toEqual({ lessons: 5, groups: 2, disciplines: 1, completed: 2, pending: 0, truncated: false });
  // A página volta ao estado em que estava.
  await expect(page.locator('#p1')).toBeHidden();
  await expect(page.locator('#p2')).toBeHidden();
});

test('Coursera: lê a barra lateral e ignora menu, perfil e "próxima aula"', async ({ page }) => {
  await serve(page, 'https://www.coursera.org/learn/react-basics/lecture/aaa1/introducao', COURSERA);
  const result = await read(page);
  expect(result.ok).toBe(true);
  expect(result.payload.provider.id).toBe('coursera');
  expect(result.payload.sourceUrl).toBe('https://www.coursera.org/learn/react-basics');
  expect(lessonsOf(result)).toEqual([
    { module: 'Semana 1', lessons: ['Introdução', 'JSX na prática', 'Teste 1'] },
    { module: 'Semana 2', lessons: ['Estado local', 'Efeitos'] },
  ]);
  const flags = result.payload.disciplines[0].modules.flatMap((module) => module.lessons.map((lesson) => lesson.completed));
  expect(flags).toEqual([true, true, false, false, false]);
  // O botão de perfil não é uma seção e não foi clicado.
  await expect(page.getByRole('button', { name: 'Menu do perfil' })).toHaveAttribute('aria-expanded', 'false');
});

test('Alura: lê as seções por título e a conclusão pela classe do ícone', async ({ page }) => {
  await serve(page, 'https://cursos.alura.com.br/course/react-componentes/task/1001', ALURA);
  const result = await read(page);
  expect(result.ok).toBe(true);
  expect(result.payload.provider.id).toBe('alura');
  expect(result.payload.sourceUrl).toBe('https://cursos.alura.com.br/course/react-componentes');
  expect(lessonsOf(result)).toEqual([
    { module: 'Seção 1: Primeiros passos', lessons: ['Apresentação', 'Criando o projeto'] },
    { module: 'Seção 2: Componentes', lessons: ['Separando em componentes'] },
  ].map((entry) => entry));
  expect(result.stats.completed).toBe(1);
});

test('página sem lista de aulas não vira curso', async ({ page }) => {
  await serve(page, 'https://www.example-escola.com.br/home', MARKETING);
  const result = await read(page);
  expect(result).toEqual({ ok: false, reason: 'no_lessons' });
});

// ---------- Recebimento no Lume ----------

async function openLume(page) {
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.setItem('lume.preview-session.v1', 'open');
  }, { key: STORAGE_KEY, state: { ...createInitialState(), onboarded: true } });
  await page.goto('/#biblioteca');
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
}

function captured(done) {
  const lesson = (title, completed, n) => ({ title, url: `https://www.udemy.com/course/react-do-zero/learn/lecture/${n}`, duration: 300, completed });
  return {
    title: 'React do zero',
    provider: { id: 'udemy' },
    sourceUrl: 'https://www.udemy.com/course/react-do-zero',
    completionSource: 'lesson-flags',
    disciplines: [{ title: 'Conteúdo do curso', modules: [{ title: 'Começando', lessons: [lesson('Boas-vindas', done >= 1, 1), lesson('Instalação', done >= 2, 2), lesson('Primeiro componente', done >= 3, 3)] }] }],
    extraction: { kind: 'extension-capture', confidence: 'medium', notes: [] },
    completeness: 'partial',
  };
}

function deliver(page, payload, id, type = 'capture') {
  return page.evaluate(({ payload: body, id: messageId, kind }) => new Promise((resolve) => {
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'lume' && event.data.id === messageId) resolve(event.data);
    });
    window.postMessage({ source: 'lume-extension', type: kind, id: messageId, payload: body }, location.origin);
  }), { payload, id, kind: type });
}

test('o Lume recebe a leitura da extensão, importa como histórico e depois registra só o que é novo', async ({ page }) => {
  await openLume(page);

  const ack = await deliver(page, captured(1), 'leitura-1');
  expect(ack).toMatchObject({ type: 'capture-ack', accepted: true });
  await expect(page.getByRole('heading', { name: 'React do zero' })).toBeVisible();
  await expect(page.getByText('Lido pela extensão na sua conta').first()).toBeVisible();
  await expect(page.getByText('3 de 3 aulas selecionadas')).toBeVisible();
  await page.getByRole('button', { name: /Adicionar 3 aulas à biblioteca/ }).click();
  await expect(page.getByText('XP concedido agora: 0')).toBeVisible();
  await expect(page.getByText(/1 aula já constava como concluída/)).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();

  // Segunda leitura: o curso já existe e uma aula nova aparece concluída.
  await deliver(page, captured(2), 'leitura-2');
  await expect(page.getByText(/já está na sua biblioteca/)).toBeVisible();
  const checkbox = page.getByRole('checkbox', { name: /Registrar 1 aula concluída na plataforma/ });
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: /Adicionar 3 aulas à biblioteca/ }).click();
  await expect(page.getByText(/1 conclusão registrada com origem na plataforma/)).toBeVisible();

  const log = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).studyLog.map(({ lessonTitle, origin, historical }) => ({ lessonTitle, origin, historical: Boolean(historical) })), STORAGE_KEY);
  expect(log).toEqual([
    { lessonTitle: 'Boas-vindas', origin: 'import', historical: true },
    { lessonTitle: 'Instalação', origin: 'integration', historical: false },
  ]);
});

test('mensagem repetida é confirmada de novo sem abrir outra revisão e payload inválido vira erro legível', async ({ page }) => {
  await openLume(page);
  await deliver(page, captured(0), 'repetida');
  await expect(page.getByRole('heading', { name: 'React do zero' })).toBeVisible();
  const again = await deliver(page, captured(0), 'repetida');
  expect(again.accepted).toBe(true);

  await page.keyboard.press('Escape');
  await deliver(page, { title: 'Quebrado', disciplines: 'nada' }, 'quebrada');
  await expect(page.getByRole('heading', { name: 'Não encontrei aulas nesse texto' })).toBeVisible();
});

test('Gran: o endereço do curso mantém o código e descarta o vídeo', async ({ page }) => {
  await serve(page, 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/Eclic28vUz4%3D/v/wyZ8GPyhbUc%3D', MARKETING);
  const course = await page.evaluate(() => globalThis.LumeCapture.courseUrlFor(location.href));
  expect(course).toBe('https://www.grancursosonline.com.br/aluno/curso/video/codigo/Eclic28vUz4%3D');
});

// Trecho real do painel do curso do Gran (estrutura e rótulos copiados da página
// de uma conta, sem dados pessoais): disciplina → aula → vídeos.
test('Gran: lê disciplina, aulas e vídeos do painel real, com duração e código do curso', async ({ page }) => {
  const html = fs.readFileSync('tests/fixtures/gran-painel.html', 'utf8');
  await serve(page, 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/Eclic28vUz4%3D/v/wyZ8GPyhbUc%3D', html);
  const result = await read(page);
  expect(result.ok).toBe(true);
  const { payload } = result;
  expect(payload.provider.id).toBe('grancursos');
  expect(payload.title).toBe('1ª Fase OAB — 47º Exame — Preparação Total (Curso Extensivo Completo)');
  expect(payload.externalId).toBe('204594');
  expect(payload.sourceUrl).toBe('https://www.grancursosonline.com.br/aluno/curso/video/codigo/Eclic28vUz4%3D');
  expect(payload.disciplines).toHaveLength(1);
  expect(payload.disciplines[0].title).toBe('1ª Fase OAB - Ciclos de Estudos Teóricos');
  const modules = payload.disciplines[0].modules;
  expect(modules.map((module) => module.title)).toEqual(['Aula 1 - Direito Constitucional', 'Aula 2 - Direito Administrativo', 'Aula 3 - Direito Processual Civil', 'Aula 4 - Direito Empresarial', 'Aula 5 - Direito Penal']);
  expect(modules.map((module) => module.lessons.length)).toEqual([5, 5, 5, 5, 4]);
  const first = modules[0].lessons[0];
  expect(first.title).toMatch(/^1 - Classificação da Constituição/);
  expect(first.title).not.toMatch(/Professor|Estude de forma/);
  expect(first.duration).toBe(2378);
  expect(first.url).toContain('/aluno/curso/video/codigo/Eclic28vUz4%3D/v/');
  expect(first.completed).toBe(false);
});

// Estrutura que só existe depois de abrir: disciplina → aula → vídeos, criada sob
// demanda (como um app Vue/React que não renderiza o que está fechado).
const LAZY = `<!doctype html><html><head><title>Curso</title></head><body>
<p role="heading" aria-level="1">Curso preguiçoso (Código: 77)</p><button role="tab">Conteúdo</button><a href="/aluno/curso/video/codigo/XYZ/v/9/c/1">Retomar</a><div id="root"></div>
<script>
const data = { 'Direito A': [['Aula 1 - Tema um', ['1 - Parte um 00:10:00', '2 - Parte dois 00:20:00'], false], ['Aula 2 - Tema dois', ['1 - Outra 00:05:00', '2 - Mais uma 00:06:00', '3 - Fim 00:07:00'], true]], 'Direito B': [['Aula 1 - Tema tres', ['1 - B um 00:01:00', '2 - B dois 00:02:00'], false]] };
const EXCLUSIVE = false, DELAY = 0;
const root = document.getElementById('root');
const el = (html) => { const t = document.createElement('div'); t.innerHTML = html; return t.firstElementChild; };
for (const [name, topics] of Object.entries(data)) {
  const wrap = el('<div></div>');
  const head = el('<div role="button" tabindex="0" aria-expanded="false" aria-label="Disciplina ' + name + ' - 0% concluído"><p>' + name + '</p></div>');
  const body = el('<div></div>');
  head.addEventListener('click', () => {
    const open = head.getAttribute('aria-expanded') === 'true';
    if (EXCLUSIVE && !open) document.querySelectorAll('[aria-label^="Disciplina"]').forEach((other) => { if (other !== head && other.getAttribute('aria-expanded') === 'true') other.click(); });
    head.setAttribute('aria-expanded', String(!open));
    body.replaceChildren();
    if (open) return;
    for (const [topic, videos, done] of topics) {
      const th = el('<button aria-expanded="false" aria-label="' + topic + '"><h2>Tópico</h2>' + (done ? '<span>CONCLUÍDO</span>' : '') + '<p>' + topic + '</p></button>');
      const tb = el('<div></div>');
      th.addEventListener('click', () => {
        const o = th.getAttribute('aria-expanded') === 'true';
        th.setAttribute('aria-expanded', String(!o));
        tb.replaceChildren();
        if (o) return;
        setTimeout(() => videos.forEach((v, i) => tb.append(el('<div><button aria-label="Marcar aula como Assistida"></button><a href="/aluno/curso/video/codigo/XYZ/v/' + name + '-' + topic + '-' + i + '"><p>' + v.slice(0, -9) + '</p></a><span>' + v.slice(-8) + '</span></div>'))), DELAY);
      });
      body.append(th, tb);
    }
  });
  wrap.append(head, body); root.append(wrap);
}
</script></body></html>`;

test('abre disciplinas e aulas que só são criadas ao clicar e fecha tudo depois', async ({ page }) => {
  await serve(page, 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/XYZ/v/1', LAZY);
  const result = await read(page);
  expect(result.ok).toBe(true);
  expect(result.payload.externalId).toBe('77');
  expect(result.stats).toMatchObject({ lessons: 7, disciplines: 2, groups: 3, pending: 0 });
  expect(result.payload.disciplines.map((discipline) => discipline.title)).toEqual(['Direito A', 'Direito B']);
  const modules = result.payload.disciplines[0].modules;
  expect(modules.map((module) => module.lessons.length)).toEqual([2, 3]);
  // Selo "Concluído" da aula 2 vale para os vídeos dela.
  expect(modules[1].lessons.every((lesson) => lesson.completed)).toBe(true);
  expect(modules[0].lessons.some((lesson) => lesson.completed)).toBe(false);
  expect(modules[0].lessons[0].duration).toBe(600);
  await expect(page.locator('[aria-expanded="true"]')).toHaveCount(0);
});

test('seção sem vídeos carregados entra como um item só, com o selo, e a leitura avisa', async ({ page }) => {
  const withEmpty = LAZY.replace("['Aula 2 - Tema dois'", "['Aula 3 - Sem video', [], true], ['Aula 2 - Tema dois'");
  await serve(page, 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/XYZ/v/1', withEmpty);
  const result = await read(page);
  expect(result.ok).toBe(true);
  expect(result.stats).toMatchObject({ lessons: 8, pending: 1 });
  const empty = result.payload.disciplines[0].modules.find((module) => module.title === 'Aulas cujos vídeos não foram lidos');
  expect(empty.lessons).toEqual([{ title: 'Aula 3 - Sem video', url: '', duration: null, completed: true }]);
  // O módulo não repete o nome da aula: nada aparece duas vezes.
  expect(result.payload.disciplines[0].modules.some((module) => module.title === 'Aula 3 - Sem video')).toBe(false);
  expect(result.payload.warnings.join(' ')).toMatch(/1 seção não abriu/);
});

test('"Concluí esta aula" abre a aula certa pelo endereço da página e só registra depois da confirmação', async ({ page }) => {
  await openLume(page);
  await deliver(page, captured(0), 'leitura');
  await page.getByRole('button', { name: /Adicionar 3 aulas à biblioteca/ }).click();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();

  // A página da aula tem um complemento depois do endereço da aula.
  const ack = await deliver(page, { url: 'https://www.udemy.com/course/react-do-zero/learn/lecture/2/extra?x=1', title: 'Aula' }, 'concluir-1', 'complete');
  expect(ack.accepted).toBe(true);
  await expect(page.getByRole('heading', { name: 'Instalação' })).toBeVisible();
  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).completed.length, STORAGE_KEY);
  expect(before).toBe(0);
  await page.getByRole('button', { name: 'Concluí esta aula' }).click();
  const log = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).studyLog.map(({ lessonTitle, origin }) => ({ lessonTitle, origin })), STORAGE_KEY);
  expect(log).toEqual([{ lessonTitle: 'Instalação', origin: 'manual' }]);
});

test('"Concluí esta aula" fora dos cursos importados é recusado sem abrir nada', async ({ page }) => {
  await openLume(page);
  await deliver(page, captured(0), 'leitura');
  await page.getByRole('button', { name: /Adicionar 3 aulas à biblioteca/ }).click();
  await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();

  const other = await deliver(page, { url: 'https://www.udemy.com/course/outro-curso/learn/lecture/2' }, 'concluir-2', 'complete');
  expect(other).toMatchObject({ accepted: false, reason: 'not_found' });
  // A página do curso (sem aula) não casa com todas as aulas.
  const course = await deliver(page, { url: 'https://www.udemy.com/course/react-do-zero' }, 'concluir-3', 'complete');
  expect(course).toMatchObject({ accepted: false, reason: 'not_found' });
  await expect(page.getByRole('button', { name: 'Concluí esta aula' })).toHaveCount(0);
});

test('site que fecha as outras disciplinas e entrega os vídeos com atraso: lê todas, uma por vez', async ({ page }) => {
  const exclusive = LAZY.replace('const EXCLUSIVE = false, DELAY = 0;', 'const EXCLUSIVE = true, DELAY = 600;');
  await serve(page, 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/XYZ/v/1', exclusive);
  const result = await read(page);
  expect(result.ok).toBe(true);
  expect(result.stats).toMatchObject({ lessons: 7, disciplines: 2, pending: 0 });
  expect(result.payload.disciplines.map((discipline) => discipline.title)).toEqual(['Direito A', 'Direito B']);
  const titles = result.payload.disciplines.flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.title)));
  // "Conteúdo" (aba) e "Retomar" (atalho) não são aulas, e nada se repete.
  expect(titles).not.toContain('Retomar');
  expect(titles).not.toContain('Conteúdo');
  expect(new Set(titles.map((title, index) => `${title}${index}`)).size).toBe(7);
  expect(result.payload.disciplines[1].modules[0].lessons.map((lesson) => lesson.title)).toEqual(['1 - B um', '2 - B dois']);
});
