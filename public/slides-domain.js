// Slides de estudo: criação, edição, ordem, visualização e progresso.
//
// O conteúdo fica no documento da conta, junto do material, para funcionar
// offline e sem depender de um site externo. O XP não é concedido ao abrir:
// exige cobertura de pelo menos 80% dos slides, chegada ao último slide e uma
// confirmação explícita. O servidor revalida tudo em xp.js.

import { XP_VALUES, slideProgressSnapshot } from './xp-policy.js';
import { sanitizeSlideImage } from '../media.js';

export const MAX_SLIDES = 60;
export const MAX_SLIDE_TITLE = 120;
export const MAX_SLIDE_BODY = 4000;
export const SLIDE_COMPLETION_RATIO = 0.8;
export const SLIDE_XP = XP_VALUES.slide;

function cleanText(value, max) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function cleanId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : '';
}

export function normalizeSlides(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const slides = [];
  for (const [index, raw] of value.entries()) {
    if (slides.length >= MAX_SLIDES) break;
    const title = cleanText(raw?.title, MAX_SLIDE_TITLE);
    const body = cleanText(raw?.body, MAX_SLIDE_BODY);
    if (!title && !body) continue;
    let id = cleanId(raw?.id) || `slide_${index + 1}`;
    if (seen.has(id)) id = `slide_${index + 1}_${slides.length + 1}`;
    seen.add(id);
    slides.push({ id, title: title || `Slide ${slides.length + 1}`, body, image: sanitizeSlideImage(raw?.image) });
  }
  return slides;
}

export function normalizeSlideProgress(value, slides = []) {
  const valid = new Set(slides.map((slide) => slide.id));
  const seen = Array.isArray(value?.seen)
    ? [...new Set(value.seen.filter((id) => typeof id === 'string' && valid.has(id)))]
    : [];
  const lastId = typeof value?.lastId === 'string' && valid.has(value.lastId) ? value.lastId : '';
  const completedAt = Number.isFinite(Date.parse(value?.completedAt)) ? new Date(value.completedAt).toISOString() : null;
  return { seen, lastId, completedAt };
}

export function slidesSummary(course) {
  const slides = normalizeSlides(course?.slides);
  const progress = normalizeSlideProgress(course?.slideProgress, slides);
  const snapshot = slideProgressSnapshot({ ...course, slides, slideProgress: progress });
  return { ...snapshot, slides, progress };
}

export function addSlide(state, courseId, { title = '', body = '' } = {}, now = new Date().toISOString()) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) throw new Error('Material não encontrado.');
  const slides = normalizeSlides(course.slides);
  if (slides.length >= MAX_SLIDES) throw new Error(`Uma apresentação pode ter até ${MAX_SLIDES} slides.`);
  const cleanTitle = cleanText(title, MAX_SLIDE_TITLE);
  const cleanBody = cleanText(body, MAX_SLIDE_BODY);
  if (!cleanTitle && !cleanBody) throw new Error('Dê um título ou escreva o conteúdo do slide.');
  const slide = {
    id: `slide_${crypto.randomUUID()}`,
    title: cleanTitle || `Slide ${slides.length + 1}`,
    body: cleanBody,
  };
  return {
    ...state,
    courses: state.courses.map((item) => item.id === courseId
      ? { ...item, slides: [...slides, slide], slideProgress: normalizeSlideProgress(item.slideProgress, [...slides, slide]), slidesUpdatedAt: now }
      : item),
  };
}

export function updateSlide(state, courseId, slideId, { title = '', body = '' } = {}, now = new Date().toISOString()) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) throw new Error('Material não encontrado.');
  const slides = normalizeSlides(course.slides);
  if (!slides.some((slide) => slide.id === slideId)) throw new Error('Slide não encontrado.');
  const cleanTitle = cleanText(title, MAX_SLIDE_TITLE);
  const cleanBody = cleanText(body, MAX_SLIDE_BODY);
  if (!cleanTitle && !cleanBody) throw new Error('Dê um título ou escreva o conteúdo do slide.');
  return {
    ...state,
    courses: state.courses.map((item) => item.id === courseId
      ? {
        ...item,
        slides: slides.map((slide) => slide.id === slideId
          ? { ...slide, title: cleanTitle || `Slide ${slides.indexOf(slide) + 1}`, body: cleanBody }
          : slide),
        slidesUpdatedAt: now,
      }
      : item),
  };
}

export function removeSlide(state, courseId, slideId, now = new Date().toISOString()) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) return state;
  const slides = normalizeSlides(course.slides).filter((slide) => slide.id !== slideId);
  return {
    ...state,
    courses: state.courses.map((item) => item.id === courseId
      ? {
        ...item,
        slides,
        slideProgress: normalizeSlideProgress(item.slideProgress, slides),
        slidesUpdatedAt: now,
      }
      : item),
  };
}

export function moveSlide(state, courseId, slideId, direction) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) return state;
  const slides = normalizeSlides(course.slides);
  const index = slides.findIndex((slide) => slide.id === slideId);
  const target = index + (direction === 'up' ? -1 : 1);
  if (index < 0 || target < 0 || target >= slides.length) return state;
  const reordered = [...slides];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return {
    ...state,
    courses: state.courses.map((item) => item.id === courseId ? { ...item, slides: reordered } : item),
  };
}

export function setSlideImage(state, courseId, slideId, image, now = new Date().toISOString()) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) return state;
  const slides = normalizeSlides(course.slides);
  if (!slides.some((slide) => slide.id === slideId)) return state;
  const safe = sanitizeSlideImage(image);
  return {
    ...state,
    courses: state.courses.map((item) => item.id === courseId
      ? {
        ...item,
        slides: slides.map((slide) => slide.id === slideId ? { ...slide, image: safe } : slide),
        slidesUpdatedAt: now,
      }
      : item),
  };
}

export function markSlideSeen(state, courseId, slideId, now = new Date().toISOString()) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) return state;
  const slides = normalizeSlides(course.slides);
  if (!slides.some((slide) => slide.id === slideId)) return state;
  const progress = normalizeSlideProgress(course.slideProgress, slides);
  const seen = progress.seen.includes(slideId) ? progress.seen : [...progress.seen, slideId];
  return {
    ...state,
    courses: state.courses.map((item) => item.id === courseId
      ? { ...item, slideProgress: { ...progress, seen, lastId: slideId, updatedAt: now } }
      : item),
  };
}

// Confirmação explícita. Não concede XP localmente: apenas registra a conclusão
// que o servidor vai revalidar.
export function completeDeck(state, courseId, now = new Date().toISOString()) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) return { state, completed: false, reason: 'missing' };
  const summary = slidesSummary(course);
  if (!summary.nearEnd) return { state, completed: false, reason: 'coverage' };
  if (!summary.lastSeen) return { state, completed: false, reason: 'last' };
  if (summary.progress.completedAt) return { state, completed: false, reason: 'already' };
  return {
    state: {
      ...state,
      courses: state.courses.map((item) => item.id === courseId
        ? { ...item, slideProgress: { ...summary.progress, completedAt: now, updatedAt: now } }
        : item),
    },
    completed: true,
    reason: null,
  };
}

export function slidePositionLabel(summary) {
  if (!summary.total) return 'Nenhum slide';
  return `${Math.min(summary.seenCount, summary.total)} de ${summary.total} slides vistos`;
}
