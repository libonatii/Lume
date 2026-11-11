import { completeMission } from '../../../public/domain.js';
import { completeLesson, completeLessonsThrough, revertLessonCompletion } from '../../../public/import-domain.js';
import { completeDeck } from '../../../public/slides-domain.js';
import { endSession, pauseSession, resumeSession, startSession, touchSession } from '../../../public/session-domain.js';

export function createProgressActions(act) {
  return {
    completeMission: (courseId, stepId, options) => act((state) => completeMission(state, courseId, stepId, options)),
    completeLesson: (courseId, stepId, options) => act((state) => completeLesson(state, courseId, stepId, options)),
    completeLessonsThrough: (courseId, lessonId, options) => act((state) => completeLessonsThrough(state, courseId, lessonId, options)),
    revertLesson: (courseId, stepId, options) => act((state) => revertLessonCompletion(state, courseId, stepId, options)),
    completeDeck: (courseId, now) => act((state) => completeDeck(state, courseId, now)),
    startSession: (input) => act((state) => ({ state: startSession(state, input) })),
    touchSession: () => act((state) => ({ state: touchSession(state) })),
    toggleSessionPause: () => act((state) => ({ state: state.activeSession?.status === 'active' ? pauseSession(state) : resumeSession(state) })),
    endSession: (now) => act((state) => endSession(state, now)),
  };
}
