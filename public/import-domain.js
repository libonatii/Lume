import { materialSteps, materialStructure, unitsFromStructure } from './material-model.js';
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

import { completedUnitIds, isCompleted, recordCompletion, revertUnit, unitOrigin } from './progress-domain.js';
import { PROVIDERS as REGISTERED_PROVIDERS, UNKNOWN_PROVIDER, providerForUrl, readsCompletion } from './providers/registry.js';

const MAX_DISCIPLINES = 40;
const MAX_MODULES = 60;
const MAX_LESSONS = 600;
const MAX_TITLE = 200;

// O catálogo de plataformas vive no registro de provedores
// (public/providers/registry.js): cada uma declara capacidades, leitores e como
// reconhecer o curso. Estes nomes continuam exportados para quem já os usa.
export const PROVIDERS = REGISTERED_PROVIDERS;
const FALLBACK_PROVIDER = UNKNOWN_PROVIDER;

export const MAX_SYLLABUS_CHARS = 60000;

export function providerById(id) {
  return PROVIDERS.find((item) => item.id === id) || FALLBACK_PROVIDER;
}

export function detectProvider(value) {
  return { ...providerForUrl(value) };
}

// Capacidades em formato pronto para a interface, a partir do que o provedor
// declara e de como esta grade foi lida. Ler a marca de concluído não é
// acompanhar a reprodução: é o que a plataforma mostrou, confirmado pela pessoa.
export function providerCapabilities(provider, extraction) {
  const declared = provider?.capabilities || UNKNOWN_PROVIDER.capabilities;
  const loggedRead = extraction === 'extension-capture' || extraction === 'page-snapshot';
  const syllabusLabel = extraction === 'extension-capture'
    ? (declared.syllabus === 'full' ? 'Sim, lida pela extensão na grade que a plataforma entrega à sua conta' : 'Parcial, lida pela extensão na página aberta com a sua conta')
    : extraction === 'page-snapshot'
      ? 'Parcial, a partir da página que você copiou já logada'
      : extraction === 'structured-data' || provider?.syllabus === 'structured'
        ? 'Sim, a partir dos dados publicados na página'
        : extraction === 'page-outline'
          ? 'Parcial, a partir da estrutura visível da página'
          : 'Somente por texto colado ou arquivo';
  const flags = declared.progress === 'lesson-flags';
  return [
    { id: 'syllabus', label: 'Importar a grade', value: syllabusLabel, available: true },
    {
      id: 'account',
      label: 'Acessar conteúdo da sua conta',
      value: loggedRead ? 'Só o que a página aberta com a sua conta mostra; o Lume não recebe senha nem cookie' : 'Não — abra o curso logado e use a extensão, ou copie a página',
      available: loggedRead,
    },
    {
      id: 'progress',
      label: 'Ler aulas marcadas como concluídas',
      value: flags && loggedRead ? 'Sim, a marca que a plataforma mostra; novas conclusões pedem sua confirmação' : flags ? 'Só na leitura logada (extensão ou página copiada)' : 'Não — conclusão é registrada por você',
      available: flags && loggedRead,
    },
    { id: 'resume', label: 'Retomar a aula na posição exata', value: declared.resume ? 'Sim' : 'Não — link direto quando a fonte permite', available: declared.resume === true },
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
  // Algumas páginas de curso logado marcam as aulas já concluídas. Esse é um
  // dado observado na página copiada, não uma conclusão nova: será importado
  // como histórico e nunca gera XP.
  // A extensão marca cada aula individualmente: títulos repetidos em módulos
  // diferentes ("Introdução") não podem se contaminar pela comparação por título.
  const flagged = input.completionSource === 'lesson-flags';
  // Só provedor que declara ler conclusão pode marcar aula como concluída na
  // fonte; numa fonte desconhecida, a marca não é confiável e é ignorada.
  const completionAllowed = readsCompletion(provider);
  const completedTitles = new Set(
    (completionAllowed && Array.isArray(input.completedTitles) ? input.completedTitles : [])
      .map((title) => cleanTitle(title))
      .filter(Boolean),
  );
  let lessonCount = 0;
  let disciplineCount = 0;
  let completedCount = 0;

  const disciplines = [];
  for (const rawDiscipline of input.disciplines) {
    if (disciplineCount >= MAX_DISCIPLINES) { warnings.push(`A lista foi limitada a ${MAX_DISCIPLINES} disciplinas.`); break; }
    const disciplineTitle = cleanTitle(rawDiscipline?.title);
    if (!disciplineTitle) continue;
    const disciplineId = `dis_${stableHash(`${identity}|${disciplineTitle}`)}`;
    const disciplineExternalId = cleanTitle(rawDiscipline?.externalId, 200);
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
        // Com identidade da plataforma, o id não depende do título: renomear a
        // aula na fonte não cria outra aula nem separa o progresso.
        const externalId = cleanTitle(rawLesson?.externalId, 200);
        const id = externalId
          ? `lsn_${stableHash(`${identity}|x:${externalId}`)}`
          : `lsn_${stableHash(`${identity}|${disciplineTitle}|${moduleTitle}|${title}`)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const duration = normalizeDuration(rawLesson?.duration);
        const completedInSource = !completionAllowed ? false : flagged
          ? rawLesson?.completed === true
          : completedTitles.has(title)
            || (title.length >= 12 && [...completedTitles].some((candidate) => candidate.includes(title) || title.includes(candidate)));
        if (completedInSource) completedCount += 1;
        lessons.push({
          id,
          ...(externalId ? { externalId } : {}),
          title,
          url: safeAssetUrl(rawLesson?.url),
          duration,
          completedInSource,
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
    disciplines.push({ id: disciplineId, ...(disciplineExternalId ? { externalId: disciplineExternalId } : {}), title: disciplineTitle, modules });
  }

  if (!completionAllowed && (flagged || (Array.isArray(input.completedTitles) && input.completedTitles.length))) {
    warnings.push('Fonte sem adaptador próprio: as marcas de concluído da página não foram lidas.');
  }
  if (!lessonCount) throw new Error('Nenhuma aula identificada. Cole a grade inteira ou envie um arquivo com disciplinas, módulos e aulas.');

  const extraction = ['structured-data', 'page-outline', 'page-snapshot', 'extension-capture', 'pasted-text', 'file-import', 'ai-assisted'].includes(input.extraction?.kind)
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
    completedCount,
    completedTitles: [...completedTitles],
    demo: input.demo === true,
    analyzedAt: typeof input.analyzedAt === 'string' && Number.isFinite(Date.parse(input.analyzedAt)) ? input.analyzedAt : null,
  };
}

export function allLessonIds(payload) {
  return payload.disciplines.flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
}

// Aula que já está na biblioteca mantém o id que tem: o progresso, o XP e as
// tarefas apontam para ele. Casa primeiro pela identidade da plataforma
// (externalId) e, para aulas importadas antes dela existir, pelo caminho de
// títulos (disciplina, módulo, aula); nesse caso a aula ganha o externalId.
function adoptExistingIds(previousStructure, nextStructure) {
  const byExternal = new Map();
  const byPath = new Map();
  for (const discipline of previousStructure || []) {
    for (const module of discipline.modules || []) {
      for (const lesson of module.lessons || []) {
        if (lesson.externalId) byExternal.set(lesson.externalId, lesson);
        const path = `${discipline.title}|${module.title}|${lesson.title}`;
        // Caminho ambíguo não é evidência suficiente para unir duas aulas.
        byPath.set(path, byPath.has(path) ? null : lesson);
      }
    }
  }
  const taken = new Set();
  const matchContainer = (items, next) => (items || []).find((item) => item.id === next.id
    || (next.externalId && item.externalId === next.externalId)
    || (item.title === next.title && (!item.externalId || !next.externalId)));
  return nextStructure.map((discipline) => {
    const oldDiscipline = matchContainer(previousStructure, discipline);
    return {
      ...discipline,
      ...(oldDiscipline ? { id: oldDiscipline.id, ...(oldDiscipline.externalId ? { externalId: oldDiscipline.externalId } : {}) } : {}),
      modules: discipline.modules.map((module) => {
        const oldModule = matchContainer(oldDiscipline?.modules, module);
        return {
          ...module,
          ...(oldModule ? { id: oldModule.id, ...(oldModule.externalId ? { externalId: oldModule.externalId } : {}) } : {}),
          lessons: module.lessons.map((lesson) => {
            const pathMatch = byPath.get(`${discipline.title}|${module.title}|${lesson.title}`);
            const known = (lesson.externalId && byExternal.get(lesson.externalId))
              || (pathMatch && (!lesson.externalId || !pathMatch.externalId) ? pathMatch : null);
            if (!known || taken.has(known.id)) return lesson;
            taken.add(known.id);
            return { ...lesson, id: known.id, ...(known.externalId ? { externalId: known.externalId } : {}) };
          }),
        };
      }),
    };
  });
}

function idRemap(before, after) {
  const map = new Map();
  before.forEach((discipline, d) => discipline.modules.forEach((module, m) => module.lessons.forEach((lesson, l) => {
    const next = after[d].modules[m].lessons[l].id;
    if (next !== lesson.id) map.set(lesson.id, next);
  })));
  return map;
}

function mergeStructure(previousStructure, nextStructure) {
  const incomingIds = new Set(nextStructure.flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id))));
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
        if (!incoming.has(id)) {
          if (incomingIds.has(id)) lessons.delete(id);
          else lessons.set(id, { ...lesson, removedFromSource: true });
        }
      }
      modules.push({ ...module, lessons: [...lessons.values()] });
    }
    // Módulos que sumiram da fonte continuam visíveis: o progresso registrado
    // não pode desaparecer porque a plataforma reorganizou o curso.
    for (const oldModule of old?.modules || []) {
      if (modules.some((module) => module.id === oldModule.id)) continue;
      modules.push({ ...oldModule, lessons: oldModule.lessons.filter((lesson) => !incomingIds.has(lesson.id)).map((lesson) => ({ ...lesson, removedFromSource: true })) });
    }
    used.add(discipline.id);
    merged.push({ ...discipline, modules });
  }
  for (const old of previousStructure || []) {
    if (used.has(old.id)) continue;
    merged.push({ ...old, removedFromSource: true, modules: old.modules.map((module) => ({ ...module, lessons: module.lessons.filter((lesson) => !incomingIds.has(lesson.id)).map((lesson) => ({ ...lesson, removedFromSource: true })) })) });
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
// `observedCompletionIds`: aulas que a plataforma mostra concluídas desde a
// leitura anterior e que a pessoa confirmou registrar. Só vale para curso que
// já estava na biblioteca; a primeira leitura é sempre histórico sem XP.
export function applyCourseImport(state, payload, { selectedLessonIds = [], now = new Date().toISOString(), mode = 'create', courseId = null, edital = null, observedCompletionIds = [] } = {}) {
  if (!payload || !Array.isArray(payload.disciplines) || !payload.disciplines.length) {
    throw new Error('Nada para importar. Escolha pelo menos uma disciplina.');
  }
  const existing = (state.courses || []).find((course) => course.source?.identity === payload.identity)
    || (courseId ? (state.courses || []).find((course) => course.id === courseId && course.source) : null);
  const incoming = existing ? adoptExistingIds(materialStructure(existing), payload.disciplines) : payload.disciplines;
  const remap = idRemap(payload.disciplines, incoming);
  const requested = new Set((selectedLessonIds.length ? selectedLessonIds : allLessonIds(payload)).map((id) => remap.get(id) || id));
  observedCompletionIds = observedCompletionIds.map((id) => remap.get(id) || id);
  const structure = existing ? mergeStructure(materialStructure(existing), incoming) : incoming;
  const selection = mergeSelection(materialSteps(existing), structure, requested);
  const steps = stepsFromStructure(structure, selection);
  if (!steps.length) throw new Error('Nada para importar. Escolha pelo menos uma disciplina.');

  const added = steps.filter((step) => !materialSteps(existing).some((old) => old.id === step.id)).length;
  const removed = materialSteps(existing).filter((old) => !steps.some((step) => step.id === old.id)).length;
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
    type: existing?.type === 'project' ? 'project' : 'course',
    planning: false,
    units: unitsFromStructure(structure, selection),
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
    edital: edital || existing?.edital || null,
  };

  // Progresso já existente na fonte (por exemplo, uma página logada copiada com
  // aulas marcadas) entra como histórico identificado. Ele não concede XP: o
  // servidor ignora registros com origin 'import'/historical no cálculo de
  // elegibilidade. Conclusões manuais posteriores continuam elegíveis.
  const importedDoneIds = structure
    .flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons))
    .filter((lesson) => lesson.completedInSource === true && steps.some((step) => step.id === lesson.id))
    .map((lesson) => lesson.id);
  // Aula que a fonte mostra concluída e que ainda não está concluída aqui:
  // vira histórico de importação, ou conclusão por integração quando a pessoa
  // confirmou a observação numa leitura posterior.
  const observed = new Set(existing ? observedCompletionIds : []);
  const pendingIds = importedDoneIds.filter((stepId) => !isCompleted(state, stepId));
  const observedIds = pendingIds.filter((stepId) => observed.has(stepId));
  let progressState = state;
  for (const stepId of pendingIds) {
    const integration = observed.has(stepId);
    progressState = recordCompletion(progressState, {
      materialId: id,
      unitId: stepId,
      origin: integration ? 'integration' : 'import',
      historical: !integration,
      at: now,
      title: steps.find((item) => item.id === stepId)?.title || '',
      materialTitle: course.title,
      idPrefix: integration ? 'lesson' : 'import',
    }).state;
  }

  const record = {
    id: `imp_${stableHash(`${payload.identity}|${now}`)}`,
    courseId: id,
    at: now,
    provider: payload.provider.id,
    extraction: payload.extraction.kind,
    lessonCount: steps.length,
    added,
    removed,
    sourceCompleted: importedDoneIds.length,
    observed: observedIds.length,
    mode: existing ? 'update' : 'create',
  };

  return {
    ...state,
    courses: existing
      ? state.courses.map((item) => (item.id === id ? course : item))
      : [...state.courses, course],
    progress: progressState.progress || [],
    selectedCourseId: id,
    imports: [...(state.imports || []), record].slice(-50),
  };
}

// Acha, nos cursos importados, a aula cujo endereço é o da página aberta. A
// página da aula pode ter um complemento depois do endereço da aula
// (".../v/<id>/c/<id>"), então vale o endereço da aula que é prefixo da página,
// nunca o contrário: a página do curso não pode "casar" com todas as aulas.
export function findLessonByUrl(state, pageUrl) {
  const segments = (value) => {
    try {
      const url = new URL(String(value || ''));
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      const decode = (part) => { try { return decodeURIComponent(part); } catch { return part; } };
      return { host: url.hostname.toLowerCase().replace(/^www\./, ''), parts: url.pathname.split('/').filter(Boolean).map(decode) };
    } catch { return null; }
  };
  const page = segments(pageUrl);
  if (!page || !page.parts.length) return null;
  let best = null;
  for (const course of state.courses || []) {
    const selected = new Set(materialSteps(course).map((step) => step.id));
    for (const lesson of courseLessons(course)) {
      if (!lesson.url || lesson.removedFromSource || !selected.has(lesson.id)) continue;
      const target = segments(lesson.url);
      if (!target || target.host !== page.host || target.parts.length > page.parts.length) continue;
      if (!target.parts.every((part, index) => part === page.parts[index])) continue;
      if (!best || target.parts.length > best.length) best = { course, lesson, length: target.parts.length };
    }
  }
  return best ? { course: best.course, lesson: best.lesson } : null;
}

export function courseLessons(course) {
  return materialStructure(course).flatMap((discipline) => discipline.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, disciplineId: discipline.id, disciplineTitle: discipline.title, moduleTitle: module.title }))));
}

export function isImportedCourse(course) {
  return Boolean(course?.source?.identity && course.units?.some((unit) => unit.kind === 'discipline'));
}

// Rótulo curto da origem, sem prometer plataforma quando a entrada foi texto.
export function sourceLabel(source) {
  const kind = source?.extraction?.kind;
  if (kind === 'extension-capture') return 'Lido pela extensão na sua conta';
  if (kind === 'page-snapshot') return 'Página copiada da sua conta';
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
  const lessons = courseLessons(course).filter((lesson) => materialSteps(course).some((step) => step.id === lesson.id));
  const doneIds = completedUnitIds(state);
  const disciplines = materialStructure(course).map((discipline) => {
    const items = discipline.modules.flatMap((module) => module.lessons).filter((lesson) => materialSteps(course).some((step) => step.id === lesson.id));
    const done = items.filter((lesson) => doneIds.has(lesson.id)).length;
    return { id: discipline.id, title: discipline.title, done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0, removedFromSource: discipline.removedFromSource === true };
  }).filter((discipline) => discipline.total > 0);
  const done = lessons.filter((lesson) => doneIds.has(lesson.id)).length;
  const next = lessons.find((lesson) => !doneIds.has(lesson.id)) || null;
  const log = (state.progress || []).filter((entry) => entry.materialId === course.id && entry.type === 'completion');
  const lastStudied = [...log].reverse().find((entry) => !entry.revertedAt && entry.at) || null;
  const resume = lastStudied ? lessons.find((lesson) => lesson.id === lastStudied.unitId) || null : null;
  const activeLog = log.filter((entry) => !entry.revertedAt);
  const origin = activeLog.some((entry) => entry.origin === 'manual')
    ? 'manual'
    : activeLog.some((entry) => entry.origin === 'integration')
      ? 'integration'
      : activeLog.some((entry) => entry.origin === 'import')
        ? 'import'
        : null;
  return {
    total: lessons.length,
    done,
    percent: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
    disciplines,
    next,
    resume,
    lastStudiedAt: lastStudied?.at || null,
    origin,
    importedDone: activeLog.filter((entry) => entry.origin === 'import').length,
    sourceCompleted: lessons.filter((lesson) => lesson.completedInSource === true).length,
    partial: course.source?.completeness !== 'complete',
    removedFromSource: lessons.some((lesson) => lesson.removedFromSource),
  };
}

export function lessonOrigin(state, lessonId) {
  const origin = unitOrigin(state, lessonId);
  return origin === 'legacy' ? 'import' : origin;
}

// Concluir uma aula importada registra progresso com origem explícita.
// Não cria evento de XP: quem concede é o servidor, pela política vigente.
export function completeLesson(state, courseId, lessonId, { origin = 'manual', now = new Date().toISOString() } = {}) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  const lesson = materialSteps(course).find((item) => item.id === lessonId);
  if (!course || !lesson || isCompleted(state, lessonId)) return { state, added: false, xp: 0 };
  const result = recordCompletion(state, {
    materialId: courseId,
    unitId: lessonId,
    origin: origin === 'integration' ? 'integration' : 'manual',
    at: now,
    title: lesson.title,
    materialTitle: course.title,
    idPrefix: 'lesson',
  });
  return { state: result.state, added: result.added, xp: 0 };
}

export function revertLessonCompletion(state, courseId, lessonId, { now = new Date().toISOString() } = {}) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course || !isCompleted(state, lessonId)) return { state, reverted: false };
  const origin = lessonOrigin(state, lessonId);
  if (origin === 'integration') return { state, reverted: false, reason: 'integration' };
  if (origin === 'import') return { state, reverted: false, reason: 'import' };
  // O histórico não é apagado: fica registrado que a conclusão foi desfeita.
  const result = revertUnit(state, lessonId, now);
  return { state: result.state, reverted: result.reverted };
}

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
  const courseDisciplines = materialStructure(course).map((discipline) => ({ title: discipline.title, normalized: normalize(discipline.title) }));
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
  const text = `${course?.title || ''} ${materialStructure(course).map((discipline) => discipline.title).join(' ')}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\boab\b|exame de ordem|concurso|preparatorio/.test(text);
}
