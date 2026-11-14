import { useEffect, useId, useState } from 'react';
import { STUDY_TYPES, studyRhythm } from '../../../public/domain.js';
import { materialSteps } from '../../../public/material-model.js';
import { completionKindForCourse, stepEventKey } from '../../../public/xp-policy.js';
import { isCompleted } from '../../../public/progress-domain.js';
import BackupPanel from './BackupPanel.jsx';
import CreatorQuotaPanel from './CreatorQuotaPanel.jsx';
import StoragePanel from './StoragePanel.jsx';
import { api, apiError } from '../../lib/api.js';
import Icon from '../../ui/Icon.jsx';
import { Heading } from '../../ui/ui.jsx';

const SECTIONS = [
  { id: 'aparencia', label: 'Aparência', icon: 'sun', info: 'Tema e tamanho do texto. A escolha fica salva na sua conta.' },
  { id: 'ritmo', label: 'Ritmo de estudo', icon: 'calendar', info: 'Seu momento e o plano semanal sugerem passos, sem obrigação.' },
  { id: 'social', label: 'Social e privacidade', icon: 'users' },
  { id: 'notificacoes', label: 'Notificações', icon: 'bell', info: 'Os lembretes de compromissos ficam na Agenda. Lembretes de pausa e por e-mail ainda não existem, então não há controle que finja um envio. Quando existirem, serão opcionais e não concederão XP.' },
  { id: 'armazenamento', label: 'Armazenamento', icon: 'layers', info: 'Acompanhe o espaço ocupado pelos seus PDFs da Biblioteca e anexos do Social e libere espaço quando precisar.' },
  { id: 'dados', label: 'Meus dados', icon: 'layers', info: 'Baixe uma cópia dos seus dados de estudo ou restaure uma cópia do Lume.' },
  { id: 'cotas', label: 'Controle de cotas', icon: 'settings', creatorOnly: true, info: 'Defina os limites de armazenamento das contas sem precisar de IDs. Visível apenas para a criadora.' },
];

const SHARING = [
  ['library', 'Biblioteca', 'Materiais em estudo e concluídos.'],
  ['queue', 'Fila de estudo', 'O roteiro que aparece no Início.'],
  ['progress', 'Progresso', 'Aulas concluídas e percentuais.'],
  ['xp', 'XP e nível', 'Confirmados pelo servidor; o saldo legado fica fora.'],
];

function Info({ text }) {
  const id = useId();
  return <span className="cfg-info">
    <button type="button" className="cfg-info-button" aria-label="Sobre esta seção" aria-describedby={id}><Icon name="info"/></button>
    <span role="tooltip" id={id} className="cfg-info-text">{text}</span>
  </span>;
}

function Toggle({ title, hint, checked, onChange, disabled, label, children }) {
  return <label className="cfg-row">
    <span className="cfg-row-copy"><strong>{title}</strong>{hint && <span>{hint}</span>}</span>
    {children}
    <input className="switch" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} aria-label={label || title}/>
  </label>;
}

function LinkButton({ onClick, children }) {
  return <button type="button" className="cfg-link" onClick={onClick}>{children}<Icon name="arrow"/></button>;
}

function ThemeCard({ id, title, checked, onChange }) {
  return <label className={`cfg-theme ${checked ? 'is-selected' : ''}`}>
    <span className={`cfg-theme-preview is-${id}`} aria-hidden="true">
      <i className="cfg-theme-dots"><b/><b/><b/></i>
      <span className="cfg-theme-side"><b/><b/><b/></span>
      <span className="cfg-theme-main"><b/><b/></span>
    </span>
    <span className="cfg-theme-label">
      <input type="radio" name="theme" value={id} checked={checked} onChange={onChange}/>{title}
    </span>
  </label>;
}

export function Preferences({ state, actions, libraryActions, confirmSave, notify, onPersonalize, account, go, open, xp, refreshXP, initialSection = '' }) {
  const visibleSections = SECTIONS.filter((item) => !item.creatorOnly || account?.isCreator);
  const resolvedInitial = visibleSections.some((item) => item.id === initialSection) ? initialSection : 'aparencia';
  const [section, setSection] = useState(resolvedInitial);
  useEffect(() => {
    if (initialSection && visibleSections.some((item) => item.id === initialSection)) {
      setSection(initialSection);
    }
  }, [initialSection, account?.isCreator]);
  const [rankingBusy, setRankingBusy] = useState(false);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [messagesBusy, setMessagesBusy] = useState(false);
  useEffect(() => {
    if (!account) return undefined;
    let alive = true;
    (async () => {
      const result = await api('/api/messages/settings');
      if (alive && result.ok) setMessageNotifications(result.data.notifications !== false);
    })();
    return () => { alive = false; };
  }, [account]);
  function preference(key, value) {
    if (!actions.setPreference(key, value)) return;
    notify('Preferência salva. Seu espaço, do seu jeito.');
  }
  async function toggleRanking(value) {
    if (!account || rankingBusy) return;
    setRankingBusy(true);
    try {
      const result = await api('/api/xp/settings', { method: 'PATCH', body: { rankingOptIn: value } });
      if (!result.ok) throw new Error(apiError(result));
      await refreshXP?.();
      notify(value ? 'Você entrou no ranking de amigos. Só suas amizades veem.' : 'Você saiu do ranking. Seu XP continua guardado.');
    } catch (error) {
      notify(error.message || 'Não foi possível atualizar sua participação agora.');
    } finally {
      setRankingBusy(false);
    }
  }
  async function toggleMessageNotifications(value) {
    if (!account || messagesBusy) return;
    setMessagesBusy(true);
    setMessageNotifications(value);
    try {
      const result = await api('/api/messages/settings', { method: 'PATCH', body: { notifications: value } });
      if (!result.ok) throw new Error(apiError(result));
      notify(value ? 'Notificações de mensagens ativadas.' : 'Notificações de mensagens silenciadas. As conversas continuam guardadas.');
    } catch (error) {
      setMessageNotifications(!value);
      notify(error.message || 'Não foi possível atualizar as notificações agora.');
    } finally {
      setMessagesBusy(false);
    }
  }
  function sharingPreference(key, value) {
    if (!actions.setSharingPreference(key, value)) return;
    notify('Privacidade do perfil atualizada.');
  }
  function toggleProject(course) {
    const open = course.shared !== true;
    if (!actions.setProjectSharing(course.id, open)) return;
    notify(open ? 'Projeto marcado como público no seu perfil.' : 'Projeto voltou a ser privado.');
  }
  const sharing = state.preferences.sharing ?? {};
  const projects = state.courses.filter((course) => course.type === 'project');
  const eventKeys = new Set((xp?.events || []).map((event) => event.eventKey));
  const legacyCourses = state.courses.filter((course) => !course.example
    && (course.planning === true || materialSteps(course).some((step) => isCompleted(state, step.id)
      && !eventKeys.has(stepEventKey(completionKindForCourse(course), course.id, step.id))))).slice(0, 8);
  function classifyCourse(courseId, patch) {
    if (!libraryActions.editMaterial(courseId, patch)) return;
    notify('Classificação atualizada. Nenhum XP antigo foi recriado.');
  }
  const current = visibleSections.find((item) => item.id === section) || visibleSections[0];
  const goal = state.preferences.weeklyGoal;

  return <div className="personal-root">
    <Heading title="Configurações">Seu Lume, do seu jeito.</Heading>
    <div className="cfg-layout">
      <nav className="cfg-nav" aria-label="Seções de configurações">
        {visibleSections.map((item) => <button key={item.id} type="button" className={`button secondary cfg-nav-item ${item.id === current.id ? 'is-active' : ''} ${item.creatorOnly ? 'is-creator-nav' : ''}`} aria-current={item.id === current.id ? 'page' : undefined} onClick={() => setSection(item.id)}>
          <Icon name={item.icon}/>{item.label}
          {item.creatorOnly && <span className="soft-badge is-reward mono">Criadora</span>}
        </button>)}
      </nav>

      <section className="card-surface cfg-panel" aria-labelledby="cfg-title">
        <header className="cfg-head">
          <h2 className="title" id="cfg-title">{current.label}{current.info && <Info text={current.info}/>}</h2>
          {section === 'social' && account && <LinkButton onClick={() => go(`perfil?id=${encodeURIComponent(account.id)}`)}>Ver meu perfil</LinkButton>}
        </header>

        {section === 'aparencia' && <div className="cfg-appearance">
          <div className="cfg-appearance-main">
            <fieldset className="cfg-group cfg-themes">
              <legend>Tema</legend>
              <ThemeCard id="dark" title="Escuro" checked={state.preferences.theme !== 'light'} onChange={() => preference('theme', 'dark')}/>
              <ThemeCard id="light" title="Claro" checked={state.preferences.theme === 'light'} onChange={() => preference('theme', 'light')}/>
            </fieldset>
            <div className="cfg-row cfg-segment-row">
              <span className="cfg-row-copy"><strong>Tamanho do texto</strong></span>
              <div className="cfg-segment" role="radiogroup" aria-label="Tamanho do texto">
                {[['normal', 'Padrão'], ['large', 'Ampliado']].map(([value, label]) => <label key={value} className={state.preferences.textSize === value ? 'is-selected' : ''}>
                  <input type="radio" name="textSize" value={value} checked={state.preferences.textSize === value} onChange={() => preference('textSize', value)}/>{label}
                </label>)}
              </div>
            </div>
            <Toggle title="Mostrar XP e conquistas" hint="Ocultar mantém seu histórico." checked={state.preferences.gamification} onChange={(value) => preference('gamification', value)}/>
          </div>
          <aside className="cfg-preview" aria-label="Prévia">
            <h3>Prévia</h3>
            <div className="cfg-preview-card" aria-hidden="true">
              <div className="cfg-preview-head"><i/><span><b/><b/></span></div>
              <div className="cfg-preview-line"><i/><b/></div>
              <div className="cfg-preview-line"><i/><b/></div>
              <div className="cfg-preview-line"><i/><b/></div>
            </div>
          </aside>
        </div>}

        {section === 'ritmo' && <div className="cfg-stack">
          <div className="cfg-block">
            <h3>Seu momento</h3>
            <p className="cfg-lead">{studyRhythm(state).title}</p>
            <LinkButton onClick={onPersonalize}>Revisar respostas iniciais</LinkButton>
          </div>
          <label className="cfg-row">
            <span className="cfg-row-copy"><strong>Plano semanal</strong><span>Passos sugeridos, sem obrigação.</span></span>
            <select className="cfg-select" value={goal} onChange={(event) => preference('weeklyGoal', Number(event.target.value))}>
              {Array.from({ length: 7 }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i === 0 ? 'passo' : 'passos'}</option>)}
            </select>
          </label>
          <div className="cfg-block"><LinkButton onClick={() => go('plano')}>Ir ao Plano de Estudos</LinkButton></div>
        </div>}

        {section === 'social' && <div className="cfg-stack">
          <p className="cfg-sub">Seu perfil é visível apenas para amigos.</p>
          {!account && <p className="inline-note"><Icon name="info"/><span>Na prévia não existe lista de amigos: o perfil fica só neste navegador.</span></p>}
          <div className="cfg-block">
            <h3>O que amigos veem</h3>
            {SHARING.map(([key, label, hint]) => <Toggle key={key} title={label} hint={hint} checked={sharing[key] !== false} onChange={(value) => sharingPreference(key, value)}/>)}
          </div>
          <div className="cfg-block">
            <h3>Ranking de amigos</h3>
            {account
              ? <Toggle title="Aparecer no ranking" hint="Sair mantém seu XP e suas conquistas." checked={xp?.settings?.rankingOptIn === true} disabled={rankingBusy || !xp} onChange={toggleRanking} label="Participar do ranking de amigos">
                <LinkButton onClick={() => go('ranking')}>Ver ranking</LinkButton>
              </Toggle>
              : <p className="inline-note"><Icon name="lock"/><span>O ranking exige conta e amizades. Na prévia, ele não é calculado.</span></p>}
          </div>
          {projects.length > 0 && <div className="cfg-block">
            <h3>Projetos no perfil</h3>
            <p className="cfg-sub">Você escolhe quais projetos compartilhar.</p>
            {projects.map((course) => <Toggle key={course.id} title={course.title} hint={course.shared === true ? 'Aparece no seu perfil' : 'Privado'} checked={course.shared === true} onChange={() => toggleProject(course)}/>)}
          </div>}
        </div>}

        {section === 'notificacoes' && <div className="cfg-stack">
          <div className="cfg-block">
            <h3>Mensagens</h3>
            {account
              ? <Toggle title="Avisos de novas mensagens" hint="Inclui o contador de não lidas." checked={messageNotifications} disabled={messagesBusy} onChange={toggleMessageNotifications} label="Receber notificações de mensagens"/>
              : <p className="inline-note"><Icon name="lock"/><span>Mensagens exigem conta e amizade aceita.</span></p>}
          </div>
          <div className="cfg-block">
            <h3>Agenda</h3>
            <div className="cfg-row">
              <span className="cfg-row-copy"><strong>Lembretes de compromissos</strong><span>Defina o aviso em cada compromisso.</span></span>
              <LinkButton onClick={() => go('agenda')}>Abrir Agenda</LinkButton>
            </div>
          </div>
        </div>}

        {current.id === 'armazenamento' && <StoragePanel state={state} account={account} libraryActions={libraryActions} confirmSave={confirmSave} notify={notify} open={open} go={go}/>}

        {current.id === 'cotas' && account?.isCreator && <CreatorQuotaPanel account={account} notify={notify}/>}

        {current.id === 'dados' && <div className="cfg-stack">
          <BackupPanel state={state} actions={actions} account={account} notify={notify}/>
          {account && legacyCourses.length > 0 && <div className="cfg-block" aria-labelledby="legacy-review-title">
            <h3 id="legacy-review-title">Revisar materiais antigos</h3>
            <p className="cfg-sub">Classifique o que veio do protótipo. O XP antigo não é recriado; a escolha vale para as próximas conclusões.</p>
            <ul className="legacy-review-list">
              {legacyCourses.map((course) => <li key={course.id}>
                <strong>{course.title}</strong>
                <div className="form-grid">
                  <label className="field">Tipo
                    <select value={course.type || 'lesson'} onChange={(event) => classifyCourse(course.id, { type: event.target.value })}>
                      {STUDY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </label>
                  <Toggle title="Planejamento" hint="Não é unidade de estudo" checked={course.planning === true} onChange={(value) => classifyCourse(course.id, { planning: value })} label={`Marcar ${course.title} como planejamento`}/>
                </div>
              </li>)}
            </ul>
            <p className="quiet-note">A lista usa os eventos recentes do servidor. Conclusões antigas continuam no saldo legado e fora do ranking, mesmo depois da classificação.</p>
          </div>}
        </div>}

      </section>
    </div>
  </div>;
}
