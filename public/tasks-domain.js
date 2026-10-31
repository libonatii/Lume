// Lista de tarefas de estudo para uma prova.
//
// Criar, editar ou organizar tarefas não rende XP. Concluir uma tarefa
// identificável vale TASK_XP uma vez e entra no total do protótipo; a política
// definitiva exige um livro de eventos validado no servidor.

export const TASK_XP = 10;
export const MAX_TASKS = 200;
// Subtarefas dividem uma tarefa quando ajuda; marcá-las nunca gera XP.
export const MAX_SUBTASKS = 10;
// Prioridade explícita: 1 alta, 2 média, 3 baixa, 0 sem prioridade (padrão).
// Definir ou mudar a prioridade é organização e nunca altera XP.
export const TASK_PRIORITIES = Object.freeze([
  { id: 1, label: 'Alta' },
  { id: 2, label: 'Média' },
  { id: 3, label: 'Baixa' },
  { id: 0, label: 'Sem prioridade' },
]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanPriority(value) {
  const number = Number(value);
  return [1, 2, 3].includes(number) ? number : 0;
}

export function priorityLabel(value) {
  return TASK_PRIORITIES.find((item) => item.id === cleanPriority(value)).label;
}

// Data local AAAA-MM-DD: prazo é um dia do calendário da pessoa, não UTC.
export function localDate(now = new Date()) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isOverdue(task, today = localDate()) {
  return !task.done && Boolean(task.dueDate) && task.dueDate < today;
}

function normalizeSubtasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value
    .filter((item) => item && typeof item.id === 'string' && item.id && !ids.has(item.id) && typeof item.title === 'string' && item.title.trim() && ids.add(item.id))
    .slice(0, MAX_SUBTASKS)
    .map((item) => ({ id: item.id, title: item.title.trim().slice(0, 140), done: item.done === true }));
}

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
      lessonId: typeof task.lessonId === 'string' && task.lessonId.length <= 160 ? task.lessonId : '',
      subtasks: normalizeSubtasks(task.subtasks),
      dueDate: cleanDate(task.dueDate),
      priority: cleanPriority(task.priority),
      done: task.done === true,
      createdAt: cleanTimestamp(task.createdAt),
      completedAt: task.done === true ? cleanTimestamp(task.completedAt) : null,
    }));
}

export function addTask(state, { title, courseId = '', lessonId = '', dueDate = '', priority = 0 }, now = new Date().toISOString()) {
  const cleanTitle = String(title || '').trim().slice(0, 180);
  if (!cleanTitle) throw new Error('Dê um nome para a tarefa.');
  const task = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    courseId: state.courses.some((course) => course.id === courseId) ? courseId : '',
    lessonId: state.courses.some((course) => course.id === courseId && course.steps.some((step) => step.id === lessonId)) ? lessonId : '',
    subtasks: [],
    dueDate: cleanDate(dueDate),
    priority: cleanPriority(priority),
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

export function setTaskPriority(state, id, priority) {
  return {
    ...state,
    tasks: (state.tasks || []).map((task) => task.id === id ? { ...task, priority: cleanPriority(priority) } : task),
  };
}

function updateTask(state, id, change) {
  return { ...state, tasks: (state.tasks || []).map((task) => task.id === id ? change(task) : task) };
}

export function addSubtask(state, id, title) {
  const clean = String(title || '').trim().slice(0, 140);
  if (!clean) throw new Error('Dê um nome para a subtarefa.');
  const task = (state.tasks || []).find((item) => item.id === id);
  if (!task) return state;
  if ((task.subtasks || []).length >= MAX_SUBTASKS) throw new Error(`Uma tarefa aceita até ${MAX_SUBTASKS} subtarefas.`);
  return updateTask(state, id, (item) => ({ ...item, subtasks: [...(item.subtasks || []), { id: crypto.randomUUID(), title: clean, done: false }] }));
}

export function toggleSubtask(state, id, subtaskId) {
  return updateTask(state, id, (task) => ({ ...task, subtasks: (task.subtasks || []).map((item) => item.id === subtaskId ? { ...item, done: !item.done } : item) }));
}

export function removeSubtask(state, id, subtaskId) {
  return updateTask(state, id, (task) => ({ ...task, subtasks: (task.subtasks || []).filter((item) => item.id !== subtaskId) }));
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

// Ordem de ação: pendentes antes; entre elas, atrasadas, depois prioridade
// (alta → baixa, sem prioridade por último), prazo mais próximo e mais recente.
export function sortTasks(tasks = [], today = localDate()) {
  const rank = (task) => cleanPriority(task.priority) || 4;
  return [...tasks].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;
    const lateLeft = isOverdue(left, today);
    const lateRight = isOverdue(right, today);
    if (lateLeft !== lateRight) return lateLeft ? -1 : 1;
    if (rank(left) !== rank(right)) return rank(left) - rank(right);
    const leftDue = left.dueDate || '9999-12-31';
    const rightDue = right.dueDate || '9999-12-31';
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });
}

// Resumo para a página Hoje: atrasadas e as próximas tarefas na ordem de ação.
export function taskAgenda(state, { today = localDate(), limit = 3 } = {}) {
  const pending = sortTasks((state.tasks || []).filter((task) => !task.done), today);
  return {
    pending: pending.length,
    overdue: pending.filter((task) => isOverdue(task, today)).length,
    dueToday: pending.filter((task) => task.dueDate === today).length,
    next: pending.slice(0, limit),
  };
}
