import {
  STORAGE_KEY, HABITS, createInitialState, restoreState,
  courseProgress, courseStatus, nextMission, hasPreparation, completeMission,
  levelInfo, localDay, weekCount, achievements, addCourse,
  STUDY_RHYTHMS, STUDY_SUPPORTS, studyRhythm, applyStudyRhythm,
} from './domain.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
let storageAvailable = true;
let state;
try {
  state = restoreState(localStorage.getItem(STORAGE_KEY));
} catch {
  state = createInitialState();
  storageAvailable = false;
}
// Prévia local: esta sessão de navegação não é autenticação de uma conta.
const PREVIEW_SESSION_KEY = 'lume.preview-session.v1';
let previewEntered = false;
try { previewEntered = sessionStorage.getItem(PREVIEW_SESSION_KEY) === 'open'; } catch { /* Sessão permanece só em memória. */ }
let onboardingDraft = { habit: state.habit, supports: [...state.supports] };
let libraryFilter = 'all';
let searchTerm = '';
let session = null;
let toastTimer;
let lastRenderedRoute = null;
let activePageTransition = null;
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  book: '<path d="M12 5v16M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',
  flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0Zm4 11v7m-4 0h8M8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7m2-4v5l3 2"/>',
  settings: '<path d="m10 3-1 3-3 1-3-1-1 4 3 2v3l-1 3 4 2 2-2h3l3 1 3-4-2-2v-3l1-3-4-3-2 1Z"/><circle cx="11" cy="12" r="3"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  sprout: '<path d="M12 21v-9M12 15C3 16 3 7 3 7s9-1 9 8Zm0-3C12 3 21 3 21 3s1 9-9 9Z"/>',
  leaf: '<path d="M20 3S5 1 4 12c-1 8 9 12 14 5 3-4 2-14 2-14ZM4 21 15 9"/>',
  tree: '<path d="M12 22v-6m0-14-7 8h3l-5 7h18l-5-7h3Z"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
  return: '<path d="m8 3-5 5 5 5M3 8h10a7 7 0 1 1 0 14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  external: '<path d="M14 3h7v7m0-7L10 14m0-11H4v17h17v-6"/>',
  steps: '<path d="M3 20h6v-6h6V8h6V3"/>',
  mountain: '<path d="m2 20 7-12 5 7 3-5 5 10Zm4-7 3 1 2-2"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || icons.spark}</svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storageAvailable = false;
    notify('Não foi possível salvar neste navegador. Seu progresso fica disponível apenas enquanto esta página estiver aberta.');
  }
}

function notify(message) {
  const toast = document.querySelector('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 6500);
}

function cover(course) {
  const art = ['design', 'code', 'language', 'nature'].includes(course.art) ? course.art : 'nature';
  return `<div class="course-cover art-${art}" aria-hidden="true"><img src="./assets/stitch/${art}.png" alt="" loading="lazy" /></div>`;
}

function route() {
  if (!previewEntered) return 'login';
  const requested = location.hash.slice(1);
  if (requested === 'login') return 'login';
  if (!state.onboarded) return 'inicio';
  const valid = ['hoje', 'biblioteca', 'missoes', 'conquistas', 'historico', 'configuracoes', 'inicio'];
  return valid.includes(requested) ? requested : 'hoje';
}

function go(destination) {
  if (route() === destination && location.hash === `#${destination}`) render(true);
  else location.hash = destination;
}

function applyPreferences() {
  document.documentElement.dataset.theme = state.preferences.theme;
  document.documentElement.dataset.motion = state.preferences.reducedMotion ? 'reduced' : 'full';
  document.documentElement.dataset.text = state.preferences.textSize;
  document.querySelector('meta[name="theme-color"]').content = state.preferences.theme === 'light' ? '#f4f5ef' : '#0c1322';
}

function shell(content, currentRoute) {
  const links = [['hoje', 'home', 'Hoje'], ['biblioteca', 'book', 'Biblioteca'], ['missoes', 'flag', 'Missões'], ['conquistas', 'trophy', 'Conquistas'], ['historico', 'history', 'Meu Caminho'], ['configuracoes', 'settings', 'Configurações & Conforto']];
  const level = levelInfo(state);
  return `<aside class="sidebar" aria-label="Menu principal">
    <a href="#hoje" class="brand" aria-label="Lume — página inicial"><img class="lume-logo" src="./assets/stitch/logo.png" alt="" /><span class="brand-copy">Lume<small>Ritmo Serena</small></span></a>
    <nav aria-label="Navegação">${links.map(([path, symbol, label]) => `<a href="#${path}" aria-label="${label}" class="nav-link ${(currentRoute === path || (path === 'hoje' && currentRoute === 'inicio')) ? 'active' : ''}" ${currentRoute === path ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span></a>`).join('')}</nav>
    <div class="sidebar-bottom"><label class="essential-toggle" for="sidebar-essential"><span>Modo Essencial</span><input id="sidebar-essential" class="switch" type="checkbox" data-preference="essential" ${state.preferences.essential ? 'checked' : ''}/><small>Foco calmo e sem distrações visuais</small></label><p class="sidebar-mantra">Não é uma corrida.<br>É o seu caminho.</p></div>
  </aside><div class="workspace"><header class="topbar"><span class="calm-badge"><span class="live-dot"></span> Foco Calmo · Sem Pressa</span><div class="topbar-right">${state.preferences.gamification ? `<div class="header-level">${icon('sprout')}<div><span>Nível ${level.level} <span class="muted">·</span> <strong>${level.current} / ${level.next} XP</strong></span><progress max="100" value="${level.current}" aria-label="Experiência até o próximo nível"></progress></div></div>` : '<span class="local-badge">Seu ritmo, sem pontuação</span>'}<button class="top-avatar icon-button" data-action="navigate" data-route="configuracoes" aria-label="Abrir minhas preferências">${icon('settings')}</button><button class="exit-preview" data-action="exit-preview">Sair da prévia</button></div></header>
  <main id="main" tabindex="-1">${content}</main><footer class="page-footer"><span>Feito para o seu ritmo, não o contrário.</span><span>Protótipo · ${storageAvailable ? 'dados só neste navegador' : 'dados temporários nesta aba'}</span></footer></div>`;
}


function entryShell(content, currentRoute) {
  return `<div class="entry-workspace"><header class="entry-header"><a class="entry-brand" href="#login" aria-label="Lume — início">Lume<span class="live-dot"></span></a><nav aria-label="Entrada no Lume"><button class="comfort-button" data-action="toggle-theme">${icon('sun')} Conforto visual</button>${currentRoute === 'login' ? '<button class="text-button" data-action="account-info">Criar conta</button>' : '<button class="text-button" data-action="exit-preview">Voltar à entrada</button>'}<button class="text-button" data-action="entry-help">Ajuda</button></nav></header><main id="main" tabindex="-1" class="entry-main">${content}</main><footer class="entry-footer"><span><span class="live-dot"></span> Aprender no seu ritmo, com espaço para recomeçar.</span><span>Prévia local · sem cadastro</span></footer></div>`;
}

function loginPage() {
  return `<div class="login-layout"><section class="login-story" aria-labelledby="welcome-title"><span class="welcome-badge">${icon('sprout')} SEU ESPAÇO DE DESCOBERTAS</span><h1 id="welcome-title">Aprender pode ter <br>o seu <em>ritmo.</em></h1><p>Um pequeno passo, uma nova possibilidade. Organize seus estudos com missões que cabem no seu momento.</p><div class="login-story-note">${icon('leaf')}<div><strong>Não é uma corrida.</strong><p>Você pode começar pequeno e voltar quando quiser.</p></div></div><div class="login-garden"><img src="./assets/stitch/welcome.png" alt="Jardim tranquilo com pedras e vegetação"/><span>Um começo mais leve.</span></div><p class="story-ending">Seu caminho não precisa ser igual ao de ninguém.</p></section><section class="login-panel" aria-labelledby="login-title"><div class="login-eyebrow"><span class="green-pill">BEM-VINDO AO LUME</span><span>Prévia local</span></div><h2 id="login-title">Que bom ter você aqui.</h2><p class="login-subtitle">Entre para encontrar seu ritmo de estudo e experimentar seu espaço.</p><button class="button secondary full-width" disabled>Continuar com Google <span class="coming-soon">Em breve</span></button><div class="login-divider"><span>Contas em preparação</span></div><fieldset class="future-login" disabled aria-describedby="preview-explanation"><legend class="sr-only">Login de conta — indisponível nesta prévia</legend><label for="future-email">E-mail</label><input id="future-email" type="email" placeholder="Disponível quando as contas forem ativadas" autocomplete="off"/><label for="future-password">Senha</label><input id="future-password" type="password" placeholder="Nenhuma senha é necessária nesta prévia" autocomplete="off"/></fieldset><div class="preview-explanation" id="preview-explanation">${icon('shield')}<p>Explore sem e-mail ou senha. Seu progresso fica neste navegador. Esta entrada ainda não autentica uma conta.</p></div><button class="button primary full-width" data-action="enter-preview">Entrar na prévia ${icon('arrow')}</button><p class="login-footnote">Na próxima tela, vamos encontrar um começo que combine com você.</p></section></div><div class="entry-benefits"><div>${icon('steps')}<span><strong>Pequenos passos</strong>Uma próxima ação possível.</span></div><div>${icon('leaf')}<span><strong>Sem pressa</strong>Pausas preservam seu progresso.</span></div><div>${icon('shield')}<span><strong>Dados locais</strong>Sem envio de dados de estudo.</span></div></div>`;
}

function onboarding() {
  return `<section class="rhythm-page"><div class="rhythm-progress-label"><span>UM COMEÇO DO SEU JEITO</span><span>Etapa 1 de 1</span></div><progress class="rhythm-progress" max="1" value="1" aria-label="Personalização inicial, etapa 1 de 1"></progress><div class="rhythm-intro"><span class="green-pill">VAMOS ENCONTRAR SEU RITMO</span><h1>Como os estudos fazem parte <br>da sua vida hoje?</h1><p>Não existe resposta certa, nem ritmo melhor. Escolha o que combina com seu momento. Você pode mudar depois.</p></div><fieldset class="rhythm-options"><legend class="sr-only">Seu ritmo de estudo</legend>${STUDY_RHYTHMS.map(item => `<label class="rhythm-card"><input id="rhythm-${item.id}" type="radio" name="habit" value="${item.id}" ${onboardingDraft.habit === item.id ? 'checked' : ''}/><span class="rhythm-card-top"><span class="rhythm-icon">${icon(item.icon)}</span><span class="rhythm-check" aria-hidden="true">${icon('check')}</span></span><span class="rhythm-label">${item.label}</span><strong class="rhythm-title">${item.title}</strong><span class="rhythm-subtitle">${item.subtitle}</span><span class="rhythm-description">${item.text}</span><span class="rhythm-detail">${icon('calendar')}${item.detail}</span></label>`).join('')}</fieldset><section class="study-supports"><div class="support-heading"><h2>${icon('focus')} O que ajudaria você a estudar?</h2><span>Escolha opcional · pode marcar mais de um</span></div><fieldset class="support-options"><legend class="sr-only">Apoios para o estudo</legend>${STUDY_SUPPORTS.map(item => `<label class="support-option"><input id="support-${item.id}" type="checkbox" name="support" value="${item.id}" ${onboardingDraft.supports.includes(item.id) ? 'checked' : ''}/><span><strong>${item.title}</strong><small>${item.text}</small></span>${icon(item.icon)}</label>`).join('')}</fieldset></section><div class="rhythm-result"><span>${icon('settings')} O que muda no seu espaço</span><p id="rhythm-summary" aria-live="polite">${esc(rhythmSummary())}</p></div><div class="rhythm-actions"><button class="text-button" data-action="skip-onboarding">${state.onboarded ? 'Usar minhas preferências salvas' : 'Explorar sem personalizar agora'}</button><button id="onboarding-next" class="button primary" data-action="finish-onboarding" ${!onboardingDraft.habit ? 'disabled' : ''}>Continuar no meu ritmo ${icon('arrow')}</button></div><p class="rhythm-footer">Sem diagnóstico, sem comparações. O plano é uma sugestão, não uma obrigação.</p></section>`;
}

function rhythmSummary() {
  if (!onboardingDraft.habit) return 'Escolha um ritmo para ver as sugestões. Seus dados e conquistas continuam guardados.';
  const suggested = applyStudyRhythm(state, onboardingDraft);
  const plan = studyRhythm(suggested);
  return `${suggested.preferences.weeklyGoal} passos sugeridos por semana.${plan.prepareFirst ? ' Preparar o material pode ser sua primeira missão.' : ' Uma etapa por vez, no seu tempo.'}${suggested.preferences.essential ? ' Modo essencial para mostrar menos informação.' : ''} Tudo pode ser ajustado nas configurações.`;
}

function pageHeading(eyebrow, title, subtitle, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}

function courseCard(course) {
  const progress = courseProgress(state, course);
  const status = courseStatus(state, course);
  const labels = { new: 'Para começar', active: 'Em andamento', paused: 'Em pausa para descansar', completed: 'Concluído' };
  return `<button class="course-card ${course.id === state.selectedCourseId ? 'selected-course' : ''}" data-action="open-course" data-id="${esc(course.id)}" aria-label="${esc(course.title)}, ${labels[status]}, ${progress.done} de ${progress.total} etapas">
    <div class="course-image">${cover(course)}<span class="course-status status-${status}"><span class="live-dot"></span>${labels[status]}</span></div><div class="course-card-body"><h3>${esc(course.title)}</h3><p class="course-description">${esc(course.category)}${course.example ? ' · Exemplo' : ''}</p><div class="course-progress-label"><span>${progress.done} de ${progress.total} etapas</span><strong>${progress.percent}%</strong></div><progress max="100" value="${progress.percent}" aria-hidden="true"></progress></div></button>`;
}

function progressCard() {
  const level = levelInfo(state);
  const count = weekCount(state);
  const target = state.preferences.weeklyGoal;
  return `<aside class="journey-card panel"><div class="card-eyebrow">${icon('compass')} SEU CAMINHO</div>
    ${state.preferences.gamification ? `<div class="level-row"><div class="level-medallion">${icon('spark')}</div><div><span class="overline">CADA PASSO CONTA</span><h2>Nível ${level.level}</h2><span class="muted">${level.total === 0 ? 'Toda jornada tem um começo.' : `${level.total} XP de descobertas.`}</span></div></div><div class="xp-label"><span>${level.current} / ${level.next} XP</span><span>Próximo nível</span></div><progress class="xp-progress" max="100" value="${level.current}" aria-label="Experiência até o próximo nível"></progress>` : `<div class="level-row"><div class="level-medallion">${icon('leaf')}</div><div><h2>Do seu jeito</h2><p>Progresso também é encontrar<br>um ritmo confortável.</p></div></div>`}
    <div class="weekly-plan"><div><span>Seu plano da semana</span><strong>${count} <span class="muted">/ ${target} missões</span></strong></div><div class="week-dots" aria-label="${count} de ${target} missões nesta semana">${Array.from({ length: target }, (_, index) => `<span class="${index < count ? 'done' : ''}">${index < count ? icon('check') : ''}</span>`).join('')}</div><p>Uma sugestão, não uma cobrança.<br>Você pode ajustar quando quiser.</p></div>
  </aside>`;
}

function home() {
  const mission = nextMission(state);
  const essential = state.preferences.essential;
  const count = weekCount(state);
  const plan = studyRhythm(state);
  const prepareFirst = mission && plan.prepareFirst && !hasPreparation(state, mission.step.id);
  const goal = state.preferences.weeklyGoal;
  const progress = mission ? courseProgress(state, mission.course) : null;
  return `<section class="welcome-heading"><span class="welcome-badge">${icon('sprout')} ESPAÇO SEU · SEM URGÊNCIA</span><h1>Olá. <span>Que bom ter você aqui.</span></h1><p>${esc(plan.message)}</p><button class="rhythm-profile" data-action="personalize">${icon('settings')} Seu ritmo: ${esc(plan.title)} · ajustar</button></section>
  ${!state.onboarded ? `<div class="notice">${icon('sprout')}<span>Um começo mais seu: responda duas perguntas rápidas.</span><button class="text-button" data-action="personalize">Personalizar ${icon('arrow')}</button></div>` : ''}
  <section class="focus-card ${essential ? 'focus-essential' : ''}" aria-labelledby="next-title"><div class="focus-main"><div class="focus-meta"><span class="focus-pill">Ação Focal Única</span><span>·</span><span>${mission ? esc(mission.course.title) : 'Seu caminho de descobertas'}</span></div><h2 id="next-title">${mission ? 'O começo pode ser pequeno.' : 'Cada passo já faz parte do seu caminho.'}</h2><p class="focus-description">${mission ? 'Você não precisa fazer tudo agora. Escolha um movimento pequeno, no seu tempo e sem compromisso de perfeição.' : 'Você pode adicionar um curso ou retomar uma trilha quando fizer sentido.'}</p>
  ${mission ? `<div class="focal-task">${icon('focus')}<div><strong>${prepareFirst ? `Preparar o material: ${esc(mission.course.title)}` : esc(mission.step.title)}</strong><small>Sem tempo mínimo · Sem pressão de entrega${mission.course.example ? ' · Curso de exemplo' : ''}</small></div><span class="free-rhythm">${icon('history')} Ritmo livre</span></div><div class="focus-actions"><button class="button primary" data-action="${prepareFirst ? 'smaller-mission' : 'start-mission'}" data-id="${esc(mission.course.id)}">${icon('play')} ${prepareFirst ? 'Preparar meu material' : 'Começar este passo'}</button><button class="button secondary" data-action="${prepareFirst ? 'start-mission' : 'smaller-mission'}" data-id="${esc(mission.course.id)}">${icon('sprout')} ${prepareFirst ? 'Fazer a etapa completa' : 'Tornar ainda menor'}</button></div>` : `<button class="button primary" data-action="navigate" data-route="biblioteca">Explorar biblioteca ${icon('arrow')}</button>`}</div>
  ${!essential ? `<aside class="rest-card"><span class="overline">CUIDADO COM SEU RITMO</span><h3>Pausa consciente</h3><p>Se hoje não der, você pode descansar. Seu progresso continua aqui para quando quiser voltar.</p><div class="rest-image"><img src="./assets/stitch/calm.png" alt=""/><div>${icon('leaf')}<span>Um respiro por vez</span><button class="button secondary" data-action="take-break">Fazer uma pausa</button></div></div><span class="rest-caption">Pausar sem culpa ${icon('pause')}</span></aside>` : ''}</section>
  ${!essential ? `<div class="home-insights"><section class="insight-card"><div class="insight-label"><span>RITMO DA SEMANA</span><span class="green-pill">No seu tempo</span></div><h2>${count} de ${goal} passos dados</h2><p>Sem cobrança: descanse se precisar, seu progresso não expira.</p><div class="week-dots">${Array.from({length: goal}, (_,i) => `<span class="${i<count ? 'done' : ''}">${i<count ? icon('check') : ''}</span>`).join('')}</div><progress max="${Math.max(goal,count)}" value="${count}" aria-label="${count} de ${goal} missões nesta semana"></progress></section>
  <section class="insight-card"><div class="insight-label"><span>TRILHA ATUAL</span><span>${progress ? progress.percent : 100}%</span></div><h2>${mission ? esc(mission.course.title) : 'Um caminho percorrido'}</h2><p>${mission ? 'Um pequeno passo de cada vez. Continue de onde parou.' : 'Explore um assunto novo quando quiser.'}</p><div class="insight-bottom"><span>Progresso contínuo ${progress ? `· ${progress.done} de ${progress.total} etapas` : ''}</span><progress max="100" value="${progress ? progress.percent : 100}" aria-label="Progresso da trilha atual"></progress><button class="text-button" data-action="${mission ? 'open-course' : 'navigate'}" ${mission ? `data-id="${esc(mission.course.id)}"` : 'data-route="biblioteca"'}>Ver detalhes da trilha ${icon('arrow')}</button></div></section>
  <section class="insight-card"><div class="insight-label">ADAPTAÇÃO DE FOCO</div><h2>Mudar de jornada</h2><p>Não está fluindo hoje? Alterne para outro interesse sem perder seu progresso.</p><div class="insight-bottom"><a class="library-shortcut" href="#biblioteca">${icon('book')} Explorar toda a biblioteca ${icon('arrow')}</a><button class="text-button" data-action="add-course">${icon('plus')} Adicionar um novo interesse</button></div></section></div><section class="comfort-note">${icon('shield')}<div><h2>Lembrete de conforto</h2><p>Você pode parar e voltar depois. Seu caminho não precisa seguir o ritmo de ninguém.</p></div><a class="button secondary" href="#configuracoes">Ajustar meu espaço</a></section>` : '<p class="essential-note">Só o próximo passo. O restante está no menu, quando você precisar.</p>'}`;
}

const statusLabels = { all: 'Todos', active: 'Em andamento', new: 'Para começar', paused: 'Em pausa', completed: 'Concluídos' };
function filteredCourses() {
  return state.courses.filter((course) => (libraryFilter === 'all' || courseStatus(state, course) === libraryFilter) && course.title.toLocaleLowerCase('pt-BR').includes(searchTerm.toLocaleLowerCase('pt-BR')));
}

function libraryResults() {
  const courses = filteredCourses();
  return courses.length ? courses.map(courseCard).join('') : `<div class="empty-state">${icon('book')}<h2>Nenhum curso por aqui. Ainda.</h2><p>Tente outro filtro ou adicione algo que você quer aprender.</p><button class="button secondary" data-action="add-course">${icon('plus')} Adicionar curso</button></div>`;
}

function libraryDetail() {
  const course = state.courses.find(item => item.id === state.selectedCourseId) || state.courses[0];
  if (!course) return '';
  const progress = courseProgress(state, course);
  const next = course.steps.find(step => !state.completed.includes(step.id));
  return `<aside class="library-detail"><div class="detail-image"><img src="./assets/stitch/${course.art === 'design' ? 'detail' : ['code','language','nature'].includes(course.art) ? course.art : 'nature'}.png" alt=""/><div><span class="green-pill">Sua trilha atual</span><h2>${esc(course.title)}</h2></div></div><button class="button primary full-width" data-action="${next && !course.paused ? 'start-mission' : 'open-course'}" data-id="${esc(course.id)}">${icon(next ? 'play' : 'check')} ${course.paused ? 'Ver curso em pausa' : next ? 'Continuar meu próximo passo' : 'Ver caminho concluído'}</button><span class="detail-rhythm">Ritmo livre · Sem pressa</span><div class="detail-section-heading">PRÓXIMOS PASSOS CLAROS</div><ol class="detail-steps">${course.steps.map((step,i) => `<li class="${state.completed.includes(step.id) ? 'detail-done' : step.id === next?.id ? 'detail-next' : ''}"><span>${state.completed.includes(step.id) ? icon('check') : i+1}</span><div>${esc(step.title)}<small>${state.completed.includes(step.id) ? 'Passo registrado' : step.id === next?.id ? 'Uma próxima ação possível' : 'Quando chegar o seu momento'}</small></div></li>`).join('')}</ol><div class="detail-progress"><span>${progress.done} de ${progress.total} etapas concluídas</span><progress max="100" value="${progress.percent}" aria-label="Progresso de ${esc(course.title)}"></progress></div><p class="detail-note">${icon('sprout')} Seu progresso é salvo neste navegador. Não há penalidades por pausas.</p></aside>`;
}
function library() {
  return `<div class="library-page-heading"><h1>Biblioteca</h1><p>Guarde seus cursos e tópicos de estudo. Continue de onde parou, no seu ritmo.</p></div><div class="library-toolbar"><label class="search-field">${icon('search')}<input id="course-search" type="search" placeholder="Buscar nas minhas trilhas…" aria-label="Buscar um curso pelo nome" value="${esc(searchTerm)}" /></label><div class="filter-list" role="group" aria-label="Filtrar cursos por situação">${Object.entries(statusLabels).map(([id,label]) => `<button class="filter-button ${libraryFilter===id ? 'selected' : ''}" aria-pressed="${libraryFilter===id}" data-action="filter" data-filter="${id}">${label} <span>(${id==='all' ? state.courses.length : state.courses.filter(c=>courseStatus(state,c)===id).length})</span></button>`).join('')}</div><button class="button primary" data-action="add-course">${icon('plus')} Adicionar curso</button></div><div class="library-layout"><section><div class="section-heading"><h2>Minha Estante <span class="shelf-count">${state.courses.length} trilhas</span></h2><span class="muted">Um interesse de cada vez</span></div><div class="course-grid library-grid" id="library-results">${libraryResults()}</div><div id="search-status" class="sr-only" role="status"></div><p class="library-help">${icon('help')} Capas ilustrativas. Os cursos de exemplo não incluem aulas.</p></section>${libraryDetail()}</div>`;
}

function missions() {
  const available = state.courses.filter((course) => !course.paused).map((course) => ({ course, step: course.steps.find((step) => !state.completed.includes(step.id)) })).filter((mission) => mission.step);
  const today = state.history.filter((entry) => localDay(entry.at) === localDay(new Date()));
  return `${pageHeading('UM PASSO POSSÍVEL DE CADA VEZ', 'Missões', 'Escolha uma. Você não precisa fazer tudo nesta lista.')}
    <div class="missions-layout"><section><div class="section-heading"><h2>Possíveis passos de hoje</h2><span class="muted">Sugestões, não pendências</span></div><div class="mission-list">${available.length ? available.map(({ course, step }) => `<article class="task-card"><div class="task-icon">${icon('flag')}</div><div><span class="overline">${esc(course.title)}</span><h3>${esc(step.title)}</h3><span class="muted">${course.example ? 'Curso de exemplo · ' : ''}Sem prazo${state.preferences.gamification ? ' · +10 XP' : ''}</span></div><button class="icon-button task-start" data-action="start-mission" data-id="${esc(course.id)}" aria-label="Começar: ${esc(step.title)}">${icon('arrow')}</button></article>`).join('') : '<div class="empty-state"><h2>Sem próximas etapas por enquanto.</h2><p>Adicione um curso ou retome um que está em pausa.</p><a href="#biblioteca" class="button secondary">Abrir biblioteca</a></div>'}</div>
    <div class="section-heading completed-heading"><h2>Passos dados hoje</h2><span class="count-pill">${today.length}</span></div>${today.length ? `<div class="mission-list">${today.map((entry) => `<article class="task-card done-task"><div class="task-icon">${icon('check')}</div><div><h3>${esc(entry.title)}</h3><span class="muted">${esc(entry.courseTitle)}</span></div>${state.preferences.gamification ? `<span class="xp-pill">+${entry.xp} XP</span>` : ''}</article>`).join('')}</div>` : '<p class="empty-copy">Ainda não houve um registro hoje. Seu primeiro passo pode ser bem pequeno.</p>'}</section>${progressCard()}</div>`;
}

function achievementPage() {
  const all = achievements(state);
  const unlocked = all.filter((item) => item.unlocked).length;
  return `${pageHeading('PEQUENAS VITÓRIAS. CONQUISTAS SUAS.', 'Sua vitrine de conquistas', 'Sem competir com ninguém. Cada descoberta tem seu próprio valor.')}
    ${state.preferences.gamification ? `<section class="achievement-summary panel"><div class="trophy-emblem">${icon('trophy')}</div><div><span class="overline">SEU PROGRESSO FICA COM VOCÊ</span><h2>${unlocked} de ${all.length} conquistas</h2><p>Sem prazo para conquistar. Sem perder o que já é seu.</p></div><span class="achievement-spark" aria-hidden="true">✳</span></section><div class="achievement-grid">${all.map((item) => `<article class="achievement-card ${item.unlocked ? 'unlocked' : ''}"><div class="achievement-icon">${icon(item.icon)}</div><span class="achievement-status">${item.unlocked ? `${icon('check')} CONQUISTADA` : `${icon('lock')} UMA POSSIBILIDADE`}</span><h2>${item.title}</h2><p>${item.text}</p><div class="achievement-progress"><span>${item.current} / ${item.target}</span><progress max="${item.target}" value="${item.current}" aria-label="Progresso da conquista ${item.title}"></progress></div></article>`).join('')}</div>` : `<div class="empty-state panel">${icon('leaf')}<h2>Um caminho sem pontuação.</h2><p>Você escolheu ocultar XP e conquistas. Seu histórico continua guardado.</p><a href="#configuracoes" class="button secondary">Ajustar minhas preferências</a></div>`}`;
}

function historyPage() {
  const days = new Set(state.history.map((entry) => localDay(entry.at))).size;
  return `${pageHeading('OLHE O CAMINHO QUE JÁ PERCORREU', 'Meu caminho', 'Seu histórico é uma memória de progresso, não uma lista de cobranças.')}
    <div class="history-stats"><div class="panel"><span>Pequenos passos</span><strong>${state.history.length}</strong></div><div class="panel"><span>Dias com descobertas</span><strong>${days}</strong></div><div class="panel"><span>Cursos concluídos</span><strong>${state.courses.filter((course) => courseStatus(state, course) === 'completed').length}</strong></div></div>
    ${state.history.length ? `<section class="history-list" aria-label="Missões concluídas">${[...state.history].reverse().map((entry) => `<article class="history-entry"><span class="history-dot">${icon(entry.preparation ? 'sprout' : 'check')}</span><div><h2>${esc(entry.title)}</h2><p>${esc(entry.courseTitle)}${entry.preparation ? ' · Preparação; a etapa original não foi concluída' : ''}</p></div><div class="history-date"><time datetime="${esc(entry.at)}">${new Date(entry.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</time>${state.preferences.gamification ? `<span>+${entry.xp} XP</span>` : ''}</div></article>`).join('')}</section>` : `<div class="empty-state panel">${icon('compass')}<h2>Sua história começa com um passo.</h2><p>Quando você concluir uma missão, ela aparece aqui. Sem pressa.</p><a href="#hoje" class="button primary">Encontrar meu próximo passo ${icon('arrow')}</a></div>`}`;
}

function toggleSetting(id, title, text) {
  return `<label class="setting-row" for="pref-${id}"><span><strong>${title}</strong><span>${text}</span></span><input id="pref-${id}" class="switch" type="checkbox" data-preference="${id}" ${state.preferences[id] ? 'checked' : ''}/></label>`;
}

function settings() {
  return `${pageHeading('O LUME É SEU. O JEITO TAMBÉM.', 'Do seu jeito', 'Escolha o que ajuda. Desative o que atrapalha.')}
    <div class="settings-layout"><section class="panel settings-panel"><h2>${icon('sun')} Aparência e conforto</h2>
      ${toggleSetting('essential', 'Modo essencial', 'Na página Hoje, mostrar só a próxima missão. Biblioteca e histórico continuam no menu.')}
      ${toggleSetting('gamification', 'Mostrar XP e conquistas', 'Desligar oculta os indicadores, sem apagar o histórico ou o progresso acumulado.')}
      ${toggleSetting('reducedMotion', 'Reduzir movimentos', 'Evitar transições na interface. A preferência de movimento reduzido do sistema também é respeitada.')}
      <label class="setting-row" for="pref-theme"><span><strong>Tema</strong><span>Um ambiente que seja confortável para você.</span></span><select id="pref-theme" data-preference="theme"><option value="dark" ${state.preferences.theme === 'dark' ? 'selected' : ''}>Escuro</option><option value="light" ${state.preferences.theme === 'light' ? 'selected' : ''}>Claro</option></select></label>
      <label class="setting-row" for="pref-textSize"><span><strong>Tamanho do texto</strong><span>Mais espaço para ler com tranquilidade.</span></span><select id="pref-textSize" data-preference="textSize"><option value="normal" ${state.preferences.textSize === 'normal' ? 'selected' : ''}>Padrão</option><option value="large" ${state.preferences.textSize === 'large' ? 'selected' : ''}>Ampliado</option></select></label>
    </section><div><section class="panel settings-panel"><h2>${icon('sprout')} Seu momento</h2><p class="settings-description">${HABITS.find((item) => item.id === state.habit)?.title || 'Você ainda não escolheu uma rotina.'} Nada aqui é uma definição sobre você.</p><button class="button secondary full-width" data-action="personalize">Revisar perguntas iniciais ${icon('arrow')}</button><label class="setting-row weekly-setting" for="pref-weeklyGoal"><span><strong>Plano semanal</strong><span>Missões sugeridas, sem obrigação.</span></span><select id="pref-weeklyGoal" data-preference="weeklyGoal">${Array.from({ length: 7 }, (_, index) => `<option value="${index + 1}" ${state.preferences.weeklyGoal === index + 1 ? 'selected' : ''}>${index + 1}</option>`).join('')}</select></label></section>
    <section class="privacy-note"><span class="privacy-icon">${icon('shield')}</span><h2>Seu espaço, por enquanto local.</h2><p>Esta é uma prévia sem cadastro ou servidor de contas. Os dados ficam neste navegador e não sincronizam entre dispositivos. Limpar os dados do site pode apagar seu progresso.</p><p>Não inclua senhas nem informações sensíveis nas suas etapas de estudo.</p><button class="text-button" data-action="export">Baixar cópia dos meus dados ${icon('arrow')}</button></section></div></div>`;
}

function motionEnabled() {
  return !state.preferences.reducedMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function render(focusMain = false) {
  const changingPage = lastRenderedRoute !== null && lastRenderedRoute !== route();
  activePageTransition?.skipTransition();
  if (changingPage && motionEnabled() && typeof document.startViewTransition === 'function') {
    activePageTransition = document.startViewTransition(() => renderContent(focusMain));
    activePageTransition.ready.catch(() => {});
  } else {
    activePageTransition = null;
    renderContent(focusMain);
    if (changingPage && motionEnabled()) document.querySelector('#main').classList.add('screen-enter');
  }
}

function renderContent(focusMain = false) {
  const focusedId = document.activeElement?.id;
  const current = route();
  lastRenderedRoute = current;
  const pages = { login: loginPage, inicio: onboarding, hoje: home, biblioteca: library, missoes: missions, conquistas: achievementPage, historico: historyPage, configuracoes: settings };
  applyPreferences();
  document.documentElement.dataset.page = current;
  app.innerHTML = ['login', 'inicio'].includes(current) ? entryShell(pages[current](), current) : shell(pages[current](), current);
  document.title = `${({ login: 'Bem-vindo', inicio: 'Seu ritmo', hoje: 'Hoje', biblioteca: 'Biblioteca', missoes: 'Missões', conquistas: 'Conquistas', historico: 'Meu caminho', configuracoes: 'Do seu jeito' })[current]} · Lume`;
  if (focusMain) {
    document.querySelector('#main').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
}

function openDialog(html) {
  if (dialog.open) dialog.close();
  dialog.innerHTML = `<button class="dialog-close icon-button" data-action="close-dialog" aria-label="Fechar janela">${icon('close')}</button>${html}`;
  dialog.showModal();
}

function showCourse(id) {
  const course = state.courses.find((item) => item.id === id);
  if (!course) return;
  const progress = courseProgress(state, course);
  const next = course.steps.find((step) => !state.completed.includes(step.id));
  openDialog(`<div class="dialog-course-cover">${cover(course)}</div><div class="dialog-content"><div class="eyebrow">${course.example ? 'CURSO DE EXEMPLO' : 'SUA TRILHA'}</div><h2 id="dialog-title">${esc(course.title)}</h2><p class="dialog-subtitle">${progress.done} de ${progress.total} etapas concluídas. Seu progresso fica com você.</p>${course.url ? `<a class="text-link external-course-link" href="${esc(course.url)}" target="_blank" rel="noopener noreferrer">Abrir conteúdo do curso ${icon('external')}</a>` : '<div class="inline-note">'+icon('help')+' Este curso não tem conteúdo vinculado. Use-o para explorar as etapas do Lume.</div>'}<ol class="course-step-list">${course.steps.map((step, index) => `<li class="${state.completed.includes(step.id) ? 'completed-step' : ''}"><span class="step-number">${state.completed.includes(step.id) ? icon('check') : String(index + 1).padStart(2, '0')}</span><span>${esc(step.title)}</span>${hasPreparation(state, step.id) && !state.completed.includes(step.id) ? '<span class="preparation-label">Material preparado</span>' : ''}</li>`).join('')}</ol><div class="dialog-actions">${next ? `<button class="button ${course.paused ? 'primary' : 'secondary'}" data-action="toggle-pause" data-id="${esc(id)}">${icon(course.paused ? 'play' : 'pause')}${course.paused ? 'Retomar curso' : 'Pausar curso'}</button>${!course.paused ? `<button class="button primary" data-action="start-mission" data-id="${esc(id)}">${progress.done ? 'Continuar' : 'Começar'} ${icon('arrow')}</button>` : ''}` : `<span class="completed-message">${icon('check')} Um caminho concluído. Essa descoberta é sua!</span>`}</div></div>`);
}

function startMission(id, preparation = false) {
  const course = state.courses.find((item) => item.id === id);
  const step = course?.steps.find((item) => !state.completed.includes(item.id));
  if (!course || !step || course.paused) return;
  if (preparation && hasPreparation(state, step.id)) {
    preparation = false;
    notify('O material dessa etapa já foi preparado. Você pode continuar quando quiser.');
  }
  session = { courseId: id, stepId: step.id, preparation };
  state.selectedCourseId = id;
  save();
  openDialog(`<div class="session-content"><div class="session-emblem">${icon(preparation ? 'sprout' : 'focus')}</div><div class="eyebrow">${preparation ? 'UM PASSO AINDA MENOR' : 'UMA COISA DE CADA VEZ'}</div><h2 id="dialog-title">${preparation ? 'Só preparar o caminho.' : esc(step.title)}</h2><p class="session-course">${esc(course.title)}</p><div class="session-instruction">${preparation ? 'Abra o material, separe o que precisa ou encontre o link da aula. Só isso já conta como uma preparação.' : 'Faça essa etapa no seu tempo. Não há cronômetro nem tempo mínimo. Quando terminar, volte aqui para registrar seu passo.'}</div>${course.url ? `<a href="${esc(course.url)}" class="button secondary" target="_blank" rel="noopener noreferrer">Abrir material ${icon('external')}</a>` : `<p class="inline-note">${icon('book')} ${course.example ? 'Este é um curso de exemplo, sem aula vinculada. Você pode simular a conclusão ou adicionar um curso seu.' : 'Use o material de estudo que você escolheu. Este curso não tem um link cadastrado.'}</p>`}${preparation ? '<p class="small-hint">Isso não marcará a aula como concluída. A etapa original continua disponível.</p>' : ''}<div class="session-actions"><button class="button primary full-width" data-action="complete-mission">${icon('check')} ${preparation ? 'Preparei meu material' : 'Concluí esse passo'}${state.preferences.gamification ? ` <span class="button-xp">+${preparation ? 5 : 10} XP</span>` : ''}</button>${!preparation && !hasPreparation(state, step.id) ? `<button class="text-button" data-action="smaller-mission" data-id="${esc(id)}">Tornar essa missão menor ${icon('sprout')}</button>` : ''}<button class="text-button muted" data-action="close-dialog">Voltar depois, sem perder nada</button></div></div>`);
}

function finishMission() {
  if (!session) return;
  const previousAwards = achievements(state).filter((item) => item.unlocked).map((item) => item.id);
  const result = completeMission(state, session.courseId, session.stepId, { preparation: session.preparation });
  if (!result.added) return;
  const wasPreparation = session.preparation;
  const originalCourseId = session.courseId;
  state = result.state;
  session = null;
  save();
  render();
  const newAward = achievements(state).find((item) => item.unlocked && !previousAwards.includes(item.id));
  openDialog(`<div class="success-content"><div class="success-emblem">${icon(wasPreparation ? 'sprout' : 'spark')}</div><div class="eyebrow">UM PASSO QUE É SEU</div><h2 id="dialog-title">${wasPreparation ? 'O caminho está preparado.' : 'Olha só: você avançou.'}</h2><p>${wasPreparation ? 'Abrir espaço para começar também conta. A etapa original continua disponível, sem pressa.' : 'Não importa o tamanho do passo.<br>O que você fez já faz parte do seu caminho.'}</p>${state.preferences.gamification ? `<span class="success-xp">+${result.xp} XP</span>${newAward ? `<div class="new-achievement">${icon(newAward.icon)}<div><span>NOVA CONQUISTA</span><strong>${newAward.title}</strong></div></div>` : ''}` : ''}<button class="button primary full-width" data-action="finish-session">Voltar ao meu espaço ${icon('arrow')}</button>${wasPreparation ? `<button class="text-button" data-action="start-mission" data-id="${esc(originalCourseId)}">Quero continuar a etapa</button>` : ''}<p class="quiet-note">Você pode parar por aqui. Seu progresso fica.</p></div>`);
}

function newCourseDialog() {
  openDialog(`<div class="dialog-content"><div class="eyebrow">MAIS UMA POSSIBILIDADE</div><h2 id="dialog-title">O que você quer aprender?</h2><p class="dialog-subtitle">Pode ser um curso, um livro ou um assunto. Comece pequeno.</p><form id="new-course-form"><label class="form-label" for="course-title">Nome do curso ou assunto <span aria-hidden="true">*</span></label><input id="course-title" name="title" required maxlength="100" placeholder="Ex.: Aprender a desenhar" autocomplete="off"/><label class="form-label" for="course-url">Link do material <span class="muted">(opcional)</span></label><input id="course-url" name="url" type="url" placeholder="https://…" maxlength="2000"/><label class="form-label" for="course-steps">Próximas etapas <span aria-hidden="true">*</span></label><textarea id="course-steps" name="steps" rows="4" required placeholder="Abrir o material&#10;Assistir à primeira aula&#10;Praticar uma coisa que aprendi" aria-describedby="steps-help"></textarea><p id="steps-help" class="form-help">Uma etapa por linha. Até 40 etapas, com 180 caracteres cada. Você só precisa de uma para começar.</p><label class="form-label" for="course-art">Estilo da capa</label><select id="course-art" name="art"><option value="nature">Novos caminhos · verde</option><option value="design">Criatividade · areia</option><option value="code">Tecnologia · azul</option><option value="language">Descobertas · lilás</option></select><p id="course-form-error" class="form-error" role="alert"></p><button type="submit" class="button primary full-width">Adicionar à minha biblioteca ${icon('plus')}</button></form></div>`);
}

function finishOnboarding(skip = false) {
  if (!skip) state = applyStudyRhythm(state, onboardingDraft);
  else state = { ...state, onboarded: true };
  save();
  go('hoje');
  notify(skip ? 'Seu espaço está pronto. Você pode personalizar quando quiser.' : 'Seu ritmo foi salvo. Seu plano e suas sugestões estão prontos.');
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  switch (action) {
    case 'take-break': openDialog(`<div class="session-content"><div class="session-emblem">${icon('leaf')}</div><h2 id="dialog-title">Pode pausar.</h2><p class="session-instruction">Descanse pelo tempo que precisar. Nenhuma etapa foi concluída e seu progresso continua guardado.</p><button class="button primary full-width" data-action="close-dialog">Voltar quando quiser</button></div>`); break;
    case 'enter-preview':
      previewEntered = true;
      try { sessionStorage.setItem(PREVIEW_SESSION_KEY, 'open'); } catch { /* Navegação disponível em memória. */ }
      onboardingDraft = { habit: state.habit, supports: [...state.supports] };
      go('inicio'); break;
    case 'exit-preview':
      previewEntered = false;
      try { sessionStorage.removeItem(PREVIEW_SESSION_KEY); } catch { /* Progresso local preservado. */ }
      go('login'); break;
    case 'toggle-theme':
      openDialog(`<div class="dialog-content"><h2 id="dialog-title">Conforto visual</h2>${toggleSetting('reducedMotion', 'Reduzir movimentos', 'Desativar animações e transições. A preferência do sistema também é respeitada.')}<label class="setting-row" for="entry-theme"><span><strong>Tema</strong><span>Escolha um ambiente confortável.</span></span><select id="entry-theme" data-preference="theme"><option value="dark" ${state.preferences.theme === 'dark' ? 'selected' : ''}>Escuro</option><option value="light" ${state.preferences.theme === 'light' ? 'selected' : ''}>Claro</option></select></label><button class="button primary full-width" data-action="close-dialog">Pronto</button></div>`); break;
    case 'account-info': openDialog(`<div class="dialog-content"><h2 id="dialog-title">Contas em preparação</h2><p class="session-instruction">Cadastro, Google e recuperação de senha ainda não estão disponíveis. Você pode explorar o Lume sem fornecer e-mail ou senha; os dados ficam neste navegador.</p><button class="button primary full-width" data-action="close-dialog">Entendi</button></div>`); break;
    case 'entry-help': openDialog(`<div class="dialog-content"><h2 id="dialog-title">Um começo simples</h2><p class="session-instruction">Entre na prévia, escolha seu ritmo e selecione os apoios que ajudam. Depois, comece uma missão ou adicione seu próprio curso. Você pode revisar tudo nas configurações.</p><button class="button primary full-width" data-action="close-dialog">Entendi</button></div>`); break;
    case 'navigate': go(button.dataset.route); break;
    case 'skip-onboarding': finishOnboarding(true); break;
    case 'finish-onboarding': if (onboardingDraft.habit) finishOnboarding(); break;
    case 'personalize': onboardingDraft = { habit: state.habit, supports: [...state.supports] }; go('inicio'); break;
    case 'add-course': newCourseDialog(); break;
    case 'open-course': showCourse(id); break;
    case 'start-mission': startMission(id); break;
    case 'smaller-mission': startMission(id, true); break;
    case 'complete-mission': finishMission(); break;
    case 'close-dialog': session = null; dialog.close(); break;
    case 'finish-session': dialog.close(); go('hoje'); break;
    case 'filter': libraryFilter = button.dataset.filter; render(); break;
    case 'toggle-pause': {
      state.courses = state.courses.map((course) => course.id === id ? { ...course, paused: !course.paused } : course);
      save(); render(); showCourse(id); break;
    }
    case 'export': {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lume-meu-caminho-${localDay(new Date())}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Cópia exportada. A importação ainda não faz parte deste protótipo.');
      break;
    }
  }
});

document.addEventListener('change', (event) => {
  const input = event.target;
  if (input.name === 'habit') {
    onboardingDraft.habit = input.value;
    document.querySelector('#onboarding-next').disabled = false;
    document.querySelector('#rhythm-summary').textContent = rhythmSummary();
  }
  if (input.name === 'support') {
    onboardingDraft.supports = [...document.querySelectorAll('[name="support"]:checked')].map(item => item.value);
    document.querySelector('#rhythm-summary').textContent = rhythmSummary();
  }
  if (input.dataset.preference) {
    state.preferences[input.dataset.preference] = input.type === 'checkbox' ? input.checked : input.dataset.preference === 'weeklyGoal' ? Number(input.value) : input.value;
    save(); render();
    notify('Preferência salva. Seu espaço, do seu jeito.');
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'course-search') return;
  searchTerm = event.target.value;
  document.querySelector('#library-results').innerHTML = libraryResults();
  document.querySelector('#search-status').textContent = `${filteredCourses().length} cursos encontrados.`;
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'new-course-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  try {
    state = addCourse(state, { title: data.get('title'), url: data.get('url'), steps: data.get('steps').split('\n'), art: data.get('art') });
    save(); dialog.close(); go('biblioteca'); render();
    notify('Uma nova possibilidade na sua biblioteca. Comece quando fizer sentido.');
  } catch (error) {
    document.querySelector('#course-form-error').textContent = error.message;
  }
});

dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    session = null;
    dialog.close();
  }
});
dialog.addEventListener('cancel', () => { session = null; });
window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); session = null; render(true); });
render();
if (!storageAvailable) notify('O armazenamento está indisponível. Os dados desta prévia são temporários nesta aba.');
