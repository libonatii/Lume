// Registro único de progresso (estado v2).
//
// Até a versão 1 o progresso vivia em três listas que precisavam concordar:
// `completed` (ids), `history` (materiais criados à mão, com o saldo legado de
// 5/10 XP e as preparações) e `studyLog` (aulas importadas). Agora há uma lista
// só, `state.progress`, que apenas cresce: desfazer uma conclusão marca o evento
// com `revertedAt`, nunca o apaga. Tudo o mais é derivado daqui.
//
// Evento: { id, type: 'completion' | 'preparation', materialId, unitId,
//           origin: 'manual' | 'integration' | 'import' | 'legacy',
//           historical, at (ISO ou null), revertedAt?, title, materialTitle, legacyXp? }
//
// `historical` marca o que entrou como registro, não como estudo feito agora
// (aula lida já concluída na primeira importação, conclusão antiga sem data).
// Nada histórico participa da política de XP.

export const PROGRESS_ORIGINS = Object.freeze(['manual', 'integration', 'import', 'legacy']);
export const MAX_PROGRESS_EVENTS = 20000;

const LEGACY_XP = new Set([0, 5, 10]);
const derived = new WeakMap();

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

// Cada item é validado sozinho: um registro estragado é descartado sem levar o
// resto junto. Ids repetidos ficam com a primeira ocorrência.
export function normalizeProgress(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const events = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.id !== 'string' || !item.id || seen.has(item.id)) continue;
    if (item.type !== 'completion' && item.type !== 'preparation') continue;
    if (typeof item.materialId !== 'string' || typeof item.unitId !== 'string' || !item.unitId) continue;
    if (!PROGRESS_ORIGINS.includes(item.origin)) continue;
    if (item.at !== null && !validDate(item.at)) continue;
    seen.add(item.id);
    events.push({
      id: item.id,
      type: item.type,
      materialId: item.materialId,
      unitId: item.unitId,
      origin: item.origin,
      historical: item.historical === true,
      at: item.at,
      ...(validDate(item.revertedAt) ? { revertedAt: item.revertedAt } : {}),
      title: cleanText(item.title),
      materialTitle: cleanText(item.materialTitle),
      ...(LEGACY_XP.has(item.legacyXp) && item.legacyXp > 0 ? { legacyXp: item.legacyXp } : {}),
    });
  }
  return events.slice(-MAX_PROGRESS_EVENTS);
}

// Conversão v1 → v2. Invariante: o conjunto de aulas concluídas derivado do
// resultado é exatamente o `completed` do documento v1. Preparação continua
// preparação; o saldo legado continua no evento (`legacyXp`), fora do XP novo.
export function progressFromV1({ completed = [], history = [], studyLog = [], courses = [] }) {
  const done = new Set(Array.isArray(completed) ? completed : []);
  const titles = new Map();
  for (const course of courses || []) {
    for (const step of course?.steps || []) titles.set(step.id, { title: step.title, materialId: course.id, materialTitle: course.title });
  }
  const events = [];
  const ids = new Set();
  const uniqueId = (base) => {
    let id = base;
    for (let n = 2; ids.has(id); n += 1) id = `${base}#${n}`;
    ids.add(id);
    return id;
  };

  for (const entry of Array.isArray(history) ? history : []) {
    if (!entry || typeof entry.stepId !== 'string' || !validDate(entry.at)) continue;
    const preparation = entry.preparation === true || String(entry.id || '').startsWith('prepare:');
    const legacyXp = LEGACY_XP.has(entry.xp) && entry.xp > 0 ? entry.xp : undefined;
    events.push({
      id: uniqueId(typeof entry.id === 'string' && entry.id ? entry.id : `${preparation ? 'prepare' : 'step'}:${entry.stepId}`),
      type: preparation ? 'preparation' : 'completion',
      materialId: entry.courseId,
      unitId: entry.stepId,
      origin: legacyXp ? 'legacy' : 'manual',
      historical: false,
      at: entry.at,
      // Conclusão no histórico sem estar em `completed`: preservada como desfeita.
      ...(!preparation && !done.has(entry.stepId) ? { revertedAt: entry.at } : {}),
      title: cleanText(entry.title),
      materialTitle: cleanText(entry.courseTitle),
      ...(legacyXp ? { legacyXp } : {}),
    });
  }

  for (const entry of Array.isArray(studyLog) ? studyLog : []) {
    if (!entry || typeof entry.stepId !== 'string' || !validDate(entry.at)) continue;
    const origin = ['manual', 'integration', 'import'].includes(entry.origin) ? entry.origin : 'manual';
    events.push({
      id: uniqueId(typeof entry.id === 'string' && entry.id ? entry.id : `lesson:${entry.stepId}`),
      type: 'completion',
      materialId: entry.courseId,
      unitId: entry.stepId,
      origin,
      historical: entry.historical === true || origin === 'import',
      at: entry.at,
      ...(validDate(entry.revertedAt) ? { revertedAt: entry.revertedAt } : {}),
      title: cleanText(entry.lessonTitle),
      materialTitle: cleanText(entry.courseTitle),
    });
  }

  // Concluída sem nenhum registro ativo: conclusão antiga sem data, só histórico.
  const active = completedSetOf(events);
  for (const unitId of done) {
    if (active.has(unitId)) continue;
    const known = titles.get(unitId) || {};
    events.push({
      id: uniqueId(`legacy:${unitId}`),
      type: 'completion',
      materialId: known.materialId || '',
      unitId,
      origin: 'legacy',
      historical: true,
      at: null,
      title: cleanText(known.title),
      materialTitle: cleanText(known.materialTitle),
    });
  }

  // Conclusão ativa de aula fora de `completed` (ex.: revertida só na lista
  // antiga): fica registrada como desfeita para preservar o v1.
  const now = new Date(0).toISOString();
  return events.map((event) => (event.type === 'completion' && !event.revertedAt && !done.has(event.unitId)
    ? { ...event, revertedAt: event.at || now }
    : event));
}

function completedSetOf(events) {
  const set = new Set();
  for (const event of events) {
    if (event.type === 'completion' && !event.revertedAt) set.add(event.unitId);
  }
  return set;
}

function indexOf(state) {
  const events = state?.progress || [];
  let index = derived.get(events);
  if (!index) {
    const completed = completedSetOf(events);
    const byUnit = new Map();
    for (const event of events) {
      if (!byUnit.has(event.unitId)) byUnit.set(event.unitId, []);
      byUnit.get(event.unitId).push(event);
    }
    index = { completed, byUnit };
    derived.set(events, index);
  }
  return index;
}

export function completedUnitIds(state) {
  return indexOf(state).completed;
}

export function isCompleted(state, unitId) {
  return indexOf(state).completed.has(unitId);
}

export function unitEvents(state, unitId) {
  return indexOf(state).byUnit.get(unitId) || [];
}

export function activeCompletions(state) {
  return (state?.progress || []).filter((event) => event.type === 'completion' && !event.revertedAt);
}

export function hasPreparationFor(state, unitId) {
  return unitEvents(state, unitId).some((event) => event.type === 'preparation');
}

export function materialHasActivity(state, materialId) {
  return (state?.progress || []).some((event) => event.materialId === materialId);
}

// Origem que vale para a aula: manual > integração > importação > legado.
export function unitOrigin(state, unitId) {
  const active = unitEvents(state, unitId).filter((event) => event.type === 'completion' && !event.revertedAt);
  if (!active.length) return null;
  for (const origin of ['manual', 'integration', 'import', 'legacy']) {
    if (active.some((event) => event.origin === origin)) return origin;
  }
  return null;
}

// Momento da conclusão que pode valer XP: o registro ativo mais recente que não
// é histórico. Sem data, não há como comparar com o marco da política.
export function completionTime(state, unitId) {
  const events = unitEvents(state, unitId)
    .filter((event) => event.type === 'completion' && !event.revertedAt && !event.historical && event.at);
  const at = Date.parse(events.at(-1)?.at);
  return Number.isFinite(at) ? at : null;
}

export function legacyProgressXp(state) {
  return (state?.progress || []).reduce((total, event) => total + (event.legacyXp || 0), 0);
}

function newId(prefix, unitId, state) {
  const base = `${prefix}:${unitId}`;
  const taken = new Set((state.progress || []).map((event) => event.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    if (!taken.has(`${base}#${n}`)) return `${base}#${n}`;
  }
}

// Registra a conclusão. Repetir com a aula já concluída não muda nada.
export function recordCompletion(state, { materialId, unitId, origin = 'manual', historical = false, at = new Date().toISOString(), title = '', materialTitle = '', idPrefix = 'step' }) {
  if (isCompleted(state, unitId)) return { state, added: false };
  const event = {
    id: newId(idPrefix, unitId, state),
    type: 'completion',
    materialId,
    unitId,
    origin: PROGRESS_ORIGINS.includes(origin) ? origin : 'manual',
    historical: historical === true,
    at,
    title: cleanText(title),
    materialTitle: cleanText(materialTitle),
  };
  return { state: { ...state, progress: [...(state.progress || []), event] }, added: true, event };
}

export function recordPreparation(state, { materialId, unitId, at = new Date().toISOString(), title = '', materialTitle = '' }) {
  if (hasPreparationFor(state, unitId)) return { state, added: false };
  const event = {
    id: newId('prepare', unitId, state),
    type: 'preparation',
    materialId,
    unitId,
    origin: 'manual',
    historical: false,
    at,
    title: cleanText(title),
    materialTitle: cleanText(materialTitle),
  };
  return { state: { ...state, progress: [...(state.progress || []), event] }, added: true, event };
}

// Desfaz sem apagar: as conclusões ativas da aula ganham `revertedAt`.
export function revertUnit(state, unitId, at = new Date().toISOString()) {
  if (!isCompleted(state, unitId)) return { state, reverted: false };
  return {
    state: {
      ...state,
      progress: state.progress.map((event) => (event.unitId === unitId && event.type === 'completion' && !event.revertedAt
        ? { ...event, revertedAt: at }
        : event)),
    },
    reverted: true,
  };
}

// Remove os eventos de unidades que deixaram de existir (material excluído).
export function pruneProgress(progress, validUnitIds) {
  return (progress || []).filter((event) => validUnitIds.has(event.unitId));
}

// União de duas cópias por id. Quando o mesmo evento está desfeito de um lado
// e ativo do outro:
// - restauração de cópia (padrão): fica ativo — restaurar nunca tira progresso;
// - sincronização entre dispositivos (`revertWins`): fica desfeito — desfazer
//   num aparelho vale para os outros.
export function mergeProgress(current, incoming, { revertWins = false } = {}) {
  const byId = new Map((current || []).map((event) => [event.id, event]));
  for (const event of incoming || []) {
    const existing = byId.get(event.id);
    if (!existing) {
      byId.set(event.id, event);
      continue;
    }
    if (revertWins && !existing.revertedAt && event.revertedAt) {
      byId.set(event.id, { ...existing, revertedAt: event.revertedAt });
    } else if (!revertWins && existing.revertedAt && !event.revertedAt) {
      const { revertedAt: _revertedAt, ...active } = existing;
      byId.set(event.id, active);
    }
  }
  return [...byId.values()];
}
