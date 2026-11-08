import { appointmentRange, shiftDate } from '../../../public/agenda-domain.js';

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function emptyDraft(date, extra = {}) {
  return { title: '', category: 'study', date, endDate: date, start: '', end: '', timeZone: browserZone(), taskIds: [], tasks: [], reminder: -1, recurrence: 'none', count: 4, until: '', weekdays: [], ...extra };
}
export function wallParts(instant, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function calendarPatch(event, timeZone = browserZone(), { month = false } = {}) {
  // No mês a posição indica só o dia: mover um bloco remove o horário.
  if (month || event.allDay) {
    const date = event.startStr.slice(0, 10);
    return { date, endDate: date, start: '', end: '', timeZone };
  }
  const start = wallParts(event.start, timeZone);
  const end = wallParts(event.end || new Date(event.start.getTime() + 30 * 60000), timeZone);
  return { date: start.date, start: start.time, endDate: end.date, end: end.time, timeZone };
}
export function calendarEvent(item, tasks) {
  const range = item.start ? appointmentRange(item) : null;
  const linked = tasks.filter((task) => item.taskIds.includes(task.id));
  return {
    id: item.id, title: item.title, allDay: !item.start,
    start: range ? new Date(range[0]).toISOString() : item.date,
    end: range ? new Date(range[1]).toISOString() : shiftDate(item.date, 1),
    editable: !item.cancelled && !item.done,
    durationEditable: Boolean(item.start) && !item.cancelled && !item.done,
    className: `lume-event lume-event-${item.category}${item.done ? ' is-complete' : ''}${item.cancelled ? ' is-cancelled' : ''}`,
    extendedProps: { item, progress: linked.length ? `${linked.filter((task) => task.done).length}/${linked.length}` : '' },
  };
}

// Horários de 15 em 15 minutos, sempre em 24 h, independentemente do idioma do navegador.
export const TIMES = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String(i % 4 * 15).padStart(2, '0')}`);
export const minutesOf = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const timeOf = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export function durationLabel(minutes) {
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`;
}
// Opções de horário; o valor atual entra mesmo fora da grade de 15 minutos.
export function timeOptions(value, after = '') {
  const list = TIMES.filter((time) => !after || minutesOf(time) > minutesOf(after));
  if (value && !list.includes(value)) list.push(value);
  return list.sort();
}
let zones = null;
export function timeZones(current) {
  if (!zones) {
    try { zones = Intl.supportedValuesOf('timeZone'); } catch { zones = []; }
    if (!zones.includes('UTC')) zones = [...zones, 'UTC'];
  }
  return current && !zones.includes(current) ? [current, ...zones] : zones;
}
export const zoneLabel = (zone) => zone.replaceAll('_', ' ');
