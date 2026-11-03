import {
  addSubtask, addTask, completeTask, removeSubtask, removeTask, reopenTask,
  setTaskPriority, toggleSubtask,
} from '../../../public/tasks-domain.js';
import {
  applyAvailability, increaseWeekly, nextAvailableDay, postponeLesson,
  setAvailability, setGoal, suggestedAvailability,
} from '../../../public/schedule-domain.js';

// As regras recebem o estado atual no momento da ação, nunca a cópia da tela.
// `act` é interno ao modelo; as telas só recebem operações desta funcionalidade.
export function createPlanActions(act) {
  const change = (rule, ...args) => act((state) => ({ state: rule(state, ...args) }));
  return {
    addTask: (input) => change(addTask, input),
    completeTask: (id, now) => act((state) => completeTask(state, id, now)),
    reopenTask: (id) => change(reopenTask, id),
    removeTask: (id) => change(removeTask, id),
    setTaskPriority: (id, priority) => change(setTaskPriority, id, priority),
    addSubtask: (id, title) => change(addSubtask, id, title),
    toggleSubtask: (id, subtaskId) => change(toggleSubtask, id, subtaskId),
    removeSubtask: (id, subtaskId) => change(removeSubtask, id, subtaskId),
    setAvailability: (day, minutes) => change(setAvailability, day, minutes),
    setGoal: (id, goal) => change(setGoal, id, goal),
    increaseWeekly: (minutes) => change(increaseWeekly, minutes),
    useSuggestedAvailability: () => act((state) => ({ state: applyAvailability(state, suggestedAvailability(state)) })),
    postponeLesson: (id, date) => act((state) => {
      const target = nextAvailableDay(state, date);
      return { state: postponeLesson(state, id, target), target };
    }),
  };
}
