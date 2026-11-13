import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import Icon from '../ui/Icon.jsx';
import { Logo } from '../ui/ui.jsx';
import { levelInfo } from '../../public/domain.js';
import { levelProgress } from '../../public/xp-policy.js';
import { useResource } from '../lib/resources.js';
import { isDesktopApp } from '../lib/desktop.js';
import DesktopUpdate from '../features/desktop/DesktopUpdate.jsx';
import SectionTabs, { SECTIONS, sectionOf } from './SectionTabs.jsx';
import { ENTRY_ROUTES } from './routes.jsx';

const desktop = isDesktopApp();
const STITCH_ENTRY_ROUTES = new Set(['conheca', 'login', 'inicio']);

// Quatro destinos no cabeçalho (Início, Biblioteca, Plano de Estudos, Amigos); o Perfil abre pelo menu da conta.
const links = Object.entries(SECTIONS).filter(([, section]) => section.nav !== false).map(([key, section]) => [key, section.home, section.icon, section.label]);
const syncLabels = { loading: 'Carregando biblioteca…', saving: 'Salvando na conta…', saved: 'Progresso salvo na conta', error: 'Gravação não confirmada' };

function positionPopoverFallback(panel, trigger) {
  if (!panel || !trigger) return;
  if (typeof CSS !== 'undefined' && CSS.supports?.('position-area', 'block-end')) {
    panel.style.top = '';
    panel.style.left = '';
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const width = panelRect.width || 272;
  const height = panelRect.height || 260;
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  const left = Math.min(Math.max(8, rect.right - width), maxLeft);
  const fitsBelow = rect.bottom + 8 + height <= window.innerHeight - 8;
  const top = fitsBelow ? rect.bottom + 8 : Math.max(8, rect.top - height - 8);
  panel.style.top = `${Math.round(top)}px`;
  panel.style.left = `${Math.round(left)}px`;
}

export default function Shell({ route, model, children, hideTabs = false, onComfort, onHelp, onRegister, onExit }) {
  const section = sectionOf(route);
  const comfortTriggerRef = useRef(null);
  const comfortPopoverRef = useRef(null);
  const accountTriggerRef = useRef(null);
  const accountPopoverRef = useRef(null);
  const entry = ENTRY_ROUTES.has(route);
  const stitchEntry = STITCH_ENTRY_ROUTES.has(route);
  const summary = model.xp?.summary;
  const level = model.account
    ? (summary ? levelProgress(summary.totalXP) : { level: 1, current: 0, next: 500, total: 0 })
    : levelInfo(model.state);
  const xpLabel = model.account ? 'XP' : 'XP · prévia local';
  const prefs = model.state.preferences;
  const gamified = prefs.gamification;
  const setPreference = model.settingsActions?.setPreference;
  const name = model.account?.name || 'Prévia';
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  const hidePopover = ref => {
    try { ref.current?.hidePopover?.(); } catch {}
  };

  useEffect(() => {
    hidePopover(comfortPopoverRef);
    hidePopover(accountPopoverRef);
  }, [route]);

  // Mesmo recurso da tela de Mensagens: um intervalo só, e ler uma conversa
  // atualiza o contador na hora.
  const unreadSummary = useResource('/api/messages/unread', { interval: 45000, enabled: Boolean(model.account) });
  const unread = model.account && unreadSummary.data?.notifications !== false ? Number(unreadSummary.data?.unread) || 0 : 0;

  if (entry && stitchEntry) {
    return <div className="entry-shell stitch-entry-shell">
      <main id="main" tabIndex={-1} className="entry-main stitch-entry-main">{children}</main>
    </div>;
  }

  if (entry) return <div className="entry-shell">
    <header className="entry-header"><a className="brand" href={route === 'conheca' ? '#conheca' : '#login'} aria-label="Lume — início"><Logo size={34}/><span className="brand-name">Lume</span></a><nav aria-label="Entrada no Lume">{route !== 'conheca' && <a className="text-button" href="#conheca">Conheça o Lume</a>}<button className="chip-button" onClick={onComfort}><Icon name="tune"/>Conforto visual</button>{route === 'login' ? <button className="text-button" onClick={onRegister}>Criar conta</button> : route === 'inicio' ? <button className="text-button" onClick={onExit}>Sair</button> : <a className="text-button" href={route === 'conheca' && model.account ? '#hoje' : '#login'}>{route !== 'conheca' ? 'Voltar à entrada' : model.account ? 'Voltar ao Lume' : 'Entrar'}</a>}<button className="text-button" onClick={onHelp}>Ajuda</button></nav></header>
    <main id="main" tabIndex={-1} className="entry-main">{children}</main>
    <footer className="entry-footer"><span>Seu espaço de estudos: ritmo próprio, progresso real e amigos por perto.</span><span>Cadastro e acesso com e-mail e senha</span></footer>
  </div>;

  const toggleComfortFallback = event => {
    if (event.newState === 'open') positionPopoverFallback(comfortPopoverRef.current, comfortTriggerRef.current);
  };
  const toggleAccountFallback = event => {
    if (event.newState === 'open') positionPopoverFallback(accountPopoverRef.current, accountTriggerRef.current);
  };

  return <div className="app-shell">
    <header className="topbar app-header">
      <div className="app-header-inner">
        <a href="#hoje" className="brand" aria-label="Lume — página inicial"><Logo size={34}/><span className="brand-name">Lume</span></a>
        <nav className="nav" aria-label="Navegação">{links.map(([key, path, icon, label]) => <a key={key} href={`#${path}`} className={`nav-link ${section === key ? 'active' : ''}`} aria-current={section === key ? 'page' : undefined} aria-label={key === 'amigos' && unread > 0 ? `${label} (${unread} mensagens não lidas)` : undefined}>{section === key && <motion.span className="nav-highlight" layoutId="active-navigation" transition={{ duration: .3, ease: [.22, 1, .36, 1] }}/>}<Icon name={icon}/><span className="nav-label">{label}</span>{key === 'amigos' && unread > 0 && <span className="nav-badge" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}</a>)}</nav>
        <div className="topbar-right">
          {model.account && (model.syncStatus === 'saving' || model.syncStatus === 'loading') && <span className={`sr-only sync-${model.syncStatus}`} role="status">{syncLabels[model.syncStatus]}</span>}
          {(!model.account || model.syncStatus === 'error') && <span className={`sync-chip sync-${model.account ? model.syncStatus : 'local'}`} role="status"><Icon name="cloud"/>{model.account ? syncLabels[model.syncStatus] : 'Prévia temporária'}</span>}
          {desktop && <DesktopUpdate/>}
          <button
            type="button"
            ref={comfortTriggerRef}
            popoverTarget="comfort-popover"
            className="comfort-chip"
            aria-label="Conforto visual"
            title="Tema, paleta de cores e tamanho do texto"
          >
            <Icon name="tune"/>
            <span>Conforto visual</span>
          </button>
          <div
            id="comfort-popover"
            ref={comfortPopoverRef}
            popover="auto"
            className="shell-popover comfort-popover anchored-overlay"
            onToggle={toggleComfortFallback}
            aria-label="Conforto visual"
          >
            <div className="shell-popover-head">
              <strong>Conforto visual</strong>
              <small>Personalize tema, paleta e densidade</small>
            </div>
            <div className="comfort-popover-group">
              <span className="comfort-popover-label">Tema</span>
              <div className="comfort-segmented">
                <button type="button" className={prefs.theme === 'dark' ? 'is-active' : ''} aria-pressed={prefs.theme === 'dark'} onClick={() => setPreference?.('theme', 'dark')}>Noite serena</button>
                <button type="button" className={prefs.theme === 'light' ? 'is-active' : ''} aria-pressed={prefs.theme === 'light'} onClick={() => setPreference?.('theme', 'light')}>Dia suave</button>
              </div>
            </div>
            <fieldset className="comfort-popover-group comfort-fieldset">
              <legend className="comfort-popover-label">Paleta de cores</legend>
              <div className="comfort-segmented" role="radiogroup" aria-label="Paleta de cores">
                <label className={`comfort-radio ${(prefs.palette || 'moderno') === 'moderno' ? 'is-active' : ''}`}>
                  <input type="radio" name="shell-palette" value="moderno" checked={(prefs.palette || 'moderno') === 'moderno'} onChange={() => setPreference?.('palette', 'moderno')}/>
                  <span>Azul</span>
                </label>
                <label className={`comfort-radio ${prefs.palette === 'variante2' ? 'is-active' : ''}`}>
                  <input type="radio" name="shell-palette" value="variante2" checked={prefs.palette === 'variante2'} onChange={() => setPreference?.('palette', 'variante2')}/>
                  <span>Roxo</span>
                </label>
              </div>
            </fieldset>
            <div className="comfort-popover-group">
              <span className="comfort-popover-label">Tamanho do texto</span>
              <div className="comfort-segmented">
                <button type="button" className={(prefs.textSize || 'normal') === 'normal' ? 'is-active' : ''} aria-pressed={(prefs.textSize || 'normal') === 'normal'} onClick={() => setPreference?.('textSize', 'normal')}>Padrão</button>
                <button type="button" className={prefs.textSize === 'large' ? 'is-active' : ''} aria-pressed={prefs.textSize === 'large'} onClick={() => setPreference?.('textSize', 'large')}>Maior</button>
              </div>
            </div>
            <label className="comfort-switch-row">
              <span>Menos estímulo (ocultar XP)</span>
              <input type="checkbox" role="switch" switch="" checked={!gamified} onChange={e => setPreference?.('gamification', !e.target.checked)}/>
            </label>
            <div className="shell-popover-foot">
              <a href="#configuracoes" className="text-link" onClick={() => hidePopover(comfortPopoverRef)}>Mais preferências →</a>
              <button type="button" className="text-button" onClick={() => { hidePopover(comfortPopoverRef); onComfort?.(); }}>Modo foco visual</button>
            </div>
          </div>

          <a className="header-icon" href="#mensagens" aria-label={unread > 0 ? `Mensagens (${unread} não lidas)` : 'Mensagens'} title="Mensagens"><Icon name="bell"/>{unread > 0 && <span className="header-dot" aria-hidden="true"/>}</a>

          <div className="user-menu-wrap">
            <button
              type="button"
              ref={accountTriggerRef}
              popoverTarget="account-popover"
              className={`account-chip user-menu-trigger ${route === 'perfil' ? 'active' : ''}`}
              aria-label={`Menu da conta (${name})`}
              title={model.account?.email || 'Modo prévia'}
            >
              {model.state.profile?.avatar
                ? <img className="avatar small player-avatar-img" src={model.state.profile.avatar} alt=""/>
                : <span className="avatar small">{name.slice(0, 1).toUpperCase()}</span>}
              <span className="account-name">{name}</span>
              <span className="user-menu-caret" aria-hidden="true">▾</span>
            </button>
            <div
              id="account-popover"
              ref={accountPopoverRef}
              popover="auto"
              className="shell-popover user-dropdown anchored-overlay"
              onToggle={toggleAccountFallback}
              aria-label="Opções do usuário"
            >
              <div className="user-dropdown-header">
                <strong>{name}</strong>
                <small>{model.account?.email || 'Modo prévia local'}</small>
                {gamified && <small className="user-dropdown-level">{model.account && !summary ? 'Sincronizando XP…' : `Nível ${level.level} · ${level.current} / ${level.next} ${xpLabel}`}</small>}
              </div>
              <a className={`user-dropdown-item ${route === 'perfil' ? 'active' : ''}`} href="#perfil" onClick={() => hidePopover(accountPopoverRef)}>
                <Icon name="user"/>
                <span>Meu Perfil</span>
              </a>
              <a className={`user-dropdown-item ${route === 'conquistas' ? 'active' : ''}`} href="#conquistas" onClick={() => hidePopover(accountPopoverRef)}>
                <Icon name="trophy"/>
                <span>Conquistas</span>
              </a>
              <a className={`user-dropdown-item ${route === 'configuracoes' ? 'active' : ''}`} href="#configuracoes" onClick={() => hidePopover(accountPopoverRef)}>
                <Icon name="settings"/>
                <span>Configurações</span>
              </a>
              <div className="user-dropdown-divider"/>
              <button
                type="button"
                className="user-dropdown-item danger"
                onClick={() => { hidePopover(accountPopoverRef); onExit(); }}
              >
                <Icon name="logout"/>
                <span>{model.account ? 'Sair' : 'Sair da prévia'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
    <main id="main" tabIndex={-1}>{!hideTabs && <SectionTabs route={route} unread={unread}/>}{children}</main>
    <footer className="app-footer"><div className="app-footer-inner"><span className="app-footer-brand"><strong>Lume</strong><small>Seu espaço de estudos: ritmo próprio, pausas sem punição e progresso real.</small></span><span className="app-footer-meta"><span>{today}</span><a className="text-link" href="#configuracoes">Preferências</a>{!desktop && <a className="text-link" href="#aplicativo"><Icon name="cloud"/>Instalar aplicativo</a>}<button type="button" className="text-button" onClick={onHelp}>Ajuda</button></span></div></footer>
  </div>;
}
