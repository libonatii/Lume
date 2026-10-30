export const STORAGE_KEY = 'lume.prototype.v1';
export const HABITS = [
  { id: 'starting', icon: 'sprout', title: 'Quero começar', text: 'Ainda não tenho uma rotina de estudos.' },
  { id: 'sometimes', icon: 'leaf', title: 'Estudo de vez em quando', text: 'Começo, mas nem sempre consigo manter.' },
  { id: 'often', icon: 'tree', title: 'Já estudo com frequência', text: 'Quero organizar e acompanhar meu progresso.' },
];
export const CHALLENGES = [
  { id: 'start', title: 'Dar o primeiro passo', icon: 'spark' },
  { id: 'choose', title: 'Escolher o que estudar', icon: 'compass' },
  { id: 'focus', title: 'Manter a atenção', icon: 'focus' },
  { id: 'routine', title: 'Criar uma rotina possível', icon: 'calendar' },
  { id: 'return', title: 'Retomar depois de uma pausa', icon: 'return' },
  { id: 'unsure', title: 'Ainda não sei', icon: 'help' },
];

export function createInitialState() {
  return {
    version: 1,
    onboarded: false,
    habit: null,
    challenges: [],
    preferences: { essential: false, gamification: true, reducedMotion: true, theme: 'dark', textSize: 'normal', weeklyGoal: 3 },
    courses: [
      { id: 'design', title: 'Design de interfaces', category: 'Design & criatividade', art: 'design', url: '', example: true, paused: false, steps: [
        { id: 'design-1', title: 'Abrir o material e conhecer o curso' },
        { id: 'design-2', title: 'Assistir ao primeiro trecho da aula 01' },
        { id: 'design-3', title: 'Desenhar uma ideia de interface no papel' },
        { id: 'design-4', title: 'Revisar uma coisa que aprendi' },
      ] },
      { id: 'python', title: 'Primeiros passos em Python', category: 'Tecnologia & programação', art: 'code', url: '', example: true, paused: false, steps: [
        { id: 'python-1', title: 'Abrir o material e conhecer o curso' },
        { id: 'python-2', title: 'Assistir ao primeiro trecho da aula 01' },
        { id: 'python-3', title: 'Escrever meu primeiro print' },
        { id: 'python-4', title: 'Praticar com um pequeno exercício' },
      ] },
      { id: 'english', title: 'Inglês no dia a dia', category: 'Idiomas & descobertas', art: 'language', url: '', example: true, paused: false, steps: [
        { id: 'english-1', title: 'Escolher um material de inglês' },
        { id: 'english-2', title: 'Ouvir uma conversa curta' },
        { id: 'english-3', title: 'Anotar três expressões novas' },
        { id: 'english-4', title: 'Revisar as expressões que anotei' },
      ] },
    ],
    completed: [],
    history: [],
    selectedCourseId: 'design',
  };
}

export function courseProgress(state, course) {
  const done = course.steps.filter((step) => state.completed.includes(step.id)).length;
  return { done, total: course.steps.length, percent: Math.round(done / course.steps.length * 100) };
}

export function courseStatus(state, course) {
  const progress = courseProgress(state, course);
  if (progress.done === progress.total) return 'completed';
  if (course.paused) return 'paused';
  if (progress.done || state.history.some((entry) => entry.courseId === course.id)) return 'active';
  return 'new';
}

export function nextMission(state, courseId = state.selectedCourseId) {
  const preferred = state.courses.find((course) => course.id === courseId);
  const candidates = preferred ? [preferred, ...state.courses.filter((course) => course.id !== preferred.id)] : state.courses;
  for (const course of candidates) {
    if (course.paused) continue;
    const step = course.steps.find((item) => !state.completed.includes(item.id));
    if (step) return { course, step };
  }
  return null;
}

export function hasPreparation(state, stepId) {
  return state.history.some((entry) => entry.id === `prepare:${stepId}`);
}

// A preparação é uma missão própria: nunca conclui a etapa original.
export function completeMission(state, courseId, stepId, { preparation = false, now = new Date().toISOString() } = {}) {
  const course = state.courses.find((item) => item.id === courseId);
  const step = course?.steps.find((item) => item.id === stepId);
  if (!step || course.paused || state.completed.includes(stepId)) return { state, added: false, xp: 0 };
  const id = preparation ? `prepare:${stepId}` : `step:${stepId}`;
  if (state.history.some((entry) => entry.id === id)) return { state, added: false, xp: 0 };
  const xp = preparation ? 5 : 10;
  const entry = { id, courseId, stepId, title: preparation ? `Preparar o material: ${course.title}` : step.title, courseTitle: course.title, preparation, xp, at: now };
  return {
    state: {
      ...state,
      selectedCourseId: courseId,
      completed: preparation ? [...state.completed] : [...state.completed, stepId],
      history: [...state.history, entry],
    },
    added: true,
    xp,
  };
}

export function totalXP(state) {
  return state.history.reduce((total, entry) => total + entry.xp, 0);
}

export function levelInfo(state) {
  const xp = totalXP(state);
  return { level: Math.floor(xp / 100) + 1, current: xp % 100, total: xp, next: 100 };
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
  return state.history.filter((entry) => new Date(entry.at) >= start && new Date(entry.at) < end).length;
}

export function achievements(state) {
  const completedCourses = state.courses.filter((course) => courseStatus(state, course) === 'completed').length;
  const days = new Set(state.history.map((entry) => localDay(entry.at))).size;
  const definitions = [
    { id: 'first', title: 'A primeira faísca', text: 'Concluir sua primeira missão, do tamanho que for.', icon: 'spark', current: state.history.length, target: 1 },
    { id: 'three', title: 'Passo a passo', text: 'Concluir três missões, sem prazo para chegar lá.', icon: 'steps', current: state.history.length, target: 3 },
    { id: 'course', title: 'Uma nova descoberta', text: 'Concluir todas as etapas de um curso.', icon: 'flag', current: completedCourses, target: 1 },
    { id: 'own', title: 'Do meu jeito', text: 'Adicionar seu próprio curso à biblioteca.', icon: 'book', current: state.courses.filter((course) => !course.example).length, target: 1 },
    { id: 'days', title: 'No meu ritmo', text: 'Estudar em cinco dias diferentes. Não precisam ser seguidos.', icon: 'leaf', current: days, target: 5 },
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
    example: false, paused: false,
    steps: cleanSteps.map((step, index) => ({ id: `${id}-${index}`, title: step })),
  };
  return { ...state, courses: [...state.courses, course], selectedCourseId: id };
}

export function restoreState(raw) {
  const fallback = createInitialState();
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.courses) || !Array.isArray(value.completed) || !Array.isArray(value.history)) return fallback;
    const ids = new Set();
    const stepIds = new Set();
    const validCourses = value.courses.every((course) => {
      if (!course || typeof course.id !== 'string' || ids.has(course.id) || typeof course.title !== 'string' || !Array.isArray(course.steps) || !course.steps.length || safeCourseURL(course.url || '') === null) return false;
      ids.add(course.id);
      return course.steps.every((step) => {
        if (!step || typeof step.id !== 'string' || stepIds.has(step.id) || typeof step.title !== 'string') return false;
        stepIds.add(step.id);
        return true;
      });
    });
    const eventIds = new Set();
    const validHistory = value.history.every((entry) => {
      if (!entry || typeof entry.id !== 'string' || eventIds.has(entry.id) || !ids.has(entry.courseId) || !stepIds.has(entry.stepId) || typeof entry.title !== 'string' || typeof entry.courseTitle !== 'string' || ![5, 10].includes(entry.xp) || !Number.isFinite(Date.parse(entry.at))) return false;
      eventIds.add(entry.id);
      return true;
    });
    if (!validCourses || !validHistory || value.completed.some((id) => !stepIds.has(id))) return fallback;
    const preferences = value.preferences || {};
    return {
      ...fallback, ...value,
      onboarded: value.onboarded === true,
      habit: HABITS.some((habit) => habit.id === value.habit) ? value.habit : null,
      challenges: Array.isArray(value.challenges) ? value.challenges.filter((id) => CHALLENGES.some((item) => item.id === id)) : [],
      preferences: {
        essential: preferences.essential === true,
        gamification: preferences.gamification !== false,
        reducedMotion: preferences.reducedMotion !== false,
        theme: preferences.theme === 'light' ? 'light' : 'dark',
        textSize: preferences.textSize === 'large' ? 'large' : 'normal',
        weeklyGoal: Number.isInteger(preferences.weeklyGoal) && preferences.weeklyGoal >= 1 && preferences.weeklyGoal <= 7 ? preferences.weeklyGoal : 3,
      },
    };
  } catch {
    return fallback;
  }
}
