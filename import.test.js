import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allLessonIds, applyCourseImport, canonicalUrl, completeLesson, courseSummary, findLessonByUrl,
  deliveryCandidates, detectProvider, editalCoverage, lessonOrigin, normalizeImportUrl, normalizePayload,
  providerCapabilities, revertLessonCompletion,
} from './public/import-domain.js';
import {
  ImportError, analyzeSnapshot, analyzeUrl, assertPublicHttpUrl, extractFromHtml, parseSyllabusText,
} from './import-server.js';
import { createInitialState, restoreState, totalXP, courseStatus, weekCount } from './public/domain.js';
import { completedUnitIds, isCompleted } from './public/progress-domain.js';

const eventFor = (state, unitId) => state.progress.find((item) => item.unitId === unitId);

const UDEMY_PAGE = `<!doctype html><html><head>
<title>Curso de React do zero | Udemy</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[{"@type":"Course","@id":"https://www.udemy.com/course/react-zero/","name":"React do zero",
"description":"Curso completo de React","provider":{"@type":"Organization","name":"Udemy"},
"hasPart":[{"@type":"Course","name":"Fundamentos"},{"@type":"Course","name":"Hooks"},{"@type":"Course","name":"Projeto final"}]}]}
</script></head><body><h1>React do zero</h1><nav><li>Entrar</li><li>Planos</li></nav></body></html>`;

const ALURA_PAGE = `<!doctype html><html><head><title>Formação Front-end | Alura</title><meta property="og:title" content="Formação Front-end"></head>
<body>
<nav><ul><li>Entrar</li><li>Cursos</li><li>Planos</li></ul></nav>
<h1>Formação Front-end</h1>
<h2>O que você vai aprender</h2>
<h3>Módulo 1 — HTML e CSS</h3>
<ul><li>Aula 1 — Estrutura de uma página</li><li>Aula 2 — Estilos e layout</li><li>Aula 3 — Responsividade</li></ul>
<h3>Módulo 2 — JavaScript</h3>
<ul><li>Aula 1 — Variáveis e funções</li><li>Aula 2 — DOM</li><li>Aula 3 — Fetch e APIs</li></ul>
</body></html>`;

// Painel de curso como aparece para quem está logado: sem seção de ementa,
// aulas em links com identificador e disciplinas nos títulos.
const LOGGED_COURSE_PAGE = `<!doctype html><html><head><title>OAB — 1ª fase | Gran Cursos Online</title></head>
<body>
<header><nav><a href="/">Início</a><a href="/meus-cursos">Meus cursos</a><a href="/planos">Planos</a></nav></header>
<div class="app"><aside class="sidebar">
<h1>OAB — 1ª fase</h1>
<h3>Direito Constitucional</h3>
<ul>
<li><a href="/curso/123/aula/456">Aula 1 — Conceito e fontes</a></li>
<li><a href="/curso/123/aula/457">Aula 2 — Direitos fundamentais</a></li>
<li><a href="/curso/123/aula/458">Aula 3 — Remédios constitucionais</a></li>
</ul>
<h3>Direito Tributário</h3>
<ul>
<li><a href="/curso/123/aula/459">Aula 1 — Fato gerador</a></li>
<li><a href="/curso/123/aula/460">Aula 2 — Obrigação tributária</a></li>
<li><a href="/curso/123/aula/461">Aula 3 — Crédito tributário</a></li>
</ul>
</aside><main><p>Bem-vindo ao curso. Conclua as aulas no seu ritmo.</p></main></div>
</body></html>`;

function fakeResponse(body, { status = 200, headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => lower[name.toLowerCase()] ?? null },
    body: null,
    text: async () => body,
  };
}

test('identifica plataformas e mantém a fonte desconhecida honesta', () => {
  assert.equal(detectProvider('https://www.grancursosonline.com.br/curso/oab').id, 'grancursos');
  assert.equal(detectProvider('https://www.alura.com.br/curso-online-react').id, 'alura');
  assert.equal(detectProvider('https://sub.rocketseat.com.br/trilha').id, 'rocketseat');
  const unknown = detectProvider('https://exemplo-de-curso.com.br/a');
  assert.equal(unknown.id, 'unknown');
  assert.match(unknown.note, /sem adaptador próprio/);
  assert.equal(detectProvider('javascript:alert(1)').id, 'unknown');
});

test('canonicaliza URLs sem rastreamento e recusa esquemas perigosos', () => {
  assert.equal(canonicalUrl('https://www.Alura.com.br/curso/?utm_source=x&aula=2#topo'), 'https://alura.com.br/curso?aula=2');
  assert.equal(canonicalUrl('javascript:alert(1)'), '');
  assert.equal(canonicalUrl('https://user:senha@site.com/x'), '');
});

test('normaliza a grade, gera ids estáveis e descarta links inválidos', () => {
  const raw = {
    title: 'Curso de teste',
    provider: { id: 'alura' },
    sourceUrl: 'https://www.alura.com.br/curso?utm_campaign=x',
    disciplines: [{
      title: 'Direito Constitucional',
      modules: [{ title: 'Princípios', lessons: [
        { title: 'Conceito', duration: '12:30', url: 'https://alura.com.br/aula/1' },
        { title: 'Conceito', duration: '12:30' },
        { title: 'Fontes', url: 'javascript:alert(1)' },
      ] }],
    }],
  };
  const payload = normalizePayload(raw);
  const ids = allLessonIds(payload);
  assert.equal(ids.length, 2, 'aula repetida não duplica');
  assert.equal(payload.lessonCount, 2);
  assert.equal(payload.disciplines[0].modules[0].lessons[1].url, '');
  assert.equal(normalizePayload(raw).identity, payload.identity, 'identidade é estável entre análises');
  assert.equal(payload.provider.id, 'alura');
  assert.ok(providerCapabilities(payload.provider, 'structured-data').every((item) => item.label));
  assert.throws(() => normalizePayload({ title: 'x', disciplines: [] }));
});

test('organiza texto colado por disciplina, módulo e aula', () => {
  const text = [
    'Disciplina: Direito Constitucional',
    'Módulo: Princípios fundamentais',
    'Aula 1 — Conceito e fontes',
    'Aula 2 — Direitos fundamentais',
    'Disciplina: Direito Tributário',
    'Módulo: Obrigação tributária',
    'Aula 1 — Fato gerador',
  ].join('\n');
  const result = parseSyllabusText(text, { title: 'OAB 1ª fase' });
  assert.equal(result.title, 'OAB 1ª fase');
  assert.equal(result.disciplines.length, 2);
  assert.equal(result.disciplines[0].modules[0].lessons.length, 2);
  assert.equal(result.extraction.kind, 'pasted-text');
  const payload = normalizePayload(result, { sourceUrl: '' });
  assert.equal(allLessonIds(payload).length, 3);
});

test('aceita markdown e numeração sem inventar aulas', () => {
  const markdown = parseSyllabusText(['# Trilha front-end', '## Módulo A', '### Aula um', '### Aula dois', '## Módulo B', '- Aula três'].join('\n'));
  assert.equal(markdown.title, 'Trilha front-end');
  assert.equal(markdown.disciplines.length, 1);
  assert.equal(markdown.disciplines[0].modules.length, 2);
  assert.equal(markdown.disciplines[0].modules[0].lessons.length, 2);
  const numbered = parseSyllabusText(['1. Fundamentos', '1.1 Instalação', '1.1.1 Baixar o editor', '1.1.2 Primeiro projeto'].join('\n'));
  assert.equal(numbered.disciplines.length, 1);
  assert.equal(numbered.disciplines[0].modules[0].lessons.length, 2);
  assert.throws(() => parseSyllabusText('   '), ImportError);
});

test('lê dados estruturados (schema.org) de uma página como a da Udemy', () => {
  const extracted = extractFromHtml(UDEMY_PAGE, 'https://www.udemy.com/course/react-zero/');
  assert.equal(extracted.extraction.kind, 'structured-data');
  assert.equal(extracted.title, 'React do zero');
  assert.equal(extracted.provider.id, 'udemy');
  assert.equal(extracted.lessonCount, 3);
  const lessons = extracted.disciplines[0].modules[0].lessons.map((lesson) => lesson.title);
  assert.deepEqual(lessons, ['Fundamentos', 'Hooks', 'Projeto final']);
});

test('infere a estrutura visível sem levar o menu de navegação', () => {
  const extracted = extractFromHtml(ALURA_PAGE, 'https://www.alura.com.br/formacao-front-end');
  assert.equal(extracted.extraction.kind, 'page-outline');
  assert.equal(extracted.lessonCount, 6);
  const titles = extracted.disciplines.flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.title)));
  assert.ok(titles.some((title) => /Estrutura de uma página/.test(title)));
  assert.ok(!titles.includes('Entrar'));
  assert.ok(!titles.includes('Planos'));
});

test('página sem grade não vira curso vazio', () => {
  const extracted = extractFromHtml('<html><body><h1>Bem-vindo</h1><p>Faça login para ver o curso.</p></body></html>', 'https://www.grancursosonline.com.br/curso/x');
  assert.equal(extracted.lessonCount, 0);
});

test('página copiada de um curso logado é lida sem receber a sessão', () => {
  const url = 'https://www.grancursosonline.com.br/curso/oab';
  assert.equal(extractFromHtml(LOGGED_COURSE_PAGE, url).lessonCount, 0, 'a leitura da página pública não acha aulas aqui');
  const analysis = analyzeSnapshot(LOGGED_COURSE_PAGE, url);
  assert.equal(analysis.extraction.kind, 'page-snapshot');
  assert.equal(analysis.completeness, 'partial');
  assert.equal(analysis.provider.id, 'grancursos');
  assert.match(analysis.warnings.join(' '), /não recebeu senha, cookie nem sessão/i);
  const titles = analysis.disciplines.flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.title)));
  assert.equal(titles.length, 6);
  assert.ok(titles.includes('Aula 1 — Conceito e fontes'));
  assert.ok(!titles.includes('Meus cursos'), 'menu não vira aula');
  assert.ok(!titles.includes('Planos'), 'menu não vira aula');
  assert.deepEqual(analysis.disciplines[0].modules.map((module) => module.title), ['Direito Constitucional', 'Direito Tributário']);

  const payload = normalizePayload(analysis, { sourceUrl: analysis.sourceUrl });
  assert.equal(allLessonIds(payload).length, 6);
  assert.equal(payload.extraction.kind, 'page-snapshot');
  assert.equal(payload.sourceUrl, 'https://grancursosonline.com.br/curso/oab');
  assert.equal(payload.capabilities.find((item) => item.id === 'syllabus').value, 'Parcial, a partir da página que você copiou já logada');
  assert.match(payload.capabilities.find((item) => item.id === 'account').value, /página aberta com a sua conta/i);
  assert.equal(payload.capabilities.find((item) => item.id === 'progress').available, true, 'o Gran declara ler a marca de concluído');

  assert.throws(() => analyzeSnapshot('<html><body><h1>Entre na sua conta</h1><p>Faça login para ver o curso.</p></body></html>', url), (error) => error.code === 'no_syllabus');
  assert.throws(() => analyzeSnapshot('<html></html>', url), (error) => error.code === 'empty_text');
});

test('progresso já marcado na página copiada entra como histórico sem XP', () => {
  const url = 'https://www.grancursosonline.com.br/curso/oab';
  const completedPage = LOGGED_COURSE_PAGE.replace(
    '<li><a href="/curso/123/aula/456">',
    '<li class="completed"><a href="/curso/123/aula/456">',
  );
  const completedTitle = LOGGED_COURSE_PAGE.match(/<li><a href="\/curso\/123\/aula\/456">([^<]+)<\/a>/)?.[1] || '';
  const analysis = analyzeSnapshot(completedPage, url);
  assert.deepEqual(analysis.completedTitles, [completedTitle]);
  const payload = normalizePayload(analysis, { sourceUrl: analysis.sourceUrl });
  assert.equal(payload.completedCount, 1);
  const state = applyCourseImport(createInitialState(), payload, { now: '2026-10-31T12:00:00Z' });
  const course = state.courses[0];
  const first = course.steps.find((step) => step.title === completedTitle);
  assert.ok(isCompleted(state, first.id));
  const entry = eventFor(state, first.id);
  assert.equal(entry.origin, 'import');
  assert.equal(entry.historical, true);
  assert.equal(totalXP(state), 0);
  assert.equal(courseSummary(state, course).importedDone, 1);
  assert.equal(lessonOrigin(state, first.id), 'import');
  assert.equal(revertLessonCompletion(state, course.id, first.id).reverted, false, 'progresso importado não vira conclusão manual');
});

test('bloqueia endereços internos, credenciais e portas incomuns', () => {
  for (const value of ['http://localhost/x', 'http://127.0.0.1/', 'http://169.254.169.254/latest', 'http://10.0.0.5/', 'http://[::1]/', 'https://user:senha@site.com/', 'https://site.com:8080/x', 'file:///etc/passwd']) {
    assert.throws(() => assertPublicHttpUrl(value), ImportError, value);
  }
  assert.equal(assertPublicHttpUrl('https://www.alura.com.br/curso').hostname, 'www.alura.com.br');
  assert.equal(assertPublicHttpUrl('http://exemplo.com.br/aula').pathname, '/aula');
});

test('a busca valida cada salto do redirecionamento', async () => {
  let calls = 0;
  const redirectToPrivate = async () => {
    calls += 1;
    return fakeResponse('', { status: 302, headers: { location: 'http://127.0.0.1/segredo' } });
  };
  await assert.rejects(() => analyzeUrl('https://curso.exemplo.com/', { fetchImpl: redirectToPrivate }), (error) => error.code === 'blocked_host');
  assert.equal(calls, 1, 'não conecta no destino bloqueado');

  const protectedPage = async () => fakeResponse('', { status: 403 });
  await assert.rejects(() => analyzeUrl('https://www.grancursosonline.com.br/curso/x', { fetchImpl: protectedPage }), (error) => error.code === 'protected');

  const noSyllabus = async () => fakeResponse('<html><body><h1>Curso</h1></body></html>');
  await assert.rejects(() => analyzeUrl('https://www.alura.com.br/curso', { fetchImpl: noSyllabus }), (error) => error.code === 'no_syllabus');

  const ok = async () => fakeResponse(ALURA_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  const result = await analyzeUrl('https://www.alura.com.br/formacao-front-end', { fetchImpl: ok });
  assert.equal(result.completeness, 'partial');
  assert.equal(result.extraction.kind, 'page-outline');
  assert.match(result.warnings.join(' '), /grade/i);
});

test('importar não concede XP e cria curso tipado com disciplinas', () => {
  const payload = normalizePayload({
    title: 'OAB — Gran Cursos',
    provider: { id: 'grancursos' },
    sourceUrl: 'https://www.grancursosonline.com.br/curso/oab',
    completeness: 'partial',
    extraction: { kind: 'page-outline', confidence: 'medium', notes: [] },
    disciplines: [
      { title: 'Direito Constitucional', modules: [{ title: 'Princípios', lessons: [{ title: 'Aula 1' }, { title: 'Aula 2' }] }] },
      { title: 'Direito Tributário', modules: [{ title: 'Obrigação', lessons: [{ title: 'Aula 1' }] }] },
    ],
  });
  const state = applyCourseImport(createInitialState(), payload);
  const course = state.courses.at(-1);
  assert.equal(state.courses.length, 1);
  assert.equal(course.steps.length, 3);
  assert.equal(course.structure.length, 2);
  assert.equal(course.source.provider, 'grancursos');
  assert.equal(course.source.completeness, 'partial');
  assert.equal(totalXP(state), 0, 'importar organiza, não recompensa');
  assert.equal(state.progress.length, 0);
  assert.equal(state.imports.length, 1);
  assert.equal(courseStatus(state, course), 'new');
  assert.equal(courseSummary(state, course).partial, true);
});

test('importação parcial seleciona disciplinas sem marcar o curso inteiro como concluído', () => {
  const payload = normalizePayload({
    title: 'Curso', provider: { id: 'alura' },
    disciplines: [
      { title: 'Área A', modules: [{ title: 'M1', lessons: [{ title: 'A1' }, { title: 'A2' }] }] },
      { title: 'Área B', modules: [{ title: 'M1', lessons: [{ title: 'B1' }] }] },
    ],
  });
  const areaA = payload.disciplines[0].modules[0].lessons.map((lesson) => lesson.id);
  let state = applyCourseImport(createInitialState(), payload, { selectedLessonIds: areaA });
  const course = state.courses.at(-1);
  assert.equal(course.steps.length, 2);
  state = completeLesson(state, course.id, areaA[0]).state;
  state = completeLesson(state, course.id, areaA[1]).state;
  assert.equal(courseSummary(state, course).percent, 100);
  assert.equal(courseStatus(state, course), 'completed');
  assert.equal(courseSummary(state, course).partial, true, 'grade parcial continua visível');
  assert.equal(totalXP(state), 0);
});

test('reimportar preserva conclusões, aulas removidas e não duplica o curso', () => {
  const base = {
    title: 'OAB', provider: { id: 'grancursos' }, sourceUrl: 'https://www.grancursosonline.com.br/curso/oab',
    disciplines: [{ title: 'Constitucional', modules: [{ title: 'M1', lessons: [{ title: 'Aula 1' }, { title: 'Aula 2' }] }] }],
  };
  const first = normalizePayload(base);
  let state = applyCourseImport(createInitialState(), first);
  const course = state.courses.at(-1);
  const firstLesson = course.steps[0].id;
  state = completeLesson(state, course.id, firstLesson).state;
  const totalCourses = state.courses.length;

  const updated = normalizePayload({
    ...base,
    disciplines: [{ title: 'Constitucional', modules: [{ title: 'M1', lessons: [{ title: 'Aula 2' }, { title: 'Aula 3' }] }] }],
  });
  state = applyCourseImport(state, updated, { selectedLessonIds: allLessonIds(updated), mode: 'update', courseId: course.id });

  assert.equal(state.courses.length, totalCourses, 'sem duplicata');
  const merged = state.courses.find((item) => item.source?.identity === updated.identity);
  assert.equal(merged.id, course.id);
  assert.deepEqual([...completedUnitIds(state)], [firstLesson], 'conclusão preservada');
  assert.ok(merged.steps.some((step) => step.id === firstLesson), 'aula removida da fonte continua no curso');
  assert.ok(merged.steps.some((step) => step.title === 'Aula 3'));
  assert.equal(merged.source.importedAt, course.source.importedAt);
  assert.equal(state.progress.length, 1, 'histórico preservado');
  assert.equal(state.imports.length, 2);
});

test('conclusão manual é registrada sem XP e pode ser desfeita sem apagar o histórico', () => {
  const payload = normalizePayload({
    title: 'Curso', provider: { id: 'dio' },
    disciplines: [{ title: 'Área', modules: [{ title: 'M', lessons: [{ title: 'Aula' }] }] }],
  });
  let state = applyCourseImport(createInitialState(), payload);
  const course = state.courses.at(-1);
  const lessonId = course.steps[0].id;
  const result = completeLesson(state, course.id, lessonId, { origin: 'manual', now: '2026-10-30T10:00:00Z' });
  assert.equal(result.added, true);
  assert.equal(result.xp, 0);
  state = result.state;
  assert.equal(courseSummary(state, course).done, 1);
  assert.equal(lessonOrigin(state, lessonId), 'manual');
  assert.equal(totalXP(state), 0);
  assert.equal(weekCount(state, new Date('2026-10-30T12:00:00Z')), 1);
  assert.equal(completeLesson(state, course.id, lessonId).added, false, 'sem duplicar');

  const undone = revertLessonCompletion(state, course.id, lessonId, { now: '2026-10-30T11:00:00Z' });
  assert.equal(undone.reverted, true);
  assert.equal(completedUnitIds(undone.state).size, 0);
  assert.equal(undone.state.progress[0].revertedAt, '2026-10-30T11:00:00Z');
  assert.equal(weekCount(undone.state, new Date('2026-10-30T12:00:00Z')), 0);
});

test('o estado importado sobrevive à restauração e aceita dados legados sem studyLog', () => {
  const payload = normalizePayload({
    title: 'Curso', provider: { id: 'alura' }, sourceUrl: 'https://www.alura.com.br/curso',
    disciplines: [{ title: 'Área', modules: [{ title: 'M', lessons: [{ title: 'Aula 1' }, { title: 'Aula 2' }] }] }],
  });
  let state = applyCourseImport(createInitialState(), payload);
  state = completeLesson(state, state.courses.at(-1).id, state.courses.at(-1).steps[0].id).state;
  const restored = restoreState(JSON.stringify(state));
  const course = restored.courses.at(-1);
  assert.equal(course.source.identity, payload.identity);
  assert.equal(course.structure.length, 1);
  assert.equal(restored.progress.length, 1);
  assert.equal(completedUnitIds(restored).size, completedUnitIds(state).size);

  // Documento v1 de antes do studyLog: lido sem erro e sem progresso inventado.
  const legacy = { ...createInitialState(), version: 1, completed: [], history: [] };
  delete legacy.progress;
  delete legacy.imports;
  const legacyRestored = restoreState(JSON.stringify(legacy));
  assert.deepEqual(legacyRestored.progress, []);
  assert.equal(legacyRestored.courses.length, 0);

  const broken = { ...state, progress: [{ id: 'x' }, ...state.progress] };
  assert.equal(restoreState(JSON.stringify(broken)).progress.length, 1, 'registro inválido não derruba o progresso');
});

test('cobertura de edital pede edição e fase e não inventa grade', () => {
  const course = { title: 'OAB', structure: [{ title: 'Direito Constitucional' }, { title: 'Direito Penal' }] };
  const unknown = editalCoverage(course, {});
  assert.equal(unknown.available, false);
  assert.equal(unknown.requested.exam, 'OAB');
  assert.match(unknown.message, /não há edital verificado/i);
  assert.equal(unknown.covered, undefined);
});

test('entregas do GitHub entram como sugestão que exige validação', () => {
  const candidates = deliveryCandidates({ name: 'api', issues: [{ title: 'Implementar login', state: 'open', milestone: 'v1' }, { title: 'Fechada', state: 'closed' }] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].requiresValidation, true);
  assert.match(candidates[0].note, /não significa projeto incompleto/i);
});

test('link colado é normalizado antes da detecção, sem inventar URL', () => {
  assert.equal(normalizeImportUrl('https://www.coursera.org/learn/react'), 'https://www.coursera.org/learn/react');
  assert.equal(normalizeImportUrl('www.coursera.org/learn/react'), 'https://www.coursera.org/learn/react');
  assert.equal(normalizeImportUrl('coursera.org/learn/react'), 'https://coursera.org/learn/react');
  assert.equal(normalizeImportUrl('  https://www.alura.com.br/formacao  '), 'https://www.alura.com.br/formacao');
  assert.equal(normalizeImportUrl('nao-e-um-link'), null);
  assert.equal(normalizeImportUrl('https://user:senha@exemplo.com/curso'), null);
  assert.equal(normalizeImportUrl('javascript:alert(1)'), null);
  assert.equal(normalizeImportUrl('cole aqui https://exemplo.com/curso'), null);
});

// Leitura enviada pela extensão: cada aula traz a própria marca de concluída.
function extensionCapture(done) {
  const lesson = (title, completed) => ({ title, url: `https://www.udemy.com/course/react/learn/lecture/${title.length}`, duration: 300, completed });
  return {
    title: 'React do zero',
    provider: { id: 'udemy' },
    sourceUrl: 'https://www.udemy.com/course/react',
    completionSource: 'lesson-flags',
    disciplines: [{
      title: 'Conteúdo do curso',
      modules: [
        { title: 'Começando', lessons: [lesson('Introdução', done.has('a')), lesson('Instalação', done.has('b'))] },
        { title: 'Componentes', lessons: [lesson('Introdução', done.has('c')), lesson('Props e estado', done.has('d'))] },
      ],
    }],
    extraction: { kind: 'extension-capture', confidence: 'medium', notes: [] },
    completeness: 'partial',
  };
}

test('leitura da extensão marca a conclusão por aula, mesmo com títulos repetidos', () => {
  const payload = normalizePayload(extensionCapture(new Set(['a'])));
  assert.equal(payload.extraction.kind, 'extension-capture');
  assert.equal(payload.lessonCount, 4);
  assert.equal(payload.completedCount, 1, 'a outra "Introdução" não pode herdar a marca');
  assert.match(payload.capabilities[0].value, /extensão/);
});

test('primeira leitura da extensão é histórico sem XP; conclusões novas confirmadas entram como plataforma', () => {
  const first = normalizePayload(extensionCapture(new Set(['a'])));
  const imported = applyCourseImport(createInitialState(), first, {
    now: '2026-10-31T12:00:00Z', observedCompletionIds: allLessonIds(first),
  });
  const course = imported.courses[0];
  assert.equal(imported.progress.length, 1);
  assert.equal(imported.progress[0].origin, 'import', 'em curso novo, nada é registrado como conclusão elegível');
  assert.equal(imported.progress[0].historical, true);

  const second = normalizePayload(extensionCapture(new Set(['a', 'b', 'd'])));
  const newIds = second.disciplines[0].modules.flatMap((module) => module.lessons)
    .filter((lesson) => lesson.completedInSource && !isCompleted(imported, lesson.id)).map((lesson) => lesson.id);
  assert.equal(newIds.length, 2);

  const confirmed = applyCourseImport(imported, second, { now: '2026-11-01T12:00:00Z', observedCompletionIds: newIds });
  assert.equal(confirmed.courses.length, 1, 'mesma identidade: atualiza sem duplicar');
  assert.equal(confirmed.imports.at(-1).observed, 2);
  for (const id of newIds) {
    assert.equal(lessonOrigin(confirmed, id), 'integration');
    assert.equal(eventFor(confirmed, id).historical, false);
  }
  assert.equal(confirmed.progress.filter((entry) => entry.origin === 'import').length, 1, 'o histórico anterior não é reescrito');

  // Sem confirmação, a mesma leitura vira só histórico.
  const declined = applyCourseImport(imported, second, { now: '2026-11-01T12:00:00Z' });
  assert.equal(declined.imports.at(-1).observed, 0);
  assert.ok(newIds.every((id) => lessonOrigin(declined, id) === 'import'));
  assert.ok(course.id);
});

test('a página aberta acha a aula pelo endereço, com complemento, sem casar a página do curso com todas', () => {
  const payload = normalizePayload(extensionCapture(new Set()));
  const state = applyCourseImport(createInitialState(), payload, { now: '2026-10-31T12:00:00Z' });
  const found = findLessonByUrl(state, 'https://udemy.com/course/react/learn/lecture/14/extra?x=1#t');
  assert.equal(found?.lesson.title, 'Props e estado');
  assert.equal(found?.course.title, 'React do zero');
  assert.equal(findLessonByUrl(state, 'https://www.udemy.com/course/react'), null);
  assert.equal(findLessonByUrl(state, 'https://www.alura.com.br/course/react/learn/lecture/14'), null);
  assert.equal(findLessonByUrl(state, 'nao-e-url'), null);
});

test('fonte sem adaptador não lê marcas de concluído', () => {
  const payload = normalizePayload({
    title: 'Curso solto', provider: { id: 'unknown' }, sourceUrl: 'https://cursos.example.test/x',
    completionSource: 'lesson-flags',
    disciplines: [{ title: 'Área', modules: [{ title: 'M', lessons: [{ title: 'Aula 1', completed: true }, { title: 'Aula 2' }] }] }],
  });
  assert.equal(payload.completedCount, 0);
  assert.ok(payload.warnings.some((item) => /marcas de concluído/.test(item)));
  assert.equal(payload.capabilities.find((item) => item.id === 'progress').available, false);
});

test('aula com identidade da plataforma mantém progresso quando o título muda', () => {
  const capture = (title, externalId = 'd1/a1') => ({
    title: 'Curso Gran', provider: { id: 'grancursos' }, sourceUrl: 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/ABC',
    completionSource: 'lesson-flags', extraction: { kind: 'extension-capture' },
    disciplines: [{ title: 'Direito', externalId: 'd1', modules: [{ title: 'Aulas', lessons: [{ title, externalId }, { title: 'Aula 2', externalId: 'd1/a2' }] }] }],
  });
  let state = applyCourseImport(createInitialState(), normalizePayload(capture('Aula 1 - Introdução')), { now: '2026-11-01T10:00:00Z' });
  const course = state.courses[0];
  const lessonId = course.steps[0].id;
  state = completeLesson(state, course.id, lessonId, { now: '2026-11-01T11:00:00Z' }).state;
  state = applyCourseImport(state, normalizePayload(capture('Aula 1 - Introdução ao Direito')), { now: '2026-11-02T10:00:00Z' });
  const updated = state.courses[0];
  assert.equal(updated.steps.length, 2, 'renomear não cria aula nova');
  assert.equal(updated.steps[0].id, lessonId);
  assert.equal(updated.steps[0].title, 'Aula 1 - Introdução ao Direito');
  assert.ok(isCompleted(state, lessonId));
});

test('aula importada antes da identidade da plataforma adota o externalId sem perder o id', () => {
  const base = {
    title: 'Curso Gran', provider: { id: 'grancursos' }, sourceUrl: 'https://www.grancursosonline.com.br/aluno/curso/video/codigo/ABC',
    extraction: { kind: 'extension-capture' },
  };
  const old = normalizePayload({ ...base, disciplines: [{ title: 'Direito', modules: [{ title: 'Aulas', lessons: [{ title: 'Aula 1' }, { title: 'Aula 2' }] }] }] });
  let state = applyCourseImport(createInitialState(), old, { now: '2026-11-01T10:00:00Z' });
  const oldId = state.courses[0].steps[0].id;
  state = completeLesson(state, state.courses[0].id, oldId, { now: '2026-11-01T11:00:00Z' }).state;
  const next = normalizePayload({ ...base, disciplines: [{ title: 'Direito', externalId: 'd1', modules: [{ title: 'Aulas', lessons: [{ title: 'Aula 1', externalId: 'd1/a1' }, { title: 'Aula 2', externalId: 'd1/a2' }] }] }] });
  state = applyCourseImport(state, next, { now: '2026-11-02T10:00:00Z' });
  const lessons = state.courses[0].structure[0].modules[0].lessons;
  assert.equal(lessons.filter((lesson) => !lesson.removedFromSource).length, 2, 'nada some nem duplica');
  assert.equal(lessons[0].id, oldId);
  assert.equal(lessons[0].externalId, 'd1/a1');
  assert.ok(isCompleted(state, oldId));
});
