// Política de XP v1 — compartilhada pelo navegador e pelo servidor.
//
// O navegador calcula apenas candidatos para exibição e para pedir a concessão.
// Quem decide, grava e impede repetição é o servidor (xp.js). O saldo legado do
// protótipo (5 XP por preparação, 10 XP por etapa/tarefa) fica separado e nunca
// entra aqui, no nível novo ou no ranking.

export const XP_POLICY_VERSION = 'v1';
export const LEVEL_XP = 500;
export const TIME_BLOCK_SECONDS = 30 * 60;
export const TIME_BLOCK_XP = 25;
export const DAILY_TIME_XP_CAP = 200;
export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export const XP_VALUES = Object.freeze({
  lesson: 100,
  reading: 100,
  exercise: 100,
  delivery: 150,
  slide: 100,
  course_bonus: 500,
  project_bonus: 500,
});

export const STEP_KINDS = Object.freeze(['lesson', 'reading', 'exercise', 'delivery']);
export const BONUS_KINDS = Object.freeze(['course_bonus', 'project_bonus']);
export const ALL_KINDS = Object.freeze([...STEP_KINDS, ...BONUS_KINDS, 'slide', 'time_block', 'adjustment']);

export const XP_KIND_LABELS = Object.freeze({
  lesson: 'Aula concluída',
  reading: 'Leitura concluída',
  exercise: 'Lista de exercícios concluída',
  delivery: 'Entrega de projeto',
  slide: 'Apresentação concluída',
  course_bonus: 'Curso completo',
  project_bonus: 'Projeto completo',
  time_block: 'Bloco de 30 minutos',
  adjustment: 'Ajuste de integridade',
});

export function levelForXP(value) {
  const xp = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  return 1 + Math.floor(xp / LEVEL_XP);
}

export function levelProgress(value) {
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  return {
    level: levelForXP(total),
    current: total % LEVEL_XP,
    next: LEVEL_XP,
    total,
  };
}

export function xpForKind(kind) {
  return XP_VALUES[kind] ?? 0;
}

export function isImportedCourse(course) {
  return Boolean(course && course.source && Array.isArray(course.structure));
}

// Um curso "planejado" (por exemplo, "definir o próximo marco") organiza a
// biblioteca, mas não é uma unidade de estudo. Ele não gera XP até ser
// substituído por um material concreto.
export function isEligibleCourse(course) {
  return Boolean(course)
    && course.example !== true
    && course.planning !== true
    && course.source?.demo !== true
    && Array.isArray(course.steps)
    && course.steps.length > 0;
}

export function completionKindForCourse(course) {
  if (!course) return 'lesson';
  if (isImportedCourse(course)) return 'lesson';
  if (course.type === 'article' || course.type === 'book') return 'reading';
  if (course.type === 'exercise') return 'exercise';
  if (course.type === 'project') return 'delivery';
  return 'lesson';
}

export function bonusKindForCourse(course) {
  return course?.type === 'project' ? 'project_bonus' : 'course_bonus';
}

export function stepEventKey(kind, courseId, stepId) {
  return `step|${kind}|${courseId}|${stepId}`;
}

export function bonusEventKey(kind, courseId) {
  return `bonus|${kind}|${courseId}`;
}

export function timeEventKey(sessionId, index) {
  return `time|${sessionId}|${index}`;
}

export function slideEventKey(courseId) {
  return `slide|${courseId}`;
}

export function slideProgressSnapshot(course) {
  const slides = Array.isArray(course?.slides)
    ? course.slides.filter((slide) => slide && typeof slide.id === 'string' && slide.id)
    : [];
  const progress = course?.slideProgress && typeof course.slideProgress === 'object' ? course.slideProgress : {};
  const known = new Set(slides.map((slide) => slide.id));
  const seen = Array.isArray(progress.seen) ? [...new Set(progress.seen.filter((id) => known.has(id)))] : [];
  const seenCount = seen.length;
  const percent = slides.length ? Math.round((seenCount / slides.length) * 100) : 0;
  const lastSeen = slides.length > 0 && progress.lastId === slides[slides.length - 1].id;
  const completedAt = Number.isFinite(Date.parse(progress.completedAt)) ? new Date(progress.completedAt).toISOString() : null;
  return {
    total: slides.length,
    seenCount,
    percent,
    nearEnd: slides.length > 0 && seenCount / slides.length >= 0.8,
    lastSeen,
    completedAt,
    completed: Boolean(completedAt) && slides.length > 0 && seenCount / slides.length >= 0.8 && lastSeen,
  };
}

// Uma grade completa da fonte não basta: se a pessoa escolheu só parte das
// disciplinas, o curso inteiro continua em aberto e o bônus não é liberado.
export function courseGradeIsComplete(course) {
  if (!isImportedCourse(course)) return true;
  if (course.source.completeness !== 'complete') return false;
  const total = (course.structure || [])
    .flatMap((discipline) => discipline.modules || [])
    .flatMap((module) => module.lessons || [])
    .filter((lesson) => lesson && lesson.removedFromSource !== true)
    .length;
  return total > 0 && course.steps.length >= total;
}

export function normalizeTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_TIME_ZONE;
  const candidate = value.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function localDay(timeZone, date = new Date()) {
  const zone = normalizeTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

function timeZoneOffsetMs(timeZone, date) {
  const zone = normalizeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const asUTC = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour) % 24, Number(values.minute), Number(values.second),
  );
  return asUTC - date.getTime();
}

// Meia-noite do dia informado no fuso, convertida para o instante UTC.
export function zonedDayStartUtc(day, timeZone) {
  const [year, month, date] = String(day).split('-').map(Number);
  const guess = Date.UTC(year, (month || 1) - 1, date || 1, 0, 0, 0, 0);
  let offset = timeZoneOffsetMs(timeZone, new Date(guess));
  let result = guess - offset;
  const adjusted = timeZoneOffsetMs(timeZone, new Date(result));
  if (adjusted !== offset) result = guess - adjusted;
  return result;
}

function dayString(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Semana começa na segunda-feira. O período é sempre devolvido em dias do
// calendário do fuso, e o fim é exclusivo.
export function periodDays(period, timeZone, now = new Date()) {
  const today = localDay(timeZone, now);
  const [year, month, date] = today.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, date));
  let start;
  if (period === 'month') {
    start = new Date(Date.UTC(year, month - 1, 1));
  } else {
    const mondayOffset = (cursor.getUTCDay() + 6) % 7;
    start = new Date(Date.UTC(year, month - 1, date - mondayOffset));
  }
  const end = new Date(start);
  if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 7);
  return {
    kind: period === 'month' ? 'month' : 'week',
    startDay: dayString(start),
    endDay: dayString(end),
    startUtc: zonedDayStartUtc(dayString(start), timeZone),
    endUtc: zonedDayStartUtc(dayString(end), timeZone),
  };
}

export function periodLabel(period, timeZone) {
  const range = periodDays(period, timeZone);
  const format = (day) => new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', day: '2-digit', month: 'short',
  }).format(new Date(`${day}T12:00:00Z`));
  const lastDay = new Date(`${range.endDay}T12:00:00Z`);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return `${format(range.startDay)} – ${format(dayString(lastDay))}`;
}
