// Lista de tarefas de estudo para uma prova.
//
// Criar, editar ou organizar tarefas não rende XP. Concluir uma tarefa
// identificável vale TASK_XP uma vez e entra no total do protótipo; a política
// definitiva exige um livro de eventos validado no servidor.

export const TASK_XP = 10;
export const MAX_TASKS = 200;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(value) {
  return typeof value === 'string' && DATE.test(value) ? value : '';
}

function cleanTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export function normalizeTasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value
    .filter((task) => {
      if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id)) return false;
      if (typeof task.title !== 'string' || !task.title.trim()) return false;
      ids.add(task.id);
      return true;
    })
    .slice(-MAX_TASKS)
    .map((task) => ({
      id: task.id,
      title: task.title.trim().slice(0, 180),
      courseId: typeof task.courseId === 'string' ? task.courseId : '',
      dueDate: cleanDate(task.dueDate),
      done: task.done === true,
      createdAt: cleanTimestamp(task.createdAt),
      completedAt: task.done === true ? cleanTimestamp(task.completedAt) : null,
    }));
}

export function addTask(state, { title, courseId = '', dueDate = '' }, now = new Date().toISOString()) {
  const cleanTitle = String(title || '').trim().slice(0, 180);
  if (!cleanTitle) throw new Error('Dê um nome para a tarefa.');
  const task = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    courseId: state.courses.some((course) => course.id === courseId) ? courseId : '',
    dueDate: cleanDate(dueDate),
    done: false,
    createdAt: new Date(now).toISOString(),
    completedAt: null,
  };
  return { ...state, tasks: [...(state.tasks || []), task].slice(-MAX_TASKS) };
}

export function completeTask(state, id, now = new Date().toISOString()) {
  const task = (state.tasks || []).find((item) => item.id === id);
  if (!task || task.done) return { state, added: false, xp: 0 };
  return {
    state: {
      ...state,
      tasks: state.tasks.map((item) => item.id === id
        ? { ...item, done: true, completedAt: new Date(now).toISOString() }
        : item),
    },
    added: true,
    xp: TASK_XP,
  };
}

export function reopenTask(state, id) {
  return {
    ...state,
    tasks: (state.tasks || []).map((task) => task.id === id
      ? { ...task, done: false, completedAt: null }
      : task),
  };
}

export function removeTask(state, id) {
  return { ...state, tasks: (state.tasks || []).filter((task) => task.id !== id) };
}

export function taskXP(state) {
  return (state.tasks || []).filter((task) => task.done).length * TASK_XP;
}

export function taskWeekCount(state, start, end) {
  return (state.tasks || []).filter((task) => {
    if (!task.done || !task.completedAt) return false;
    const at = new Date(task.completedAt);
    return at >= start && at < end;
  }).length;
}

export function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    const leftDue = left.dueDate || '9999-12-31';
    const rightDue = right.dueDate || '9999-12-31';
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });
}
