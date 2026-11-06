// Tabela de rotas da SPA. Uma tela nova é uma linha aqui: hash, título, seção
// do menu (com o rótulo da aba) e como desenhar. O menu, as abas de seção e o
// título da janela derivam desta tabela.

import { Login, Recovery } from '../features/account/Auth.jsx';
import { Home, Library } from '../features/library/Study.jsx';
import Onboarding from '../features/account/Onboarding.jsx';
import { Achievements, History, Preferences } from '../features/settings/Personal.jsx';
import { Roadmap, Schedule } from '../features/plan/Plan.jsx';
import Friends from '../features/social/Friends.jsx';
import Profile from '../features/social/Profile.jsx';
import Companion from '../features/desktop/Companion.jsx';
import Tasks from '../features/plan/Tasks.jsx';
import Agenda from '../features/agenda/Agenda.jsx';
import Ranking from '../features/social/Ranking.jsx';
import Messages from '../features/social/Messages.jsx';
import GitHub from '../features/library/GitHub.jsx';
import Icon from '../ui/Icon.jsx';

// Seis destinos do menu; as telas secundárias são abas da seção.
export const SECTIONS = {
  hoje: { label: 'Hoje', icon: 'home', home: 'hoje' },
  biblioteca: { label: 'Biblioteca', icon: 'book', home: 'biblioteca' },
  plano: { label: 'Plano', icon: 'list', home: 'plano' },
  agenda: { label: 'Agenda', icon: 'calendar', home: 'agenda' },
  amigos: { label: 'Amigos', icon: 'users', home: 'amigos' },
  perfil: { label: 'Perfil', icon: 'user', home: 'perfil' },
};

// Telas de entrada: sem menu lateral, com o cabeçalho próprio.
export const ENTRY_ROUTES = new Set(['login', 'inicio', 'recuperar', 'redefinir']);

// Endereços antigos continuam válidos: Missões virou o Roteiro dentro do Plano.
export const ALIASES = { missoes: 'roteiro' };

// Enquanto a sessão é verificada, o formulário não aparece: evita a impressão de estar deslogada.
function SessionCheck() {
  return <section className="recovery-card" aria-busy="true"><span className="dialog-emblem"><Icon name="cloud"/></span><h1 className="headline">Verificando sua sessão.</h1><p className="muted-text">Só um instante enquanto confirmamos se você já está conectada.</p></section>;
}

// ctx: { model, state, open, go, notify, params, hash, authMode, setAuthMode, checkingSession }
export const ROUTES = [
  { id: 'login', title: 'Bem-vindo', render: (ctx) => (ctx.checkingSession ? <SessionCheck/> : <Login model={ctx.model} mode={ctx.authMode} setMode={ctx.setAuthMode} go={ctx.go} notify={ctx.notify}/>) },
  { id: 'inicio', title: 'Seu ritmo', render: (ctx) => <Onboarding key={ctx.model.account?.id || 'local'} state={ctx.state} actions={ctx.model.accountActions} libraryActions={ctx.model.libraryActions} go={ctx.go} notify={ctx.notify} account={ctx.model.account}/> },
  { id: 'recuperar', title: 'Recuperar acesso', render: (ctx) => <Recovery key="recuperar" reset={false} notify={ctx.notify} go={ctx.go}/> },
  { id: 'redefinir', title: 'Nova senha', render: (ctx) => <Recovery key={ctx.hash} reset notify={ctx.notify} go={ctx.go}/> },

  { id: 'hoje', title: 'Hoje', section: 'hoje', render: (ctx) => <Home state={ctx.state} open={ctx.open} go={ctx.go} planActions={ctx.model.planActions} progressActions={ctx.model.progressActions} notify={ctx.notify} account={ctx.model.account} xp={ctx.model.xp}/> },

  { id: 'biblioteca', title: 'Biblioteca', section: 'biblioteca', tab: 'Materiais', render: (ctx) => <Library state={ctx.state} open={ctx.open} actions={ctx.model.libraryActions}/> },
  { id: 'github', title: 'GitHub', section: 'biblioteca', tab: 'GitHub', render: (ctx) => <GitHub actions={ctx.model.libraryActions} account={ctx.model.account} notify={ctx.notify} go={ctx.go}/> },

  { id: 'plano', title: 'Plano', section: 'plano', tab: 'Cronograma', render: (ctx) => <Schedule state={ctx.state} actions={ctx.model.planActions} open={ctx.open} notify={ctx.notify}/> },
  { id: 'agenda', title: 'Agenda', section: 'agenda', tab: 'Calendário', render: (ctx) => <Agenda key={ctx.hash} state={ctx.state} actions={ctx.model.agendaActions} taskActions={ctx.model.planActions} confirmSave={ctx.model.confirmSave} retrySave={ctx.model.retrySave} saveError={ctx.model.saveError} syncStatus={ctx.model.syncStatus} params={ctx.params} notify={ctx.notify}/> },
  { id: 'tarefas', title: 'Tarefas', section: 'agenda', tab: 'Tarefas', render: (ctx) => <Tasks state={ctx.state} actions={ctx.model.planActions} notify={ctx.notify} onSchedule={(task) => ctx.go(`agenda?tarefa=${encodeURIComponent(task.id)}`)}/> },
  { id: 'roteiro', title: 'Roteiro', section: 'plano', tab: 'Roteiro', render: (ctx) => <Roadmap state={ctx.state} open={ctx.open}/> },

  { id: 'amigos', title: 'Amigos', section: 'amigos', tab: 'Contatos', render: (ctx) => <Friends account={ctx.model.account} notify={ctx.notify} go={ctx.go}/> },
  { id: 'mensagens', title: 'Mensagens', section: 'amigos', tab: 'Mensagens', render: (ctx) => <Messages account={ctx.model.account} state={ctx.state} notify={ctx.notify} go={ctx.go} contactId={ctx.params.get('com') || ''}/> },
  { id: 'ranking', title: 'Ranking', section: 'amigos', tab: 'Ranking', render: (ctx) => <Ranking account={ctx.model.account} xp={ctx.model.xp} refreshXP={ctx.model.refreshXP} notify={ctx.notify} go={ctx.go}/> },

  // Perfil de uma amizade (#perfil?id=) não mostra as abas da própria conta.
  { id: 'perfil', title: 'Perfil', section: 'perfil', tab: 'Meu perfil', hideTabs: (ctx) => Boolean(ctx.params.get('id')), render: (ctx) => <Profile id={ctx.params.get('id') || ''} state={ctx.state} actions={ctx.model.settingsActions} account={ctx.model.account} notify={ctx.notify} go={ctx.go} xp={ctx.model.xp}/> },
  { id: 'conquistas', title: 'Conquistas', section: 'perfil', tab: 'Conquistas', render: (ctx) => <Achievements state={ctx.state} account={ctx.model.account} xp={ctx.model.xp}/> },
  { id: 'historico', title: 'Meu caminho', section: 'perfil', tab: 'Meu caminho', render: (ctx) => <History state={ctx.state} account={ctx.model.account} xp={ctx.model.xp} refreshXP={ctx.model.refreshXP} notify={ctx.notify}/> },
  { id: 'configuracoes', title: 'Configurações', section: 'perfil', tab: 'Configurações', render: (ctx) => <Preferences state={ctx.state} actions={ctx.model.settingsActions} libraryActions={ctx.model.libraryActions} account={ctx.model.account} notify={ctx.notify} go={ctx.go} xp={ctx.model.xp} refreshXP={ctx.model.refreshXP} onPersonalize={() => ctx.go('inicio')}/> },

  { id: 'aplicativo', title: 'Instalar aplicativo', render: (ctx) => <Companion account={ctx.model.account} notify={ctx.notify} go={ctx.go}/> },
];

export const ROUTE_BY_ID = new Map(ROUTES.map((route) => [route.id, route]));

export function tabsOf(sectionKey) {
  return ROUTES.filter((route) => route.section === sectionKey && route.tab).map((route) => [route.id, route.tab]);
}

export function sectionOf(routeId) {
  return ROUTE_BY_ID.get(routeId)?.section || null;
}

// Lê `#rota?param=valor`, aplicando os apelidos de endereços antigos.
export function parseHash(hash) {
  const [path, query = ''] = String(hash || '').replace(/^#/, '').split('?');
  return { requested: ALIASES[path] || path, params: new URLSearchParams(query) };
}
