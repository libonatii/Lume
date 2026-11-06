import { completeJourney, saveOnboardingAnswer, skipJourney, startJourney } from '../../../public/domain.js';

export function createAccountActions(act) {
  return {
    startJourney: (id) => act((state) => ({ state: startJourney(state, id) })),
    saveAnswers: (answers, step) => act((state) => ({ state: saveOnboardingAnswer(state, answers, step) })),
    finishJourney: (answers, step) => act((state) => ({ state: completeJourney(saveOnboardingAnswer(state, answers, step)) })),
    skipJourney: () => act((state) => ({ state: skipJourney(state) })),
  };
}
