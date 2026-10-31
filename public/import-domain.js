// Domínio da importação de cursos.
// Este módulo é usado pelo navegador, pelo servidor local e pelo Worker, e por
// isso não depende de DOM, rede ou banco. Ele só normaliza, compara e mescla.
//
// Regras que valem aqui:
// - Importar, selecionar disciplinas ou conectar uma fonte nunca gera XP.
// - Conteúdo identificado na fonte, previsão de edital e sugestão de IA são
//   categorias diferentes e nunca são somadas como se fossem a mesma coisa.
// - Reimportar preserva conclusões, marcadores e histórico; conteúdo removido
//   da fonte é marcado, não apagado.

const MAX_DISCIPLINES = 40;
const MAX_MODULES = 60;
const MAX_LESSONS = 600;
const MAX_TITLE = 200;

// Capacidades declaradas por fonte. Aceitar um link não significa que todas
// estejam disponíveis: cada campo precisa ser verificado na fonte.
//   syllabus: structured = dados estruturados publicados na página
//             page       = grade parcialmente legível na página pública
//             manual     = a grade só chega por texto/arquivo
//             none       = nenhuma leitura automática conhecida
export const PROVIDERS = [
  {
    id: 'grancursos', label: 'Gran Cursos Online', hosts: ['grancursosonline.com.br'],
    structure: 'disciplinas e assuntos', art: 'nature',
    syllabus: 'page',
    note: 'A página pública costuma mostrar as disciplinas do pacote. Módulos e aulas detalhados normalmente ficam na área autenticada: o Lume não pede senha nem cookie.',
  },
  {
    id: 'estrategia', label: 'Estratégia Concursos', hosts: ['estrategiaconcursos.com.br'],
    structure: 'disciplinas e assuntos', art: 'nature',
    syllabus: 'page',
    note: 'O Lume lê apenas a página pública do curso. A grade completa costuma exigir acesso à conta.',
  },
  {
    id: 'alura', label: 'Alura', hosts: ['alura.com.br'],
    structure: 'cursos, módulos e aulas', art: 'code',
    syllabus: 'structured',
    note: 'Cursos avulsos e formações publicam parte da ementa na página. Trilhas fechadas podem aparecer incompletas.',
  },
  {
    id: 'rocketseat', label: 'Rocketseat', hosts: ['rocketseat.com.br'],
    structure: 'trilhas, módulos e projetos', art: 'code',
    syllabus: 'page',
    note: 'A trilha pública lista módulos e aulas; o conteúdo em vídeo exige acesso próprio.',
  },
  {
    id: 'udemy', label: 'Udemy', hosts: ['udemy.com'],
    structure: 'seções e aulas', art: 'design',
    syllabus: 'structured',
    note: 'O catálogo publica título e parte do currículo em dados estruturados. Aulas pagas não são acessíveis ao Lume.',
  },
  {
    id: 'coursera', label: 'Coursera', hosts: ['coursera.org'],
    structure: 'semanas e aulas', art: 'language',
    syllabus: 'structured',
    note: 'Parte do programa é publicada na página do curso. A duração real pode variar por turma.',
  },
  {
    id: 'dio', label: 'DIO', hosts: ['dio.me'],
    structure: 'bootcamps e módulos', art: 'code',
    syllabus: 'page',
    note: 'Bootcamps públicos listam módulos; o detalhe das aulas pode exigir cadastro.',
  },
  {
    id: 'hotmart', label: 'Hotmart', hosts: ['hotmart.com'],
    structure: 'módulos e aulas', art: 'design',
    syllabus: 'manual',
    note: 'Páginas de produto raramente publicam a grade. Prefira colar a ementa ou enviar um arquivo.',
  },
];

const FALLBACK_PROVIDER = {
  id: 'unknown', label: 'Fonte não reconhecida', hosts: [], structure: 'conteúdo', art: 'nature',
  syllabus: 'page',
  note: 'Fonte sem adaptador próprio. O Lume tenta ler dados estruturados e a estrutura visível da página; se não bastar, use texto ou arquivo.',
};

export const MAX_SYLLABUS_CHARS = 60000;

export function providerById(id) {
  return PROVIDERS.find((item) => item.id === id) || FALLBACK_PROVIDER;
}

export function detectProvider(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { return { ...FALLBACK_PROVIDER }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { ...FALLBACK_PROVIDER };
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const found = PROVIDERS.find((item) => item.hosts.some((known) => host === known || host.endsWith(`.${known}`)));
  return { ...(found || FALLBACK_PROVIDER) };
}

// Capacidades em formato pronto para a interface. Nunca prometemos progresso
// automático: nenhuma fonte integrada expõe hoje leitura de aulas assistidas.
export function providerCapabilities(provider, extraction) {
  const syllabusLabel = extraction === 'structured-data' || provider.syllabus === 'structured'
    ? 'Sim, a partir dos dados publicados na página'
    : extraction === 'page-outline'
      ? 'Parcial, a partir da estrutura visível da página'
      : 'Somente por texto colado ou arquivo';
  return [
    { id: 'syllabus', label: 'Importar a grade', value: syllabusLabel, available: true },
    { id: 'account', label: 'Acessar conteúdo da sua conta', value: 'Não — exige login na plataforma', available: false },
    { id: 'progress', label: 'Consultar progresso automaticamente', value: 'Não — conclusão é registrada por você', available: false },
    { id: 'resume', label: 'Retomar a aula na posição exata', value: 'Não — link direto quando a fonte permite', available: false },
  ];
}

// Aceita o link como a pessoa costuma colar: com ou sem https://, com www ou
// apenas o domínio. Não inventa URL para texto comum nem aceita credenciais.
export function normalizeImportUrl(value) {
  const text = String(value || '').trim();
  if (!text || /[\s]/.test(text)) return null;
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!url.hostname.includes('.') || url.hostname === 'localhost') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function canonicalUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { return ''; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  // Parâmetros de rastreamento não identificam o curso e quebrariam a deduplicação.
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|ref|origem|source|coupon|aff)/i.test(key)) url.searchParams.delete(key);
  }
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${path}${url.search ? `?${url.searchParams.toString()}` : ''}`;
}

export function safeAssetUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}

export function stableHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, '0');
}

export function cleanTitle(value, maxLength = MAX_TITLE) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  const text = String(value ?? '').trim();
  const clock = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const [, a, b, c] = clock;
    return c ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
  }
  const minutes = text.match(/^(\d{1,4})\s*(min|minuto|m)$/i);
  if (minutes) return Number(minutes[1]) * 60;
  return null;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

// Normaliza o formato vindo do servidor, de um arquivo ou de um organizador de
// texto. Estrutura inválida não entra na biblioteca: preferimos dizer o que
// faltou a persistir algo que não sabemos de onde veio.
export function normalizePayload(input, { sourceUrl = '' } = {}) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.disciplines)) {
    throw new Error('A fonte não devolveu uma grade legível. Tente colar o conteúdo ou enviar um arquivo.');
  }
  const url = canonicalUrl(input.sourceUrl || sourceUrl);
  const provider = providerById(input.provider?.id) === FALLBACK_PROVIDER && input.provider?.id
    ? { ...FALLBACK_PROVIDER, ...input.provider }
    : { ...providerById(input.provider?.id) };
  const identityBase = url || `texto:${stableHash(cleanTitle(input.title) || 'sem-titulo')}`;
  const identity = `${provider.id}|${identityBase}`;
  const warnings = Array.isArray(input.warnings) ? input.warnings.map((item) => cleanTitle(item, 240)).filter(Boolean) : [];
  let lessonCount = 0;
  let disciplineCount = 0;

  const disciplines = [];
  for (const rawDiscipline of input.disciplines) {
    if (disciplineCount >= MAX_DISCIPLINES) { warnings.push(`A lista foi limitada a ${MAX_DISCIPLINES} disciplinas.`); break; }
    const disciplineTitle = cleanTitle(rawDiscipline?.title);
    if (!disciplineTitle) continue;
    const disciplineId = `dis_${stableHash(`${identity}|${disciplineTitle}`)}`;
    const modules = [];
    let moduleCount = 0;
    for (const rawModule of Array.isArray(rawDiscipline.modules) ? rawDiscipline.modules : []) {
      if (moduleCount >= MAX_MODULES) { warnings.push(`A disciplina "${disciplineTitle}" foi limitada a ${MAX_MODULES} módulos.`); break; }
      const moduleTitle = cleanTitle(rawModule?.title) || 'Conteúdo';
      const moduleId = `mod_${stableHash(`${identity}|${disciplineTitle}|${moduleTitle}`)}`;
      const lessons = [];
      const seen = new Set();
      for (const rawLesson of Array.isArray(rawModule.lessons) ? rawModule.lessons : []) {
        if (lessonCount >= MAX_LESSONS) break;
        const title = cleanTitle(rawLesson?.title);
        if (!title) continue;
        const id = `lsn_${stableHash(`${identity}|${disciplineTitle}|${moduleTitle}|${title}`)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const duration = normalizeDuration(rawLesson?.duration);
        lessons.push({
          id,
          title,
          url: safeAssetUrl(rawLesson?.url),
          duration,
          removedFromSource: false,
        });
        lessonCount += 1;
      }
      if (!lessons.length) continue;
      // Uma lista que repete o título seguido da descrição gera quase-duplicatas.
      // Só descartamos quando o título menor é longo e prefixo exato do maior.
      const deduped = [];
      for (const lesson of lessons) {
        if (deduped.some((kept) => (kept.title.length >= 20 && lesson.title.startsWith(kept.title))
          || (lesson.title.length >= 20 && kept.title.startsWith(lesson.title)))) continue;
        deduped.push(lesson);
      }
      lessonCount += deduped.length - lessons.length;
      moduleCount += 1;
      modules.push({ id: moduleId, title: moduleTitle, lessons: deduped });
    }
    if (!modules.length) continue;
    disciplineCount += 1;
    disciplines.push({ id: disciplineId, title: disciplineTitle, modules });
  }

  if (!lessonCount) throw new Error('Nenhuma aula identificada. Cole a grade inteira ou envie um arquivo com disciplinas, módulos e aulas.');

  const extraction = ['structured-data', 'page-outline', 'pasted-text', 'file-import', 'ai-assisted'].includes(input.extraction?.kind)
    ? input.extraction.kind : 'pasted-text';
  const completeness = ['complete', 'partial', 'unknown'].includes(input.completeness) ? input.completeness : 'unknown';
  const capabilities = providerCapabilities(provider, extraction);

  return {
    identity,
    title: cleanTitle(input.title) || 'Curso importado',
    provider: { id: provider.id, label: provider.label, structure: provider.structure, note: provider.note },
    sourceUrl: url || safeAssetUrl(sourceUrl),
    externalId: cleanTitle(input.externalId, 300) || '',
    extraction: {
      kind: extraction,
      confidence: ['high', 'medium', 'low'].includes(input.extraction?.confidence) ? input.extraction.confidence : 'low',
      notes: Array.isArray(input.extraction?.notes) ? input.extraction.notes.map((item) => cleanTitle(item, 240)).filter(Boolean).slice(0, 8) : [],
    },
    completeness,
    capabilities,
    warnings: warnings.slice(0, 10),
    disciplines,
    lessonCount,
    demo: input.demo === true,
    analyzedAt: typeof input.analyzedAt === 'string' && Number.isFinite(Date.parse(input.analyzedAt)) ? input.analyzedAt : null,
  };
}

export function allLessonIds(payload) {
  return payload.disciplines.flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
}

export function selectedCount(payload, selected) {
  return allLessonIds(payload).filter((id) => selected.has(id)).length;
}

// 30 XP não: importar é organização, não estudo. A função existe para deixar
// explícito no código o valor zero que a política de gamificação determina.
export function importXp() {
  return 0;
}

function mergeStructure(previousStructure, nextStructure) {
  const previousDisciplines = new Map((previousStructure || []).map((discipline) => [discipline.id, discipline]));
  const merged = [];
  const used = new Set();
  for (const discipline of nextStructure) {
    const old = previousDisciplines.get(discipline.id);
    const modules = [];
    const oldModules = new Map((old?.modules || []).map((module) => [module.id, module]));
    for (const module of discipline.modules) {
      const oldModule = oldModules.get(module.id);
      const lessons = new Map((oldModule?.lessons || []).map((lesson) => [lesson.id, lesson]));
      const incoming = new Set(module.lessons.map((lesson) => lesson.id));
      for (const lesson of module.lessons) {
        lessons.set(lesson.id, { ...(lessons.get(lesson.id) || {}), ...lesson, removedFromSource: false });
      }
      // Aula que existia e sumiu da fonte permanece visível, marcada.
      for (const [id, lesson] of lessons) {
        if (!incoming.has(id)) lessons.set(id, { ...lesson, removedFromSource: true });
      }
      modules.push({ ...module, lessons: [...lessons.values()] });
    }
    // Módulos que sumiram da fonte continuam visíveis: o progresso registrado
    // não pode desaparecer porque a plataforma reorganizou o curso.
    for (const oldModule of old?.modules || []) {
      if (modules.some((module) => module.id === oldModule.id)) continue;
      modules.push({ ...oldModule, lessons: oldModule.lessons.map((lesson) => ({ ...lesson, removedFromSource: true })) });
    }
    used.add(discipline.id);
    merged.push({ ...discipline, modules });
  }
  for (const old of previousStructure || []) {
    if (used.has(old.id)) continue;
    merged.push({ ...old, removedFromSource: true, modules: old.modules.map((module) => ({ ...module, lessons: module.lessons.map((lesson) => ({ ...lesson, removedFromSource: true })) })) });
  }
  return merged;
}

function stepsFromStructure(structure, selectedIds) {
  const steps = [];
  for (const discipline of structure) {
    for (const module of discipline.modules) {
      for (const lesson of module.lessons) {
        if (!selectedIds.has(lesson.id)) continue;
        if (steps.some((step) => step.id === lesson.id)) continue;
        steps.push({ id: lesson.id, title: lesson.title, discipline: discipline.title, module: module.title, removedFromSource: lesson.removedFromSource === true });
      }
    }
  }
  return steps;
}

function mergeSelection(previousSteps, structure, requested) {
  const available = new Set(allLessonIds({ disciplines: structure }));
  const selection = new Set(requested);
  // Aulas que a pessoa já acompanhava continuam selecionadas mesmo que a nova
  // análise traga apenas parte da grade.
  for (const step of previousSteps || []) if (available.has(step.id)) selection.add(step.id);
  // Conclusões nunca são desmarcadas por uma reimportação.
  return selection;
}

// Aplica uma análise à biblioteca. `mode: 'update'` mantém conclusões,
// posições e o que já foi estudado.
export function applyCourseImport(state, payload, { selectedLessonIds = [], now = new Date().toISOString(), mode = 'create', courseId = null, edital = null } = {}) {
  if (!payload || !Array.isArray(payload.disciplines) || !payload.disciplines.length) {
    throw new Error('Nada para importar. Escolha pelo menos uma disciplina.');
  }
  const existing = (state.courses || []).find((course) => course.source?.identity === payload.identity)
    || (courseId ? (state.courses || []).find((course) => course.id === courseId && course.source) : null);
  const requested = new Set(selectedLessonIds.length ? selectedLessonIds : allLessonIds(payload));
  const structure = existing ? mergeStructure(existing.structure, payload.disciplines) : payload.disciplines;
  const selection = mergeSelection(existing?.steps, structure, requested);
  const steps = stepsFromStructure(structure, selection);
  if (!steps.length) throw new Error('Nada para importar. Escolha pelo menos uma disciplina.');

  const added = steps.filter((step) => !(existing?.steps || []).some((old) => old.id === step.id)).length;
  const removed = (existing?.steps || []).filter((old) => !steps.some((step) => step.id === old.id)).length;
  const id = existing?.id || `course_${stableHash(payload.identity)}`;
  const course = {
    ...(existing || {}),
    id,
    title: payload.title,
    category: `${payload.provider.label} · ${payload.provider.structure}`,
    art: providerById(payload.provider.id).art || 'nature',
    url: payload.sourceUrl,
    example: false,
    paused: existing?.paused === true,
    steps,
    structure,
    source: {
      provider: payload.provider.id,
      providerLabel: payload.provider.label,
      identity: payload.identity,
      canonicalUrl: payload.sourceUrl,
      externalId: payload.externalId,
      fetchedAt: now,
      extraction: payload.extraction,
      completeness: payload.completeness,
      capabilities: payload.capabilities,
      warnings: payload.warnings,
      demo: payload.demo === true,
      importedAt: existing?.source?.importedAt || now,
      lastUpdatedAt: now,
    },
    selection: { lessonIds: steps.map((step) => step.id) },
    edital: edital || existing?.edital || null,
  };

  const record = {
    id: `imp_${stableHash(`${payload.identity}|${now}`)}`,
    courseId: id,
    at: now,
    provider: payload.provider.id,
    extraction: payload.extraction.kind,
    lessonCount: steps.length,
    added,
    removed,
    mode: existing ? 'update' : 'create',
  };

  return {
    ...state,
    courses: existing
      ? state.courses.map((item) => (item.id === id ? course : item))
      : [...state.courses, course],
    selectedCourseId: id,
    imports: [...(state.imports || []), record].slice(-50),
  };
}

export function courseLessons(course) {
  if (!course?.structure) return [];
  return course.structure.flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, disciplineId: discipline.id, disciplineTitle: discipline.title, moduleTitle: module.title }))));
}

export function isImportedCourse(course) {
  return Boolean(course?.source?.identity && Array.isArray(course?.structure));
}

// Rótulo curto da origem, sem prometer plataforma quando a entrada foi texto.
export function sourceLabel(source) {
  const kind = source?.extraction?.kind;
  if (!source?.provider || source.provider === 'unknown') {
    if (kind === 'pasted-text') return 'Texto colado';
    if (kind === 'ai-assisted') return 'Organizado por IA';
    if (kind === 'file-import') return 'Arquivo enviado';
    return 'Conteúdo importado';
  }
  return source.providerLabel || 'Conteúdo importado';
}

// Resumo separado por disciplina e no conjunto selecionado. Não confundir com
// conclusão do curso inteiro quando a grade é parcial.
export function courseSummary(state, course) {
  const lessons = courseLessons(course).filter((lesson) => course.steps?.some((step) => step.id === lesson.id));
  const doneIds = new Set(state.completed || []);
  const disciplines = (course.structure || []).map((discipline) => {
    const items = discipline.modules.flatMap((module) => module.lessons).filter((lesson) => course.steps?.some((step) => step.id === lesson.id));
    const done = items.filter((lesson) => doneIds.has(lesson.id)).length;
    return { id: discipline.id, title: discipline.title, done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0, removedFromSource: discipline.removedFromSource === true };
  }).filter((discipline) => discipline.total > 0);
  const done = lessons.filter((lesson) => doneIds.has(lesson.id)).length;
  const next = lessons.find((lesson) => !doneIds.has(lesson.id)) || null;
  const log = (state.studyLog || []).filter((entry) => entry.courseId === course.id);
  const lastStudied = [...log].reverse().find((entry) => !entry.revertedAt) || null;
  const resume = lastStudied ? lessons.find((lesson) => lesson.id === lastStudied.stepId) || null : null;
  return {
    total: lessons.length,
    done,
    percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
    disciplines,
    next,
    resume,
    lastStudiedAt: lastStudied?.at || null,
    origin: log.length ? (log.some((entry) => entry.origin === 'integration') ? 'integration' : 'manual') : null,
    partial: course.source?.completeness !== 'complete',
    removedFromSource: lessons.some((lesson) => lesson.removedFromSource),
  };
}

export function lessonOrigin(state, lessonId) {
  const entries = (state.studyLog || []).filter((entry) => entry.stepId === lessonId && !entry.revertedAt);
  if (!entries.length) return null;
  return entries.some((entry) => entry.origin === 'integration') ? 'integration' : 'manual';
}

// Concluir uma aula importada registra progresso com origem explícita.
// Não cria evento de XP: a atribuição da nova política exige validação no
// servidor, que ainda não existe para contas.
export function completeLesson(state, courseId, lessonId, { origin = 'manual', now = new Date().toISOString() } = {}) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  const lesson = course?.steps?.find((item) => item.id === lessonId);
  if (!course || !lesson || (state.completed || []).includes(lessonId)) return { state, added: false, xp: 0 };
  const entry = {
    id: `lesson:${lessonId}`,
    courseId,
    stepId: lessonId,
    courseTitle: course.title,
    lessonTitle: lesson.title,
    origin: origin === 'integration' ? 'integration' : 'manual',
    at: now,
  };
  return {
    state: { ...state, completed: [...(state.completed || []), lessonId], studyLog: [...(state.studyLog || []), entry].slice(-500) },
    added: true,
    xp: 0,
  };
}

export function revertLessonCompletion(state, courseId, lessonId, { now = new Date().toISOString() } = {}) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course || !(state.completed || []).includes(lessonId)) return { state, reverted: false };
  const origin = lessonOrigin(state, lessonId);
  if (origin === 'integration') return { state, reverted: false, reason: 'integration' };
  return {
    state: {
      ...state,
      completed: state.completed.filter((id) => id !== lessonId),
      // O histórico não é apagado: fica registrado que a conclusão foi desfeita.
      studyLog: (state.studyLog || []).map((entry) => (entry.stepId === lessonId && !entry.revertedAt ? { ...entry, revertedAt: now } : entry)),
    },
    reverted: true,
  };
}

// ---------------- Programação e GitHub ----------------
// Preparação de adaptadores: os repositórios ainda não são consultados nesta
// versão. O formato existe para que a integração futura não invente conclusão
// a partir de issues abertas ou de inatividade.
export const GITHUB_CAPABILITIES = [
  { id: 'syllabus', label: 'Identificar o projeto', value: 'Não — conexão ao GitHub ainda não implementada', available: false },
  { id: 'deliveries', label: 'Sugerir entregas pendentes', value: 'Planejado (README, issues e milestones autorizados)', available: false },
  { id: 'progress', label: 'Validar conclusão automaticamente', value: 'Não — a pessoa valida cada entrega', available: false },
  { id: 'share', label: 'Compartilhar para colaboração', value: 'Não — amigos e grupos ainda não existem', available: false },
];

export function deliveryCandidates(repository) {
  // Estrutura de entrada esperada: { name, readme, issues: [{ title, state, milestone }], milestones: [...] }
  // Sem conexão real, devolvemos apenas candidatos marcados como sugestão.
  if (!repository || typeof repository !== 'object') return [];
  const issues = Array.isArray(repository.issues) ? repository.issues : [];
  return issues
    .filter((issue) => issue && issue.state !== 'closed' && cleanTitle(issue.title))
    .slice(0, 30)
    .map((issue) => ({
      id: `gh_${stableHash(`${repository.name || ''}|${issue.title}`)}`,
      title: cleanTitle(issue.title, 180),
      milestone: cleanTitle(issue.milestone, 120) || null,
      kind: 'suggestion',
      requiresValidation: true,
      note: 'Sugestão a partir de uma issue aberta. Issue aberta não significa projeto incompleto.',
    }));
}

// ---------------- Edital ----------------
// Registro de editais verificados. Fica vazio de propósito: preencher com um
// edital exige conferir a fonte oficial e a data. Enquanto não houver entrada,
// o Lume pede edição e fase e diz que a cobertura não está disponível, em vez
// de inventar uma grade de prova.
export const EDITAL_SOURCES = [];

export function editalCoverage(course, { edition = '', phase = '' } = {}) {
  const requested = { exam: 'OAB', edition: cleanTitle(edition, 40), phase: cleanTitle(phase, 20) };
  const source = EDITAL_SOURCES.find((item) => item.exam === requested.exam && item.edition === requested.edition && item.phase === requested.phase);
  if (!source) {
    return {
      available: false,
      requested,
      message: 'Ainda não há edital verificado cadastrado para esta edição e fase. Por isso o Lume não calcula o que falta para a prova nem trata a grade importada como cobertura completa.',
    };
  }
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const courseDisciplines = (course?.structure || []).map((discipline) => ({ title: discipline.title, normalized: normalize(discipline.title) }));
  const covered = [];
  const missing = [];
  for (const topic of source.topics) {
    const target = normalize(topic);
    const found = courseDisciplines.find((discipline) => discipline.normalized.includes(target) || target.includes(discipline.normalized));
    if (found) covered.push({ topic, discipline: found.title });
    else missing.push(topic);
  }
  return {
    available: true,
    requested,
    covered,
    missing,
    coverage: source.topics.length ? Math.round((covered.length / source.topics.length) * 100) : 0,
    source: { name: source.name, url: source.url, publishedAt: source.publishedAt, checkedAt: source.checkedAt },
    message: 'A comparação usa apenas os temas cadastrados do edital. Ela não mede domínio nem garante aprovação.',
  };
}

export function looksLikeExamCourse(course) {
  const text = `${course?.title || ''} ${(course?.structure || []).map((discipline) => discipline.title).join(' ')}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\boab\b|exame de ordem|concurso|preparatorio/.test(text);
}
