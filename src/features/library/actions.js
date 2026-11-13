import { addMaterial, deleteCourse, replaceCourseSteps, selectCourse, setCourseEdital, toggleCoursePause, updateCourse } from '../../../public/domain.js';
import { applyCourseImport, isImportedCourse } from '../../../public/import-domain.js';
import { addHighlight, addPdfMaterial, recolorHighlight, removeHighlight, setReadingPage } from '../../../public/pdf-domain.js';
import { addSubject, deleteSubject, linkMaterialSubject, updateSubject } from '../../../public/subject-domain.js';
import { addSlide, markSlideSeen, moveSlide, removeSlide, setSlideImage, updateSlide } from '../../../public/slides-domain.js';

export function createLibraryActions(act) {
  const change = (rule, ...args) => act((state) => ({ state: rule(state, ...args) }));
  return {
    addMaterial: (input, origin = 'manual') => change(addMaterial, input, origin),
    importCourse: (payload, options) => change(applyCourseImport, payload, options),
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
    // PDF e disciplina na mesma gravação: uma disciplina nova nasce junto com o
    // material, sem estado intermediário para desfazer se a gravação falhar.
    addPdf: ({ title, file, subjectId = '', newSubject = '' }) => act((state) => {
      let next = state;
      let subject = subjectId;
      if (newSubject.trim()) {
        subject = crypto.randomUUID();
        next = addSubject(next, { title: newSubject }, subject);
      }
      return { state: addPdfMaterial(next, { title, file, subjectId: subject }) };
    }),
    setReadingPage: (id, position) => change(setReadingPage, id, position),
    addHighlight: (id, input) => change(addHighlight, id, input),
    recolorHighlight: (id, highlightId, color) => change(recolorHighlight, id, highlightId, color),
    removeHighlight: (id, highlightId) => change(removeHighlight, id, highlightId),
    addSubject: (input) => change(addSubject, input),
    addNotebookWithSubject: ({ title, color = 'lume', materialTitle, firstActivity }) => act((state) => {
      const subjectId = crypto.randomUUID();
      const withSubject = addSubject(state, { title, color }, subjectId);
      const withMaterial = addMaterial(withSubject, { title: materialTitle, type: 'lesson', firstActivity }, 'onboarding');
      return { state: linkMaterialSubject(withMaterial, withMaterial.selectedCourseId, subjectId) };
    }),
    updateSubject: (id, input) => change(updateSubject, id, input),
    deleteSubject: (id) => change(deleteSubject, id),
    linkSubject: (materialId, subjectId) => change(linkMaterialSubject, materialId, subjectId),
  };
}
