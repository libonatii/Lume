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
// Conta real: a sessão vive em um cookie HttpOnly emitido por server.js.
let account = null;
let accountState = 'checking'; // checking | ready | offline
let authMode = 'login';
let authError = '';
let authBusy = false;
let recoverResult = null;
let recoverError = '';
let resetDone = false;
let resetError = '';
let completedResetToken = '';
let onboardingDraft = { habit: state.habit, supports: [...state.supports] };
let libraryFilter = 'all';
let searchTerm = '';
let session = null;
let toastTimer;
let lastRenderedRoute = null;
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const entranceAnimations = new Set();
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
  mail: '<path d="M3 6h18v12H3Z"/><path d="m3 7 9 6 9-6"/>',
  heart: '<path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.5-7 9-7 9Z"/>',
  external: '<path d="M14 3h7v7m0-7L10 14m0-11H4v17h17v-6"/>',
  steps: '<path d="M3 20h6v-6h6V8h6V3"/>',
  mountain: '<path d="m2 20 7-12 5 7 3-5 5 10Zm4-7 3 1 2-2"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || icons.spark}</svg>`;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let stateSaveTimer = null;
let stateSyncAttempted = false;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storageAvailable = false;
    notify('Não foi possível salvar neste navegador. Seu progresso fica disponível apenas enquanto esta página estiver aberta.');
  }
  if (account) queueRemoteSave();
}

// Envia o progresso para a conta sem travar a interface: agrupa alterações
// próximas em um único envio.
function queueRemoteSave() {
  if (!account) return;
  clearTimeout(stateSaveTimer);
  stateSaveTimer = setTimeout(() => {
    api('/api/state', { method: 'PUT', body: state })
      .then((result) => {
        if (!result.ok) notify('O progresso não foi enviado para sua conta. Vamos tentar de novo na próxima alteração.');
      })
      .catch(() => notify('Sem conexão com a conta. O progresso continua guardado neste navegador.'));
  }, 900);
}

// Ao entrar, o progresso da conta tem prioridade; se a conta ainda não tem
// progresso, o que existe neste navegador é enviado como semente.
async function loadRemoteState() {
  if (!account || stateSyncAttempted) return;
  stateSyncAttempted = true;
  try {
    const { ok, data } = await api('/api/state');
    if (!ok || !data) return;
    if (data.state) {
      state = restoreState(JSON.stringify(data.state));
      onboardingDraft = { habit: state.habit, supports: [...state.supports] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      notify('Seu progresso foi carregado da sua conta.');
    } else if (state.courses.length || state.history.length) {
      queueRemoteSave();
      notify('O progresso deste navegador foi enviado para sua conta.');
    }
  } catch {
    /* Sem servidor: segue com o progresso local. */
  }
}

function notify(message) {
  const toast = document.querySelector('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 6500);
}

// ---------- Conta e sessão ----------

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { ok: response.ok, status: response.status, data };
}

async function loadAccount() {
  try {
    const { data } = await api('/api/me');
    if (!data || typeof data.authenticated !== 'boolean') {
      // Resposta sem JSON significa servidor estático (Live Server), não o server.js.
      account = null;
      accountState = 'offline';
      return null;
    }
    account = data.authenticated && data.user ? data.user : null;
    accountState = 'ready';
    if (account) await loadRemoteState();
  } catch {
    account = null;
    accountState = 'offline';
  }
  return account;
}

const SERVER_HINT = 'O servidor de contas não foi encontrado nesta página. Abra o Lume com node server.js e acesse http://localhost:4173 — o Live Server sozinho não cadastra contas.';

function apiMessage(result) {
  if (result.data?.error) return result.data.error;
  if (result.status === 404 || result.status === 405 || result.data === null) return SERVER_HINT;
  return 'Não foi possível concluir agora. Tente de novo.';
}

async function submitAuth(form) {
  authError = '';
  authBusy = true;
  render(true);
  const data = new FormData(form);
  const body = { email: data.get('email'), password: data.get('password') };
  if (authMode === 'register') body.name = data.get('name');

  try {
    const result = await api(authMode === 'register' ? '/api/register' : '/api/login', { method: 'POST', body });
    if (!result.ok) {
      authError = apiMessage(result);
      accountState = authError === SERVER_HINT ? 'offline' : accountState;
      authBusy = false;
      render(true);
      document.getElementById('auth-error')?.focus();
      return;
    }
    account = result.data.user;
    accountState = 'ready';
    authBusy = false;
    authMode = 'login';
    stateSyncAttempted = false;
    await loadRemoteState();
    onboardingDraft = { habit: state.habit, supports: [...state.supports] };
    go(account && state.onboarded ? 'hoje' : 'inicio');
    notify(`Que bom ter você aqui, ${account.name.split(' ')[0]}.`);  } catch {
    authBusy = false;
    accountState = 'offline';
    authError = SERVER_HINT;
    render(true);
  }
}

async function submitRecover(form) {
  recoverError = '';
  recoverResult = null;
  render(true);
  const data = new FormData(form);
  try {
    const result = await api('/api/password/request', { method: 'POST', body: { email: data.get('email') } });
    if (!result.ok) {
      recoverError = apiMessage(result);
      render(true);
      document.getElementById('recover-error')?.focus();
      return;
    }
    recoverResult = result.data;
    render(true);
  } catch {
    accountState = 'offline';
    recoverError = 'O servidor de contas não respondeu. Inicie o Lume com node server.js.';
    render(true);
  }
}

async function submitReset(form) {
  resetError = '';
  const data = new FormData(form);
  const password = data.get('password');
  if (password !== data.get('confirm')) {
    resetError = 'As duas senhas precisam ser iguais.';
    render(true);
    document.getElementById('reset-error')?.focus();
    return;
  }
  try {
    const result = await api('/api/password/reset', { method: 'POST', body: { token: resetToken(), password } });
    if (!result.ok) {
      resetError = apiMessage(result);
      render(true);
      document.getElementById('reset-error')?.focus();
      return;
    }
    resetDone = true;
    completedResetToken = resetToken();
    resetError = '';
    history.replaceState(null, '', '#redefinir');
    render(true);
    notify('Acesso validado. Entre com a nova senha.');
  } catch {
    resetError = 'O servidor de contas não respondeu. Inicie o Lume com node server.js.';
    render(true);
  }
}

function cover(course) {
  const art = ['design', 'code', 'language', 'nature'].includes(course.art) ? course.art : 'nature';
  return `<div class="course-cover art-${art}" aria-hidden="true"><img src="./assets/stitch/${art}.png" alt="" loading="lazy" /></div>`;
}

function route() {
  const requested = location.hash.slice(1).split('?')[0];
  if (requested === 'recuperar' || requested === 'redefinir') return requested;
  if (!account && !previewEntered) return 'login';
  const valid = ['hoje', 'biblioteca', 'missoes', 'conquistas', 'historico', 'configuracoes', 'inicio'];
  if (requested === 'login') return 'login';
  if (!state.onboarded) return 'inicio';
  return valid.includes(requested) ? requested : 'hoje';
}

function resetToken() {
  const raw = location.hash.slice(1);
  const index = raw.indexOf('?');
  if (index < 0) return '';
  return new URLSearchParams(raw.slice(index + 1)).get('token') || '';
}

function go(destination) {
  if (route() === destination && location.hash === `#${destination}`) render(true);
  else location.hash = destination;
}

function applyPreferences() {
  document.documentElement.dataset.theme = state.preferences.theme;
  document.documentElement.dataset.text = state.preferences.textSize;
  document.documentElement.dataset.essential = String(state.preferences.essential);
  document.querySelector('meta[name="theme-color"]').content = state.preferences.theme === 'light' ? '#f4f5ef' : '#0c1322';
}

function shell(content, currentRoute) {
  const links = [['hoje', 'home', 'Hoje'], ['biblioteca', 'book', 'Biblioteca'], ['missoes', 'flag', 'Missões'], ['conquistas', 'trophy', 'Conquistas'], ['historico', 'history', 'Meu Caminho'], ['configuracoes', 'settings', 'Configurações & Conforto']];
  const level = levelInfo(state);
  return `<aside class="sidebar" aria-label="Menu principal">
    <a href="#hoje" class="brand" aria-label="Lume — página inicial"><img class="lume-logo" src="./assets/stitch/logo.png" alt="" /><span class="brand-copy">Lume<small>Ritmo Serena</small></span></a>
    <nav aria-label="Navegação">${links.map(([path, symbol, label]) => `<a href="#${path}" aria-label="${label}" class="nav-link ${(currentRoute === path || (path === 'hoje' && currentRoute === 'inicio')) ? 'active' : ''}" ${currentRoute === path ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span></a>`).join('')}</nav>
    <div class="sidebar-bottom"><label class="essential-toggle" for="sidebar-essential"><span>Modo Essencial</span><input id="sidebar-essential" class="switch" type="checkbox" data-preference="essential" ${state.preferences.essential ? 'checked' : ''}/><small>Foco calmo e sem distrações visuais</small></label><p class="sidebar-mantra">Não é uma corrida.<br>É o seu caminho.</p></div>
  </aside><div class="workspace"><header class="topbar"><span class="calm-badge"><span class="live-dot"></span> Foco Calmo · Sem Pressa</span><div class="topbar-right">${state.preferences.gamification ? `<div class="header-level">${icon('sprout')}<div><span>Nível ${level.level} <span class="muted">·</span> <strong>${level.current} / ${level.next} XP</strong></span><progress max="100" value="${level.current}" aria-label="Experiência até o próximo nível"></progress></div></div>` : '<span class="local-badge">Seu ritmo, sem pontuação</span>'}<button class="top-avatar icon-button" data-action="navigate" data-route="configuracoes" aria-label="Abrir minhas preferências">${icon('settings')}</button>${account ? `<span class="account-chip" title="${esc(account.email)}">${esc(account.name)}</span><button class="exit-preview" data-action="logout">Sair</button>` : '<button class="exit-preview" data-action="exit-preview">Sair da prévia</button>'}</div></header>
  <main id="main" tabindex="-1">${content}</main><footer class="page-footer"><span>Feito para o seu ritmo, não o contrário.</span><span>Protótipo · ${storageAvailable ? 'dados só neste navegador' : 'dados temporários nesta aba'}</span></footer></div>`;
}


function entryShell(content, currentRoute) {
  return `<div class="entry-workspace"><header class="entry-header"><a class="entry-brand" href="#login" aria-label="Lume — início">Lume<span class="live-dot"></span></a><nav aria-label="Entrada no Lume"><button class="comfort-button" data-action="toggle-theme">${icon('sun')} Conforto visual</button>${currentRoute === 'login' ? '<button class="text-button" data-action="auth-mode" data-mode="register">Criar conta</button>' : '<button class="text-button" data-action="exit-preview">Voltar à entrada</button>'}<button class="text-button" data-action="entry-help">Ajuda</button></nav></header><main id="main" tabindex="-1" class="entry-main">${content}</main><footer class="entry-footer"><span><span class="live-dot"></span> Aprender no seu ritmo, com espaço para recomeçar.</span><span>Cadastro e acesso com e-mail e senha</span></footer></div>`;
}

function loginPage() {
  const registering = authMode === 'register';
  const offline = accountState === 'offline';
  const fields = [
    registering ? `<label class="block font-label-md text-label-md text-on-surface-variant mb-1.5" for="auth-name">Seu nome</label>
      <div class="relative flex items-center rounded-lg bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary shadow-inner"><span class="material-symbols-outlined text-outline text-[18px] ml-3 pointer-events-none">${icon('sprout')}</span>
      <input class="w-full bg-transparent px-3 py-3 text-on-surface font-body-md text-body-md placeholder:text-outline-variant focus:outline-none" id="auth-name" name="name" type="text" autocomplete="name" maxlength="60" placeholder="Como você quer ser chamada" ${offline ? 'disabled' : ''}/></div>` : '',
    `<label class="block font-label-md text-label-md text-on-surface-variant mb-1.5" for="auth-email">E-mail</label>
    <div class="relative flex items-center rounded-lg bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary shadow-inner"><span class="material-symbols-outlined text-outline text-[18px] ml-3 pointer-events-none">${icon('mail')}</span>
    <input class="w-full bg-transparent px-3 py-3 text-on-surface font-body-md text-body-md placeholder:text-outline-variant focus:outline-none" id="auth-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="nome@exemplo.com" ${offline ? 'disabled' : ''}/></div>`,
    `<div class="flex items-center justify-between mb-1.5"><label class="font-label-md text-label-md text-on-surface-variant" for="auth-password">Senha</label>${registering ? '' : '<a class="font-label-sm text-label-sm text-primary hover:text-primary-fixed transition-colors" href="#recuperar">Esqueci minha senha</a>'}</div>
    <div class="relative flex items-center rounded-lg bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary shadow-inner"><span class="material-symbols-outlined text-outline text-[18px] ml-3 pointer-events-none">${icon('lock')}</span>
    <input class="w-full bg-transparent px-3 py-3 text-on-surface font-body-md text-body-md placeholder:text-outline-variant focus:outline-none" id="auth-password" name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" placeholder="${registering ? 'Pelo menos 8 caracteres' : 'Sua senha'}" ${offline ? 'disabled' : ''}/></div>`,
  ].join('');
  return `<div data-stitch class="relative w-full flex flex-col items-center">
    <div class="absolute -top-12 -left-16 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-10 -right-12 w-80 h-80 bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
      <section class="lg:col-span-5 flex flex-col justify-between p-8 rounded-xl bg-surface-container-low shadow-xl relative overflow-hidden" aria-labelledby="welcome-title">
        <div class="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-secondary/5 pointer-events-none"></div>
        <div class="relative z-10 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(69,223,164,0.7)]"></span><span class="font-label-sm text-label-sm uppercase tracking-wider text-secondary">APRENDIZADO COM PROPÓSITO</span></div>
        <div class="relative z-10 my-8">
          <h1 id="welcome-title" class="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-snug mb-3">Descubra o prazer de aprender e ir cada vez mais longe.</h1>
          <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">Aprender não precisa ser uma obrigação pesada. O Lume existe para despertar sua curiosidade, transformar esforço em satisfação e impulsionar suas conquistas.</p>
          <div class="mt-6 p-4 rounded-lg bg-surface-container flex items-start gap-3 shadow-sm"><span class="material-symbols-outlined text-secondary text-[22px] mt-0.5">${icon('leaf')}</span><div><p class="font-label-md text-label-md text-on-surface font-semibold">Entusiasmo &amp; Conquistas Reais</p><p class="font-body-sm text-body-sm text-on-surface-variant">Cada avanço gera orgulho próprio. Celebre cada vitória na sua jornada.</p></div></div>
        </div>
        <div class="relative z-10 w-full overflow-hidden rounded-lg aspect-[16/10] shadow-md"><img class="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out" src="./assets/stitch/welcome.png" alt="Jardim tranquilo com pedras e vegetação suave"/><div class="absolute inset-0 bg-gradient-to-t from-surface-container-low/90 via-surface-container-low/20 to-transparent"></div><div class="absolute bottom-3 left-4 right-4 flex items-center justify-between"><span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px] text-secondary">${icon('check')}</span> Foco claro e calmo</span><span class="font-label-sm text-label-sm text-outline">Lume · prévia</span></div></div>
        <div class="relative z-10 pt-4 flex items-center gap-2"><span class="material-symbols-outlined text-outline text-[16px]">${icon('heart')}</span><p class="font-body-sm text-body-sm text-outline">Feito com cuidado por e para mentes curiosas e neurodivergentes.</p></div>
      </section>
      <section class="lg:col-span-7 flex flex-col justify-center p-8 sm:p-10 rounded-xl bg-surface-container shadow-xl relative" aria-labelledby="login-title">
        <div class="flex items-center justify-between gap-3 mb-4"><span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/20 text-secondary font-label-sm text-label-sm"><span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> ${registering ? 'UM NOVO COMEÇO' : 'ENERGIA FOCADA'}</span><span class="font-label-sm text-label-sm text-outline">${accountState === 'checking' ? 'Verificando sessão…' : offline ? 'Servidor indisponível' : 'Sessão segura'}</span></div>
        <div class="mb-6"><h2 id="login-title" class="font-headline-lg text-headline-lg text-on-surface tracking-tight">${registering ? 'Vamos criar seu espaço.' : 'Bem-vindo de volta ao Lume.'}</h2><p class="font-body-md text-body-md text-on-surface-variant mt-1">${registering ? 'Seu nome, um e-mail e uma senha. O progresso de estudo continua seu.' : 'Entre para desbloquear seu potencial e aprender com verdadeiro prazer.'}</p></div>
        ${providerButtons()}
        <div class="relative flex items-center my-6"><div class="flex-grow h-px bg-surface-container-highest"></div><span class="flex-shrink mx-4 font-label-md text-label-md text-outline">ou acesse com seu e-mail</span><div class="flex-grow h-px bg-surface-container-highest"></div></div>
        <div class="auth-tabs" role="tablist" aria-label="Entrar ou criar conta"><button type="button" role="tab" id="tab-login" aria-selected="${!registering}" aria-controls="auth-form" data-action="auth-mode" data-mode="login">Entrar</button><button type="button" role="tab" id="tab-register" aria-selected="${registering}" aria-controls="auth-form" data-action="auth-mode" data-mode="register">Criar conta</button></div>
        <form id="auth-form" class="auth-form space-y-4" method="post" novalidate>${fields}<p id="auth-error" class="auth-error" role="alert" ${authError ? '' : 'hidden'}>${esc(authError)}</p><button class="w-full mt-2 py-3 px-6 rounded-lg bg-primary-container hover:bg-inverse-primary text-on-primary font-headline-sm text-headline-sm tracking-tight flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary" type="submit" ${offline || authBusy ? 'disabled' : ''}><span>${authBusy ? 'Um instante…' : registering ? 'Criar minha conta' : 'Entrar e ir além'}</span>${icon('arrow')}</button></form>
        ${offline ? `<div class="preview-explanation" role="status">${icon('shield')}<p>O servidor de contas não respondeu. Inicie o Lume com <strong>node server.js</strong> para entrar com e-mail e senha. A prévia abaixo continua disponível.</p></div>` : ''}
        <div class="mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4"><p class="font-body-sm text-body-sm text-on-surface-variant">Prefere olhar primeiro? <button class="font-label-md text-label-md text-secondary hover:text-secondary-fixed transition-colors ml-1 font-semibold" data-action="enter-preview">Explorar a prévia</button></p><div class="flex items-center gap-2 text-outline font-label-sm text-label-sm"><span class="material-symbols-outlined text-[16px] text-tertiary">${icon('focus')}</span><span>Sessão protegida · 7 dias</span></div></div>
      </section>
    </div>
    <div class="w-full mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="p-4 rounded-lg bg-surface-container-low flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-secondary"><span class="material-symbols-outlined text-[18px]">${icon('steps')}</span></div><div><h4 class="font-label-md text-label-md text-on-surface">Pequenos passos</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Uma próxima ação possível, sem exaustão.</p></div></div>
      <div class="p-4 rounded-lg bg-surface-container-low flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[18px]">${icon('leaf')}</span></div><div><h4 class="font-label-md text-label-md text-on-surface">Sem pressa</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Pausas preservam seu progresso.</p></div></div>
      <div class="p-4 rounded-lg bg-surface-container-low flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-tertiary"><span class="material-symbols-outlined text-[18px]">${icon('shield')}</span></div><div><h4 class="font-label-md text-label-md text-on-surface">Conta com senha</h4><p class="font-body-sm text-body-sm text-on-surface-variant">Sessão protegida no servidor.</p></div></div>
    </div>
  </div>`;
}

// Botões de provedor preservados do export do Stitch (designs/stitch/inicio-login).
// Sem OAuth implementado: ficam visíveis e desativados, sem prometer o que não existe.
function providerButtons() {
  return `<div class="provider-buttons"><button class="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-lg text-label-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="button" id="btn-google-auth" disabled aria-describedby="provider-note"><svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/></svg><span>Continuar com Google</span><span class="coming-soon">Em breve</span></button><button class="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-lg text-label-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" type="button" id="btn-github-auth" disabled aria-describedby="provider-note"><svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 .5C5.73.5.6 5.63.6 11.9c0 5.02 3.26 9.28 7.78 10.78.57.1.78-.25.78-.55v-1.9c-3.16.69-3.83-1.52-3.83-1.52-.52-1.32-1.27-1.67-1.27-1.67-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.02 1.74 2.67 1.24 3.32.95.1-.74.4-1.24.72-1.53-2.52-.29-5.17-1.26-5.17-5.62 0-1.24.44-2.26 1.17-3.05-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.17a10.9 10.9 0 0 1 5.72 0c2.18-1.48 3.14-1.17 3.14-1.17.62 1.57.23 2.73.12 3.02.73.79 1.17 1.81 1.17 3.05 0 4.37-2.66 5.33-5.19 5.61.41.36.77 1.06.77 2.14v3.17c0 .3.2.66.79.55 4.51-1.51 7.77-5.76 7.77-10.78C23.4 5.63 18.27.5 12 .5z" fill="currentColor"/></svg><span>Continuar com GitHub</span><span class="coming-soon">Em breve</span></button></div><p id="provider-note" class="sr-only">Entrar com Google ou GitHub ainda não está disponível. Use seu e-mail e senha.</p>`;
}

function recoverPage() {

  const body = recoverResult
    ? `<div class="recover-status" role="status">${icon('check')}<div><h2>Confira seu acesso.</h2><p>${esc(recoverResult.message)}</p></div></div>${recoverResult.resetUrl ? `<p class="login-footnote">O envio por e-mail ainda não está ligado. Use o link gerado agora:</p><p class="recover-link"><a href="${esc(recoverResult.resetUrl.replace(/^https?:\/\/[^/]+/, ''))}">Abrir a tela de nova senha</a></p>` : ''}<button class="button primary full-width" data-action="recover-again">Gerar outro link</button>`
    : `<form id="recover-form" class="auth-form" method="post" novalidate><label for="recover-email">E-mail da conta</label><input id="recover-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="nome@exemplo.com" required/><p id="recover-error" class="auth-error" role="alert" ${recoverError ? '' : 'hidden'}>${esc(recoverError)}</p><button class="button primary full-width" type="submit">Gerar link de recuperação ${icon('arrow')}</button></form><p class="login-footnote">O link vale por 30 minutos e só pode ser usado uma vez. Trocar a senha encerra as sessões abertas.</p>`;
  return `<div class="login-layout"><section class="login-story" aria-labelledby="recover-title"><span class="welcome-badge">${icon('shield')} ACESSO AO SEU ESPAÇO</span><h1 id="recover-title">Voltar é parte <br>do <em>caminho.</em></h1><p>Esquecer uma senha não apaga seu progresso. Vamos encontrar um novo acesso, com calma.</p><div class="login-story-note">${icon('leaf')}<div><strong>Sem pressa.</strong><p>Você pode pedir outro link quantas vezes precisar.</p></div></div><p class="story-ending">Seu histórico de estudo continua guardado.</p></section><section class="login-panel" aria-labelledby="recover-heading"><div class="login-eyebrow"><span class="green-pill">RECUPERAR ACESSO</span><span>30 minutos</span></div><h2 id="recover-heading">${recoverResult ? 'Tudo encaminhado.' : 'Vamos reabrir seu acesso.'}</h2><p class="login-subtitle">${recoverResult ? 'Se o e-mail existir no Lume, o link de nova senha já foi gerado.' : 'Informe o e-mail que você usou na conta. Enviaremos as instruções para criar uma nova senha.'}</p>${body}<div class="login-divider"><span>ou</span></div><a class="button secondary full-width" href="#login">Voltar para entrar</a></section></div>`;
}

function resetPage() {
  const token = resetToken();
  let body;
  if (resetDone) {
    body = `<div class="recover-status" role="status">${icon('check')}<div><h2>Acesso validado.</h2><p>Sua senha foi alterada e as sessões antigas foram encerradas. Entre com a nova senha.</p></div></div><a class="button primary full-width" href="#login">Entrar no Lume ${icon('arrow')}</a>`;
  } else if (!token) {
    body = `<p class="auth-error" role="alert">Este link está incompleto. Peça uma nova recuperação para receber outro.</p><a class="button primary full-width" href="#recuperar">Pedir novo link ${icon('arrow')}</a>`;
  } else {
    body = `<form id="reset-form" class="auth-form" method="post" novalidate><label for="reset-password">Nova senha</label><input id="reset-password" name="password" type="password" autocomplete="new-password" minlength="8" placeholder="Pelo menos 8 caracteres" required/><label for="reset-confirm">Repita a nova senha</label><input id="reset-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" placeholder="A mesma senha" required/><p id="reset-error" class="auth-error" role="alert" ${resetError ? '' : 'hidden'}>${esc(resetError)}</p><button class="button primary full-width" type="submit">Salvar nova senha ${icon('arrow')}</button></form><p class="login-footnote">Ao salvar, todas as sessões abertas nesta conta são encerradas.</p>`;
  }
  return `<div class="login-layout"><section class="login-story" aria-labelledby="reset-title"><span class="welcome-badge">${icon('sprout')} UM NOVO COMEÇO</span><h1 id="reset-title">Sua conta, <br>de <em>volta.</em></h1><p>Uma senha nova, o mesmo caminho de estudos esperando por você.</p><div class="login-story-note">${icon('leaf')}<div><strong>Depois de salvar.</strong><p>Use a nova senha para entrar. O progresso continua no lugar.</p></div></div><p class="story-ending">Nada do que você estudou foi perdido.</p></section><section class="login-panel" aria-labelledby="reset-heading"><div class="login-eyebrow"><span class="green-pill">${resetDone ? 'ACESSO VALIDADO' : 'NOVA SENHA'}</span><span>${resetDone ? 'Concluído' : 'Link de 30 minutos'}</span></div><h2 id="reset-heading">${resetDone ? 'Acesso validado.' : 'Escolha uma nova senha.'}</h2><p class="login-subtitle">${resetDone ? 'O acesso foi confirmado com segurança.' : 'Use pelo menos 8 caracteres. Uma frase que você lembre funciona bem.'}</p>${body}<div class="login-divider"><span>ou</span></div><a class="button secondary full-width" href="#login">Voltar para entrar</a></section></div>`;
}

function onboarding() {
  const rhythmCards = STUDY_RHYTHMS.map((item, index) => `<label class="pace-card group relative flex flex-col justify-between p-6 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors duration-200 cursor-pointer shadow-sm">
    <input class="peer sr-only" id="rhythm-${item.id}" type="radio" name="habit" value="${item.id}" ${onboardingDraft.habit === item.id ? 'checked' : ''}/>
    <div class="flex flex-col gap-4">
      <div class="flex items-start justify-between">
        <div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center card-accent text-2xl">${icon(item.icon)}</div>
        <span class="card-indicator w-6 h-6 rounded-full bg-surface-container-highest">${icon('check')}</span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant/80">${esc(item.label)}</span>
        <h2 class="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary">${esc(item.title)}</h2>
        <p class="text-on-surface-variant/80 font-body-sm text-body-sm">${esc(item.subtitle)}</p>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant">${esc(item.text)}</p>
    </div>
    <div class="flex items-center gap-2 pt-2 mt-6 border-t border-surface-variant/40 text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-lg">${icon('calendar')}</span><span>${esc(item.detail)}</span></div>
  </label>`).join('');

  const supportCards = STUDY_SUPPORTS.map((item) => `<label class="pace-card group relative flex items-start gap-3 p-6 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors duration-200 cursor-pointer shadow-sm">
    <input class="peer sr-only" id="support-${item.id}" type="checkbox" name="support" value="${item.id}" ${onboardingDraft.supports.includes(item.id) ? 'checked' : ''}/>
    <span class="card-indicator w-6 h-6 rounded-sm bg-surface-container-highest flex-shrink-0 mt-0.5">${icon('check')}</span>
    <span class="flex flex-col gap-1"><strong class="font-label-lg text-label-lg text-on-surface">${esc(item.title)}</strong><small class="font-body-sm text-body-sm text-on-surface-variant">${esc(item.text)}</small></span>
    <span class="material-symbols-outlined text-lg card-accent self-start">${icon(item.icon)}</span>
  </label>`).join('');

  return `<div data-stitch class="w-full flex flex-col items-center">
    <div class="relative w-full max-w-5xl mx-auto md:px-margin py-8 md:py-12 flex flex-col gap-space-lg">
      <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div class="absolute top-1/3 -right-20 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <header class="flex flex-col gap-space-sm w-full">
        <div class="flex items-center justify-between text-on-surface-variant font-label-md text-label-md"><span class="inline-flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-secondary"></span>Passo 1 de 1 • Vamos calibrar seu potencial</span><span class="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Etapa inicial</span></div>
        <div class="w-full h-1.5 bg-surface-container rounded-full overflow-hidden"><div class="h-full w-1/2 bg-secondary rounded-full transition-all duration-500 ease-out"></div></div>
      </header>

      <section class="flex flex-col gap-space-xs mt-2">
        <div class="inline-flex items-center gap-2 text-primary font-label-lg text-label-lg"><span class="material-symbols-outlined text-lg">${icon('spark')}</span><span>Sua jornada de descoberta</span></div>
        <h1 class="font-headline-lg text-headline-lg text-on-surface md:text-display-lg md:font-display-lg">Como os estudos fazem parte da sua vida hoje?</h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant max-w-3xl">Não existe resposta certa, nem ritmo melhor. Escolha o que combina com seu momento. Você pode mudar depois, sem perder nada do que já estudou.</p>
      </section>

      <fieldset class="grid grid-cols-1 md:grid-cols-3 gap-space-md" id="pace-card-group"><legend class="sr-only">Seu ritmo de estudo</legend>${rhythmCards}</fieldset>

      <section class="flex flex-col gap-space-sm"><div class="flex items-center justify-between flex-wrap gap-2"><h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2"><span class="material-symbols-outlined card-accent">${icon('focus')}</span> O que ajudaria você a estudar?</h2><span class="font-label-sm text-label-sm text-on-surface-variant">Opcional • pode marcar mais de um</span></div>
        <fieldset class="grid grid-cols-1 md:grid-cols-2 gap-space-sm"><legend class="sr-only">Apoios para o estudo</legend>${supportCards}</fieldset>
      </section>

      <div class="rounded-xl bg-surface-container border-t border-surface-variant/40 p-6 flex flex-col gap-2">
        <span class="inline-flex items-center gap-2 text-secondary font-label-md text-label-md"><span class="material-symbols-outlined text-lg">${icon('settings')}</span> O que muda no seu espaço</span>
        <p id="rhythm-summary" class="font-body-sm text-body-sm text-on-surface-variant" aria-live="polite">${esc(rhythmSummary())}</p>
      </div>

      <div class="flex flex-col-reverse md:flex-row items-center justify-between gap-4">
        <button class="text-on-surface-variant hover:bg-surface-container rounded-lg px-8 py-3.5 font-label-md text-label-md transition-colors duration-200" data-action="skip-onboarding">${state.onboarded ? 'Usar minhas preferências salvas' : 'Explorar sem personalizar agora'}</button>
        <button id="onboarding-next" class="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-primary-container hover:bg-inverse-primary text-on-primary font-headline-sm text-headline-sm tracking-tight flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary" data-action="finish-onboarding" ${!onboardingDraft.habit ? 'disabled' : ''}>Continuar no meu ritmo ${icon('arrow')}</button>
      </div>

      <p class="text-center font-label-sm text-label-sm text-on-surface-variant">Sem diagnóstico, sem comparações. O plano é uma sugestão, não uma obrigação.</p>
    </div>
  </div>`;
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
  const art = ['design', 'code', 'language', 'nature'].includes(course.art) ? course.art : 'nature';
  return `<button class="group relative flex flex-col rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors duration-200 overflow-hidden text-left w-full ${course.id === state.selectedCourseId ? 'ring-2' : ''}" data-action="open-course" data-id="${esc(course.id)}" aria-label="${esc(course.title)}, ${labels[status]}, ${progress.done} de ${progress.total} etapas">
    <div class="relative h-44 overflow-hidden"><img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" src="./assets/stitch/${art}.png" alt="" loading="lazy"/><span class="absolute left-3 top-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface/90 backdrop-blur text-on-surface-variant font-label-sm text-label-sm"><span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>${labels[status]}</span></div>
    <div class="p-4 flex flex-col gap-2 min-w-0"><h3 class="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary truncate">${esc(course.title)}</h3><p class="font-body-sm text-body-sm text-on-surface-variant truncate">${esc(course.category)}${course.example ? ' · Exemplo' : ''}</p><div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant"><span>${progress.done} de ${progress.total} etapas</span><strong class="text-secondary font-semibold">${progress.percent}%</strong></div><div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden"><div class="h-full bg-secondary rounded-full" style="width:${progress.percent}%"></div></div></div>
  </button>`;
}
function progressCard() {
  const level = levelInfo(state);
  const count = weekCount(state);
  const target = state.preferences.weeklyGoal;
  return `<aside class="flex flex-col gap-4 p-6 rounded-xl bg-surface-container-low border border-outline-variant/30">
    <span class="inline-flex items-center gap-2 text-secondary font-label-sm text-label-sm uppercase tracking-wider">${icon('compass')} Seu caminho</span>
    ${state.preferences.gamification ? `<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-tertiary text-[24px]">${icon('spark')}</div><div><span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Cada passo conta</span><h2 class="font-headline-sm text-headline-sm text-on-surface">Nível ${level.level}</h2><span class="font-body-sm text-body-sm text-on-surface-variant">${level.total === 0 ? 'Toda jornada tem um começo.' : `${level.total} XP de descobertas.`}</span></div></div><div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant"><span>${level.current} / ${level.next} XP</span><span>Próximo nível</span></div><div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden"><div class="h-full bg-primary rounded-full" style="width:${level.current}%"></div></div>` : `<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary text-[24px]">${icon('leaf')}</div><div><h2 class="font-headline-sm text-headline-sm text-on-surface">Do seu jeito</h2><p class="font-body-sm text-body-sm text-on-surface-variant">Progresso também é encontrar um ritmo confortável.</p></div></div>`}
    <div class="flex flex-col gap-2 pt-4 border-t border-outline-variant/30"><div class="flex items-center justify-between font-label-md text-label-md text-on-surface-variant"><span>Seu plano da semana</span><strong class="text-on-surface">${count} <span class="text-on-surface-variant">/ ${target} missões</span></strong></div><div class="flex gap-1.5" aria-label="${count} de ${target} missões nesta semana">${Array.from({ length: target }, (_, index) => `<span class="h-1.5 flex-1 rounded-full ${index < count ? 'bg-secondary' : 'bg-surface-container-highest'}"></span>`).join('')}</div><p class="font-body-sm text-body-sm text-on-surface-variant">Uma sugestão, não uma cobrança. Você pode ajustar quando quiser.</p></div>
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
  return `<div data-stitch class="max-w-[1440px] mx-auto flex flex-col gap-space-lg">
    <header class="flex flex-col gap-2">
      <span class="inline-flex items-center gap-2 text-secondary font-label-sm text-label-sm uppercase tracking-wider"><span class="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(69,223,164,0.7)]"></span>Espaço seu · sem urgência</span>
      <h1 class="font-display-lg text-display-lg text-on-surface tracking-tight">Olá. <span class="text-secondary">Que bom ter você aqui.</span></h1>
      <p class="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">${esc(plan.message)}</p>
      <button class="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors duration-200 font-label-md text-label-md" data-action="personalize"><span class="material-symbols-outlined text-lg">${icon('settings')}</span> Seu ritmo: ${esc(plan.title)} · ajustar</button>
    </header>
    ${!state.onboarded ? `<div class="flex items-center gap-3 p-4 rounded-xl bg-tertiary-container/30 border border-outline-variant/30"><span class="text-tertiary">${icon('sprout')}</span><span class="font-body-md text-body-md text-on-surface">Um começo mais seu: responda duas perguntas rápidas.</span><button class="text-secondary hover:underline font-label-md text-label-md inline-flex items-center gap-1" data-action="personalize">Personalizar ${icon('arrow')}</button></div>` : ''}
    <section class="grid grid-cols-1 xl:grid-cols-2 gap-space-md" aria-labelledby="next-title">
      <div class="relative flex flex-col gap-4 p-6 md:p-8 rounded-xl bg-surface-container-low shadow-xl overflow-hidden">
        <div class="absolute -right-16 -top-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="relative z-10 flex items-center gap-2 flex-wrap font-label-sm text-label-sm text-on-surface-variant"><span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Ação focal única</span><span>·</span><span>${mission ? esc(mission.course.title) : 'Seu caminho de descobertas'}</span></div>
        <h2 id="next-title" class="relative z-10 font-headline-lg text-headline-lg text-on-surface tracking-tight">${mission ? 'O começo pode ser pequeno.' : 'Cada passo já faz parte do seu caminho.'}</h2>
        <p class="relative z-10 font-body-md text-body-md text-on-surface-variant">${mission ? 'Você não precisa fazer tudo agora. Escolha um movimento pequeno, no seu tempo e sem compromisso de perfeição.' : 'Você pode adicionar um curso ou retomar uma trilha quando fizer sentido.'}</p>
        ${mission ? `<div class="relative z-10 flex items-center gap-3 p-4 rounded-lg bg-surface-container"><span class="text-secondary">${icon('focus')}</span><div class="min-w-0"><strong class="font-label-lg text-label-lg text-on-surface block truncate">${prepareFirst ? `Preparar o material: ${esc(mission.course.title)}` : esc(mission.step.title)}</strong><small class="font-body-sm text-body-sm text-on-surface-variant">Sem tempo mínimo · Sem pressão de entrega${mission.course.example ? ' · Curso de exemplo' : ''}</small></div></div>
        <div class="relative z-10 flex flex-wrap gap-3 pt-2"><button class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container hover:bg-inverse-primary text-on-primary font-headline-sm text-headline-sm transition-all active:scale-[0.99]" data-action="${prepareFirst ? 'smaller-mission' : 'start-mission'}" data-id="${esc(mission.course.id)}">${icon('play')} ${prepareFirst ? 'Preparar meu material' : 'Começar este passo'}</button><button class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-lg text-label-lg transition-colors" data-action="${prepareFirst ? 'start-mission' : 'smaller-mission'}" data-id="${esc(mission.course.id)}">${icon('sprout')} ${prepareFirst ? 'Fazer a etapa completa' : 'Tornar ainda menor'}</button></div>` : `<button class="relative z-10 self-start flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container hover:bg-inverse-primary text-on-primary font-label-lg text-label-lg transition-colors" data-action="navigate" data-route="biblioteca">Explorar biblioteca ${icon('arrow')}</button>`}
      </div>
      ${!essential ? `<aside class="flex flex-col gap-3 p-6 rounded-xl bg-surface-container border border-outline-variant/30"><span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Cuidado com seu ritmo</span><h3 class="font-headline-sm text-headline-sm text-on-surface">Pausa consciente</h3><p class="font-body-sm text-body-sm text-on-surface-variant">Se hoje não der, você pode descansar. Seu progresso continua aqui para quando quiser voltar.</p><div class="relative h-32 rounded-lg overflow-hidden"><img class="w-full h-full object-cover opacity-80" src="./assets/stitch/calm.png" alt=""/><div class="absolute inset-0 bg-gradient-to-t from-surface-container-low/90 via-surface-container-low/20 to-transparent"></div><div class="absolute bottom-3 left-3 flex items-center gap-2"><span class="text-secondary">${icon('leaf')}</span><button class="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-colors" data-action="take-break">Fazer uma pausa</button></div></div><span class="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">Pausar sem culpa ${icon('pause')}</span></aside>` : ''}
    </section>
    ${!essential ? `<div class="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
      <section class="flex flex-col gap-3 p-6 rounded-xl bg-surface-container border border-outline-variant/30"><div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant"><span class="uppercase tracking-wider">Ritmo da semana</span><span class="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">No seu tempo</span></div><h2 class="font-headline-md text-headline-md text-on-surface">${count} de ${goal} passos</h2><p class="font-body-sm text-body-sm text-on-surface-variant">Sem cobrança: descanse se precisar, seu progresso não expira.</p><div class="flex gap-1.5" aria-label="${count} de ${goal} missões nesta semana">${Array.from({ length: goal }, (_, i) => `<span class="h-1.5 flex-1 rounded-full ${i < count ? 'bg-secondary' : 'bg-surface-container-highest'}"></span>`).join('')}</div></section>
      <section class="flex flex-col gap-3 p-6 rounded-xl bg-surface-container border border-outline-variant/30"><div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant"><span class="uppercase tracking-wider">Trilha atual</span><span class="text-secondary">${progress ? progress.percent : 100}%</span></div><h2 class="font-headline-md text-headline-md text-on-surface truncate">${mission ? esc(mission.course.title) : 'Um caminho percorrido'}</h2><p class="font-body-sm text-body-sm text-on-surface-variant">${mission ? 'Um pequeno passo de cada vez. Continue de onde parou.' : 'Explore um assunto novo quando quiser.'}</p><div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden"><div class="h-full bg-secondary rounded-full" style="width:${progress ? progress.percent : 100}%"></div></div><button class="inline-flex items-center gap-1 self-start text-secondary hover:underline font-label-md text-label-md" data-action="${mission ? 'open-course' : 'navigate'}" ${mission ? `data-id="${esc(mission.course.id)}"` : 'data-route="biblioteca"'}>Ver detalhes da trilha ${icon('arrow')}</button></section>
      <section class="flex flex-col gap-3 p-6 rounded-xl bg-surface-container border border-outline-variant/30"><span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Adaptação de foco</span><h2 class="font-headline-md text-headline-md text-on-surface">Mudar de jornada</h2><p class="font-body-sm text-body-sm text-on-surface-variant">Não está fluindo hoje? Alterne para outro interesse sem perder seu progresso.</p><a class="inline-flex items-center gap-1 text-secondary hover:underline font-label-md text-label-md" href="#biblioteca">${icon('book')} Explorar toda a biblioteca ${icon('arrow')}</a><button class="inline-flex items-center gap-1 self-start text-on-surface-variant hover:text-on-surface font-label-md text-label-md" data-action="add-course">${icon('plus')} Adicionar um novo interesse</button></section>
    </div>
    <section class="flex flex-col md:flex-row md:items-center gap-4 p-6 rounded-xl bg-surface-container-low border border-outline-variant/30"><span class="text-secondary">${icon('shield')}</span><div class="flex-1"><h2 class="font-headline-sm text-headline-sm text-on-surface">Lembrete de conforto</h2><p class="font-body-sm text-body-sm text-on-surface-variant">Você pode parar e voltar depois. Seu caminho não precisa seguir o ritmo de ninguém.</p></div><a class="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-lg text-label-lg transition-colors" href="#configuracoes">Ajustar meu espaço</a></section>` : '<p class="font-body-sm text-body-sm text-on-surface-variant">Só o próximo passo. O restante está no menu, quando você precisar.</p>'}
  </div>`;
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
  const art = course.art === 'design' ? 'detail' : ['code', 'language', 'nature'].includes(course.art) ? course.art : 'nature';
  return `<aside class="xl:col-span-4 flex flex-col gap-4 p-6 rounded-xl bg-surface-container-low border border-outline-variant/30">
    <div class="relative h-44 rounded-lg overflow-hidden"><img class="w-full h-full object-cover" src="./assets/stitch/${art}.png" alt=""/><div class="absolute inset-0 bg-gradient-to-t from-surface-container-low/90 via-surface-container-low/50 to-transparent"></div><div class="absolute bottom-3 left-3 right-3"><span class="inline-flex px-2 py-0.5 rounded-full bg-secondary/20 text-secondary font-label-sm text-label-sm">Sua trilha atual</span><h2 class="font-headline-sm text-headline-sm text-on-surface truncate">${esc(course.title)}</h2></div></div>
    <button class="w-full px-5 py-3 rounded-lg bg-primary-container hover:bg-inverse-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]" data-action="${next && !course.paused ? 'start-mission' : 'open-course'}" data-id="${esc(course.id)}">${icon(next ? 'play' : 'check')} ${course.paused ? 'Ver curso em pausa' : next ? 'Continuar meu próximo passo' : 'Ver caminho concluído'}</button>
    <span class="font-label-sm text-label-sm text-on-surface-variant">Ritmo livre · sem pressa</span>
    <div class="flex flex-col gap-2 pt-4 border-t border-outline-variant/30">
      <span class="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant">Próximos passos claros</span>
      <ol class="flex flex-col gap-2">${course.steps.map((step, i) => `<li class="flex items-start gap-3 p-2 rounded-lg ${step.id === next?.id ? 'bg-surface-container-high' : ''}"><span class="w-6 h-6 rounded-full grid place-items-center flex-shrink-0 ${state.completed.includes(step.id) ? 'bg-secondary text-on-secondary' : 'bg-surface-container-highest text-on-surface-variant'} text-xs font-semibold">${state.completed.includes(step.id) ? icon('check') : i + 1}</span><div class="min-w-0"><span class="block font-body-sm text-body-sm text-on-surface ${state.completed.includes(step.id) ? 'opacity-60' : ''}">${esc(step.title)}</span><small class="block font-label-sm text-label-sm text-on-surface-variant">${state.completed.includes(step.id) ? 'Passo registrado' : step.id === next?.id ? 'Uma próxima ação possível' : 'Quando chegar o seu momento'}</small></div></li>`).join('')}</ol>
    </div>
    <div class="flex flex-col gap-2"><div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant"><span>${progress.done} de ${progress.total} etapas</span><strong class="text-secondary">${progress.percent}%</strong></div><div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden"><div class="h-full bg-secondary rounded-full" style="width:${progress.percent}%"></div></div></div>
    <p class="flex items-start gap-2 font-body-sm text-body-sm text-on-surface-variant"><span class="text-secondary">${icon('sprout')}</span> Seu progresso é salvo neste navegador. Não há penalidades por pausas.</p>
  </aside>`;
}
function library() {
  return `<div data-stitch class="max-w-[1440px] mx-auto flex flex-col gap-space-md">
    <header class="flex flex-col gap-2"><h1 class="font-display-lg text-display-lg text-on-surface tracking-tight">Biblioteca</h1><p class="font-body-lg text-body-lg text-on-surface-variant max-w-3xl">Guarde seus cursos e tópicos de estudo. Continue de onde parou, no seu ritmo.</p></header>
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <label class="relative flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-container-lowest shadow-inner min-w-0 md:w-80" for="course-search"><span class="text-on-surface-variant pointer-events-none">${icon('search')}</span><input class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:outline-none" id="course-search" type="search" placeholder="Buscar nas minhas trilhas…" aria-label="Buscar um curso pelo nome" value="${esc(searchTerm)}"/></label>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar cursos por situação">${Object.entries(statusLabels).map(([id, label]) => `<button class="filter-btn" aria-pressed="${libraryFilter === id}" data-action="filter" data-filter="${id}">${label} <span class="opacity-60">(${id === 'all' ? state.courses.length : state.courses.filter((c) => courseStatus(state, c) === id).length})</span></button>`).join('')}</div>
      <button class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container hover:bg-inverse-primary text-on-primary font-label-lg text-label-lg transition-all active:scale-[0.99]" data-action="add-course">${icon('plus')} Adicionar curso</button>
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-space-md items-start">
      <section class="xl:col-span-8 flex flex-col gap-3">
        <div class="flex items-center justify-between flex-wrap gap-2"><h2 class="font-headline-md text-headline-md text-on-surface flex items-center gap-2">Minha estante <span class="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-label-sm text-label-sm">${state.courses.length} trilhas</span></h2><span class="font-label-sm text-label-sm text-on-surface-variant">Um interesse de cada vez</span></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm" id="library-results">${libraryResults()}</div>
        <div id="search-status" class="sr-only" role="status"></div>
        <p class="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant"><span class="material-symbols-outlined text-lg">${icon('help')}</span> Capas ilustrativas. Os cursos de exemplo não incluem aulas.</p>
      </section>
      ${libraryDetail()}
    </div>
  </div>`;
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
      <label class="setting-row" for="pref-theme"><span><strong>Tema</strong><span>Um ambiente que seja confortável para você.</span></span><select id="pref-theme" data-preference="theme"><option value="dark" ${state.preferences.theme === 'dark' ? 'selected' : ''}>Escuro</option><option value="light" ${state.preferences.theme === 'light' ? 'selected' : ''}>Claro</option></select></label>
      <label class="setting-row" for="pref-textSize"><span><strong>Tamanho do texto</strong><span>Mais espaço para ler com tranquilidade.</span></span><select id="pref-textSize" data-preference="textSize"><option value="normal" ${state.preferences.textSize === 'normal' ? 'selected' : ''}>Padrão</option><option value="large" ${state.preferences.textSize === 'large' ? 'selected' : ''}>Ampliado</option></select></label>
    </section><div><section class="panel settings-panel"><h2>${icon('sprout')} Seu momento</h2><p class="settings-description">${HABITS.find((item) => item.id === state.habit)?.title || 'Você ainda não escolheu uma rotina.'} Nada aqui é uma definição sobre você.</p><button class="button secondary full-width" data-action="personalize">Revisar perguntas iniciais ${icon('arrow')}</button><label class="setting-row weekly-setting" for="pref-weeklyGoal"><span><strong>Plano semanal</strong><span>Missões sugeridas, sem obrigação.</span></span><select id="pref-weeklyGoal" data-preference="weeklyGoal">${Array.from({ length: 7 }, (_, index) => `<option value="${index + 1}" ${state.preferences.weeklyGoal === index + 1 ? 'selected' : ''}>${index + 1}</option>`).join('')}</select></label></section>
    <section class="privacy-note"><span class="privacy-icon">${icon('shield')}</span><h2>Seu espaço, por enquanto local.</h2><p>O Lume terá contas com e-mail e senha e progresso associado ao perfil. A sincronização dos estudos está em implementação; nesta prévia, o progresso ainda fica neste navegador.</p><p>Não inclua senhas nem informações sensíveis nas suas etapas de estudo.</p><button class="text-button" data-action="export">Baixar cópia dos meus dados ${icon('arrow')}</button></section></div></div>`;
}

function motionEnabled() {
  return !motionPreference.matches && !state.preferences.essential;
}

function stopEntranceAnimations() {
  entranceAnimations.forEach(animation => animation.cancel());
  entranceAnimations.clear();
}

// Entradas finitas inspiradas no calm motion da Arc (catálogo FGLibs).
// O conteúdo permanece visível e funcional sem a Web Animations API.
function revealElements(elements, stagger = 45) {
  if (!motionEnabled()) return;
  [...elements].slice(0, 12).forEach((element, index) => {
    if (typeof element.animate !== 'function') return;
    const animation = element.animate([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 400, delay: Math.min(index * stagger, 180), easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
    entranceAnimations.add(animation);
    animation.finished.catch(() => {}).finally(() => entranceAnimations.delete(animation));
  });
}

motionPreference.addEventListener('change', stopEntranceAnimations);

function render(focusMain = false) {
  const enteringPage = lastRenderedRoute !== route();
  stopEntranceAnimations();
  renderContent(focusMain);
  // Não repetir entradas ao digitar, salvar preferências ou receber resposta da API.
  if (enteringPage) {
    const selectors = {
      login: '[aria-labelledby="welcome-title"], [aria-labelledby="login-title"]',
      inicio: '#main header, #main section, #pace-card-group > label',
      hoje: '[data-stitch] > header, [data-stitch] > section, [data-stitch] > div > section',
      biblioteca: '[data-stitch] > header, [data-stitch] > div, #library-results > button, [data-stitch] aside',
    };
    revealElements(document.querySelectorAll(selectors[route()] || '#main > :first-child, #main .panel, #main .task-card, #main .achievement-card, #main .history-entry'));
  }
}

function renderContent(focusMain = false) {
  const focusedId = document.activeElement?.id;
  const current = route();
  lastRenderedRoute = current;
  const pages = { login: loginPage, recuperar: recoverPage, redefinir: resetPage, inicio: onboarding, hoje: home, biblioteca: library, missoes: missions, conquistas: achievementPage, historico: historyPage, configuracoes: settings };
  applyPreferences();
  document.documentElement.dataset.page = current;
  app.innerHTML = ['login', 'recuperar', 'redefinir', 'inicio'].includes(current) ? entryShell(pages[current](), current) : shell(pages[current](), current);
  document.title = `${({ login: 'Bem-vindo', recuperar: 'Recuperar acesso', redefinir: resetDone ? 'Acesso validado' : 'Nova senha', inicio: 'Seu ritmo', hoje: 'Hoje', biblioteca: 'Biblioteca', missoes: 'Missões', conquistas: 'Conquistas', historico: 'Meu caminho', configuracoes: 'Do seu jeito' })[current]} · Lume`;
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
    case 'recover-again':
      recoverResult = null;
      recoverError = '';
      render(true);
      document.getElementById('recover-email')?.focus();
      break;
    case 'auth-mode':
      authMode = button.dataset.mode === 'register' ? 'register' : 'login';
      authError = '';
      render(false);
      document.getElementById(authMode === 'register' ? 'auth-name' : 'auth-email')?.focus();
      break;
    case 'logout': {
      api('/api/logout', { method: 'POST' }).catch(() => {});
      clearTimeout(stateSaveTimer);
      account = null;
      previewEntered = false;
      stateSyncAttempted = false;
      // O progresso de quem estava logado fica na conta. Não deixamos cópia no
      // navegador para outra pessoa que use o mesmo computador não herdar dados.
      state = createInitialState();
      try {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      } catch { /* Sessão só em memória. */ }
      go('login');
      notify('Você saiu da conta. Seu progresso está guardado nela.');
      break;
    }
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
      openDialog(`<div class="dialog-content"><h2 id="dialog-title">Conforto visual</h2><label class="setting-row" for="entry-theme"><span><strong>Tema</strong><span>Escolha um ambiente confortável.</span></span><select id="entry-theme" data-preference="theme"><option value="dark" ${state.preferences.theme === 'dark' ? 'selected' : ''}>Escuro</option><option value="light" ${state.preferences.theme === 'light' ? 'selected' : ''}>Claro</option></select></label><button class="button primary full-width" data-action="close-dialog">Pronto</button></div>`); break;
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
    case 'filter':
      libraryFilter = button.dataset.filter;
      render();
      revealElements(document.querySelectorAll('#library-results > *'), 25);
      break;
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
  if (event.target.id === 'auth-form') {
    event.preventDefault();
    if (!authBusy) submitAuth(event.target);
    return;
  }
  if (event.target.id === 'recover-form') {
    event.preventDefault();
    submitRecover(event.target);
    return;
  }
  if (event.target.id === 'reset-form') {
    event.preventDefault();
    submitReset(event.target);
    return;
  }
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
window.addEventListener('hashchange', () => {
  if (dialog.open) dialog.close();
  session = null;
  if (resetDone && resetToken() !== completedResetToken) { resetDone = false; resetError = ''; }
  if (route() === 'recuperar') { recoverResult = null; recoverError = ''; }
  render(true);
});
await loadAccount();
render();
if (!storageAvailable) notify('O armazenamento está indisponível. Os dados desta prévia são temporários nesta aba.');
