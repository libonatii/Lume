import { addMaterial, deleteCourse, replaceCourseSteps, selectCourse, setCourseEdital, toggleCoursePause, updateCourse } from '../../../public/domain.js';
import { applyCourseImport, isImportedCourse } from '../../../public/import-domain.js';
import { createGitHubProject } from '../../../public/github-domain.js';
import { addSlide, markSlideSeen, moveSlide, removeSlide, setSlideImage, updateSlide } from '../../../public/slides-domain.js';

export function createLibraryActions(act) {
  const change = (rule, ...args) => act((state) => ({ state: rule(state, ...args) }));
  return {
    addMaterial: (input, origin = 'manual') => change(addMaterial, input, origin),
    importCourse: (payload, options) => change(applyCourseImport, payload, options),
    createGitHubProject: (analysis, chosen) => change(createGitHubProject, analysis, chosen),
    deleteMaterial: (id) => change(deleteCourse, id),
    togglePause: (id) => change(toggleCoursePause, id),
    selectMaterial: (id) => change(selectCourse, id),
    setEdital: (id, value) => change(setCourseEdital, id, value),
    editMaterial: (id, patch, steps) => act((state) => {
      const course = state.courses.find((item) => item.id === id);
      let next = updateCourse(state, id, patch);
      if (steps && !isImportedCourse(course)) next = replaceCourseSteps(next, id, steps);
      return { state: next };
    }),
    addSlide: (id, input) => change(addSlide, id, input),
    updateSlide: (id, slideId, input) => change(updateSlide, id, slideId, input),
    removeSlide: (id, slideId) => change(removeSlide, id, slideId),
    moveSlide: (id, slideId, direction) => change(moveSlide, id, slideId, direction),
    setSlideImage: (id, slideId, url) => change(setSlideImage, id, slideId, url),
    markSlideSeen: (id, slideId) => change(markSlideSeen, id, slideId),
  };
}
