// Compromissos explícitos: sugestões nunca movem registros já agendados.
import { addTask, MAX_TASKS, localDate } from './tasks-domain.js';
import { buildSchedule } from './schedule-domain.js';

export const MAX_APPOINTMENTS = 1000;
export const CATEGORIES = { study: 'Estudo', exam: 'Prova', delivery: 'Entrega', personal: 'Pessoal' };
export const REMINDERS = [-1, 0, 5, 15, 30, 60];
export const RECURRENCES = { none: 'Não repetir', daily: 'Diariamente', weekly: 'Semanalmente', monthly: 'Mensalmente' };
const formatters = new Map();
const ranges = new WeakMap();
const fail = (message) => { throw new Error(message); };
export const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export function shiftDate(date, days) {
  if (!validDate(date)) fail('Data inválida.');
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function validZone(zone) {
  if (typeof zone !== 'string' || !zone || zone.length > 80) return false;
  try {
    if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
    return true;
  } catch { return false; }
}
function partsAt(time, zone) {
  const p = Object.fromEntries(formatters.get(zone).formatToParts(time).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// Fuso fixado no compromisso. Em horário ambíguo escolhe a primeira ocorrência;
// horário inexistente por mudança sazonal é recusado, nunca deslocado em silêncio.
export function zonedInstant(date, time, zone) {
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !validZone(zone)) fail('Revise a data, o horário e o fuso.');
  const wall = `${date}T${time}`;
  const target = Date.parse(`${wall}:00Z`);
  const offsets = new Set([-36, -12, 0, 12, 36].map((hours) => {
    const sample = target + hours * 3600000;
    return Date.parse(`${partsAt(sample, zone)}:00Z`) - sample;
  }));
  const candidates = [...offsets].map((offset) => target - offset).filter((instant) => partsAt(instant, zone) === wall);
  if (!candidates.length) fail('Este horário não existe nesse fuso por mudança de horário de verão. Escolha outro.');
  return Math.min(...candidates);
}

export function normalizeAppointment(value) {
  if (!value || typeof value.id !== 'string' || !value.id || value.id.length > 200) fail('Compromisso sem identificador.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 180) fail('Dê um título de até 180 caracteres.');
  if (!validDate(value.date) || !validZone(value.timeZone)) fail('Data ou fuso inválido.');
  const start = value.start || '', end = value.end || '', endDate = value.endDate || value.date;
  if (!validDate(endDate) || endDate < value.date) fail('O fim deve ser posterior ao início.');
  if (Boolean(start) !== Boolean(end)) fail('Informe início e fim, ou deixe ambos sem horário.');
  if (start && zonedInstant(endDate, end, value.timeZone) <= zonedInstant(value.date, start, value.timeZone)) fail('O fim deve ser posterior ao início.');
  if (!start && endDate !== value.date) fail('Compromissos sem horário ocupam um único dia.');
  if (!start) zonedInstant(value.date, '09:00', value.timeZone);
  if (!Object.hasOwn(CATEGORIES, value.category)) fail('Tipo de atividade inválido.');
  if (!Array.isArray(value.taskIds) || value.taskIds.length > 50 || value.taskIds.some((id) => typeof id !== 'string' || !id) || new Set(value.taskIds).size !== value.taskIds.length) fail('Lista de tarefas inválida.');
  const reminder = value.reminder ?? -1;
  if (!REMINDERS.includes(reminder)) fail('Antecedência do lembrete inválida.');
  return {
    id: value.id, title: value.title.trim(), category: value.category,
    date: value.date, start, end, endDate, timeZone: value.timeZone,
    taskIds: [...value.taskIds], reminder,
    seriesId: typeof value.seriesId === 'string' ? value.seriesId.slice(0, 200) : '',
    recurrence: Object.hasOwn(RECURRENCES, value.recurrence) ? value.recurrence : 'none',
    originalDate: validDate(value.originalDate) ? value.originalDate : value.date,
    done: value.done === true, cancelled: value.cancelled === true,
  };
}
export function normalizeAgenda(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.flatMap((item) => {
    try { const result = normalizeAppointment(item); if (ids.has(result.id)) return []; ids.add(result.id); return [result]; } catch { return []; }
  }).slice(0, MAX_APPOINTMENTS);
}
export function validateAgenda(state) {
  const agenda = state.agenda || [];
  if (!Array.isArray(agenda) || agenda.length > MAX_APPOINTMENTS) fail(`A Agenda aceita até ${MAX_APPOINTMENTS} compromissos.`);
  const tasks = new Set(state.tasks.map((task) => task.id));
  const ids = new Set();
  for (const value of agenda) {
    const item = normalizeAppointment(value);
    if (ids.has(item.id)) fail('Compromisso duplicado.');
    ids.add(item.id);
    if (item.taskIds.some((id) => !tasks.has(id))) fail('Uma tarefa da atividade não está disponível.');
  }
}
function recurrenceDate(date, recurrence, index) {
  if (recurrence !== 'monthly') return shiftDate(date, index * (recurrence === 'weekly' ? 7 : 1));
  const [year, month, day] = date.split('-').map(Number);
  const last = new Date(Date.UTC(year, month + index, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + index, Math.min(day, last), 12)).toISOString().slice(0, 10);
}
export function createAppointment(state, input) {
  const recurrence = input.recurrence || 'none';
  if (!Object.hasOwn(RECURRENCES, recurrence)) fail('Repetição inválida.');
  const count = recurrence === 'none' ? 1 : Number(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 52) fail('Escolha de 1 a 52 ocorrências.');
  const taskIds = input.taskIds || [];
  const templates = input.tasks || [];
  if (!Array.isArray(templates) || templates.length + taskIds.length > 50) fail('Use até 50 tarefas por atividade.');
  const linked = taskIds.map((id) => state.tasks.find((task) => task.id === id) || fail('Tarefa não encontrada.'));
  const needed = templates.length * count + linked.length * (count - 1);
  if (state.tasks.length + needed > MAX_TASKS) fail(`A série ultrapassa o limite de ${MAX_TASKS} tarefas. Reduza as ocorrências.`);
  if ((state.agenda || []).length + count > MAX_APPOINTMENTS) fail('Limite de compromissos atingido.');
  const seriesId = count > 1 ? crypto.randomUUID() : '';
  const base = normalizeAppointment({ ...input, id: crypto.randomUUID(), taskIds, seriesId, recurrence });
  const daySpan = Math.round((Date.parse(`${base.endDate}T12:00Z`) - Date.parse(`${base.date}T12:00Z`)) / 86400000);
  let next = state;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const ids = i === 0 ? [...taskIds] : [];
    for (const template of [...templates, ...(i ? linked : [])]) {
      next = addTask(next, template);
      const task = next.tasks.at(-1);
      // Repetir não copia conclusão, prazo ou subtarefas marcadas.
      next = { ...next, tasks: next.tasks.map((item) => item.id === task.id ? { ...item, dueDate: '', subtasks: (template.subtasks || []).map((subtask) => ({ id: crypto.randomUUID(), title: subtask.title, done: false })) } : item) };
      ids.push(task.id);
    }
    const date = recurrenceDate(base.date, recurrence, i);
    entries.push(normalizeAppointment({ ...base, id: i ? crypto.randomUUID() : base.id, date, originalDate: date, endDate: shiftDate(date, daySpan), taskIds: ids, done: false, cancelled: false }));
  }
  next = { ...next, agenda: [...(state.agenda || []), ...entries] };
  validateAgenda(next);
  return next;
}

export function updateAppointment(state, id, patch, scope = 'one', today = localDate()) {
  const current = (state.agenda || []).find((item) => item.id === id);
  if (!current) fail('Compromisso não encontrado.');
  if (!['one', 'future'].includes(scope)) fail('Escolha esta ocorrência ou as futuras.');
  const shift = patch.date ? Math.round((Date.parse(`${patch.date}T12:00Z`) - Date.parse(`${current.date}T12:00Z`)) / 86400000) : 0;
  const agenda = state.agenda.map((item) => {
    const selected = item.id === id || (scope === 'future' && current.seriesId && item.seriesId === current.seriesId && item.originalDate >= current.originalDate && item.date >= today && !item.done && !item.cancelled);
    if (!selected || (scope === 'future' && (item.date < today || item.done || item.cancelled))) return item;
    const delta = { ...patch };
    if (scope === 'future') {
      delta.date = shiftDate(item.date, shift);
      const endSpan = patch.endDate ? Math.round((Date.parse(`${patch.endDate}T12:00Z`) - Date.parse(`${patch.date || current.date}T12:00Z`)) / 86400000) : Math.round((Date.parse(`${item.endDate}T12:00Z`) - Date.parse(`${item.date}T12:00Z`)) / 86400000);
      delta.endDate = shiftDate(delta.date, endSpan);
      delete delta.taskIds;
    }
    return normalizeAppointment({ ...item, ...delta, id: item.id, seriesId: item.seriesId, originalDate: item.originalDate, recurrence: item.recurrence });
  });
  const next = { ...state, agenda };
  validateAgenda(next);
  return next;
}

// O editor grava checklist e compromisso juntos, preservando identidade e conclusão.
export function saveAppointment(state, input, scope = 'one') {
  if (!input.id) return createAppointment(state, input);
  const current = state.agenda.find((item) => item.id === input.id);
  if (!current) fail('Compromisso não encontrado.');
  const { tasks = [], taskChanges = [], ...patch } = input;
  if (scope === 'future') return updateAppointment(state, input.id, patch, scope);
  let next = state;
  for (const change of taskChanges) {
    const task = next.tasks.find((item) => item.id === change.id);
    if (!task || !current.taskIds.includes(task.id)) fail('Tarefa não pertence a esta atividade.');
    if (task.done) continue;
    // addTask faz a mesma validação de título e vínculos usada no restante do produto.
    const checked = addTask({ ...next, tasks: [] }, change).tasks[0];
    next = { ...next, tasks: next.tasks.map((item) => item.id === task.id ? { ...item, title: checked.title, courseId: checked.courseId, lessonId: checked.lessonId } : item) };
  }
  const ids = [...(patch.taskIds || current.taskIds)];
  for (const task of tasks) { next = addTask(next, task); ids.push(next.tasks.at(-1).id); }
  return updateAppointment(next, input.id, { ...patch, taskIds: ids }, scope);
}

// Move só as pendências para uma nova atividade, conservando a anterior.
export function movePending(state, id, date) {
  const current = state.agenda.find((item) => item.id === id);
  if (!current) fail('Compromisso não encontrado.');
  const pending = current.taskIds.filter((taskId) => state.tasks.some((task) => task.id === taskId && !task.done));
  if (!pending.length) fail('Não há tarefas pendentes para mover.');
  const next = createAppointment(state, { ...current, date, endDate: shiftDate(date, Math.round((Date.parse(`${current.endDate}T12:00Z`) - Date.parse(`${current.date}T12:00Z`)) / 86400000)), taskIds: pending, recurrence: 'none' });
  return updateAppointment(next, id, { taskIds: current.taskIds.filter((taskId) => !pending.includes(taskId)) });
}
function dayStart(date, zone) {
  // Alguns fusos mudam à meia-noite. Um dia civil começa no primeiro horário
  // existente; um dia inteiramente suprimido termina no início do seguinte.
  for (let minutes = 0; minutes < 2880; minutes += 15) {
    const day = minutes < 1440 ? date : shiftDate(date, 1);
    const time = `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    try { return zonedInstant(day, time, zone); } catch { /* Avança somente na fronteira civil. */ }
  }
  fail('Não foi possível resolver o início do dia nesse fuso.');
}
export function appointmentRange(item) {
  // O domínio troca objetos, nunca altera compromissos in-place.
  if (!ranges.has(item)) ranges.set(item, item.start
    ? [zonedInstant(item.date, item.start, item.timeZone), zonedInstant(item.endDate, item.end, item.timeZone)]
    : [dayStart(item.date, item.timeZone), dayStart(shiftDate(item.date, 1), item.timeZone)]);
  return ranges.get(item);
}
export function conflictsFor(item, agenda) {
  if (item.cancelled) return [];
  const [start, end] = appointmentRange(item);
  return agenda.filter((other) => {
    if (other.id === item.id || other.cancelled) return false;
    const [a, b] = appointmentRange(other);
    return start < b && a < end;
  });
}
export function reminderKey(item) {
  return JSON.stringify([item.id, item.date, item.start, item.timeZone, item.reminder]);
}
export function dueReminders(state, now = Date.now()) {
  return (state.agenda || []).filter((item) => {
    if (item.done || item.cancelled || item.reminder < 0) return false;
    const at = zonedInstant(item.date, item.start || '09:00', item.timeZone) - item.reminder * 60000;
    return at <= now && now - at <= 15 * 60000;
  });
}
export function agendaSuggestions(state, today = localDate()) {
  const scheduled = new Set((state.agenda || []).filter((item) => !item.cancelled).flatMap((item) => item.taskIds).flatMap((id) => {
    const task = state.tasks.find((candidate) => candidate.id === id);
    return task?.lessonId ? [JSON.stringify([task.courseId, task.lessonId])] : [];
  }));
  return buildSchedule(state, { today }).days.flatMap((day) => day.items.map((item) => ({ ...item, date: day.date })))
    .filter((item) => !scheduled.has(JSON.stringify([item.courseId, item.lessonId]))).slice(0, 10);
}
