// Tabela de rotas da SPA. Uma tela nova é uma linha aqui: hash, título, seção
// do menu (com o rótulo da aba) e como desenhar. O menu, as abas de seção e o
// título da janela derivam desta tabela.

import { lazy } from 'react';
import { Login, Recovery } from '../features/account/Auth.jsx';
import { Library } from '../features/library/Study.jsx';
import { Home } from '../features/library/Today.jsx';
import Onboarding from '../features/account/Onboarding.jsx';
import Tasks from '../features/plan/Tasks.jsx';

// Telas fora do caminho inicial (entrada, Início e Biblioteca) carregam sob
// demanda: cada uma vira um pacote próprio e o primeiro acesso fica menor.
// A Agenda leva o FullCalendar consigo. O App envolve a rota em Suspense.
const named = (load, name) => lazy(() => load().then((module) => ({ default: module[name] })));
const personal = () => import('../features/settings/Personal.jsx');
const plan = () => import('../features/plan/Plan.jsx');
const Achievements = named(personal, 'Achievements');
const Preferences = named(() => import('../features/settings/Settings.jsx'), 'Preferences');
const Schedule = named(plan, 'Schedule');
const Friends = lazy(() => import('../features/social/Friends.jsx'));
const Profile = lazy(() => import('../features/social/Profile.jsx'));
const Companion = lazy(() => import('../features/desktop/Companion.jsx'));
const Agenda = lazy(() => import('../features/agenda/Agenda.jsx'));
const Ranking = lazy(() => import('../features/social/Ranking.jsx'));
const Messages = lazy(() => import('../features/social/Messages.jsx'));
const Subjects = lazy(() => import('../features/library/Subjects.jsx'));
const FocusSession = lazy(() => import('../features/progress/FocusSession.jsx'));
const ScheduleSession = lazy(() => import('../features/agenda/ScheduleSession.jsx'));
const Landing = lazy(() => import('../features/account/Landing.jsx'));

// Quatro destinos no cabeçalho; as demais telas ficam em abas ou no menu da conta.
export const SECTIONS = {
  hoje: { label: 'Início', icon: 'home', home: 'hoje' },
  biblioteca: { label: 'Biblioteca', icon: 'book', home: 'biblioteca' },
  plano: { label: 'Plano de Estudos', icon: 'calendar', home: 'plano' },
  amigos: { label: 'Social', icon: 'users', home: 'amigos' },
  // Perfil, Conquistas e Configurações abrem pelo menu da conta, não pelo cabeçalho.
  perfil: { label: 'Perfil', icon: 'user', home: 'perfil', nav: false },
};

// Telas de entrada: sem menu principal, com cabeçalho próprio.
export const ENTRY_ROUTES = new Set(['login', 'inicio', 'recuperar', 'redefinir', 'conheca']);

// Telas abertas sem conta nem prévia (a apresentação e a recuperação de acesso).
export const PUBLIC_ROUTES = new Set(['recuperar', 'redefinir', 'conheca']);

// Endereços antigos continuam válidos: Missões virou o Roteiro dentro do Plano.
// Endereços antigos continuam válidos: Missões e Roteiro viraram o Plano; Meu caminho, Conquistas.
const ALIASES = { missoes: 'plano', roteiro: 'plano', historico: 'conquistas' };

// Enquanto a sessão é verificada, o formulário não aparece: evita a impressão de estar deslogada.
export function SessionCheck() {
  return <div className="boot-stage">
    <span className="boot-brand" aria-hidden="true">Lume</span>
    <section className="boot-card" role="status" aria-busy="true">
      <span className="boot-dots" aria-hidden="true"><i/><i/><i/></span>
      <h1 className="headline">Verificando sua sessão</h1>
      <p className="muted-text">Só um instante. Estamos conferindo seu acesso.</p>
    </section>
  </div>;
}

// ctx: { model, state, open, go, notify, params, hash, authMode, setAuthMode, checkingSession }
// `loading`: forma do esqueleto ('cards' ou 'panel') enquanto a biblioteca da conta
// carrega; sem ele, a tela se vira sozinha (ex.: Agenda, telas sociais).
const ROUTES = [
  { id: 'login', title: 'Bem-vindo', render: (ctx) => <Login model={ctx.model} mode={ctx.authMode} setMode={ctx.setAuthMode} go={ctx.go} notify={ctx.notify}/> },
  { id: 'inicio', title: 'Seu ritmo', render: (ctx) => <Onboarding key={ctx.model.account?.id || 'local'} state={ctx.state} actions={ctx.model.accountActions} libraryActions={ctx.model.libraryActions} open={ctx.open} go={ctx.go} notify={ctx.notify} account={ctx.model.account} onExit={ctx.onExit}/> },
  { id: 'recuperar', title: 'Recuperar acesso', render: (ctx) => <Recovery key="recuperar" reset={false} notify={ctx.notify} go={ctx.go}/> },
  { id: 'conheca', title: 'Conheça o Lume', render: (ctx) => <Landing go={ctx.go} setAuthMode={ctx.setAuthMode} signedIn={Boolean(ctx.model.account)}/> },
  { id: 'redefinir', title: 'Nova senha', render: (ctx) => <Recovery key={ctx.hash} reset notify={ctx.notify} go={ctx.go}/> },

  { id: 'hoje', title: 'Início', loading: 'panel', section: 'hoje', render: (ctx) => <Home state={ctx.state} open={ctx.open} go={ctx.go} planActions={ctx.model.planActions} progressActions={ctx.model.progressActions} notify={ctx.notify} account={ctx.model.account} xp={ctx.model.xp}/> },
  // Telas de ação sem aba própria: o menu continua marcando a seção de origem.
  { id: 'foco', title: 'Sessão de foco', section: 'hoje', hideTabs: () => true, render: (ctx) => <FocusSession state={ctx.state} actions={ctx.model.progressActions} settingsActions={ctx.model.settingsActions} open={ctx.open} go={ctx.go} notify={ctx.notify} account={ctx.model.account} xp={ctx.model.xp}/> },

  { id: 'biblioteca', title: 'Biblioteca', loading: 'cards', section: 'biblioteca', tab: 'Materiais', hideTabs: () => true, render: (ctx) => <Library state={ctx.state} open={ctx.open} go={ctx.go} actions={ctx.model.libraryActions}/> },
  { id: 'disciplinas', title: 'Disciplinas', loading: 'cards', section: 'biblioteca', tab: 'Disciplinas', render: (ctx) => <Subjects key={ctx.params.get('id') || 'todas'} state={ctx.state} actions={ctx.model.libraryActions} open={ctx.open} go={ctx.go} notify={ctx.notify} id={ctx.params.get('id') || ''}/> },

  { id: 'plano', title: 'Plano de Estudos', loading: 'panel', section: 'plano', tab: 'Agenda', tabIcon: 'calendar', hideTabs: () => true, render: (ctx) => <Schedule go={ctx.go} state={ctx.state} actions={ctx.model.planActions} agendaActions={ctx.model.agendaActions} progressActions={ctx.model.progressActions} open={ctx.open} notify={ctx.notify}/> },
  { id: 'agenda', title: 'Calendário', section: 'plano', tab: 'Calendário', tabIcon: 'layers', hideTabs: () => true, render: (ctx) => <Agenda key={ctx.hash} state={ctx.state} actions={ctx.model.agendaActions} taskActions={ctx.model.planActions} confirmSave={ctx.model.confirmSave} retrySave={ctx.model.retrySave} saveError={ctx.model.saveError} syncStatus={ctx.model.syncStatus} params={ctx.params} notify={ctx.notify}/> },
  { id: 'agendar', title: 'Agendar sessão', loading: 'panel', section: 'plano', hideTabs: () => true, render: (ctx) => <ScheduleSession state={ctx.state} actions={ctx.model.agendaActions} open={ctx.open} confirmSave={ctx.model.confirmSave} notify={ctx.notify} go={ctx.go}/> },
  { id: 'tarefas', title: 'Tarefas', loading: 'panel', section: 'plano', tab: 'Tarefas', tabIcon: 'check', hideTabs: () => true, render: (ctx) => <Tasks state={ctx.state} actions={ctx.model.planActions} notify={ctx.notify} onSchedule={(task) => ctx.go(`agenda?tarefa=${encodeURIComponent(task.id)}`)}/> },

  { id: 'amigos', title: 'Social', section: 'amigos', tab: 'Feed', hideTabs: () => true, render: (ctx) => <Friends account={ctx.model.account} state={ctx.state} xp={ctx.model.xp} inviteCode={ctx.params.get('convite') || ''} notify={ctx.notify} go={ctx.go}/> },
  { id: 'mensagens', title: 'Mensagens', section: 'amigos', tab: 'Mensagens', render: (ctx) => <Messages account={ctx.model.account} state={ctx.state} notify={ctx.notify} go={ctx.go} contactId={ctx.params.get('com') || ''}/> },
  { id: 'ranking', title: 'Ranking', section: 'amigos', tab: 'Ranking', render: (ctx) => <Ranking account={ctx.model.account} xp={ctx.model.xp} refreshXP={ctx.model.refreshXP} notify={ctx.notify} go={ctx.go}/> },


  // Perfil de uma amizade (#perfil?id=) não mostra as abas da própria conta.
  { id: 'perfil', title: 'Perfil', loading: 'panel', section: 'perfil', tab: 'Meu perfil', hideTabs: (ctx) => Boolean(ctx.params.get('id')), render: (ctx) => <Profile id={ctx.params.get('id') || ''} state={ctx.state} actions={ctx.model.settingsActions} account={ctx.model.account} notify={ctx.notify} go={ctx.go} xp={ctx.model.xp}/> },
  { id: 'conquistas', title: 'Conquistas', loading: 'cards', section: 'perfil', tab: 'Conquistas', render: (ctx) => <Achievements state={ctx.state} account={ctx.model.account} xp={ctx.model.xp}/> },
  { id: 'configuracoes', title: 'Configurações', loading: 'panel', section: 'perfil', tab: 'Configurações', render: (ctx) => <Preferences state={ctx.state} actions={ctx.model.settingsActions} libraryActions={ctx.model.libraryActions} confirmSave={ctx.model.confirmSave} account={ctx.model.account} notify={ctx.notify} go={ctx.go} open={ctx.open} xp={ctx.model.xp} refreshXP={ctx.model.refreshXP} initialSection={ctx.params.get('secao') || ''} onPersonalize={() => ctx.go('inicio')}/> },

  { id: 'aplicativo', title: 'Instalar aplicativo', render: (ctx) => <Companion account={ctx.model.account} notify={ctx.notify} go={ctx.go}/> },
];

export const ROUTE_BY_ID = new Map(ROUTES.map((route) => [route.id, route]));

export function tabsOf(sectionKey) {
  return ROUTES.filter((route) => route.section === sectionKey && route.tab).map((route) => [route.id, route.tab, route.tabIcon]);
}

export function sectionOf(routeId) {
  return ROUTE_BY_ID.get(routeId)?.section || null;
}

// Lê `#rota?param=valor`, aplicando os apelidos de endereços antigos.
export function parseHash(hash) {
  const [path, query = ''] = String(hash || '').replace(/^#/, '').split('?');
  return { requested: ALIASES[path] || path, params: new URLSearchParams(query) };
}
