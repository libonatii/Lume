// Registro único de progresso (estado v3).
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
