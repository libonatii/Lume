import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import Atropos from 'atropos/react';
import { STORAGE_KEY, achievements, courseProgress, courseStatus, levelInfo, localDay, nextMission, studyRhythm, totalXP } from '../../public/domain.js';
import { formatSessionDuration } from '../../public/session-domain.js';
import { XP_KIND_LABELS, levelProgress } from '../../public/xp-policy.js';
import { mergeBackup, previewBackup, readBackup } from '../../public/backup-domain.js';
import { api, apiError } from '../lib/api.js';
import Icon from './Icon.jsx';
import { AnimatedNumber, Button, Cover, Empty, Glow, Heading, Progress, Ring, stagger } from './ui.jsx';

export function Missions({ state, open }) {
  const available = state.courses.flatMap(course => {
    const mission = nextMission({ ...state, courses: [course] }, course.id);
    return mission ? [mission] : [];
  });
  return <div className="personal-root">
    <Heading eyebrow="Próximos movimentos possíveis" title="Missões">
      Escolha uma. Você não precisa fazer tudo nesta lista.
    </Heading>
    {available.length ? <div className="mission-list">
      {available.map(({ course, step }, index) => {
        const progress = courseProgress(state, course);
        return <motion.article className="task-card" key={step.id} {...stagger(index)}>
          <Cover art={course.art} className="task-cover"/>
          <div className="task-body">
            <div className="task-meta">
              <span className="eyebrow">{course.title}</span>
              <span className="task-step-pill">Etapa {progress.done + 1} de {progress.total}</span>
            </div>
            <h2 className="title">{step.title}</h2>
            <span className="muted-text">{course.example ? 'Curso de exemplo' : 'Registro manual'} · Sem prazo</span>
          </div>
          <Button secondary onClick={() => open({ type: 'session', id: course.id })}>Começar<Icon name="arrow"/></Button>
        </motion.article>;
      })}
    </div> : <Empty title="Sem próximas etapas por enquanto." onAdd={() => open({ type: 'new' })}>Adicione um curso ou retome um que está em pausa.</Empty>}
  </div>;
}

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
      <section className="achievement-summary">
        <Glow palette="lume"/>
        <div className="achievement-summary-body">
          <div className="trophy-emblem"><Icon name="trophy"/></div>
          <div className="achievement-summary-copy">
            <span className="eyebrow on-glow">{account ? 'XP confirmado pelo servidor' : 'Prévia local'}</span>
            <h2 className="headline">{unlockedCount} de {all.length} conquistas</h2>
            <p className="muted-text">Nível {level.level} · <AnimatedNumber value={level.total}/> XP {account ? 'elegível' : 'de prévia'}{account && !xp ? ' · sincronizando…' : ''}</p>
          </div>
          <Ring value={unlockedCount} max={Math.max(all.length, 1)} size={82} stroke={7} label="Conquistas desbloqueadas">
            <strong>{unlockedCount}/{all.length}</strong>
          </Ring>
        </div>
      </section>
      {validated && !validated.length && <Empty title="Sua vitrine personalizada começa na primeira conclusão.">Concluir um curso, uma leitura, uma lista de exercícios ou uma apresentação cria uma memória com o nome do material.</Empty>}
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
    </> : <Empty title="Um caminho sem pontuação.">Você ocultou os indicadores. Seu histórico continua guardado.</Empty>}
  </div>;
}

export function History({ state, account, xp }) {
  const completedCourses = state.courses.filter(course => courseStatus(state, course) === 'completed').length;
  const summary = account ? xp?.summary : null;
  const events = account ? (xp?.events || []) : [];
  const legacy = totalXP(state);
  const level = summary ? levelProgress(summary.totalXP) : levelInfo(state);
  const originLabel = { manual: 'registro manual', integration: 'integração', import: 'progresso importado' };
  return <div className="personal-root">
    <Heading eyebrow="Memória de estudo" title="Meu caminho">
      Seu histórico é uma memória de progresso, não uma lista de cobranças.
    </Heading>
    <div className="history-stats">
      <div className="card-surface stat-card"><span className="eyebrow">{account ? 'XP elegível' : 'XP de prévia'}</span><strong className="stat-value"><AnimatedNumber value={level.total}/></strong><small className="muted-text">Nível {level.level} · {level.current}/{level.next} para o próximo</small></div>
      <div className="card-surface stat-card"><span className="eyebrow">Passos registrados</span><strong className="stat-value"><AnimatedNumber value={state.history.length}/></strong><small className="muted-text">Avanços anotados no seu tempo</small></div>
      <div className="card-surface stat-card"><span className="eyebrow">Cursos concluídos</span><strong className="stat-value"><AnimatedNumber value={completedCourses}/></strong><small className="muted-text">Trilhas percorridas até o fim</small></div>
    </div>

    {account && <section className="xp-ledger" aria-labelledby="xp-ledger-title">
      <div className="xp-ledger-head">
        <div>
          <span className="eyebrow">Livro de eventos</span>
          <h2 id="xp-ledger-title" className="title">XP confirmado pelo servidor</h2>
          <p className="muted-text">Cada linha é um evento único. Repetir uma requisição, recarregar ou sincronizar de outro dispositivo não concede de novo.</p>
        </div>
        {summary && <div className="xp-time-cap">
          <span className="eyebrow">Tempo hoje</span>
          <strong>{summary.dailyTimeXP} / {summary.dailyTimeCap} XP</strong>
          <Progress value={summary.dailyTimeXP} max={summary.dailyTimeCap} tone="mint" label="XP de tempo usado hoje"/>
          <small className="muted-text">{Math.floor(summary.carrySeconds / 60)} min no acumulador · blocos de 30 min</small>
        </div>}
      </div>
      {events.length
        ? <ul className="xp-event-list">{[...events].reverse().map((event) => <li key={event.id} className="xp-event">
          <span className={`xp-event-icon kind-${event.kind}`}><Icon name={event.kind === 'time_block' ? 'clock' : event.kind === 'course_bonus' ? 'trophy' : event.kind === 'project_bonus' || event.kind === 'delivery' ? 'flag' : event.kind === 'slide' ? 'book' : event.kind === 'exercise' ? 'steps' : 'check'}/></span>
          <span className="xp-event-copy">
            <strong>{event.materialTitle || XP_KIND_LABELS[event.kind] || 'Evento de XP'}</strong>
            <small>{XP_KIND_LABELS[event.kind] || event.kind}{event.stepTitle ? ` · ${event.stepTitle}` : ''} · {originLabel[event.origin] || event.origin}</small>
          </span>
          <span className="xp-event-value"><strong>+{event.xp} XP</strong><small>{new Date(event.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small></span>
        </li>)}</ul>
        : <Empty title={xp ? 'Nenhum evento elegível ainda.' : 'Sincronizando seu XP…'}>Concluir uma aula, uma leitura, uma lista de exercícios, uma apresentação ou uma entrega cria o primeiro evento. Abrir ou preparar o material não concede XP.</Empty>}
    </section>}

    {(state.studySessions || []).length > 0 && <section className="session-history" aria-labelledby="session-history-title">
      <h2 id="session-history-title" className="title">Sessões declaradas</h2>
      <p className="quiet-note">Tempo que você iniciou e encerrou. O servidor confirma os blocos de 30 minutos; pausas não contam e a sessão não comprova estudo.</p>
      <ul>
        {[...state.studySessions].reverse().slice(0, 8).map(session => <li key={session.id}>
          <span className="session-history-dot"><Icon name="clock"/></span>
          <span className="session-history-copy">
            <strong>{session.label}</strong>
            <small>{new Date(session.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · tempo declarado</small>
          </span>
          <span className="session-history-time">{formatSessionDuration(session.durationMs)}</span>
        </li>)}
      </ul>
    </section>}

    {state.history.length ? <section className="history-list" aria-label="Histórico de passos">
      {[...state.history].reverse().map((entry, index) => <motion.article className="history-entry" key={entry.id} {...stagger(index)}>
        <span className={`history-dot ${entry.preparation ? 'prep' : 'done'}`}><Icon name={entry.preparation ? 'sprout' : 'check'}/></span>
        <div className="history-copy">
          <h2 className="title">{entry.title}</h2>
          <p className="muted-text">{entry.courseTitle}{entry.preparation && ' · Preparação; a etapa original não foi concluída'}</p>
        </div>
        <div className="history-date">
          <time dateTime={entry.at}>{new Date(entry.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</time>
          {state.preferences.gamification && entry.xp > 0 && <span className="xp-pill">+{entry.xp} XP de legado</span>}
          {state.preferences.gamification && account && entry.policy === 'v1' && <span className="xp-pill tone-muted">XP elegível no extrato</span>}
        </div>
      </motion.article>)}
    </section> : <Empty title="Sua história começa com um passo.">Quando você registrar uma etapa, ela aparece aqui.</Empty>}

    {legacy > 0 && <details className="legacy-details">
      <summary>Saldo legado: {legacy} XP (fora do nível e do ranking)</summary>
      <p className="quiet-note">Preparações, etapas e tarefas do protótipo somam {legacy} XP histórico. Esse saldo não é convertido, não entra no nível novo e não aparece em placares. Ele permanece guardado para não apagar seu histórico.</p>
    </details>}
  </div>;
}

export function Preferences({ state, update, notify, onPersonalize, account, go, xp, refreshXP }) {
  const [rankingBusy, setRankingBusy] = useState(false);
  const [backup, setBackup] = useState(null);
  const [backupName, setBackupName] = useState('');
  const [backupError, setBackupError] = useState('');
  const backupInput = useRef(null);
  function preference(key, value) {
    update(previous => ({ ...previous, preferences: { ...previous.preferences, [key]: value, ...(key === 'weeklyGoal' ? { weeklyGoalSource: 'manual' } : {}) } }));
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
  function sharingPreference(key, value) {
    update(previous => ({ ...previous, preferences: { ...previous.preferences, sharing: { ...previous.preferences.sharing, [key]: value } } }));
    notify('Privacidade do perfil atualizada.');
  }
  function toggleProject(course) {
    const open = course.shared !== true;
    update(previous => ({ ...previous, courses: previous.courses.map(item => item.id === course.id ? { ...item, shared: open } : item) }));
    notify(open ? 'Projeto marcado como público no seu perfil.' : 'Projeto voltou a ser privado.');
  }
  const sharing = state.preferences.sharing ?? {};
  const projects = state.courses.filter(course => course.type === 'project');
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lume-meu-caminho-${localDay(new Date())}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Cópia exportada. Para restaurar, escolha o arquivo em “Restaurar uma cópia”.');
  }
  async function chooseBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupError('');
    setBackup(null);
    try {
      const text = await file.text();
      const incoming = readBackup(text);
      setBackup({ incoming, summary: previewBackup(state, incoming) });
      setBackupName(file.name);
    } catch (error) {
      setBackupError(error.message || 'Não foi possível ler esta cópia.');
      setBackupName('');
    }
  }
  function applyBackup() {
    if (!backup) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}.before-import`, JSON.stringify(state));
    } catch { /* A cópia atual também permanece em memória. */ }
    update(mergeBackup(state, backup.incoming));
    notify('Cópia mesclada. O estado anterior foi guardado neste navegador.');
    setBackup(null);
    setBackupName('');
  }
  return <div className="personal-root">
    <Heading eyebrow="Autonomia & conforto" title="Do seu jeito">
      Escolha o que ajuda. Desative o que atrapalha.
    </Heading>
    <div className="settings-layout">
      <section className="card-surface settings-panel">
        <div className="panel-title"><span className="pace-icon"><Icon name="sun"/></span><div><h2 className="title">Aparência e conforto</h2><p className="muted-text">Ajuste o espaço para estudar com tranquilidade.</p></div></div>
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

      <div className="settings-column">
        <section className="card-surface settings-panel">
          <div className="panel-title"><span className="pace-icon"><Icon name="sprout"/></span><div><h2 className="title">Seu momento</h2><p className="muted-text">{studyRhythm(state).title}</p></div></div>
          <Button secondary onClick={onPersonalize}>Revisar perguntas iniciais<Icon name="arrow"/></Button>
          <label className="setting-row">
            <span><strong>Plano semanal</strong><span>Passos sugeridos, sem obrigação.</span></span>
            <select value={state.preferences.weeklyGoal} onChange={event => preference('weeklyGoal', Number(event.target.value))}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
          </label>
        </section>

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

        <section className="card-surface settings-panel" aria-labelledby="notifications-title">
          <div className="panel-title"><span className="pace-icon"><Icon name="mail"/></span><div><h2 className="title" id="notifications-title">Notificações e lembretes</h2><p className="muted-text">Ainda não disponíveis. Não há envio por e-mail, notificação nativa nem lembrete de pausa configurável.</p></div></div>
          <p className="quiet-note">Quando existirem, os lembretes serão opcionais e não concederão XP. Até lá, esta tela não finge um controle que ainda não funciona.</p>
        </section>

        <section className="card-surface settings-panel" aria-labelledby="sharing-title">
          <div className="panel-title"><span className="pace-icon"><Icon name="users"/></span><div><h2 className="title" id="sharing-title">O que amigos veem</h2><p className="muted-text">O perfil abre só para quem está na sua lista de amigos.</p></div></div>
          {[['library', 'Biblioteca', 'Materiais em estudo e concluídos.'], ['queue', 'Fila de estudo', 'O roteiro que aparece em Hoje.'], ['progress', 'Progresso', 'Aulas concluídas e percentuais.'], ['xp', 'XP e nível', 'Confirmados pelo servidor; o saldo legado fica fora.']].map(([key, label, hint]) => <label className="setting-row" key={key}>
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

        <section className="card-surface privacy-note">
          <div className="panel-title"><span className="pace-icon"><Icon name="shield"/></span><div><h2 className="title">Seu espaço, seu progresso.</h2></div></div>
          <p className="muted-text">{account ? 'Sua conta sincroniza a biblioteca e o XP elegível é confirmado no servidor. O saldo antigo do protótipo fica separado, fora do nível novo e do ranking.' : 'Na prévia, seu progresso fica neste navegador e o XP exibido é local. Você pode exportar uma cópia.'}</p>
          <p className="quiet-note">Não inclua senhas ou informações sensíveis nas suas etapas.</p>
          <button className="text-button accent" onClick={download}>Baixar cópia dos meus dados<Icon name="arrow"/></button>
          <div className="backup-restore">
            <strong className="title">Restaurar uma cópia</strong>
            <p className="muted-text">Mescla cursos, progresso, histórico e tarefas de um arquivo JSON. Suas preferências, privacidade e onboarding atuais não são substituídos.</p>
            <input ref={backupInput} type="file" accept=".json,application/json" className="sr-only" onChange={chooseBackup} aria-label="Escolher arquivo de cópia do Lume"/>
            <Button secondary onClick={() => backupInput.current?.click()}><Icon name="return"/>Escolher arquivo JSON</Button>
            {backupName && <p className="quiet-note">Arquivo: {backupName}</p>}
            {backupError && <p className="form-error" role="alert">{backupError}</p>}
            {backup && <div className="backup-preview">
              <p className="inline-note"><Icon name="info"/><span>Esta cópia acrescenta {backup.summary.newCourseCount} {backup.summary.newCourseCount === 1 ? 'material novo' : 'materiais novos'}, {backup.summary.newCompleted} {backup.summary.newCompleted === 1 ? 'conclusão' : 'conclusões'} e {backup.summary.newTasks} {backup.summary.newTasks === 1 ? 'tarefa' : 'tarefas'}. {backup.summary.unchanged > 0 ? `${backup.summary.unchanged} material(is) já existente(s) serão mesclados.` : ''}</span></p>
              {backup.summary.newCourses.length > 0 && <ul className="backup-course-list">{backup.summary.newCourses.map((title) => <li key={title}>{title}</li>)}</ul>}
              <div className="dialog-actions inline-actions">
                <Button onClick={applyBackup}><Icon name="check"/>Mesclar à minha biblioteca</Button>
                <Button secondary onClick={() => { setBackup(null); setBackupName(''); }}>Cancelar</Button>
              </div>
            </div>}
          </div>
        </section>
      </div>
    </div>
  </div>;
}
