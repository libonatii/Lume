// Restauração de cópia JSON. A mesclagem é conservadora: mantém o material
// atual, acrescenta materiais que ainda não existem e une o registro de progresso,
// tarefas e sessões sem duplicar ids. Preferências, privacidade e onboarding
// atuais não são substituídos pela cópia.
//
// O XP validado não viaja neste arquivo: ele vive no livro de eventos do
// servidor. Restaurar uma cópia não recria nem duplica recompensas.

import { STATE_VERSION, restoreState } from './domain.js';
import { completedUnitIds, mergeProgress } from './progress-domain.js';

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;

export class BackupError extends Error {
  constructor(message, code = 'backup_error') {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}

export function readBackup(text) {
  if (typeof text !== 'string' || !text.trim()) throw new BackupError('O arquivo está vazio.', 'empty');
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) {
    throw new BackupError('A cópia é grande demais (limite de 2 MB).', 'too_large');
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Este arquivo não é um JSON válido.', 'invalid_json');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BackupError('Este arquivo não parece uma cópia do Lume.', 'invalid_shape');
  // Cópias da versão 1 (com `completed` e `history`) continuam aceitas e são
  // convertidas para o registro único de progresso.
  const v1 = raw.version === 1 && Array.isArray(raw.completed) && Array.isArray(raw.history);
  const v2 = raw.version === STATE_VERSION && Array.isArray(raw.progress);
  if (!Array.isArray(raw.courses) || (!v1 && !v2)) {
    throw new BackupError('A cópia não tem o formato de progresso do Lume.', 'invalid_version');
  }
  const restored = restoreState(JSON.stringify(raw));
  if (!restored || restored.version !== STATE_VERSION) throw new BackupError('Não foi possível ler a cópia.', 'invalid_state');
  return restored;
}

function mergeById(current, incoming) {
  const map = new Map((current || []).map((item) => [item.id, item]));
  for (const item of incoming || []) {
    if (item?.id && !map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function mergeCourseSteps(currentSteps, incomingSteps) {
  const map = new Map((currentSteps || []).map((step) => [step.id, step]));
  for (const step of incomingSteps || []) {
    if (step?.id && !map.has(step.id)) map.set(step.id, step);
  }
  return [...map.values()];
}

function mergeCourseProgress(current, incoming) {
  const steps = mergeCourseSteps(current.steps, incoming.steps);
  const slides = mergeById(current.slides || [], incoming.slides || []);
  const seen = new Set([
    ...(current.slideProgress?.seen || []),
    ...(incoming.slideProgress?.seen || []),
  ].filter((id) => slides.some((slide) => slide.id === id)));
  const completedAt = [current.slideProgress?.completedAt, incoming.slideProgress?.completedAt]
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()
    .at(-1) || null;
  return {
    ...current,
    steps,
    slides,
    // Mantém as escolhas atuais de título, tipo, link e privacidade.
    slideProgress: {
      seen: [...seen],
      lastId: seen.has(current.slideProgress?.lastId) ? current.slideProgress.lastId : (seen.has(incoming.slideProgress?.lastId) ? incoming.slideProgress.lastId : ''),
      completedAt,
    },
  };
}

export function mergeBackup(current, incoming) {
  const currentCourses = current.courses || [];
  const incomingCourses = incoming.courses || [];
  const currentIds = new Set(currentCourses.map((course) => course.id));
  const byId = new Map(currentCourses.map((course) => [course.id, course]));
  for (const course of incomingCourses) {
    if (!course?.id) continue;
    if (!byId.has(course.id)) {
      byId.set(course.id, course);
      continue;
    }
    const existing = byId.get(course.id);
    byId.set(course.id, mergeCourseProgress(existing, course));
  }
  const courses = [...byId.values()];
  const validCourses = new Set(courses.map((course) => course.id));
  const stepIds = new Set(courses.flatMap((course) => course.steps.map((step) => step.id)));
  // Restaurar nunca tira progresso: conclusão ativa em qualquer lado continua ativa.
  const progress = mergeProgress(current.progress || [], incoming.progress || [])
    .filter((event) => stepIds.has(event.unitId));
  const tasks = mergeById(current.tasks || [], incoming.tasks || []).map((task) => ({
    ...task,
    courseId: validCourses.has(task.courseId) ? task.courseId : '',
  }));
  const sessions = mergeById(current.studySessions || [], incoming.studySessions || []);
  return {
    ...current,
    courses,
    progress,
    tasks,
    studySessions: sessions,
    imports: mergeById(current.imports || [], incoming.imports || []),
    selectedCourseId: validCourses.has(current.selectedCourseId)
      ? current.selectedCourseId
      : (courses[0]?.id ?? null),
  };
}

export function previewBackup(current, incoming) {
  const currentCourses = new Set((current.courses || []).map((course) => course.id));
  const currentCompleted = completedUnitIds(current);
  const currentEvents = new Set((current.progress || []).map((event) => event.id));
  const currentTasks = new Set((current.tasks || []).map((task) => task.id));
  const currentSessions = new Set((current.studySessions || []).map((session) => session.id));
  const newCourses = (incoming.courses || []).filter((course) => !currentCourses.has(course.id));
  return {
    newCourses: newCourses.map((course) => course.title).slice(0, 8),
    newCourseCount: newCourses.length,
    newCompleted: [...completedUnitIds(incoming)].filter((id) => !currentCompleted.has(id)).length,
    newProgress: (incoming.progress || []).filter((event) => !currentEvents.has(event.id)).length,
    newTasks: (incoming.tasks || []).filter((task) => !currentTasks.has(task.id)).length,
    newSessions: (incoming.studySessions || []).filter((session) => !currentSessions.has(session.id)).length,
    unchanged: (incoming.courses || []).length - newCourses.length,
  };
}
