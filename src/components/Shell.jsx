import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import Icon from './Icon.jsx';
import { AnimatedNumber, Logo, Progress, Ring } from './ui.jsx';
import { levelInfo } from '../../public/domain.js';
import { levelProgress } from '../../public/xp-policy.js';
import { isDesktopApp } from '../lib/desktop.js';
import DesktopUpdate from './DesktopUpdate.jsx';

const desktop = isDesktopApp();

const links = [['hoje', 'home', 'Hoje', 'Hoje'], ['tarefas', 'list', 'Tarefas', 'Tarefas'], ['biblioteca', 'book', 'Biblioteca', 'Biblioteca'], ['missoes', 'flag', 'Missões', 'Missões'], ['conquistas', 'trophy', 'Conquistas', 'Conquistas'], ['historico', 'history', 'Meu Caminho', 'Caminho'], ['amigos', 'users', 'Amigos', 'Amigos'], ['ranking', 'podium', 'Ranking', 'Ranking'], ['configuracoes', 'settings', 'Configurações', 'Ajustes']];
const planned = [['mail', 'Mensagens']];
const syncLabels = { saving: 'Salvando na conta…', saved: 'Progresso salvo na conta', error: 'Sem sincronização · cópia local preservada' };

export default function Shell({ route, model, children, onComfort, onHelp, onRegister, onExit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const entry = ['login', 'inicio', 'recuperar', 'redefinir'].includes(route);
  const summary = model.xp?.summary;
  const level = model.account
    ? (summary ? levelProgress(summary.totalXP) : { level: 1, current: 0, next: 500, total: 0 })
    : levelInfo(model.state);
  const xpLabel = model.account ? 'XP elegível' : 'prévia local';
  const gamified = model.state.preferences.gamification;
  const name = model.account?.name || 'Prévia';
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

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
    <header className="entry-header"><a className="brand" href="#login" aria-label="Lume — início"><Logo size={34}/><span className="brand-name">Lume</span></a><nav aria-label="Entrada no Lume"><button className="chip-button" onClick={onComfort}><Icon name="sun"/>Conforto visual</button>{route === 'login' ? <button className="text-button" onClick={onRegister}>Criar conta</button> : route === 'inicio' ? <button className="text-button" onClick={onExit}>Sair</button> : <a className="text-button" href="#login">Voltar à entrada</a>}<button className="text-button" onClick={onHelp}>Ajuda</button></nav></header>
    <main id="main" tabIndex={-1} className="entry-main">{children}</main>
    <footer className="entry-footer"><span>Aprender no seu ritmo, com espaço para recomeçar.</span><span>Cadastro e acesso com e-mail e senha</span></footer>
  </div>;
  return <div className="app-shell">
    <aside className="sidebar" aria-label="Menu principal">
      <a href="#hoje" className="brand" aria-label="Lume — página inicial"><Logo size={38}/><span className="brand-copy"><span className="brand-name">Lume</span><small>Seu ritmo, seu caminho</small></span></a>
      <nav className="nav" aria-label="Navegação">{links.map(([path, icon, label, short]) => <a key={path} href={`#${path}`} className={`nav-link ${route === path ? 'active' : ''}`} aria-current={route === path ? 'page' : undefined} aria-label={label}>{route === path && <motion.span className="nav-highlight" layoutId="active-navigation" transition={{ duration: .3, ease: [.22, 1, .36, 1] }}/>}<Icon name={icon}/><span className="nav-label">{label}</span><span className="nav-short" aria-hidden="true">{short}</span></a>)}</nav>
      <div className="nav-planned"><span className="nav-section">Em breve</span>{planned.map(([icon, label]) => <span key={label} className="nav-link planned"><Icon name={icon}/><span className="nav-label">{label}</span><span className="soon-badge">Planejado</span></span>)}</div>
      {!desktop && <a className="install-app" href="#aplicativo"><Icon name="cloud"/><span>Instalar aplicativo</span></a>}
      <a className="player-card" href="#perfil" aria-label="Abrir meu perfil">
        {model.state.profile?.avatar
          ? <img className="avatar player-avatar-img" src={model.state.profile.avatar} alt=""/>
          : gamified ? <Ring value={level.current} max={level.next} size={52} stroke={5} label={`Nível ${level.level}`}><strong>{level.level}</strong></Ring> : <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>}
        <div className="player-copy"><strong title={model.account?.email}>{name}</strong>{gamified ? (model.account && !summary ? <span>Sincronizando XP…</span> : <span>Nível {level.level} · <AnimatedNumber value={level.current}/> / {level.next} XP {xpLabel}</span>) : <span>Indicadores ocultos</span>}</div>
      </a>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-left"><span className="today">{today}</span></div>
        <div className="topbar-right">
          {gamified && <div className="level-chip" title={model.account ? 'XP confirmado pelo servidor; o saldo legado fica fora do nível.' : 'Prévia local: este XP não vale para ranking.'}><Icon name="spark"/><span>Nível {level.level} · <strong>{level.current} / {level.next} XP</strong> {model.account ? 'elegível' : 'na prévia'}</span><Progress value={level.current} max={level.next} tone="lume" label="Experiência até o próximo nível"/></div>}
          <span className={`sync-chip sync-${model.account ? model.syncStatus : 'local'}`}><Icon name="cloud"/>{model.account ? syncLabels[model.syncStatus] || 'Conta conectada' : 'Prévia · progresso neste navegador'}</span>
          {desktop && <DesktopUpdate/>}
          <a className="icon-button" href="#configuracoes" aria-label="Abrir minhas preferências"><Icon name="settings"/></a>
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
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="page-footer"><span>Feito para o seu ritmo, não o contrário.</span><span role="status">{model.account ? syncLabels[model.syncStatus] || 'Conta conectada' : 'Prévia · progresso neste navegador'}</span></footer>
    </div>
  </div>;
}
