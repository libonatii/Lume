import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import Icon from '../ui/Icon.jsx';
import { Logo, Progress } from '../ui/ui.jsx';
import { levelInfo } from '../../public/domain.js';
import { levelProgress } from '../../public/xp-policy.js';
import { useResource } from '../lib/resources.js';
import { isDesktopApp } from '../lib/desktop.js';
import DesktopUpdate from '../features/desktop/DesktopUpdate.jsx';
import SectionTabs, { SECTIONS, sectionOf } from './SectionTabs.jsx';
import { ENTRY_ROUTES } from './routes.jsx';

const desktop = isDesktopApp();

// Seis destinos no cabeçalho; as telas secundárias ficam nas abas de cada seção.
const links = Object.entries(SECTIONS).map(([key, section]) => [key, section.home, section.icon, section.label]);
const syncLabels = { loading: 'Carregando biblioteca…', saving: 'Salvando na conta…', saved: 'Progresso salvo na conta', error: 'Gravação não confirmada' };

export default function Shell({ route, model, children, hideTabs = false, onComfort, onHelp, onRegister, onExit }) {
  const section = sectionOf(route);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const entry = ENTRY_ROUTES.has(route);
  const summary = model.xp?.summary;
  const level = model.account
    ? (summary ? levelProgress(summary.totalXP) : { level: 1, current: 0, next: 500, total: 0 })
    : levelInfo(model.state);
  const xpLabel = model.account ? 'XP elegível' : 'prévia local';
  const gamified = model.state.preferences.gamification;
  const name = model.account?.name || 'Prévia';
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  // Mesmo recurso da tela de Mensagens: um intervalo só, e ler uma conversa
  // atualiza o contador na hora.
  const unreadSummary = useResource('/api/messages/unread', { interval: 45000, enabled: Boolean(model.account) });
  const unread = model.account && unreadSummary.data?.notifications !== false ? Number(unreadSummary.data?.unread) || 0 : 0;

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (entry) return <div className="entry-shell">
    <header className="entry-header"><a className="brand" href={route === 'conheca' ? '#conheca' : '#login'} aria-label="Lume — início"><Logo size={34}/><span className="brand-name">Lume</span></a><nav aria-label="Entrada no Lume">{route !== 'conheca' && <a className="text-button" href="#conheca">Conheça o Lume</a>}<button className="chip-button" onClick={onComfort}><Icon name="leaf"/>Conforto visual</button>{route === 'login' ? <button className="text-button" onClick={onRegister}>Criar conta</button> : route === 'inicio' ? <button className="text-button" onClick={onExit}>Sair</button> : <a className="text-button" href={route === 'conheca' && model.account ? '#hoje' : '#login'}>{route !== 'conheca' ? 'Voltar à entrada' : model.account ? 'Voltar ao Lume' : 'Entrar'}</a>}<button className="text-button" onClick={onHelp}>Ajuda</button></nav></header>
    <main id="main" tabIndex={-1} className="entry-main">{children}</main>
    <footer className="entry-footer"><span>Seu espaço de estudos: ritmo próprio, progresso real e amigos por perto.</span><span>Cadastro e acesso com e-mail e senha</span></footer>
  </div>;
  return <div className="app-shell">
    <header className="topbar app-header">
      <div className="app-header-inner">
        <a href="#hoje" className="brand" aria-label="Lume — página inicial"><Logo size={34}/><span className="brand-name">Lume</span></a>
        <nav className="nav" aria-label="Navegação">{links.map(([key, path, icon, label]) => <a key={key} href={`#${path}`} className={`nav-link ${section === key ? 'active' : ''}`} aria-current={section === key ? 'page' : undefined} aria-label={key === 'amigos' && unread > 0 ? `${label} (${unread} mensagens não lidas)` : label}>{section === key && <motion.span className="nav-highlight" layoutId="active-navigation" transition={{ duration: .3, ease: [.22, 1, .36, 1] }}/>}<Icon name={icon}/><span className="nav-label">{label}</span>{key === 'amigos' && unread > 0 && <span className="nav-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}</a>)}</nav>
        <div className="topbar-right">
          {gamified && <div className="level-chip" title={model.account ? 'XP confirmado pelo servidor; o saldo legado fica fora do nível.' : 'Prévia local: este XP não vale para ranking.'}><Icon name="spark"/><span>Nível {level.level} · <strong>{level.current} / {level.next} XP</strong> <span className="level-chip-note">{model.account ? 'elegível' : 'na prévia'}</span></span><Progress value={level.current} max={level.next} tone="reward" label="Experiência até o próximo nível"/></div>}
          {(!model.account || model.syncStatus !== 'saved') && <span className={`sync-chip sync-${model.account ? model.syncStatus : 'local'}`} role="status"><Icon name="cloud"/>{model.account ? syncLabels[model.syncStatus] || 'Conta conectada' : 'Prévia temporária · não salva'}</span>}
          {desktop && <DesktopUpdate/>}
          <button type="button" className="comfort-chip" onClick={onComfort} aria-label="Conforto visual" title="Tema, paleta e tamanho do texto"><Icon name="leaf"/><span>Conforto visual</span></button>
          <a className="appearance-chip" href="#configuracoes" aria-label="Aparência" title="Paleta de cores, tema e tamanho do texto"><Icon name="sun"/><span>Aparência</span></a>
          <a className="header-icon" href="#mensagens" aria-label={unread > 0 ? `Mensagens (${unread} não lidas)` : 'Mensagens'} title="Mensagens"><Icon name="bell"/>{unread > 0 && <span className="header-dot" aria-hidden="true"/>}</a>
          <div className="user-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className={`account-chip user-menu-trigger ${menuOpen || route === 'perfil' ? 'active' : ''}`}
              onClick={() => setMenuOpen(open => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={`Menu da conta (${name})`}
              title={model.account?.email || 'Modo prévia'}
            >
              {model.state.profile?.avatar
                ? <img className="avatar small player-avatar-img" src={model.state.profile.avatar} alt=""/>
                : <span className="avatar small">{name.slice(0, 1).toUpperCase()}</span>}
              <span className="account-name">{name}</span>
              <span className={`user-menu-caret ${menuOpen ? 'open' : ''}`} aria-hidden="true">▾</span>
            </button>
            {menuOpen && <div className="user-dropdown" role="menu" aria-label="Opções do usuário">
              <div className="user-dropdown-header">
                <strong>{name}</strong>
                <small>{model.account?.email || 'Modo prévia local'}</small>
                {gamified && <small className="user-dropdown-level">{model.account && !summary ? 'Sincronizando XP…' : `Nível ${level.level} · ${level.current} / ${level.next} XP ${xpLabel}`}</small>}
              </div>
              <a
                role="menuitem"
                className={`user-dropdown-item ${route === 'perfil' ? 'active' : ''}`}
                href="#perfil"
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="user"/>
                <span>Meu Perfil</span>
              </a>
              <a
                role="menuitem"
                className={`user-dropdown-item ${route === 'configuracoes' ? 'active' : ''}`}
                href="#configuracoes"
                onClick={() => setMenuOpen(false)}
              >
                <Icon name="settings"/>
                <span>Configurações</span>
              </a>
              {!desktop && <a role="menuitem" className="user-dropdown-item" href="#aplicativo" onClick={() => setMenuOpen(false)}><Icon name="cloud"/><span>Instalar aplicativo</span></a>}
              <div className="user-dropdown-divider" role="separator"/>
              <button
                type="button"
                role="menuitem"
                className="user-dropdown-item danger"
                onClick={() => { setMenuOpen(false); onExit(); }}
              >
                <Icon name="logout"/>
                <span>{model.account ? 'Sair' : 'Sair da prévia'}</span>
              </button>
            </div>}
          </div>
        </div>
      </div>
    </header>
    <main id="main" tabIndex={-1}>{!hideTabs && <SectionTabs route={route} unread={unread}/>}{children}</main>
    <footer className="app-footer"><div className="app-footer-inner"><span className="app-footer-brand"><strong>Lume</strong><small>Seu espaço de estudos: ritmo próprio, pausas sem punição e progresso real.</small></span><span className="app-footer-meta"><span>{today}</span>{!desktop && <a className="text-link" href="#aplicativo"><Icon name="cloud"/>Instalar aplicativo</a>}</span></div></footer>
  </div>;
}
