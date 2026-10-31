import { motion } from 'motion/react';
import Icon from './Icon.jsx';
import { AnimatedNumber, Logo, Progress, Ring } from './ui.jsx';
import { levelInfo } from '../../public/domain.js';

const links = [['hoje', 'home', 'Hoje', 'Hoje'], ['biblioteca', 'book', 'Biblioteca', 'Biblioteca'], ['missoes', 'flag', 'Missões', 'Missões'], ['conquistas', 'trophy', 'Conquistas', 'Conquistas'], ['historico', 'history', 'Meu Caminho', 'Caminho'], ['amigos', 'users', 'Amigos', 'Amigos'], ['configuracoes', 'settings', 'Configurações', 'Ajustes']];
const planned = [['podium', 'Ranking']];
const syncLabels = { saving: 'Salvando na conta…', saved: 'Progresso salvo na conta', error: 'Sem sincronização · cópia local preservada' };

export default function Shell({ route, model, children, onComfort, onHelp, onRegister, onExit }) {
  const entry = ['login', 'inicio', 'recuperar', 'redefinir'].includes(route);
  const level = levelInfo(model.state);
  const gamified = model.state.preferences.gamification;
  const name = model.account?.name || 'Prévia';
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
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
      <a className="install-app" href="#aplicativo"><Icon name="cloud"/><span>Instalar aplicativo</span></a>
      <div className="player-card">
        {gamified ? <Ring value={level.current} max={level.next} size={52} stroke={5} label={`Nível ${level.level}`}><strong>{level.level}</strong></Ring> : <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>}
        <div className="player-copy"><strong title={model.account?.email}>{name}</strong>{gamified ? <span>Nível {level.level} · <AnimatedNumber value={level.current}/> / {level.next} XP</span> : <span>Indicadores ocultos</span>}</div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-left"><span className="today">{today}</span></div>
        <div className="topbar-right">
          {gamified && <div className="level-chip"><Icon name="spark"/><span>Nível {level.level} · <strong>{level.current} / {level.next} XP</strong></span><Progress value={level.current} max={level.next} tone="lume" label="Experiência até o próximo nível"/></div>}
          <span className={`sync-chip sync-${model.account ? model.syncStatus : 'local'}`}><Icon name="cloud"/>{model.account ? syncLabels[model.syncStatus] || 'Conta conectada' : 'Prévia · progresso neste navegador'}</span>
          <a className="icon-button" href="#configuracoes" aria-label="Abrir minhas preferências"><Icon name="settings"/></a>
          {model.account && <span className="account-chip" title={model.account.email}><span className="avatar small">{model.account.name.slice(0, 1).toUpperCase()}</span><span className="account-name">{model.account.name}</span></span>}
          <button className="text-button exit-button" onClick={onExit}><Icon name="logout"/>{model.account ? 'Sair' : 'Sair da prévia'}</button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="page-footer"><span>Feito para o seu ritmo, não o contrário.</span><span role="status">{model.account ? syncLabels[model.syncStatus] || 'Conta conectada' : 'Prévia · progresso neste navegador'}</span></footer>
    </div>
  </div>;
}
