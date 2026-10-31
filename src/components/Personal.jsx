import { motion } from 'motion/react';
import Atropos from 'atropos/react';
import { achievements, courseProgress, courseStatus, levelInfo, localDay, nextMission, studyRhythm } from '../../public/domain.js';
import { formatSessionDuration } from '../../public/session-domain.js';
import Icon from './Icon.jsx';
import { AnimatedNumber, Button, Cover, Empty, Glow, Heading, Progress, Ring, stagger } from './ui.jsx';
import Companion from './Companion.jsx';

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

export function Achievements({ state }) {
  const all = achievements(state);
  const level = levelInfo(state);
  const unlockedCount = all.filter(item => item.unlocked).length;
  return <div className="personal-root">
    <Heading eyebrow="Marcos permanentes" title="Sua vitrine de conquistas">
      Memórias do caminho que você percorreu.
    </Heading>
    <p className="inline-note"><Icon name="spark"/><span>Esta vitrine e o XP ainda usam o modelo legado do protótipo. Conquistas personalizadas por material e a nova política de estudo estão planejadas.</span></p>
    {state.preferences.gamification ? <>
      <section className="achievement-summary">
        <Glow palette="lume"/>
        <div className="achievement-summary-body">
          <div className="trophy-emblem"><Icon name="trophy"/></div>
          <div className="achievement-summary-copy">
            <span className="eyebrow on-glow">Seu progresso fica com você</span>
            <h2 className="headline">{unlockedCount} de {all.length} conquistas</h2>
            <p className="muted-text">Nível {level.level} · <AnimatedNumber value={level.total}/> XP de legado</p>
          </div>
          <Ring value={unlockedCount} max={all.length} size={82} stroke={7} label="Conquistas desbloqueadas">
            <strong>{unlockedCount}/{all.length}</strong>
          </Ring>
        </div>
      </section>
      <div className="achievement-grid">
        {all.map((item, index) => {
          const card = <article className={`achievement-card ${item.unlocked ? 'unlocked' : ''}`}>
            <div className="achievement-card-top">
              <div className="achievement-icon"><Icon name={item.icon}/></div>
              <span className="achievement-status">{item.unlocked ? 'CONQUISTADA' : 'UMA POSSIBILIDADE'}</span>
            </div>
            <h2 className="title">{item.title}</h2>
            <p className="muted-text">{item.text}</p>
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
    </> : <Empty title="Um caminho sem pontuação.">Você ocultou os indicadores. Seu histórico continua guardado.</Empty>}
  </div>;
}

export function History({ state }) {
  const days = new Set(state.history.map(entry => localDay(entry.at))).size;
  const completedCourses = state.courses.filter(course => courseStatus(state, course) === 'completed').length;
  return <div className="personal-root">
    <Heading eyebrow="Memória de estudo" title="Meu caminho">
      Seu histórico é uma memória de progresso, não uma lista de cobranças.
    </Heading>
    <div className="history-stats">
      <div className="card-surface stat-card"><span className="eyebrow">Passos registrados</span><strong className="stat-value"><AnimatedNumber value={state.history.length}/></strong><small className="muted-text">Avanços anotados no seu tempo</small></div>
      <div className="card-surface stat-card"><span className="eyebrow">Dias com descobertas</span><strong className="stat-value"><AnimatedNumber value={days}/></strong><small className="muted-text">Sem exigir dias seguidos</small></div>
      <div className="card-surface stat-card"><span className="eyebrow">Cursos concluídos</span><strong className="stat-value"><AnimatedNumber value={completedCourses}/></strong><small className="muted-text">Trilhas percorridas até o fim</small></div>
    </div>
    {(state.studySessions || []).length > 0 && <section className="session-history" aria-labelledby="session-history-title">
      <h2 id="session-history-title" className="title">Sessões declaradas</h2>
      <p className="quiet-note">Tempo que você iniciou e encerrou. Não é observação de atividade e não gera XP.</p>
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
          {state.preferences.gamification && <span className="xp-pill">+{entry.xp} XP de legado</span>}
        </div>
      </motion.article>)}
    </section> : <Empty title="Sua história começa com um passo.">Quando você registrar uma etapa, ela aparece aqui.</Empty>}
  </div>;
}

export function Preferences({ state, update, notify, onPersonalize, account, go }) {
  function preference(key, value) {
    update(previous => ({ ...previous, preferences: { ...previous.preferences, [key]: value, ...(key === 'weeklyGoal' ? { weeklyGoalSource: 'manual' } : {}) } }));
    notify('Preferência salva. Seu espaço, do seu jeito.');
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lume-meu-caminho-${localDay(new Date())}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Cópia exportada. A importação ainda não foi implementada.');
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

        <section className="card-surface privacy-note">
          <div className="panel-title"><span className="pace-icon"><Icon name="shield"/></span><div><h2 className="title">Seu espaço, seu progresso.</h2></div></div>
          <p className="muted-text">{account ? 'Sua conta pode sincronizar uma cópia da biblioteca. O XP ainda é calculado no navegador pelo modelo legado e não é válido para um placar compartilhado.' : 'Na prévia, seu progresso fica neste navegador. Você pode exportar uma cópia.'}</p>
          <p className="quiet-note">Não inclua senhas ou informações sensíveis nas suas etapas.</p>
          <button className="text-button accent" onClick={download}>Baixar cópia dos meus dados<Icon name="arrow"/></button>
        </section>

        <Companion account={account} notify={notify} go={go}/>
      </div>
    </div>
  </div>;
}
