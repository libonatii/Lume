// Visões derivadas da tela Início: a trilha do módulo atual (constelação), as
// entregas em contagem regressiva e a semana em pontos de luz. Só leem o estado;
// não gravam nada nem mexem em XP.

import { materialSteps, materialStructure } from './material-model.js';
import { completedUnitIds } from './progress-domain.js';
import { localDay, minutesByDay } from './session-domain.js';
import { CATEGORIES } from './agenda-domain.js';

export const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "sex 14 nov": datas curtas em mono, sem pontos de abreviação.
export function shortDate(day) {
  const date = new Date(`${day}T12:00:00`);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function daysUntil(day, today) {
  return Math.round((Date.parse(`${day}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86400000);
}

// Aulas do módulo da aula atual, na ordem do roteiro. Sem módulo (material com
// etapas soltas), o próprio material faz o papel do módulo.
export function moduleTrail(state, action) {
  const course = state.courses.find((item) => item.id === action.courseId);
  const steps = materialSteps(course);
  const selected = new Set(steps.map((step) => step.id));
  const done = completedUnitIds(state);
  let lessons = steps;
  let module = null;
  for (const discipline of materialStructure(course)) {
    for (const item of discipline.modules) {
      if (item.lessons.some((lesson) => lesson.id === action.lessonId)) {
        module = item;
        lessons = item.lessons.filter((lesson) => selected.has(lesson.id));
      }
    }
  }
  const current = lessons.findIndex((lesson) => lesson.id === action.lessonId);
  const nodes = lessons.map((lesson, index) => ({
    id: lesson.id,
    title: lesson.title,
    index,
    state: index === current ? 'current' : done.has(lesson.id) ? 'done' : 'todo',
  }));
  return {
    module: module?.title || '',
    nodes,
    current,
    done: nodes.filter((node) => node.state === 'done').length,
    remaining: nodes.filter((node) => node.state !== 'done').length,
    position: steps.findIndex((step) => step.id === action.lessonId) + 1,
    total: steps.length,
  };
}

// Janela em torno da aula atual: módulos longos mostram só as vizinhas.
export function trailWindow(nodes, current, size) {
  if (nodes.length <= size) return nodes;
  const start = Math.max(0, Math.min(nodes.length - size, current - Math.floor(size / 2)));
  return nodes.slice(start, start + size);
}

// Provas, entregas e prazos de tarefas em contagem regressiva. Sessões de estudo
// agendadas não são entregas: aparecem só como a próxima sessão.
export function upcomingDeadlines(state, today = localDay(), limit = 3) {
  const agenda = (state.agenda || []).filter((item) => !item.cancelled && !item.done && item.date >= today);
  const linked = new Set(agenda.flatMap((item) => item.taskIds || []));
  const items = [
    ...agenda.filter((item) => item.category !== 'study').map((item) => ({ id: `agenda-${item.id}`, title: item.title, date: item.date, start: item.start || '', kind: CATEGORIES[item.category] || 'Compromisso', href: `#agenda?data=${encodeURIComponent(item.date)}` })),
    ...(state.tasks || []).filter((task) => !task.done && task.dueDate && task.dueDate >= today && !linked.has(task.id)).map((task) => ({ id: `task-${task.id}`, title: task.title, date: task.dueDate, start: '', kind: 'Tarefa', href: '#tarefas' })),
  ].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const session = agenda.filter((item) => item.category === 'study').sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0] || null;
  return { items: items.slice(0, limit), total: items.length, session };
}

// Semana de segunda a domingo em pontos de luz. Dia com estudo acende em
// azul-claro; dia sem estudo fica só apagado, sem marca de falta; hoje é a estrela.
export function weekLights(state, now = Date.now()) {
  const weekday = (new Date(now).getDay() + 6) % 7;
  const past = minutesByDay(state, weekday + 1, now);
  const days = [
    ...past.map((day, index) => ({ ...day, state: index === weekday ? 'today' : day.minutes > 0 ? 'lit' : 'off' })),
    ...Array.from({ length: 6 - weekday }, (_, index) => {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + index + 1);
      return { date: localDay(date), minutes: 0, sessions: 0, state: 'future' };
    }),
  ];
  return { days, total: past.reduce((sum, day) => sum + day.minutes, 0), lit: past.filter((day) => day.minutes > 0).length };
}
