// Cronograma de estudo: distribui as aulas restantes na disponibilidade semanal.
//
// Critério explícito e auditável:
// 1. Ordem dos cursos: prioridade escolhida (alta → baixa, sem prioridade por
//    último), depois prazo mais próximo, depois a ordem do roteiro (study-plan.js).
// 2. Dentro de cada curso, as aulas seguem a sequência da fonte.
// 3. Cada dia recebe aulas enquanto couberem; uma aula maior que o dia ocupa um
//    dia inteiro e é sinalizada.
// 4. Adiar uma aula adia também as seguintes do mesmo curso, preservando a sequência.
//
// O cronograma é derivado do estado: concluir uma aula, pausar um curso ou mudar a
// disponibilidade recalcula tudo a partir de hoje, sem apagar progresso. Nada
// aqui concede XP; planejar, adiar e priorizar são organização.

import { courseLessons } from './import-domain.js';
import { materialSteps } from './material-model.js';
import { DEFAULT_SESSION_MINUTES, studyPlan } from './study-plan.js';
import { completedUnitIds } from './progress-domain.js';

export const WEEKDAYS = Object.freeze([
  { id: 1, short: 'seg', label: 'Segunda' },
  { id: 2, short: 'ter', label: 'Terça' },
  { id: 3, short: 'qua', label: 'Quarta' },
  { id: 4, short: 'qui', label: 'Quinta' },
  { id: 5, short: 'sex', label: 'Sexta' },
  { id: 6, short: 'sáb', label: 'Sábado' },
  { id: 0, short: 'dom', label: 'Domingo' },
]);
export const DAY_MINUTE_OPTIONS = Object.freeze([0, 15, 30, 45, 60, 90, 120, 180, 240, 300]);
export const MAX_DAY_MINUTES = 600;
export const HORIZON_DAYS = 180;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_RANK = { 1: 1, 2: 2, 3: 3 };

export function emptyPlan() {
  return { version: 1, availability: {}, goals: {}, postponed: {}, updatedAt: null };
}

function cleanDate(value) {
  return typeof value === 'string' && DATE.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) ? value : '';
}

function cleanMinutes(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, MAX_DAY_MINUTES) : 0;
}

// Aceita dados antigos ou corrompidos sem perder o resto do estado.
export function normalizePlan(value, courseIds = null) {
  const plan = emptyPlan();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return plan;
  for (const day of WEEKDAYS) {
    const minutes = cleanMinutes(value.availability?.[day.id]);
    if (minutes) plan.availability[day.id] = minutes;
  }
  for (const [courseId, goal] of Object.entries(value.goals || {})) {
    if (courseIds && !courseIds.has(courseId)) continue;
    if (!goal || typeof goal !== 'object') continue;
    const deadline = cleanDate(goal.deadline);
    const priority = PRIORITY_RANK[goal.priority] ? Number(goal.priority) : 0;
    if (deadline || priority) plan.goals[courseId] = { deadline, priority };
  }
  for (const [lessonId, date] of Object.entries(value.postponed || {})) {
    const clean = cleanDate(date);
    if (clean && typeof lessonId === 'string' && lessonId.length <= 160) plan.postponed[lessonId] = clean;
  }
  plan.updatedAt = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null;
  return plan;
}

function touch(state, plan, now) {
  return { ...state, plan: { ...plan, updatedAt: new Date(now).toISOString() } };
}

export function setAvailability(state, weekday, minutes, now = Date.now()) {
  const plan = normalizePlan(state.plan);
  const clean = cleanMinutes(minutes);
  const availability = { ...plan.availability };
  if (clean) availability[weekday] = clean; else delete availability[weekday];
  return touch(state, { ...plan, availability }, now);
}

export function setGoal(state, courseId, patch, now = Date.now()) {
  if (!state.courses.some((course) => course.id === courseId)) return state;
  const plan = normalizePlan(state.plan);
  const current = plan.goals[courseId] || { deadline: '', priority: 0 };
  const next = {
    deadline: patch.deadline === undefined ? current.deadline : cleanDate(patch.deadline),
    priority: patch.priority === undefined ? current.priority : (PRIORITY_RANK[patch.priority] ? Number(patch.priority) : 0),
  };
  const goals = { ...plan.goals };
  if (next.deadline || next.priority) goals[courseId] = next; else delete goals[courseId];
  return touch(state, { ...plan, goals }, now);
}

export function postponeLesson(state, lessonId, date, now = Date.now()) {
  const plan = normalizePlan(state.plan);
  const clean = cleanDate(date);
  const postponed = { ...plan.postponed };
  if (clean) postponed[lessonId] = clean; else delete postponed[lessonId];
  return touch(state, { ...plan, postponed }, now);
}

// Sugestão inicial, só aplicada por escolha da pessoa: dias úteis com o tempo de
// sessão informado no onboarding.
export function suggestedAvailability(state) {
  const value = Number(state.onboarding?.answers?.sessionMinutes);
  const minutes = Number.isFinite(value) && value > 0 ? Math.min(Math.round(value), MAX_DAY_MINUTES) : DEFAULT_SESSION_MINUTES;
  return { 1: minutes, 2: minutes, 3: minutes, 4: minutes, 5: minutes };
}

export function applyAvailability(state, availability, now = Date.now()) {
  const plan = normalizePlan(state.plan);
  return touch(state, { ...plan, availability: normalizePlan({ availability }).availability }, now);
}

export function weeklyMinutes(plan) {
  return Object.values(normalizePlan(plan).availability).reduce((sum, value) => sum + value, 0);
}

// Datas em calendário local, sem horário: AAAA-MM-DD.
export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekdayOf(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

function sessionEstimate(state) {
  const value = Number(state.onboarding?.answers?.sessionMinutes);
  return Number.isFinite(value) && value > 0 && value <= 240 ? Math.round(value) : DEFAULT_SESSION_MINUTES;
}

function queues(state, plan, today) {
  const completed = completedUnitIds(state);
  const roadmap = studyPlan(state, { limit: 1 });
  const order = new Map(roadmap.courses.map((course, index) => [course.id, index]));
  const estimate = sessionEstimate(state);
  return roadmap.courses
    .map((planned) => {
      const course = state.courses.find((item) => item.id === planned.id);
      const durations = new Map(courseLessons(course).map((lesson) => [lesson.id, lesson.duration]));
      const goal = plan.goals[course.id] || { deadline: '', priority: 0 };
      return {
        course,
        goal,
        order: order.get(course.id),
        lessons: materialSteps(course).filter((step) => !completed.has(step.id)).map((step) => {
          const seconds = durations.get(step.id);
          const known = Number.isFinite(seconds) && seconds > 0;
          return {
            lessonId: step.id,
            title: step.title,
            discipline: step.discipline || '',
            minutes: known ? Math.max(1, Math.ceil(seconds / 60)) : estimate,
            durationKnown: known,
            notBefore: plan.postponed[step.id] && plan.postponed[step.id] > today ? plan.postponed[step.id] : '',
          };
        }),
      };
    })
    .sort((left, right) => (PRIORITY_RANK[left.goal.priority] || 4) - (PRIORITY_RANK[right.goal.priority] || 4)
      || (left.goal.deadline || '9999-12-31').localeCompare(right.goal.deadline || '9999-12-31')
      || left.order - right.order);
}

export function buildSchedule(state, { today, horizon = HORIZON_DAYS } = {}) {
  const plan = normalizePlan(state.plan);
  const weekly = weeklyMinutes(plan);
  const pending = queues(state, plan, today);
  const totalMinutes = pending.reduce((sum, item) => sum + item.lessons.reduce((acc, lesson) => acc + lesson.minutes, 0), 0);
  const unknown = pending.reduce((sum, item) => sum + item.lessons.filter((lesson) => !lesson.durationKnown).length, 0);
  const result = {
    today,
    weeklyMinutes: weekly,
    totalMinutes,
    lessonsWithoutDuration: unknown,
    criteria: 'Prioridade escolhida, depois prazo mais próximo e a ordem do roteiro. As aulas seguem a sequência da fonte; adiar uma aula adia as seguintes do mesmo curso.',
    days: [],
    courses: [],
    conflicts: [],
    unscheduled: 0,
  };
  if (!pending.length) return result;
  if (!weekly) {
    result.unscheduled = pending.reduce((sum, item) => sum + item.lessons.length, 0);
    result.courses = pending.map((item) => ({ courseId: item.course.id, title: item.course.title, goal: item.goal, remaining: item.lessons.length, finish: '' }));
    return result;
  }

  const cursor = new Map(pending.map((item) => [item.course.id, 0]));
  const finish = new Map();
  for (let offset = 0; offset < horizon; offset += 1) {
    const date = addDays(today, offset);
    const capacity = plan.availability[weekdayOf(date)] || 0;
    if (!capacity) continue;
    const day = { date, capacity, used: 0, items: [] };
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const item of pending) {
        const index = cursor.get(item.course.id);
        const lesson = item.lessons[index];
        if (!lesson || (lesson.notBefore && lesson.notBefore > date)) continue;
        const fits = day.used + lesson.minutes <= capacity;
        const alone = !day.items.length && lesson.minutes > capacity;
        if (!fits && !alone) continue;
        day.items.push({ ...lesson, courseId: item.course.id, courseTitle: item.course.title, overflow: alone });
        day.used += lesson.minutes;
        cursor.set(item.course.id, index + 1);
        if (index + 1 === item.lessons.length) finish.set(item.course.id, date);
        progressed = true;
        break;
      }
      if (day.used >= capacity) break;
    }
    if (day.items.length) result.days.push(day);
    if (pending.every((item) => cursor.get(item.course.id) >= item.lessons.length)) break;
  }

  result.unscheduled = pending.reduce((sum, item) => sum + item.lessons.length - cursor.get(item.course.id), 0);
  result.courses = pending.map((item) => ({
    courseId: item.course.id,
    title: item.course.title,
    goal: item.goal,
    remaining: item.lessons.length,
    remainingMinutes: item.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0),
    finish: finish.get(item.course.id) || '',
  }));

  // Conflito: o curso tem prazo e o plano termina depois dele (ou não termina no horizonte).
  for (const course of result.courses) {
    const deadline = course.goal.deadline;
    if (!deadline || (course.finish && course.finish <= deadline)) continue;
    const daysLeft = Math.max(1, daysBetween(today, deadline) + 1);
    const weeks = Math.max(1, daysLeft / 7);
    // Minutos de tudo o que vem antes deste curso na ordem, mais ele mesmo.
    const position = result.courses.indexOf(course);
    const needed = result.courses.slice(0, position + 1).reduce((sum, item) => sum + item.remainingMinutes, 0);
    const available = Math.floor(weekly * weeks);
    result.conflicts.push({
      courseId: course.courseId,
      title: course.title,
      deadline,
      finish: course.finish,
      neededMinutes: needed,
      availableMinutes: available,
      extraWeeklyMinutes: Math.max(15, Math.ceil(((needed - available) / weeks) / 15) * 15),
      prioritized: course.goal.priority === 1,
    });
  }
  return result;
}

// Opção de ajuste: distribui minutos extras por semana entre os dias já
// disponíveis (ou de segunda a sexta, se nenhum estiver), em passos de 5 minutos.
export function increaseWeekly(state, extraWeeklyMinutes, now = Date.now()) {
  const plan = normalizePlan(state.plan);
  const days = Object.keys(plan.availability).length ? Object.keys(plan.availability).map(Number) : [1, 2, 3, 4, 5];
  const share = Math.ceil(extraWeeklyMinutes / days.length / 5) * 5;
  const availability = { ...plan.availability };
  for (const day of days) availability[day] = Math.min(MAX_DAY_MINUTES, (availability[day] || 0) + share);
  return touch(state, { ...plan, availability }, now);
}

// Próximo dia com disponibilidade depois de `date`, para "Adiar".
export function nextAvailableDay(state, date) {
  const plan = normalizePlan(state.plan);
  for (let offset = 1; offset <= 14; offset += 1) {
    const candidate = addDays(date, offset);
    if (plan.availability[weekdayOf(candidate)]) return candidate;
  }
  return addDays(date, 1);
}
