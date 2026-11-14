// Perfil compartilhado: projeta somente as seções autorizadas da biblioteca.
// Nas contas, XP e conquistas vêm do livro do servidor; percentuais de progresso
// continuam sendo registros declarados, não prova de compreensão.
import {
  achievements, courseProgress, courseStatus, levelInfo, normalizeProfileCard, STUDY_TYPES,
} from './domain.js';
import { studyPlan } from './study-plan.js';
import { materialSteps } from './material-model.js';

export const STUDYING_LIMIT = 6;
export const PROJECTS_LIMIT = 8;
export const QUEUE_LIMIT = 5;
export const RECENT_ACTIVITY_LIMIT = 4;
export const RECENT_ACTIVITY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Ausência de escolha significa compartilhar: são os padrões decididos para o perfil.
export function normalizeSharing(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    library: source.library !== false,
    queue: source.queue !== false,
    progress: source.progress !== false,
    xp: source.xp !== false,
    // Padrão ligado: a pessoa é achada pelo @usuário e o perfil abre a quem não é amigo; desligar fecha os dois.
    public: source.public !== false,
  };
}

function typeLabel(course) {
  return STUDY_TYPES.find((type) => type.id === course.type)?.title || 'Material';
}

function realCourses(state) {
  const courses = Array.isArray(state?.courses) ? state.courses : [];
  return courses.filter((course) => course && course.example !== true && materialSteps(course).length > 0);
}

// Um projeto só aparece no perfil quando a pessoa marca explicitamente.
export function isPublicProject(course) {
  return Boolean(course && course.type === 'project' && course.shared === true);
}

function safeArt(art) {
  return ['design', 'code', 'language', 'nature'].includes(art) ? art : 'nature';
}

function buildRecentActivity(state, courses, { sharing, now }) {
  if (!sharing.library || !sharing.progress) {
    return { items: [], recentStepsTwoWeeks: null, recentMinutesTwoWeeks: null };
  }
  const visibleIds = new Set(courses.map((course) => course.id));
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const cutoff = now - RECENT_ACTIVITY_WINDOW_MS;

  const eventsByCourse = new Map();
  let recentStepsTwoWeeks = 0;
  let recentDurationMs = 0;

  const touch = (courseId, at, label, isStep = false) => {
    if (!visibleIds.has(courseId)) return;
    const timestamp = Date.parse(at);
    if (!Number.isFinite(timestamp)) return;
    if (isStep && timestamp >= cutoff) recentStepsTwoWeeks += 1;
    const current = eventsByCourse.get(courseId) || { lastAt: 0, lastLabel: '', stepsCount: 0, durationMs: 0 };
    if (timestamp >= current.lastAt) {
      current.lastAt = timestamp;
      current.lastLabel = label || current.lastLabel;
    }
    if (isStep) current.stepsCount += 1;
    eventsByCourse.set(courseId, current);
  };

  for (const entry of state?.progress || []) {
    if (entry.revertedAt || !entry.at) continue;
    touch(entry.materialId, entry.at, entry.title, entry.type === 'completion');
  }
  for (const session of state?.studySessions || []) {
    if (!visibleIds.has(session.courseId)) continue;
    const endedAt = Date.parse(session.endedAt || session.startedAt);
    const duration = Number(session.durationMs) || 0;
    if (Number.isFinite(endedAt) && endedAt >= cutoff) recentDurationMs += duration;
    touch(session.courseId, session.endedAt || session.startedAt, session.label, false);
    const current = eventsByCourse.get(session.courseId);
    if (current) current.durationMs += duration;
  }

  // Se não houver eventos com data, usa os materiais com etapas já concluídas
  for (const course of courses) {
    if (eventsByCourse.has(course.id)) continue;
    const progress = courseProgress(state, course);
    if (progress.done > 0) {
      eventsByCourse.set(course.id, {
        lastAt: 0,
        lastLabel: course.resumeAt || `${progress.done} de ${progress.total} concluídos`,
        stepsCount: progress.done,
        durationMs: 0,
      });
    }
  }

  const items = [...eventsByCourse.entries()]
    .sort((a, b) => b[1].lastAt - a[1].lastAt || b[1].stepsCount - a[1].stepsCount)
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map(([courseId, info]) => {
      const course = courseMap.get(courseId);
      const progress = courseProgress(state, course);
      return {
        id: course.id,
        title: course.title,
        type: typeLabel(course),
        art: safeArt(course.art),
        status: courseStatus(state, course),
        progress,
        lastAt: info.lastAt ? new Date(info.lastAt).toISOString() : null,
        lastLabel: info.lastLabel || course.resumeAt || '',
        durationMinutes: info.durationMs > 0 ? Math.max(1, Math.round(info.durationMs / 60000)) : null,
      };
    });

  return {
    items,
    recentStepsTwoWeeks,
    recentMinutesTwoWeeks: recentDurationMs > 0 ? Math.max(1, Math.round(recentDurationMs / 60000)) : 0,
  };
}

export function buildProfile(state, { now = Date.now(), validated = null } = {}) {
  const sharing = normalizeSharing(state?.preferences?.sharing);
  const customization = normalizeProfileCard(state?.profile);
  // Projeto privado não aparece em lugar nenhum do perfil: nem na biblioteca,
  // nem na fila, nem nas contagens — senão a própria existência vazaria.
  const courses = realCourses(state).filter((course) => course.type !== 'project' || course.shared === true);
  const visibleState = { ...state, courses };

  const entries = courses.map((course) => {
    const progress = courseProgress(state, course);
    return {
      id: course.id,
      title: course.title,
      type: typeLabel(course),
      art: safeArt(course.art),
      status: courseStatus(state, course),
      progress: sharing.progress ? progress : null,
    };
  });

  const totals = courses.reduce((accumulator, course) => {
    const progress = courseProgress(state, course);
    accumulator.lessons += progress.total;
    accumulator.done += progress.done;
    if (progress.done === progress.total) accumulator.completedCourses += 1;
    return accumulator;
  }, { lessons: 0, done: 0, completedCourses: 0 });

  const level = sharing.xp
    ? (validated
      ? { level: validated.level, total: validated.totalXP, current: validated.levelCurrent, next: validated.levelNext }
      : levelInfo(state))
    : null;
  // Conquistas validadas vêm do livro de eventos do servidor. Sem elas (prévia
  // ou perfil antigo), os selos genéricos permanecem visíveis como legado.
  const allAchievements = sharing.xp
    ? (validated
      ? (validated.achievements || []).map((item) => ({
        id: item.id,
        title: item.title,
        text: item.criterion,
        icon: item.kind === 'project' ? 'flag' : item.kind === 'slide' ? 'book' : 'trophy',
        unlocked: true,
        current: 1,
        target: 1,
      }))
      : achievements(visibleState))
    : null;
  const unlockedBadges = allAchievements ? allAchievements.filter((item) => item.unlocked) : [];
  const featuredBadge = unlockedBadges[unlockedBadges.length - 1] || (allAchievements ? allAchievements[0] : null);
  const recent = buildRecentActivity(state, courses, { sharing, now });

  return {
    sharing,
    customization,
    studying: sharing.library ? entries.filter((entry) => entry.status !== 'completed').slice(0, STUDYING_LIMIT) : [],
    completed: sharing.library ? entries.filter((entry) => entry.status === 'completed').slice(0, STUDYING_LIMIT) : [],
    queue: sharing.queue
      ? studyPlan(visibleState, { limit: QUEUE_LIMIT, now }).steps.map((step) => ({
        course: step.courseTitle,
        lesson: step.title,
        reason: step.reason.label,
      }))
      : [],
    projects: courses.filter(isPublicProject).slice(0, PROJECTS_LIMIT).map((course) => ({
      id: course.id,
      title: course.title,
      art: safeArt(course.art),
      status: courseStatus(state, course),
      progress: sharing.progress ? courseProgress(state, course) : null,
    })),
    titles: sharing.xp ? (validated?.titles || []) : [],
    achievements: allAchievements
      ? allAchievements.map(({ id, title, text, icon, unlocked, current, target }) => ({
        id, title, text, icon, unlocked, current, target,
      }))
      : [],
    featuredBadge: featuredBadge
      ? { id: featuredBadge.id, title: featuredBadge.title, icon: featuredBadge.icon, unlocked: featuredBadge.unlocked }
      : null,
    recentActivity: recent.items,
    stats: {
      activeCourses: courses.length,
      lessons: sharing.progress ? totals.lessons : null,
      doneLessons: sharing.progress ? totals.done : null,
      completedCourses: sharing.progress ? totals.completedCourses : null,
      xp: level ? level.total : null,
      level: level ? level.level : null,
      levelCurrent: level ? level.current : null,
      levelNext: level ? level.next : null,
      xpValidated: Boolean(validated),
      unlockedAchievements: allAchievements ? unlockedBadges.length : null,
      totalAchievements: allAchievements ? allAchievements.length : null,
      recentStepsTwoWeeks: recent.recentStepsTwoWeeks,
      recentMinutesTwoWeeks: recent.recentMinutesTwoWeeks,
    },
  };
}
