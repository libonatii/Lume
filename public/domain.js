import { materialSteps, stepUnits, normalizeMaterialUnits } from './material-model.js';
import { normalizeActiveSession, normalizeStudySessions } from './session-domain.js';
import { normalizeFocusTaskId, normalizeTasks } from './tasks-domain.js';
import { normalizeAgenda } from './agenda-domain.js';
import { emptyPlan, normalizePlan } from './schedule-domain.js';
import { levelProgress } from './xp-policy.js';
import { normalizeSlideProgress, normalizeSlides } from './slides-domain.js';
import { normalizePdfMeta, normalizeReading } from './pdf-domain.js';
import { normalizeSubjects } from './subject-domain.js';
import {
  activeCompletions, completedUnitIds, hasPreparationFor, isCompleted, legacyProgressXp, materialHasActivity,
  normalizeProgress, pruneProgress, recordCompletion, recordPreparation,
} from './progress-domain.js';

export const STORAGE_KEY = 'lume.prototype.v1';
// Formato v3: materiais com units e registro único progress. Versões anteriores
// são recusadas; não existe migração automática de dados.
export const STATE_VERSION = 3;
export const HABITS = [
  { id: 'starting', icon: 'spark', title: 'Quero começar', text: 'Ainda não tenho uma rotina de estudos.' },
  { id: 'sometimes', icon: 'compass', title: 'Estudo de vez em quando', text: 'Começo, mas nem sempre consigo manter.' },
  { id: 'often', icon: 'steps', title: 'Já estudo com frequência', text: 'Quero organizar e acompanhar meu progresso.' },
];
export const CHALLENGES = [
  { id: 'start', title: 'Dar o primeiro passo', icon: 'spark' },
  { id: 'choose', title: 'Escolher o que estudar', icon: 'compass' },
  { id: 'focus', title: 'Manter a atenção', icon: 'focus' },
  { id: 'routine', title: 'Criar uma rotina possível', icon: 'calendar' },
  { id: 'return', title: 'Retomar depois de uma pausa', icon: 'return' },
  { id: 'unsure', title: 'Ainda não sei', icon: 'help' },
];

export const STUDY_RHYTHMS = [
  { id: 'starting', icon: 'spark', label: 'Um começo possível', title: 'Quero começar', subtitle: 'Encontrar prazer nos primeiros passos', text: 'Ainda não tenho uma rotina. Quero descobrir um jeito de começar com ações pequenas e claras.', detail: 'Sugestão inicial: 2 passos por semana', weeklyGoal: 2 },
  { id: 'sometimes', icon: 'compass', label: 'Uma chama que continua', title: 'Estudo de vez em quando', subtitle: 'Construir uma rotina que caiba na vida', text: 'Já começo a estudar, mas nem sempre consigo manter. Quero ter um próximo passo esperando meu retorno.', detail: 'Sugestão inicial: 3 passos por semana', weeklyGoal: 3 },
  { id: 'often', icon: 'steps', label: 'Novas possibilidades', title: 'Estudo com frequência', subtitle: 'Organizar e aprofundar meus interesses', text: 'O estudo já faz parte da minha rotina. Quero acompanhar minhas trilhas e avançar com espaço para descansar.', detail: 'Sugestão inicial: 5 passos por semana', weeklyGoal: 5 },
];

export const STUDY_SUPPORTS = [
  { id: 'initiation', icon: 'play', title: 'Ajuda para começar', text: 'Sugerir a preparação do material como primeiro passo.' },
  { id: 'calm', icon: 'focus', title: 'Menos informação na tela', text: 'Registrar que prefiro ver menos informação de uma vez.' },
  { id: 'return', icon: 'return', title: 'Retomar sem culpa', text: 'Destacar que posso continuar de onde parei.' },
  { id: 'chunking', icon: 'steps', title: 'Passos ainda menores', text: 'Oferecer uma preparação antes da etapa completa.' },
];

// Tipos de material usados no onboarding e na biblioteca. Não representam
// capacidade nem nível: são apenas o formato do conteúdo.
export const STUDY_TYPES = [
  { id: 'lesson', title: 'Aula' },
  { id: 'video', title: 'Videoaula' },
  { id: 'article', title: 'Artigo ou leitura' },
  { id: 'book', title: 'Livro' },
  { id: 'exercise', title: 'Lista de exercícios' },
  { id: 'project', title: 'Projeto' },
  { id: 'course', title: 'Curso completo' },
];

// PDF anexado é um formato próprio, criado só pelo envio do arquivo
// (pdf-domain.js); por isso não aparece na escolha de tipo dos formulários.
const PDF_TYPE = { id: 'pdf', title: 'PDF' };

export function materialType(type) {
  return type === 'pdf' ? PDF_TYPE : STUDY_TYPES.find((item) => item.id === type) || STUDY_TYPES[0];
}

// Rótulos de retomada por tipo de material. O campo continua sendo um texto
// livre porque nem toda fonte expõe uma posição estruturada; a interface deixa
// claro que o marcador é declarado pela pessoa.
export function resumeLabel(type) {
  if (type === 'video') return 'Instante do vídeo';
  if (type === 'article' || type === 'book') return 'Página, seção ou capítulo';
  if (type === 'exercise') return 'Exercício ou tentativa atual';
  if (type === 'project') return 'Próxima entrega';
  return 'Próxima aula ou ponto de retomada';
}

export function parseVideoTime(value) {
  const text = String(value ?? '').trim();
  if (/^\d+$/.test(text)) return Math.max(0, Number(text));
  const parts = text.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return null;
}

export function formatVideoTime(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

// Posição estruturada por tipo. `resumeAt` continua existindo como rótulo
// legível e para dados antigos; novos materiais guardam também o campo tipado.
export function normalizePosition(value, type = 'lesson') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (type === 'video') {
    const seconds = Number.isFinite(value.seconds) ? Math.max(0, Math.round(value.seconds)) : parseVideoTime(value.value);
    return seconds === null ? null : { kind: 'video', seconds };
  }
  const text = (field) => String(value[field] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (type === 'article') {
    const page = text('page');
    const section = text('section');
    return page || section ? { kind: 'page', page, section } : null;
  }
  if (type === 'book') {
    const chapter = text('chapter');
    return chapter ? { kind: 'chapter', chapter } : null;
  }
  if (type === 'exercise') {
    const current = text('current');
    const attempts = Number.isInteger(value.attempts) && value.attempts > 0 ? Math.min(value.attempts, 999) : 0;
    return current || attempts ? { kind: 'exercise', current, attempts } : null;
  }
  if (type === 'project') {
    const next = text('next');
    return next ? { kind: 'delivery', next } : null;
  }
  const next = text('next');
  return next ? { kind: 'lesson', next } : null;
}

export function positionLabel(type, position) {
  const value = normalizePosition(position, type);
  if (!value) return '';
  if (value.kind === 'video') return formatVideoTime(value.seconds);
  if (value.kind === 'page') return [value.section, value.page && `p. ${value.page}`].filter(Boolean).join(' · ');
  if (value.kind === 'chapter') return /^cap[ií]tulo\b/i.test(value.chapter) ? value.chapter : `capítulo ${value.chapter}`;
  if (value.kind === 'exercise') return [value.current, value.attempts ? `${value.attempts}ª tentativa` : ''].filter(Boolean).join(' · ');
  return value.next;
}

// Paletas da Aparência. Os ids são internos (moderno = tela "Redesign Moderno" do Stitch,
// variante2 = "Variante 2"); para quem usa, os nomes são só Azul e Roxo. O logo não muda.
export const PALETTES = [
  { id: 'moderno', title: 'Azul', detail: 'Azul com destaques em âmbar · padrão', swatches: ['#090d1f', '#0f172a', '#2563eb', '#f59e0b'] },
  { id: 'variante2', title: 'Roxo', detail: 'Roxo com lavanda e destaques em âmbar', swatches: ['#0b0b18', '#13132b', '#7c3aed', '#f59e0b'] },
];

// O onboarding é versionado e retomável: interromper não obriga a recomeçar.
export function emptyOnboarding() {
  return { version: 2, status: 'pending', journey: null, step: 0, answers: {}, savedAt: null, finishedAt: null };
}

export function normalizeOnboarding(value) {
  const base = emptyOnboarding();
  if (!value || typeof value !== 'object') return base;
  const journey = STUDY_RHYTHMS.some((item) => item.id === value.journey) ? value.journey : null;
  const status = ['pending', 'active', 'done'].includes(value.status) ? value.status : base.status;
  const step = Number.isInteger(value.step) && value.step >= 0 && value.step <= 8 ? value.step : 0;
  const answers = value.answers && typeof value.answers === 'object' && !Array.isArray(value.answers) ? value.answers : {};
  return {
    version: 2,
    status: journey ? status : 'pending',
    journey,
    step: journey ? step : 0,
    answers,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
  };
}

export function startJourney(state, journey) {
  if (!STUDY_RHYTHMS.some((item) => item.id === journey)) throw new Error('Escolha uma das três jornadas.');
  const current = normalizeOnboarding(state.onboarding);
  const resuming = current.status === 'active' && current.journey === journey;
  return {
    ...state,
    habit: journey,
    onboarding: { ...current, journey, status: 'active', step: resuming ? current.step : 1, savedAt: new Date().toISOString() },
  };
}

export function saveOnboardingAnswer(state, patch, step) {
  const current = normalizeOnboarding(state.onboarding);
  return {
    ...state,
    onboarding: {
      ...current,
      status: 'active',
      answers: { ...current.answers, ...patch },
      step: Number.isInteger(step) ? step : current.step,
      savedAt: new Date().toISOString(),
    },
  };
}

// Conclui o onboarding sem conceder XP: criar material e escolher ritmo não são
// eventos elegíveis na política de recompensas.
export function skipJourney(state, now = new Date().toISOString()) {
  return { ...state, onboarded: true, onboarding: { ...emptyOnboarding(), status: 'done', finishedAt: now } };
}

// Objetivos de estudo escolhidos no cadastro ou no onboarding. A tela usa os mesmos ids.
export const STUDY_GOALS = Object.freeze(['college', 'exams', 'research', 'personal']);

// Sons ambiente aceitos nas preferências; aliases antigos ('noise' e 'library')
// são convertidos para os ids canônicos do motor de áudio ('white' e 'pink').
export function normalizeSoundscape(value, fallback = 'off') {
  if (value === 'noise') return 'white';
  if (value === 'library') return 'pink';
  return ['off', 'rain', 'pink', 'white'].includes(value) ? value : fallback;
}

export function completeJourney(state) {
  const current = normalizeOnboarding(state.onboarding);
  const rhythm = STUDY_RHYTHMS.find((item) => item.id === current.journey);
  const manualGoal = state.preferences.weeklyGoalSource === 'manual';
  const answers = current.answers || {};
  const dailyMinutes = Number.isInteger(answers.dailyMinutes) && answers.dailyMinutes >= 15 && answers.dailyMinutes <= 720
    ? answers.dailyMinutes : state.preferences.dailyMinutes;
  const soundscape = normalizeSoundscape(answers.soundscape, state.preferences.soundscape);
  const studyGoal = STUDY_GOALS.includes(answers.studyGoal)
    ? answers.studyGoal : state.preferences.studyGoal;
  return {
    ...state,
    onboarded: true,
    habit: current.journey,
    onboarding: { ...current, status: 'done', finishedAt: new Date().toISOString() },
    preferences: {
      ...state.preferences,
      dailyMinutes,
      soundscape,
      studyGoal,
      // Só sugere a meta quando ela nunca foi ajustada à mão.
      weeklyGoal: manualGoal ? state.preferences.weeklyGoal : rhythm?.weeklyGoal ?? state.preferences.weeklyGoal,
      weeklyGoalSource: manualGoal ? 'manual' : 'suggested',
    },
  };
}

// Plano inicial por jornada, usado na página Hoje e na revisão do ritmo.
export function journeyPlan(state) {
  const journey = normalizeOnboarding(state.onboarding).journey ?? state.habit;
  const pending = state.courses.find((course) => !course.paused && materialSteps(course).some((step) => !isCompleted(state, step.id)));
  const resumed = pending ? materialSteps(pending).find((step) => !isCompleted(state, step.id)) : null;
  const base = { journey, title: 'Seu próximo passo', detail: 'Registro manual, no seu tempo.', firstActivity: resumed?.title ?? null, course: pending?.title ?? null };
  if (journey === 'starting') return { ...base, title: 'Comece por uma coisa só', detail: 'Uma atividade concreta, sem montar um sistema inteiro.' };
  if (journey === 'sometimes') return { ...base, title: 'Continuar de onde parei', detail: 'Retome o material que ficou aberto, sem recomeçar do zero.' };
  if (journey === 'often') return { ...base, title: 'Prioridades e entregas', detail: 'Acompanhe trilhas, pontos de retomada e entregas próximas.' };
  return base;
}

export function addMaterial(state, { title, url = '', type = 'lesson', resumeAt = '', firstActivity = '', steps = [], planning = false }, origin = 'onboarding') {
  const activities = steps.length ? steps : [firstActivity || 'Concluir a primeira atividade'];
  const next = addCourse(state, { title, url, steps: activities, art: 'nature' });
  const cleanOrigin = origin === 'manual' ? 'manual' : 'onboarding';
  return {
    ...next,
    courses: next.courses.map((course) => course.id === next.selectedCourseId
      ? { ...course, type, resumeAt, origin: cleanOrigin, planning: planning === true }
      : course),
  };
}

export function studyRhythm(state) {
  const rhythm = STUDY_RHYTHMS.find(item => item.id === state.habit);
  return {
    title: rhythm?.title || 'Explorar no meu ritmo',
    weeklyGoal: rhythm?.weeklyGoal || 3,
    prepareFirst: state.habit === 'starting' || state.supports?.some(id => ['initiation', 'chunking'].includes(id)),
    message: state.supports?.includes('return')
      ? 'Retome pela próxima aula da lista. Se o prazo mudou, ajuste o plano.'
      : state.habit === 'starting' ? 'Comece pela primeira aula. Preparar o material ajuda, mas o avanço vem ao concluir.'
      : state.habit === 'often' ? 'Mantenha a sequência das trilhas ativas e conclua uma antes de abrir outra.'
      : 'Defina a próxima aula e reserve o tempo para concluí-la.',
  };
}

export const MAX_PROFILE_IMAGE_LENGTH = 256;
export const MAX_PROFILE_BIO_LENGTH = 240;

export function emptyProfileCard() {
  return { bio: '', avatar: '', header: '' };
}

export function sanitizeProfileImage(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PROFILE_IMAGE_LENGTH) return '';
  if (!/^\/api\/media\/profiles\/[A-Za-z0-9_-]{1,64}\/(?:avatar|header)-[0-9]{1,20}\.(?:webp|png|jpg|gif)$/.test(trimmed)) return '';
  return trimmed;
}

export function normalizeProfileCard(value) {
  const base = emptyProfileCard();
  if (!value || typeof value !== 'object') return base;
  const bio = typeof value.bio === 'string' ? value.bio.replace(/\r\n/g, '\n').trim().slice(0, MAX_PROFILE_BIO_LENGTH) : '';
  return {
    bio,
    avatar: sanitizeProfileImage(value.avatar),
    header: sanitizeProfileImage(value.header),
  };
}

export function createInitialState() {
  return {
    version: STATE_VERSION,
    onboarded: false,
    habit: null,
    challenges: [],
    supports: [],
    profile: emptyProfileCard(),
    preferences: {
      essential: false,
      gamification: true,
      theme: 'dark',
      palette: 'moderno',
      textSize: 'normal',
      weeklyGoal: 3,
      weeklyGoalSource: 'suggested',
      dailyMinutes: 90,
      soundscape: 'off',
      focusShield: false,
      focusNotes: '',
      studyGoal: '',
      sharing: { library: true, queue: true, progress: true, xp: true },
    },
    onboarding: emptyOnboarding(),
    courses: [],
    // Registro único de conclusões e preparações. O XP elegível é concedido pelo
    // servidor; aqui fica só o que a pessoa fez e de onde veio.
    progress: [],
    imports: [],
    // Sessão declarada pela pessoa: tempo de continuidade, nunca XP.
    activeSession: null,
    studySessions: [],
    // Tarefas de estudo para provas. Concluir vale XP uma vez; criar não.
    tasks: [],
    agenda: [],
    // Disciplinas criadas pela pessoa para agrupar materiais (subject-domain.js).
    subjects: [],
    // Plano: disponibilidade semanal, prazos e prioridades por curso e aulas
    // adiadas. O cronograma é derivado daqui e do progresso; não gera XP.
    plan: emptyPlan(),
    selectedCourseId: null,
    // Tarefa que a pessoa escolheu focar na Hoje (tasks-domain.js). Não gera XP.
    focusTaskId: null,
  };
}

function sanitizeCapabilities(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item.id === 'string' && typeof item.label === 'string').slice(0, 8).map((item) => ({
    id: item.id,
    label: item.label,
    value: typeof item.value === 'string' ? item.value : '',
    available: item.available === true,
  }));
}

// Campos de importação e de slides são extensões opcionais. Quando não são
// válidos, o curso e suas etapas continuam intactos: nenhum progresso é
// descartado. Esta função também garante que o estado antigo receba a estrutura
// de slides vazia, sem inventar conteúdo.
function sanitizeCourse(course, subjectIds = new Set()) {
  if (!course || typeof course !== 'object') return course;
  const slides = normalizeSlides(course.slides);
  const pdf = normalizePdfMeta(course.pdf);
  const type = pdf ? 'pdf' : STUDY_TYPES.some((item) => item.id === course.type) ? course.type : 'lesson';
  const { pdf: _pdf, reading: _reading, ...rest } = course;
  const base = {
    ...rest,
    ...(pdf ? { pdf, reading: normalizeReading(course.reading, pdf.pages) } : {}),
    subjectId: subjectIds.has(course.subjectId) ? course.subjectId : '',
    type,
    planning: course.planning === true,
    resumeAt: typeof course.resumeAt === 'string' ? course.resumeAt.slice(0, 120) : '',
    position: normalizePosition(course.position, type),
    slides,
    slideProgress: normalizeSlideProgress(course.slideProgress, slides),
    slidesUpdatedAt: Number.isFinite(Date.parse(course.slidesUpdatedAt)) ? course.slidesUpdatedAt : null,
  };
  if (!course.source || typeof course.source !== 'object') return base;
  const source = course.source;
  const extraction = source.extraction && typeof source.extraction === 'object' ? source.extraction : {};
  return {
    ...base,
    source: {
      provider: typeof source.provider === 'string' ? source.provider : 'unknown',
      providerLabel: typeof source.providerLabel === 'string' ? source.providerLabel : 'Fonte não reconhecida',
      identity: typeof source.identity === 'string' ? source.identity : '',
      canonicalUrl: typeof source.canonicalUrl === 'string' ? source.canonicalUrl : '',
      externalId: typeof source.externalId === 'string' ? source.externalId : '',
      fetchedAt: Number.isFinite(Date.parse(source.fetchedAt)) ? source.fetchedAt : null,
      extraction: {
        kind: typeof extraction.kind === 'string' ? extraction.kind : 'pasted-text',
        confidence: typeof extraction.confidence === 'string' ? extraction.confidence : 'low',
        notes: Array.isArray(extraction.notes) ? extraction.notes.filter((note) => typeof note === 'string').slice(0, 8) : [],
      },
      completeness: ['complete', 'partial', 'unknown'].includes(source.completeness) ? source.completeness : 'unknown',
      capabilities: sanitizeCapabilities(source.capabilities),
      warnings: Array.isArray(source.warnings) ? source.warnings.filter((item) => typeof item === 'string').slice(0, 10) : [],
      demo: source.demo === true,
      importedAt: Number.isFinite(Date.parse(source.importedAt)) ? source.importedAt : null,
      lastUpdatedAt: Number.isFinite(Date.parse(source.lastUpdatedAt)) ? source.lastUpdatedAt : null,
    },
    edital: course.edital && typeof course.edital === 'object' ? course.edital : null,
  };
}

function sanitizeImports(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry.courseId === 'string' && Number.isFinite(Date.parse(entry.at))).slice(-50).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : `imp_${entry.courseId}`,
    courseId: entry.courseId,
    at: entry.at,
    provider: typeof entry.provider === 'string' ? entry.provider : 'unknown',
    extraction: typeof entry.extraction === 'string' ? entry.extraction : 'pasted-text',
    lessonCount: Number.isInteger(entry.lessonCount) ? entry.lessonCount : 0,
    added: Number.isInteger(entry.added) ? entry.added : 0,
    removed: Number.isInteger(entry.removed) ? entry.removed : 0,
    mode: entry.mode === 'update' ? 'update' : 'create',
  }));
}

export function courseProgress(state, course) {
  const completed = completedUnitIds(state);
  const steps = materialSteps(course);
  const done = steps.filter((step) => completed.has(step.id)).length;
  return { done, total: steps.length, percent: steps.length ? Math.round(done / steps.length * 100) : 0 };
}

export function courseStatus(state, course) {
  const progress = courseProgress(state, course);
  if (progress.done === progress.total) return 'completed';
  if (course.paused) return 'paused';
  if (progress.done || materialHasActivity(state, course.id)) return 'active';
  return 'new';
}

export function hasPreparation(state, stepId) {
  return hasPreparationFor(state, stepId);
}

// A preparação organiza o caminho, mas não é estudo. A partir da política v1,
// novas conclusões registram progresso com xp 0: o XP elegível é concedido pelo
// servidor e aparece no extrato, nunca no saldo legado. Registros antigos com
// 5 ou 10 XP continuam preservados como histórico do protótipo.
export function completeMission(state, courseId, stepId, { preparation = false, now = new Date().toISOString() } = {}) {
  const course = state.courses.find((item) => item.id === courseId);
  const step = materialSteps(course).find((item) => item.id === stepId);
  if (!step || course.paused || isCompleted(state, stepId)) return { state, added: false, xp: 0 };
  const result = preparation
    ? recordPreparation(state, { materialId: courseId, unitId: stepId, at: now, title: `Preparar o material: ${course.title}`, materialTitle: course.title })
    : recordCompletion(state, { materialId: courseId, unitId: stepId, origin: 'manual', at: now, title: step.title, materialTitle: course.title });
  if (!result.added) return { state, added: false, xp: 0 };
  return { state: { ...result.state, selectedCourseId: courseId }, added: true, xp: 0 };
}

export function totalXP(state) {
  return legacyProgressXp(state);
}

// Nível do saldo legado, usado apenas na prévia sem conta. Em uma conta, o
// nível vem do servidor (xp-policy.js), que ignora este saldo.
export function levelInfo(state) {
  return levelProgress(totalXP(state));
}

export function localDay(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function weekCount(state, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const inWeek = (entry) => entry.at && new Date(entry.at) >= start && new Date(entry.at) < end;
  // Só estudo concluído conta; preparar o material e registros históricos, não.
  const lessons = activeCompletions(state).filter((entry) => !entry.historical && inWeek(entry)).length;
  return lessons;
}

export function achievements(state) {
  const completedCourses = state.courses.filter((course) => courseStatus(state, course) === 'completed').length;
  const done = activeCompletions(state).filter((entry) => !entry.historical && entry.at);
  const days = new Set(done.map((entry) => localDay(entry.at))).size;
  const definitions = [
    { id: 'first', title: 'A primeira faísca', text: 'Concluir sua primeira missão, do tamanho que for.', icon: 'spark', current: done.length, target: 1 },
    { id: 'three', title: 'Passo a passo', text: 'Concluir três missões, sem prazo para chegar lá.', icon: 'steps', current: done.length, target: 3 },
    { id: 'course', title: 'Uma nova descoberta', text: 'Concluir todas as etapas de um curso.', icon: 'flag', current: completedCourses, target: 1 },
    { id: 'own', title: 'Do meu jeito', text: 'Adicionar seu próprio curso à biblioteca.', icon: 'book', current: state.courses.filter((course) => !course.example).length, target: 1 },
    { id: 'days', title: 'No meu ritmo', text: 'Estudar em cinco dias diferentes. Não precisam ser seguidos.', icon: 'calendar', current: days, target: 5 },
    { id: 'two', title: 'Novos horizontes', text: 'Concluir dois cursos, no seu tempo.', icon: 'mountain', current: completedCourses, target: 2 },
  ];
  return definitions.map((item) => ({ ...item, unlocked: item.current >= item.target, current: Math.min(item.current, item.target) }));
}

export function safeCourseURL(value) {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function addCourse(state, { title, url = '', steps, art = 'design' }, id = crypto.randomUUID()) {
  const cleanTitle = title.trim().slice(0, 100);
  const cleanSteps = steps.map((step) => step.trim()).filter(Boolean);
  const cleanURL = safeCourseURL(url);
  if (!cleanTitle || !cleanSteps.length || cleanSteps.length > 40 || cleanSteps.some((step) => step.length > 180) || cleanURL === null) {
    throw new Error('Confira o nome, o link e as etapas do curso. São permitidas até 40 etapas de 180 caracteres.');
  }
  const course = {
    id, title: cleanTitle, url: cleanURL, category: 'Minha trilha de estudos',
    art: ['design', 'code', 'language', 'nature'].includes(art) ? art : 'nature',
    example: false, paused: false, type: 'course', planning: false, resumeAt: '',
    position: null,
    slides: [], slideProgress: { seen: [], lastId: '', completedAt: null },
    units: stepUnits(cleanSteps.map((step, index) => ({ id: `${id}-${index}`, title: step }))),
  };
  return { ...state, courses: [...state.courses, course], selectedCourseId: id };
}

// Edição de dados básicos. Etapas de curso importado vêm da fonte e não são
// substituídas por aqui; slides e ponto de retomada valem para os dois formatos.
export function updateCourse(state, courseId, patch = {}) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) throw new Error('Material não encontrado.');
  const cleanTitle = typeof patch.title === 'string' ? patch.title.trim().slice(0, 100) : course.title;
  if (!cleanTitle) throw new Error('Dê um nome ao material.');
  const cleanURL = patch.url === undefined ? course.url : safeCourseURL(String(patch.url || ''));
  if (cleanURL === null) throw new Error('Confira o link do material.');
  const type = course.pdf || patch.type === undefined ? course.type : (STUDY_TYPES.some((item) => item.id === patch.type) ? patch.type : course.type);
  const position = patch.position === undefined ? normalizePosition(course.position, type) : normalizePosition(patch.position, type);
  const resumeAt = patch.resumeAt === undefined
    ? (patch.position !== undefined ? positionLabel(type, position) : course.resumeAt)
    : String(patch.resumeAt || '').slice(0, 120);
  const next = {
    ...course,
    title: cleanTitle,
    url: cleanURL || '',
    type,
    resumeAt,
    position,
    planning: patch.planning === undefined ? course.planning === true : patch.planning === true,
    category: typeof patch.category === 'string' ? patch.category.trim().slice(0, 100) || course.category : course.category,
    art: patch.art === undefined ? course.art : (['design', 'code', 'language', 'nature'].includes(patch.art) ? patch.art : course.art),
  };
  return { ...state, courses: state.courses.map((item) => item.id === courseId ? next : item) };
}

export function toggleCoursePause(state, courseId) {
  return { ...state, courses: state.courses.map((course) => course.id === courseId ? { ...course, paused: !course.paused } : course) };
}

export function selectCourse(state, courseId) {
  return { ...state, selectedCourseId: courseId };
}

export function setCourseEdital(state, courseId, edital) {
  return { ...state, courses: state.courses.map((course) => course.id === courseId ? { ...course, edital } : course) };
}

export function replaceCourseSteps(state, courseId, steps = []) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) throw new Error('Material não encontrado.');
  if (course.source) throw new Error('As etapas de um curso importado vêm da fonte. Atualize a grade pela importação.');
  const cleanSteps = steps.map((step) => String(step?.title ?? step ?? '').trim()).filter(Boolean);
  if (!cleanSteps.length) throw new Error('Mantenha pelo menos uma etapa.');
  if (cleanSteps.length > 40) throw new Error('São permitidas até 40 etapas.');
  if (cleanSteps.some((step) => step.length > 180)) throw new Error('Cada etapa pode ter até 180 caracteres.');
  const previous = new Map(materialSteps(course).map((step) => [step.id, step]));
  const used = new Set();
  const nextSteps = cleanSteps.map((title, index) => {
    const exact = materialSteps(course).find((step) => step.title === title && !used.has(step.id));
    if (exact) { used.add(exact.id); return exact; }
    const sameIndex = materialSteps(course)[index];
    if (sameIndex && !used.has(sameIndex.id)) {
      used.add(sameIndex.id);
      return { ...sameIndex, title };
    }
    let id = `${course.id}-${index}`;
    while (previous.has(id) || used.has(id)) id = `${id}_${index}`;
    used.add(id);
    return { id, title };
  });
  const validIds = new Set(nextSteps.map((step) => step.id));
  return {
    ...state,
    courses: state.courses.map((item) => item.id === courseId ? { ...item, units: stepUnits(nextSteps) } : item),
    progress: (state.progress || []).filter((event) => event.materialId !== courseId || validIds.has(event.unitId)),
  };
}

// Exclusão pedida pela pessoa, com confirmação na interface. O XP já concedido
// permanece no livro do servidor; aqui removemos o material e o progresso que
// dependem dele para o documento continuar válido.
export function deleteCourse(state, courseId) {
  const course = (state.courses || []).find((item) => item.id === courseId);
  if (!course) return state;
  const stepIds = new Set(materialSteps(course).map((step) => step.id));
  const courses = state.courses.filter((item) => item.id !== courseId);
  return {
    ...state,
    courses,
    progress: (state.progress || []).filter((event) => event.materialId !== courseId && !stepIds.has(event.unitId)),
    imports: (state.imports || []).filter((entry) => entry.courseId !== courseId),
    studySessions: (state.studySessions || []).filter((session) => session.courseId !== courseId),
    activeSession: state.activeSession?.courseId === courseId ? null : state.activeSession,
    tasks: (state.tasks || []).map((task) => task.courseId === courseId ? { ...task, courseId: '' } : task),
    selectedCourseId: state.selectedCourseId === courseId ? (courses[0]?.id ?? null) : state.selectedCourseId,
  };
}

// Cursos de exemplo não são mais criados. Um exemplo antigo só permanece se a
// pessoa tiver algum progresso nele; exemplos intocados são removidos na
// restauração, sem tocar em cursos reais nem em histórico.
function exampleHasProgress(course, value, progress) {
  const stepIds = new Set(materialSteps(course).map((step) => step.id));
  return progress.some((event) => event.materialId === course.id || stepIds.has(event.unitId))
    || (Array.isArray(value.studySessions) && value.studySessions.some((session) => session.courseId === course.id))
    || value.activeSession?.courseId === course.id;
}

// Curso e etapas válidos; ids repetidos ficam com a primeira ocorrência.
function validCourses(list) {
  const ids = new Set();
  const stepIds = new Set();
  const courses = [];
  for (let course of Array.isArray(list) ? list : []) {
    if (!course || typeof course.id !== 'string' || ids.has(course.id) || typeof course.title !== 'string') continue;
    if (!Array.isArray(course.units) || 'steps' in course || 'structure' in course || 'selection' in course || safeCourseURL(course.url || '') === null) continue;
    course = { ...course, units: normalizeMaterialUnits(course.units.filter((unit) => !stepIds.has(unit?.id))) };
    const steps = materialSteps(course);
    if (!steps.length || course.units.some((unit) => stepIds.has(unit.id))) continue;
    ids.add(course.id);
    course.units.forEach((unit) => stepIds.add(unit.id));
    courses.push(course);
  }
  return courses;
}

// Valida o formato atual por material e registro. Formatos antigos são
// recusados explicitamente, sem produzir um estado vazio para gravar por cima.
export function restoreState(raw) {
  const fallback = createInitialState();
  if (!raw) return fallback;
  let value;
  try {
    value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  if (value.version !== STATE_VERSION) throw new Error('Formato de dados incompatível. Nenhuma migração automática será realizada.');
  try {
    const courses = validCourses(value.courses);
    const progress = normalizeProgress(value.progress);
    const keptCourses = courses.filter((course) => course.example !== true || exampleHasProgress(course, value, progress));
    const keptIds = new Set(keptCourses.map((course) => course.id));
    const keptStepIds = new Set(keptCourses.flatMap((course) => materialSteps(course).map((step) => step.id)));
    const selectedCourseId = keptIds.has(value.selectedCourseId) ? value.selectedCourseId : keptCourses[0]?.id ?? null;
    const preferences = value.preferences || {};
    const { completed: _completed, history: _history, studyLog: _studyLog, ...rest } = value;
    const subjects = normalizeSubjects(value.subjects);
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    return {
      ...fallback, ...rest,
      version: STATE_VERSION,
      courses: keptCourses.map((course) => sanitizeCourse(course, subjectIds)),
      subjects,
      progress: pruneProgress(progress, keptStepIds),
      selectedCourseId,
      imports: sanitizeImports(value.imports),
      activeSession: normalizeActiveSession(value.activeSession),
      studySessions: normalizeStudySessions(value.studySessions),
      onboarded: value.onboarded === true,
      habit: HABITS.some((habit) => habit.id === value.habit) ? value.habit : null,
      challenges: Array.isArray(value.challenges) ? value.challenges.filter((id) => CHALLENGES.some((item) => item.id === id)) : [],
      supports: Array.isArray(value.supports) ? [...new Set(value.supports.filter(id => STUDY_SUPPORTS.some(item => item.id === id)))] : [],
      profile: normalizeProfileCard(value.profile),
      tasks: normalizeTasks(value.tasks),
      focusTaskId: normalizeFocusTaskId(value.focusTaskId, normalizeTasks(value.tasks)),
      agenda: normalizeAgenda(value.agenda),
      plan: normalizePlan(value.plan, keptIds),
      preferences: {
        essential: preferences.essential === true,
        gamification: preferences.gamification !== false,
        theme: preferences.theme === 'light' ? 'light' : 'dark',
        palette: PALETTES.some((item) => item.id === preferences.palette) ? preferences.palette : 'moderno',
        textSize: preferences.textSize === 'large' ? 'large' : 'normal',
        weeklyGoal: Number.isInteger(preferences.weeklyGoal) && preferences.weeklyGoal >= 1 && preferences.weeklyGoal <= 7 ? preferences.weeklyGoal : 3,
        weeklyGoalSource: preferences.weeklyGoalSource === 'manual' ? 'manual' : 'suggested',
        dailyMinutes: Number.isInteger(preferences.dailyMinutes) && preferences.dailyMinutes >= 15 && preferences.dailyMinutes <= 720 ? preferences.dailyMinutes : 90,
        soundscape: normalizeSoundscape(preferences.soundscape, 'off'),
        focusShield: preferences.focusShield === true,
        focusNotes: typeof preferences.focusNotes === 'string' ? preferences.focusNotes.slice(0, 4000) : '',
        studyGoal: STUDY_GOALS.includes(preferences.studyGoal) ? preferences.studyGoal : '',
        sharing: {
          library: preferences.sharing?.library !== false,
          queue: preferences.sharing?.queue !== false,
          progress: preferences.sharing?.progress !== false,
          xp: preferences.sharing?.xp !== false,
        },
      },
      onboarding: normalizeOnboarding(value.onboarding),
    };
  } catch {
    return fallback;
  }
}
