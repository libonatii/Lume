import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Atropos from 'atropos/react';
import { PALETTES, STUDY_TYPES, achievements, levelInfo, studyRhythm, totalXP } from '../../../public/domain.js';
import { materialSteps } from '../../../public/material-model.js';
import { completionKindForCourse, levelProgress, stepEventKey } from '../../../public/xp-policy.js';
import BackupPanel from './BackupPanel.jsx';
import { api, apiError } from '../../lib/api.js';
import Icon from '../../ui/Icon.jsx';
import { AnimatedNumber, Button, Empty, Heading, Progress, Ring, stagger } from '../../ui/ui.jsx';
import { isCompleted } from '../../../public/progress-domain.js';

export function Achievements({ state, account, xp }) {
  const legacy = achievements(state);
  const summary = account ? xp?.summary : null;
  const level = summary
    ? levelProgress(summary.totalXP)
    : levelInfo(state);
  const validated = account && xp?.achievements?.length ? xp.achievements : null;
  const all = validated
    ? validated.map((item) => ({
      id: item.id,
      title: item.title,
      text: item.criterion,
      icon: item.kind === 'project' ? 'flag' : item.kind === 'slide' ? 'book' : item.kind === 'exercise' ? 'steps' : 'trophy',
      unlocked: true,
      current: 1,
      target: 1,
      earnedAt: item.earnedAt,
    }))
    : legacy;
  const unlockedCount = all.filter(item => item.unlocked).length;
  return <div className="personal-root">
    <Heading eyebrow="Marcos permanentes" title="Sua vitrine de conquistas">
      Memórias do caminho que você percorreu.
    </Heading>
    {state.preferences.gamification ? <>
      <section className="achievement-summary crest-card">
        <div className="achievement-summary-body">
          <div className="trophy-emblem"><Icon name="trophy"/></div>
          <div className="achievement-summary-copy">
            <span className="metric-label">{account ? 'XP confirmado pelo servidor' : 'Prévia local'}</span>
            <h2 className="headline">{unlockedCount} de {all.length} conquistas</h2>
            <p className="muted-text">Nível {level.level} · <AnimatedNumber value={level.total}/> XP {account ? 'elegível' : 'de prévia'}{account && !xp ? ' · sincronizando…' : ''}</p>
          </div>
          <Ring value={unlockedCount} max={Math.max(all.length, 1)} size={82} stroke={7} label="Conquistas desbloqueadas">
            <strong>{unlockedCount}/{all.length}</strong>
          </Ring>
        </div>
      </section>
      {validated && !validated.length && <Empty icon="trophy" title="Sua vitrine personalizada começa na primeira conclusão.">Concluir um curso, uma leitura, uma lista de exercícios ou uma apresentação cria uma memória com o nome do material.</Empty>}
      <div className="achievement-grid">
        {all.map((item, index) => {
          const card = <article className={`achievement-card ${item.unlocked ? 'unlocked' : ''}`}>
            <div className="achievement-card-top">
              <div className="achievement-icon"><Icon name={item.icon}/></div>
              <span className="achievement-status">{item.unlocked ? 'CONQUISTADA' : 'UMA POSSIBILIDADE'}</span>
            </div>
            <h2 className="title">{item.title}</h2>
            <p className="muted-text">{item.text}</p>
            {item.earnedAt && <small className="muted-text">{new Date(item.earnedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</small>}
            <div className="achievement-progress">
              <div className="course-progress-label"><span>Progresso</span><strong>{item.current} / {item.target}</strong></div>
              <Progress value={item.current} max={item.target} tone={item.unlocked ? 'lume' : 'mint'} label={`Progresso da conquista ${item.title}`}/>
            </div>
          </article>;
          return <motion.div key={item.id} {...stagger(index)}>
            {item.unlocked ? <Atropos className="achievement-atropos" activeOffset={14} shadow={false} rotateXMax={5} rotateYMax={5}>{card}</Atropos> : card}
          </motion.div>;
        })}
      </div>
      {validated && <details className="legacy-details">
        <summary>Selos do protótipo (legado)</summary>
        <p className="quiet-note">Estes seis selos contam ações do modelo antigo e não entram no ranking nem no nível novo. Eles permanecem para não apagar a memória do que já existia.</p>
        <ul className="legacy-seal-list">{legacy.map((item) => <li key={item.id} className={item.unlocked ? 'is-unlocked' : ''}><Icon name={item.icon}/><span>{item.title}</span><strong>{item.current}/{item.target}</strong></li>)}</ul>
      </details>}
    </> : <Empty icon="history" title="Um caminho sem pontuação.">Você ocultou os indicadores. Seu histórico continua guardado.</Empty>}
  </div>;
}

export function Preferences({ state, actions, libraryActions, notify, onPersonalize, account, go, xp, refreshXP }) {
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
  const projects = state.courses.filter(course => course.type === 'project');
  const eventKeys = new Set((xp?.events || []).map((event) => event.eventKey));
  const legacyCourses = state.courses.filter((course) => !course.example
    && (course.planning === true || materialSteps(course).some((step) => isCompleted(state, step.id)
      && !eventKeys.has(stepEventKey(completionKindForCourse(course), course.id, step.id))))).slice(0, 8);
  function classifyCourse(courseId, patch) {
    if (!libraryActions.editMaterial(courseId, patch)) return;
    notify('Classificação atualizada. Nenhum XP antigo foi recriado.');
  }
  return <div className="personal-root">
    <Heading eyebrow="Perfil" title="Configurações">
      Aparência, ritmo, privacidade, ranking e mensagens.
    </Heading>
    <div className="settings-layout">
      <div className="settings-column">
      <section className="card-surface settings-panel" aria-labelledby="appearance-title">
        <div className="panel-title"><span className="pace-icon"><Icon name="sun"/></span><div><h2 className="title" id="appearance-title">Aparência</h2><p className="muted-text">Paleta de cores, tema e tamanho do texto. A escolha fica salva na sua conta.</p></div></div>
        <fieldset className="palette-options">
          <legend>Paleta de cores</legend>
          {PALETTES.map((palette) => <label key={palette.id} className={`palette-option ${state.preferences.palette === palette.id ? 'is-selected' : ''}`}>
            <input type="radio" name="palette" value={palette.id} checked={state.preferences.palette === palette.id} onChange={() => preference('palette', palette.id)}/>
            <span className="palette-swatches" aria-hidden="true">{palette.swatches.map((color) => <span key={color} style={{ background: color }}/>)}</span>
            <span className="palette-copy"><strong>{palette.title}</strong><small>{palette.detail}</small></span>
          </label>)}
        </fieldset>
        <label className="setting-row">
          <span><strong>Mostrar XP e conquistas</strong><span>Ocultar não apaga seu histórico.</span></span>
          <input className="switch" type="checkbox" checked={state.preferences.gamification} onChange={event => preference('gamification', event.target.checked)}/>
        </label>
        <label className="setting-row">
          <span><strong>Tema</strong><span>Um ambiente confortável para você.</span></span>
          <select value={state.preferences.theme} onChange={event => preference('theme', event.target.value)}>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
          </select>
        </label>
        <label className="setting-row">
          <span><strong>Tamanho do texto</strong><span>Escala confortável para leitura prolongada.</span></span>
          <select value={state.preferences.textSize} onChange={event => preference('textSize', event.target.value)}>
            <option value="normal">Padrão</option>
            <option value="large">Ampliado</option>
          </select>
        </label>
      </section>

        <section className="card-surface settings-panel">
          <div className="panel-title"><span className="pace-icon"><Icon name="sprout"/></span><div><h2 className="title">Seu momento</h2><p className="muted-text">{studyRhythm(state).title}</p></div></div>
          <Button secondary onClick={onPersonalize}>Revisar perguntas iniciais<Icon name="arrow"/></Button>
          <label className="setting-row">
            <span><strong>Plano semanal</strong><span>Passos sugeridos, sem obrigação.</span></span>
            <select value={state.preferences.weeklyGoal} onChange={event => preference('weeklyGoal', Number(event.target.value))}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          </label>
        </section>

        {account && legacyCourses.length > 0 && <section className="card-surface settings-panel" aria-labelledby="legacy-review-title">
          <div className="panel-title"><span className="pace-icon"><Icon name="history"/></span><div><h2 className="title" id="legacy-review-title">Revisar materiais antigos</h2><p className="muted-text">Classifique o que veio do protótipo. O XP antigo não é recriado; a escolha vale para as próximas conclusões.</p></div></div>
          <ul className="legacy-review-list">
            {legacyCourses.map((course) => <li key={course.id}>
              <strong>{course.title}</strong>
              <div className="form-grid">
                <label className="field">Tipo
                  <select value={course.type || 'lesson'} onChange={(event) => classifyCourse(course.id, { type: event.target.value })}>
                    {STUDY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </label>
                <label className="setting-row compact">
                  <span><strong>Planejamento</strong><span>Não é unidade de estudo</span></span>
                  <input className="switch" type="checkbox" checked={course.planning === true} onChange={(event) => classifyCourse(course.id, { planning: event.target.checked })} aria-label={`Marcar ${course.title} como planejamento`}/>
                </label>
              </div>
            </li>)}
          </ul>
          <p className="quiet-note">A lista usa os eventos recentes do servidor. Conclusões antigas continuam no saldo legado e fora do ranking, mesmo depois da classificação.</p>
        </section>}

        <section className="card-surface settings-panel" aria-labelledby="ranking-settings-title">
          <div className="panel-title"><span className="pace-icon"><Icon name="podium"/></span><div><h2 className="title" id="ranking-settings-title">Ranking de amigos</h2><p className="muted-text">Participação opcional. Só amizades veem; sair não apaga XP, nível ou conquistas.</p></div></div>
          {account
            ? <>
              <label className="setting-row">
                <span><strong>Aparecer no ranking</strong><span>{xp?.settings?.rankingOptIn ? 'Você participa das três classificações.' : 'Seu XP continua privado.'}</span></span>
                <input className="switch" type="checkbox" checked={xp?.settings?.rankingOptIn === true} disabled={rankingBusy || !xp} onChange={event => toggleRanking(event.target.checked)} aria-label="Participar do ranking de amigos"/>
              </label>
              <Button secondary onClick={() => go('ranking')}>Abrir ranking<Icon name="arrow"/></Button>
            </>
            : <p className="inline-note"><Icon name="lock"/><span>O ranking exige conta e amizades. Na prévia, ele não é calculado.</span></p>}
        </section>

        <section className="card-surface settings-panel" aria-labelledby="messages-settings-title">
          <div className="panel-title"><span className="pace-icon"><Icon name="mail"/></span><div><h2 className="title" id="messages-settings-title">Mensagens diretas</h2><p className="muted-text">Conversas individuais entre amizades aceitas. Não há grupos, canais ou desconhecidos.</p></div></div>
          {account
            ? <>
              <label className="setting-row">
                <span><strong>Notificações de mensagens</strong><span>{messageNotifications ? 'O contador de não lidas aparece no menu.' : 'O contador fica oculto; as mensagens continuam guardadas.'}</span></span>
                <input className="switch" type="checkbox" checked={messageNotifications} disabled={messagesBusy} onChange={event => toggleMessageNotifications(event.target.checked)} aria-label="Receber notificações de mensagens"/>
              </label>
              <Button secondary onClick={() => go('mensagens')}>Abrir mensagens<Icon name="arrow"/></Button>
            </>
            : <p className="inline-note"><Icon name="lock"/><span>Mensagens exigem conta e amizade aceita.</span></p>}
        </section>
      </div>

      <div className="settings-column">
        <section className="card-surface settings-panel" aria-labelledby="notifications-title">
          <div className="panel-title"><span className="pace-icon"><Icon name="mail"/></span><div><h2 className="title" id="notifications-title">Outros lembretes</h2><p className="muted-text">Os lembretes de compromissos ficam na Agenda. Lembretes de pausa e por e-mail ainda não existem. Não há um controle que finja um envio que não acontece.</p></div></div>
          <p className="quiet-note">Quando existirem, os lembretes serão opcionais e não concederão XP.</p>
          <Button secondary onClick={() => go('agenda')}>Abrir Agenda<Icon name="arrow"/></Button>
        </section>

        <section className="card-surface settings-panel" aria-labelledby="sharing-title">
          <div className="panel-title"><span className="pace-icon"><Icon name="users"/></span><div><h2 className="title" id="sharing-title">O que amigos veem</h2><p className="muted-text">O perfil abre só para quem está na sua lista de amigos.</p></div></div>
          {[['library', 'Biblioteca', 'Materiais em estudo e concluídos.'], ['queue', 'Fila de estudo', 'O roteiro que aparece no Início.'], ['progress', 'Progresso', 'Aulas concluídas e percentuais.'], ['xp', 'XP e nível', 'Confirmados pelo servidor; o saldo legado fica fora.']].map(([key, label, hint]) => <label className="setting-row" key={key}>
            <span><strong>{label}</strong><span>{hint}</span></span>
            <input className="switch" type="checkbox" checked={sharing[key] !== false} onChange={event => sharingPreference(key, event.target.checked)}/>
          </label>)}
          {account
            ? <Button secondary onClick={() => go(`perfil?id=${encodeURIComponent(account.id)}`)}>Ver meu perfil<Icon name="arrow"/></Button>
            : <p className="inline-note"><Icon name="info"/><span>Na prévia não existe lista de amigos: o perfil fica só neste navegador.</span></p>}
          <div className="sharing-projects">
            <strong className="title">Projetos no perfil</strong>
            <p className="muted-text">Projetos começam privados e só aparecem quando você marca.</p>
            {projects.length === 0
              ? <p className="inline-note"><Icon name="info"/><span>Nenhum material do tipo projeto na biblioteca.</span></p>
              : <ul className="sharing-project-list">{projects.map(course => <li key={course.id}>
                <label className="setting-row">
                  <span><strong>{course.title}</strong><span>{course.shared === true ? 'Aparece no seu perfil' : 'Privado'}</span></span>
                  <input className="switch" type="checkbox" checked={course.shared === true} onChange={() => toggleProject(course)}/>
                </label>
              </li>)}</ul>}
          </div>
        </section>

        <BackupPanel state={state} actions={actions} account={account} notify={notify}/>
      </div>
    </div>
  </div>;
}
