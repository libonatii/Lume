// Resolução de conflito entre duas cópias sincronizadas.
//
// A biblioteca e o progresso são unidos sem apagar o que só existe de um lado.
// Metadados do material e preferências desta sessão são preservados; o servidor
// continua sendo quem decide a revisão. O XP elegível não faz parte deste
// documento e nunca é mesclado aqui.

import { STATE_VERSION, restoreState } from './domain.js';
import { mergeProgress } from './progress-domain.js';
import { mergeBackup } from './backup-domain.js';

function onboardingTime(value) {
  const candidate = value && typeof value === 'object' ? value : {};
  return Math.max(
    Number.isFinite(Date.parse(candidate.finishedAt)) ? Date.parse(candidate.finishedAt) : 0,
    Number.isFinite(Date.parse(candidate.savedAt)) ? Date.parse(candidate.savedAt) : 0,
  );
}

function newerOnboarding(left, right) {
  return onboardingTime(left) >= onboardingTime(right) ? left : right;
}

function usableProfile(value) {
  return Boolean(value && (value.bio || value.avatar || value.header));
}

export function mergeStates(local, remote) {
  const left = restoreState(JSON.stringify(local));
  const right = restoreState(JSON.stringify(remote));
  // `mergeBackup(local, remote)` preserva títulos, tipos e privacidade da
  // sessão atual e acrescenta cursos/progresso que só existem no outro lado.
  const merged = mergeBackup(left, right);
  const onboarding = newerOnboarding(left.onboarding, right.onboarding);
  const courses = merged.courses || [];
  const remoteTasks = new Map((right.tasks || []).map((task) => [task.id, task]));
  const tasks = (merged.tasks || []).map((task) => {
    const other = remoteTasks.get(task.id);
    if (!other) return task;
    if (other.done && !task.done) return { ...task, done: true, completedAt: other.completedAt };
    if (task.done && other.done && other.completedAt && (!task.completedAt || Date.parse(other.completedAt) > Date.parse(task.completedAt))) {
      return { ...task, completedAt: other.completedAt };
    }
    return task;
  });
  // Entre dispositivos, desfazer uma conclusão num deles vale para o outro.
  const stepIds = new Set(courses.flatMap((course) => course.steps.map((step) => step.id)));
  const progress = mergeProgress(left.progress || [], right.progress || [], { revertWins: true })
    .filter((event) => stepIds.has(event.unitId));
  const selected = courses.some((course) => course.id === merged.selectedCourseId)
    ? merged.selectedCourseId
    : (courses[0]?.id ?? null);
  return {
    ...merged,
    version: STATE_VERSION,
    courses,
    progress,
    tasks,
    // O plano é configuração, como as preferências: vale o desta sessão.
    plan: left.plan || right.plan,
    selectedCourseId: selected,
    // Preferências e perfil são escolhas desta sessão. O progresso do outro
    // dispositivo entra, mas não sobrescreve privacidade ou conforto.
    preferences: left.preferences,
    profile: usableProfile(left.profile) ? left.profile : right.profile,
    onboarding,
    onboarded: left.onboarded || right.onboarded || onboarding.status === 'done',
    habit: onboarding.journey || left.habit || right.habit || null,
    activeSession: left.activeSession || right.activeSession,
  };
}

export function statesDiffer(left, right) {
  try {
    return JSON.stringify(left) !== JSON.stringify(right);
  } catch {
    return true;
  }
}
