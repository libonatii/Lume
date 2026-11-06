import { appointmentRange, shiftDate } from '../../../public/agenda-domain.js';

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export function emptyDraft(date, extra = {}) {
  return { title: '', category: 'study', date, endDate: date, start: '', end: '', timeZone: browserZone(), taskIds: [], tasks: [], reminder: -1, recurrence: 'none', count: 4, ...extra };
}
export function wallParts(instant, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function calendarPatch(event, timeZone = browserZone()) {
  if (event.allDay) return { date: event.startStr.slice(0, 10), endDate: event.startStr.slice(0, 10), start: '', end: '', timeZone };
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
