// Sessão de estudo declarada pela pessoa.
//
// O que isto é: um marcador de tempo que a própria pessoa inicia, pausa e
// encerra, ligado a um material. Serve para continuidade e para a presença
// ("estou estudando agora").
//
// O que isto não é: observação de atividade ou prova de estudo. A sessão é um
// registro declarado. O XP de tempo só é concedido pelo servidor, em blocos de
// 30 minutos, depois que a sessão é encerrada e o intervalo é validado.

export const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
export const STALE_SESSION_MS = 5 * 60 * 1000;
export const MAX_STORED_SESSIONS = 200;

function iso(value) {
  return new Date(value).toISOString();
}

function clampDuration(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), MAX_SESSION_MS);
}

export function normalizeActiveSession(value) {
  if (!value || typeof value !== 'object') return null;
  const startedAt = Date.parse(value.startedAt);
  const lastTickAt = Date.parse(value.lastTickAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(lastTickAt)) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `sess_${startedAt}`,
    courseId: typeof value.courseId === 'string' ? value.courseId : '',
    stepId: typeof value.stepId === 'string' ? value.stepId : '',
    label: typeof value.label === 'string' ? value.label.slice(0, 160) : 'Sessão de estudo',
    status: value.status === 'paused' ? 'paused' : 'active',
    startedAt: new Date(startedAt).toISOString(),
    lastTickAt: new Date(lastTickAt).toISOString(),
    accumulatedMs: clampDuration(value.accumulatedMs),
  };
}

export function normalizeStudySessions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && Number.isFinite(Date.parse(entry.startedAt)) && Number.isFinite(Date.parse(entry.endedAt)))
    .slice(-MAX_STORED_SESSIONS)
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : `sess_${entry.startedAt}`,
      courseId: typeof entry.courseId === 'string' ? entry.courseId : '',
      stepId: typeof entry.stepId === 'string' ? entry.stepId : '',
      label: typeof entry.label === 'string' ? entry.label.slice(0, 160) : 'Sessão de estudo',
      startedAt: new Date(entry.startedAt).toISOString(),
      endedAt: new Date(entry.endedAt).toISOString(),
      durationMs: clampDuration(entry.durationMs),
      origin: entry.origin === 'companion' ? 'companion' : 'declared',
    }));
}

// Tempo decorrido acumulado. Enquanto ativa, soma o intervalo desde o último
// batimento — por isso um recarregamento curto não perde o tempo.
export function sessionElapsed(session, now = Date.now()) {
  if (!session) return 0;
  const base = clampDuration(session.accumulatedMs);
  if (session.status !== 'active') return base;
  return clampDuration(base + Math.max(0, now - Date.parse(session.lastTickAt)));
}

export function formatSessionDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function startSession(state, { courseId = '', stepId = '', label = '' } = {}, now = Date.now()) {
  const closed = state.activeSession ? endSession(state, now) : null;
  const base = closed ? closed.state : state;
  const startedAt = iso(now);
  return {
    ...base,
    activeSession: {
      id: `sess_${now}_${Math.random().toString(36).slice(2, 8)}`,
      courseId: cleanId(courseId),
      stepId: cleanId(stepId),
      label: cleanLabel(label) || 'Sessão de estudo',
      status: 'active',
      startedAt,
      lastTickAt: startedAt,
      accumulatedMs: 0,
    },
  };
}

export function pauseSession(state, now = Date.now()) {
  const session = state.activeSession;
  if (!session || session.status !== 'active') return state;
  return {
    ...state,
    activeSession: {
      ...session,
      status: 'paused',
      accumulatedMs: sessionElapsed(session, now),
      lastTickAt: iso(now),
    },
  };
}

export function resumeSession(state, now = Date.now()) {
  const session = state.activeSession;
  if (!session || session.status === 'active') return state;
  return { ...state, activeSession: { ...session, status: 'active', lastTickAt: iso(now) } };
}

export function endSession(state, now = Date.now()) {
  const session = state.activeSession;
  if (!session) return { state, session: null };
  const durationMs = sessionElapsed(session, now);
  const closed = {
    id: session.id,
    courseId: session.courseId,
    stepId: session.stepId,
    label: session.label,
    startedAt: session.startedAt,
    endedAt: iso(now),
    durationMs,
    origin: 'declared',
  };
  return {
    state: {
      ...state,
      activeSession: null,
      studySessions: [...normalizeStudySessions(state.studySessions), closed].slice(-MAX_STORED_SESSIONS),
    },
    session: closed,
  };
}

// Batimento periódico: mantém o tempo contando entre recarregamentos sem
// transformar a presença em observação. Chamado a cada minuto pela interface.
export function touchSession(state, now = Date.now()) {
  const session = state.activeSession;
  if (!session || session.status !== 'active') return state;
  return {
    ...state,
    activeSession: {
      ...session,
      accumulatedMs: sessionElapsed(session, now),
      lastTickAt: iso(now),
    },
  };
}

// Ao carregar, uma sessão ativa há muito tempo sem batimento é pausada. Assim
// uma aba esquecida aberta por dias não vira "tempo de estudo".
export function reconcileSession(state, now = Date.now(), { staleMs = STALE_SESSION_MS } = {}) {
  const session = state.activeSession;
  if (!session || session.status !== 'active') return state;
  if (now - Date.parse(session.lastTickAt) <= staleMs) return state;
  return {
    ...state,
    activeSession: { ...session, status: 'paused', lastTickAt: iso(now) },
  };
}

function cleanId(value) {
  return typeof value === 'string' && value.length <= 120 ? value : '';
}

function cleanLabel(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

// Data civil local (AAAA-MM-DD) de um instante. As métricas de ritmo contam
// pelo dia de quem estuda, não pelo UTC.
export function localDay(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Minutos declarados por dia, do mais antigo ao de hoje. Cada sessão conta no
// dia em que começou; a sessão em andamento entra em hoje. É ritmo declarado,
// não prova de estudo, e não altera XP.
export function minutesByDay(state, days = 7, now = Date.now()) {
  const keys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    keys.push(localDay(date));
  }
  const totals = new Map(keys.map((key) => [key, { date: key, minutes: 0, sessions: 0 }]));
  for (const session of normalizeStudySessions(state?.studySessions)) {
    const entry = totals.get(localDay(Date.parse(session.startedAt)));
    if (!entry) continue;
    entry.minutes += session.durationMs / 60000;
    entry.sessions += 1;
  }
  const active = state?.activeSession ? normalizeActiveSession(state.activeSession) : null;
  const today = totals.get(localDay(now));
  if (active && today) today.minutes += sessionElapsed(active, now) / 60000;
  return keys.map((key) => {
    const entry = totals.get(key);
    return { ...entry, minutes: Math.round(entry.minutes) };
  });
}

// Comparação gentil entre os últimos sete dias e os sete anteriores. Sem
// histórico anterior, não há porcentagem para não inventar crescimento.
export function weeklyRhythm(state, now = Date.now()) {
  const fortnight = minutesByDay(state, 14, now);
  const previous = fortnight.slice(0, 7).reduce((sum, day) => sum + day.minutes, 0);
  const current = fortnight.slice(7).reduce((sum, day) => sum + day.minutes, 0);
  const activeDays = fortnight.slice(7).filter((day) => day.minutes > 0).length;
  return {
    days: fortnight.slice(7),
    current,
    previous,
    activeDays,
    average: Math.round(current / 7),
    change: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
}

export function formatMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${hours}h`;
}
