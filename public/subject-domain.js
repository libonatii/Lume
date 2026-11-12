// Disciplinas (matérias) da biblioteca: categoria criada pela pessoa para reunir
// PDFs e outros materiais e retomar de onde parou. É organização: criar,
// renomear, vincular ou excluir uma disciplina não gera XP, e ela não tem bônus
// próprio, porque é aberta e pode receber materiais a qualquer momento
// (decisão de 10/11/2026). Não confundir com a disciplina da grade de um curso
// importado (unidade kind 'discipline'), que mantém o bônus de 200 XP.

import { materialSteps } from './material-model.js';
import { completedUnitIds } from './progress-domain.js';
import { readingLabel, sectionsCovered } from './pdf-domain.js';

export const MAX_SUBJECTS = 60;
export const MAX_SUBJECT_TITLE = 80;
export const MAX_KEYWORDS = 20;
export const SUBJECT_COLORS = ['lume', 'mint', 'violet', 'amber', 'coral'];
export const SUBJECT_COLOR_LABELS = { lume: 'Azul Safira', mint: 'Menta Serena', violet: 'Lavanda Suave', amber: 'Âmbar Quente', coral: 'Rosa Ardósia' };

const cleanColor = (value) => SUBJECT_COLORS.includes(value) ? value : 'lume';
const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const fold = (value) => clean(value, 200).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

export function parseKeywords(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[,;\n]/);
  const seen = new Set();
  const keywords = [];
  for (const item of list) {
    const keyword = clean(item, 40);
    if (!keyword || seen.has(fold(keyword))) continue;
    seen.add(fold(keyword));
    keywords.push(keyword);
    if (keywords.length >= MAX_KEYWORDS) break;
  }
  return keywords;
}

export function normalizeSubjects(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  const subjects = [];
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id)) continue;
    const title = clean(item.title, MAX_SUBJECT_TITLE);
    if (!title) continue;
    ids.add(item.id);
    subjects.push({
      id: item.id,
      title,
      color: cleanColor(item.color),
      keywords: parseKeywords(item.keywords),
      createdAt: Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : null,
    });
    if (subjects.length >= MAX_SUBJECTS) break;
  }
  return subjects;
}

function assertTitle(state, title, ignoreId = null) {
  const value = clean(title, MAX_SUBJECT_TITLE);
  if (!value) throw new Error('Dê um nome à disciplina.');
  if ((state.subjects || []).some((item) => item.id !== ignoreId && fold(item.title) === fold(value))) {
    throw new Error('Já existe uma disciplina com esse nome.');
  }
  return value;
}

export function addSubject(state, { title, keywords = [], color = 'lume' }, id = crypto.randomUUID(), now = new Date().toISOString()) {
  if ((state.subjects || []).length >= MAX_SUBJECTS) throw new Error(`São permitidas até ${MAX_SUBJECTS} disciplinas.`);
  const subject = { id, title: assertTitle(state, title), color: cleanColor(color), keywords: parseKeywords(keywords), createdAt: now };
  return { ...state, subjects: [...(state.subjects || []), subject] };
}

export function updateSubject(state, id, { title, keywords, color }) {
  const subject = (state.subjects || []).find((item) => item.id === id);
  if (!subject) throw new Error('Disciplina não encontrada.');
  const next = {
    ...subject,
    title: title === undefined ? subject.title : assertTitle(state, title, id),
    color: color === undefined ? cleanColor(subject.color) : cleanColor(color),
    keywords: keywords === undefined ? subject.keywords : parseKeywords(keywords),
  };
  return { ...state, subjects: state.subjects.map((item) => item.id === id ? next : item) };
}

// Excluir a disciplina só desfaz os vínculos: materiais, progresso e XP ficam.
export function deleteSubject(state, id) {
  if (!(state.subjects || []).some((item) => item.id === id)) return state;
  return {
    ...state,
    subjects: state.subjects.filter((item) => item.id !== id),
    courses: state.courses.map((course) => course.subjectId === id ? { ...course, subjectId: '' } : course),
  };
}

export function linkMaterialSubject(state, materialId, subjectId) {
  const course = state.courses.find((item) => item.id === materialId);
  if (!course) throw new Error('Material não encontrado.');
  if (subjectId && !(state.subjects || []).some((item) => item.id === subjectId)) throw new Error('Disciplina não encontrada.');
  if ((course.subjectId || '') === (subjectId || '')) return state;
  return { ...state, courses: state.courses.map((item) => item.id === materialId ? { ...item, subjectId: subjectId || '' } : item) };
}

export function subjectOf(state, course) {
  return course?.subjectId ? (state.subjects || []).find((item) => item.id === course.subjectId) || null : null;
}

// Progresso de um material dentro da disciplina. PDF: conclusão declarada ou
// página mais adiante já aberta; demais materiais: etapas concluídas. A página
// aberta é marcador de retomada, não prova de leitura.
export function materialStanding(state, course, completed = completedUnitIds(state)) {
  const steps = materialSteps(course);
  const done = steps.length > 0 && steps.every((step) => completed.has(step.id));
  if (course.pdf) {
    const pages = course.pdf.pages;
    const reached = Math.min(course.reading?.maxPage || 0, pages);
    return {
      done,
      percent: done ? 100 : pages ? Math.round(reached / pages * 100) : 0,
      label: done ? 'Leitura concluída' : course.reading ? readingLabel(course.reading, pages) : `${pages} páginas · não iniciado`,
      touchedAt: course.reading?.updatedAt || null,
      pages,
      reached: done ? pages : reached,
    };
  }
  const finished = steps.filter((step) => completed.has(step.id)).length;
  return {
    done,
    percent: steps.length ? Math.round(finished / steps.length * 100) : 0,
    label: `${finished} de ${steps.length} etapas`,
    touchedAt: null,
    pages: 0,
    reached: 0,
  };
}

function lastActivity(state) {
  const map = new Map();
  for (const event of state.progress || []) {
    const time = Date.parse(event.at);
    if (!event.revertedAt && Number.isFinite(time)) map.set(event.materialId, Math.max(map.get(event.materialId) || 0, time));
  }
  for (const session of state.studySessions || []) {
    const time = Date.parse(session.startedAt);
    if (Number.isFinite(time)) map.set(session.courseId, Math.max(map.get(session.courseId) || 0, time));
  }
  return map;
}

// Visão da disciplina: o que já foi percorrido e por onde retomar. A retomada é
// o material não concluído e não pausado com atividade mais recente.
export function subjectOverview(state, subjectId) {
  const completed = completedUnitIds(state);
  const activity = lastActivity(state);
  const materials = state.courses
    .filter((course) => (course.subjectId || '') === (subjectId || ''))
    .map((course) => {
      const standing = materialStanding(state, course, completed);
      const touched = Math.max(activity.get(course.id) || 0, Date.parse(standing.touchedAt) || 0);
      return { course, ...standing, touched, sections: course.pdf ? sectionsCovered(course.pdf.outline, standing.reached) : [] };
    });
  const pending = materials.filter((item) => !item.done && !item.course.paused);
  const resume = [...pending].sort((a, b) => b.touched - a.touched || state.courses.indexOf(a.course) - state.courses.indexOf(b.course))[0] || null;
  const pagesTotal = materials.reduce((sum, item) => sum + item.pages, 0);
  const pagesReached = materials.reduce((sum, item) => sum + item.reached, 0);
  return {
    subject: (state.subjects || []).find((item) => item.id === subjectId) || null,
    materials,
    done: materials.filter((item) => item.done).length,
    total: materials.length,
    percent: materials.length ? Math.round(materials.reduce((sum, item) => sum + item.percent, 0) / materials.length) : 0,
    pagesTotal,
    pagesReached,
    resume,
  };
}

export function subjectsOverview(state) {
  return (state.subjects || []).map((subject) => subjectOverview(state, subject.id));
}
