// Roteiro de estudo por prioridade.
//
// Critério explícito e auditável — não é uma pontuação opaca:
// 1. Continuidade: material estudado nos últimos 7 dias.
// 2. Primeiro passo: material sem nenhum progresso registrado.
// 3. Perto do fim: menos aulas restantes entre os materiais em andamento.
// 4. Ordem da biblioteca, como desempate final.
//
// Cursos pausados e concluídos ficam fora do roteiro. Cursos de exemplo não
// entram: eles não representam o estudo real da pessoa. Nada aqui concede XP.

import { materialSteps } from './material-model.js';
import { courseLessons, isImportedCourse, sourceLabel } from './import-domain.js';
import { completedUnitIds } from './progress-domain.js';

export const PLAN_LIMIT = 8;
export const RECENT_DAYS = 7;
// Sem duração publicada pela fonte nem tempo de sessão escolhido no onboarding,
// a estimativa usa 25 minutos e é sempre rotulada como estimativa.
export const DEFAULT_SESSION_MINUTES = 25;

const REASONS = {
  continuity: { id: 'continuity', label: 'Continuidade', detail: 'Você estudou ou retomou este material nos últimos 7 dias.' },
  start: { id: 'start', label: 'Primeiro passo', detail: 'Ainda não há progresso registrado neste material.' },
  close: { id: 'close', label: 'Perto do fim', detail: 'Faltam poucas aulas para concluir as áreas escolhidas.' },
  ongoing: { id: 'ongoing', label: 'Em andamento', detail: 'Material em andamento na sua biblioteca.' },
};

function lessonsOf(course) {
  return materialSteps(course).map((step) => ({
    id: step.id,
    title: typeof step.title === 'string' ? step.title : 'Aula',
    discipline: typeof step.discipline === 'string' ? step.discipline : '',
    module: typeof step.module === 'string' ? step.module : '',
  }));
}

function lastTouched(state) {
  const map = new Map();
  const mark = (courseId, at) => {
    const time = Date.parse(at);
    if (courseId && Number.isFinite(time)) map.set(courseId, Math.max(map.get(courseId) || 0, time));
  };
  for (const entry of state.progress || []) if (!entry.revertedAt) mark(entry.materialId, entry.at);
  for (const session of state.studySessions || []) mark(session.courseId, session.startedAt);
  // Página aberta no leitor de PDF: conta como continuidade, não como estudo concluído.
  for (const course of state.courses || []) if (course.reading) mark(course.id, course.reading.updatedAt);
  return map;
}

function reasonFor(item) {
  if (item.recent) return REASONS.continuity;
  if (!item.touched) return REASONS.start;
  if (item.remaining <= 3) return REASONS.close;
  return REASONS.ongoing;
}

export function studyPlan(state, { limit = PLAN_LIMIT, now = Date.now() } = {}) {
  const completed = completedUnitIds(state);
  const touchedMap = lastTouched(state);
  const cutoff = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const limitValue = Math.max(1, Math.min(Number(limit) || PLAN_LIMIT, 20));

  const prepared = (state.courses || [])
    .filter((course) => course && course.example !== true && materialSteps(course).length)
    .map((course, index) => {
      const lessons = lessonsOf(course);
      const remainingLessons = lessons.filter((lesson) => !completed.has(lesson.id));
      const touched = touchedMap.get(course.id) || 0;
      const item = {
        course,
        index,
        lessons,
        remainingLessons,
        remaining: remainingLessons.length,
        total: lessons.length,
        touched,
        recent: touched >= cutoff,
        paused: course.paused === true,
        complete: remainingLessons.length === 0,
      };
      return { ...item, reason: reasonFor(item) };
    });

  const active = prepared.filter((item) => !item.paused && !item.complete);
  const ordered = [...active].sort((a, b) => {
    const weight = { continuity: 0, start: 1, close: 2, ongoing: 3 };
    return weight[a.reason.id] - weight[b.reason.id]
      || a.remaining - b.remaining
      || a.index - b.index;
  });

  const steps = [];
  const rounds = Math.max(1, Math.ceil(limitValue / Math.max(1, ordered.length)));
  for (let round = 0; round < rounds && steps.length < limitValue; round += 1) {
    for (const item of ordered) {
      const lesson = item.remainingLessons[round];
      if (!lesson || steps.length >= limitValue) continue;
      steps.push({
        courseId: item.course.id,
        courseTitle: item.course.title,
        lessonId: lesson.id,
        title: lesson.title,
        discipline: lesson.discipline,
        module: lesson.module,
        position: round + 1,
        remaining: item.remaining,
        reason: item.reason,
      });
    }
  }

  const totalRemaining = active.reduce((sum, item) => sum + item.remaining, 0);
  const totalLessons = prepared.reduce((sum, item) => sum + item.total, 0);
  const doneLessons = prepared.reduce((sum, item) => sum + (item.total - item.remaining), 0);

  return {
    generatedAt: new Date(now).toISOString(),
    criteria: 'Prioridade por continuidade recente, primeiro passo, proximidade do fim e ordem da biblioteca. Pausados e concluídos ficam fora.',
    totals: {
      remaining: totalRemaining,
      lessons: totalLessons,
      doneLessons,
      activeCourses: active.length,
      pausedCourses: prepared.filter((item) => item.paused && !item.complete).length,
      completedCourses: prepared.filter((item) => item.complete).length,
    },
    courses: ordered.map((item) => ({
      id: item.course.id,
      title: item.course.title,
      source: isImportedCourse(item.course) ? sourceLabel(item.course.source) : item.course.category || 'Minha trilha',
      remaining: item.remaining,
      total: item.total,
      percent: item.total ? Math.round(((item.total - item.remaining) / item.total) * 100) : 0,
      partial: isImportedCourse(item.course) ? item.course.source?.completeness !== 'complete' : false,
      reason: item.reason,
      next: item.remainingLessons[0] ? { id: item.remainingLessons[0].id, title: item.remainingLessons[0].title } : null,
    })),
    steps,
    note: active.length
      ? null
      : 'Nenhum curso em andamento. Adicione um curso na biblioteca para o roteiro aparecer aqui.',
  };
}

function sessionMinutes(state) {
  const value = Number(state.onboarding?.answers?.sessionMinutes);
  return Number.isFinite(value) && value > 0 && value <= 240 ? Math.round(value) : DEFAULT_SESSION_MINUTES;
}

// Próxima ação da página Hoje. Usa o mesmo critério do roteiro (Companion e
// perfil), para que nenhuma tela indique outra aula como "a próxima".
// Duração conhecida vem da fonte importada; sem ela, o tempo é estimado.
export function nextAction(state, { now = Date.now() } = {}) {
  const plan = studyPlan(state, { limit: 1, now });
  const step = plan.steps[0];
  if (!step) return null;
  const course = state.courses.find((item) => item.id === step.courseId);
  const planned = plan.courses.find((item) => item.id === step.courseId);
  const lessons = new Map(courseLessons(course).map((lesson) => [lesson.id, lesson]));
  const lesson = lessons.get(step.lessonId);
  const known = Number.isFinite(lesson?.duration) && lesson.duration > 0;
  const completed = completedUnitIds(state);
  const remainingSteps = materialSteps(course).filter((item) => !completed.has(item.id));
  const durations = remainingSteps.map((item) => lessons.get(item.id)?.duration).filter((value) => Number.isFinite(value) && value > 0);
  return {
    courseId: course.id,
    courseTitle: course.title,
    lessonId: step.lessonId,
    title: step.title,
    discipline: step.discipline,
    module: step.module,
    reason: step.reason,
    minutes: known ? Math.max(1, Math.ceil(lesson.duration / 60)) : sessionMinutes(state),
    durationKnown: known,
    url: lesson?.url || course.url || '',
    imported: isImportedCourse(course),
    partial: planned?.partial === true,
    remaining: step.remaining,
    total: planned?.total || materialSteps(course).length,
    remainingKnownMinutes: Math.round(durations.reduce((sum, value) => sum + value, 0) / 60),
    remainingWithoutDuration: remainingSteps.length - durations.length,
    // PDF anexado: a próxima ação é retomar a leitura na página salva.
    pdf: course.pdf ? { page: course.reading?.page || 1, pages: course.pdf.pages, section: course.reading?.section || '', started: Boolean(course.reading) } : null,
  };
}

// "Continuar agora" da Biblioteca. Fica na disciplina que a pessoa escolheu:
// o material selecionado enquanto tiver passo pendente; concluído, o próximo
// pendente da mesma disciplina na ordem da biblioteca (depois dele, e então os
// anteriores). Só troca de disciplina quando a pessoa escolhe outro material.
// Disciplina toda concluída devolve `subjectDone`, sem pular para outra.
// Material sem disciplina segue o roteiro geral.
export function resumeMaterial(state, { now = Date.now() } = {}) {
  const pendingAction = (course) => nextAction({ ...state, courses: [course] }, { now });
  const found = (course, action) => ({ course, action, subjectDone: null });
  const chosen = (state.courses || []).find((course) => course.id === state.selectedCourseId);
  const own = chosen && pendingAction(chosen);
  if (own) return found(chosen, own);
  const subject = chosen?.subjectId ? (state.subjects || []).find((item) => item.id === chosen.subjectId) : null;
  if (subject) {
    const index = state.courses.indexOf(chosen);
    const peers = [...state.courses.slice(index + 1), ...state.courses.slice(0, index)].filter((course) => course.subjectId === subject.id);
    for (const course of peers) {
      const action = pendingAction(course);
      if (action) return found(course, action);
    }
    return { course: null, action: null, subjectDone: subject };
  }
  const general = nextAction(state, { now });
  return general ? found(state.courses.find((course) => course.id === general.courseId), general) : null;
}
