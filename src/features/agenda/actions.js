import { createAppointment, updateAppointment, saveAppointment, movePending } from '../../../public/agenda-domain.js';

export function createAgendaActions(act) {
  const change = (rule, ...args) => act((state) => ({ state: rule(state, ...args) }));
  return {
    save: (input, scope) => change(saveAppointment, input, scope),
    create: (input) => change(createAppointment, input),
    update: (id, patch, scope) => change(updateAppointment, id, patch, scope),
    movePending: (id, date) => change(movePending, id, date),
  };
}
