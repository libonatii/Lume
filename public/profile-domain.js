// Perfil compartilhado: monta a visão que outra pessoa vê a partir da cópia de
// estado que a própria pessoa sincronizou. XP e progresso são declarados pelo
// navegador, não validados pelo servidor — por isso não alimentam ranking e a
// interface precisa dizer isso.
import { courseProgress, courseStatus, levelInfo, STUDY_TYPES } from './domain.js';
import { studyPlan } from './study-plan.js';

export const STUDYING_LIMIT = 6;
export const PROJECTS_LIMIT = 8;
export const QUEUE_LIMIT = 5;

// Ausência de escolha significa compartilhar: são os padrões decididos para o perfil.
export function normalizeSharing(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    library: source.library !== false,
    queue: source.queue !== false,
    progress: source.progress !== false,
    xp: source.xp !== false,
  };
}

function typeLabel(course) {
  return STUDY_TYPES.find((type) => type.id === course.type)?.title || 'Material';
}

function realCourses(state) {
  const courses = Array.isArray(state?.courses) ? state.courses : [];
  return courses.filter((course) => course && course.example !== true && Array.isArray(course.steps) && course.steps.length > 0);
}

// Um projeto só aparece no perfil quando a pessoa marca explicitamente.
export function isPublicProject(course) {
  return Boolean(course && course.type === 'project' && course.shared === true);
}

export function buildProfile(state, { now = Date.now() } = {}) {
  const sharing = normalizeSharing(state?.preferences?.sharing);
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

  const level = sharing.xp ? levelInfo(state) : null;

  return {
    sharing,
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
      status: courseStatus(state, course),
      progress: sharing.progress ? courseProgress(state, course) : null,
    })),
    stats: {
      activeCourses: courses.length,
      lessons: sharing.progress ? totals.lessons : null,
      doneLessons: sharing.progress ? totals.done : null,
      completedCourses: sharing.progress ? totals.completedCourses : null,
      xp: level ? level.total : null,
      level: level ? level.level : null,
    },
  };
}
