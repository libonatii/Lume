import { useEffect, useRef, useState } from 'react';
import { nextAction } from '../../../public/study-plan.js';
import { materialType } from '../../../public/domain.js';
import { materialStanding, subjectOf } from '../../../public/subject-domain.js';
import { formatMinutes, formatSessionDuration, minutesByDay, sessionElapsed } from '../../../public/session-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button } from '../../ui/ui.jsx';
import { SOUNDSCAPES, createSoundscape } from './soundscape.js';

// Ciclos sugeridos. O ciclo é só uma contagem regressiva sobre a sessão
// declarada: encerrar um ciclo não encerra a sessão nem gera XP.
const CYCLES = [
  { minutes: 10, title: 'Relâmpago' },
  { minutes: 15, title: 'Aquecimento' },
  { minutes: 30, title: 'Clássico' },
  { minutes: 60, title: 'Profunda' },
];
const RADIUS = 118;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const BLOCK_MS = 30 * 60 * 1000;

export default function FocusSession({ state, actions, open, go, notify, account }) {
  const active = state.activeSession;
  const suggestion = nextAction(state);
  const [courseId, setCourseId] = useState(() => active?.courseId || suggestion?.courseId || '');
  const [intention, setIntention] = useState('');
  const [cycle, setCycle] = useState(30);
  const [manual, setManual] = useState(false);
  const [custom, setCustom] = useState(25);
  const [offset, setOffset] = useState(0);
  const [sound, setSound] = useState('off');
  const [volume, setVolume] = useState(45);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef(null);
  const chimed = useRef(false);

  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const beat = setInterval(actions.touchSession, 60000);
    return () => { clearInterval(clock); clearInterval(beat); };
  }, [active?.id, active?.status, actions]);

  useEffect(() => () => audio.current?.close(), []);

  const course = state.courses.find((item) => item.id === courseId) || null;
  const lesson = course && suggestion?.courseId === course.id ? suggestion : null;
  const elapsed = active ? sessionElapsed(active, now) : 0;
  const cycleMs = cycle * 60000;
  const inCycle = Math.max(0, elapsed - offset);
  const remaining = Math.max(0, cycleMs - inCycle);
  const finished = Boolean(active) && remaining === 0;
  const progress = active ? Math.min(1, inCycle / cycleMs) : 0;
  const completedCycles = Math.floor(elapsed / cycleMs);
  const today = minutesByDay(state, 1)[0];
  const goal = state.plan?.availability?.[new Date().getDay()] || 0;

  useEffect(() => {
    if (!finished || chimed.current) return;
    chimed.current = true;
    audio.current ||= createSoundscape();
    audio.current.chime();
    notify('Ciclo concluído. Que tal uma pausa de 5 minutos? A sessão continua aberta até você encerrar.');
  }, [finished, notify]);

  function sounds() {
    audio.current ||= createSoundscape();
    return audio.current;
  }
  function chooseSound(id) {
    setSound(id);
    sounds().setVolume(volume / 100);
    sounds().play(id);
  }
  function changeVolume(value) {
    setVolume(value);
    sounds().setVolume(value / 100);
  }
  function chooseCycle(minutes) {
    setCycle(minutes);
    setManual(false);
    restartCycle();
  }
  function restartCycle() {
    setOffset(active ? elapsed : 0);
    chimed.current = false;
  }
  function begin() {
    const label = intention.trim() || (lesson ? lesson.title : course?.title) || 'Sessão de foco';
    if (!actions.startSession({ courseId: course?.id || '', stepId: lesson?.lessonId || '', label })) return;
    setOffset(0);
    chimed.current = false;
  }
  function finish() {
    const result = actions.endSession(Date.now());
    if (!result?.session) return;
    sounds().play('off');
    setSound('off');
    setOffset(0);
    chimed.current = false;
    notify(account
      ? `Sessão registrada: ${formatSessionDuration(result.session.durationMs)}. O servidor confirma os blocos de 30 minutos.`
      : `Sessão registrada: ${formatSessionDuration(result.session.durationMs)}. Nesta prévia o tempo fica local; entre na conta para o XP de tempo.`);
  }
  function openMaterial() {
    if (!course) return;
    if (course.pdf) open({ type: 'pdf', id: course.id });
    else if (lesson) open({ type: 'session', id: course.id, stepId: lesson.lessonId });
    else open({ type: 'course', id: course.id });
  }

  const digits = formatSessionDuration(active ? remaining : cycleMs);
  return <div className="focus-root">
    <header className="focus-heading">
      <div>
        <a className="back-link" href="#hoje"><Icon name="back"/>Voltar para Hoje</a>
        <div className="focus-title-row"><h1 className="display">Sessão de foco</h1><span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>{active ? (active.status === 'active' ? 'Em foco' : 'Pausada') : 'Pronta para começar'}</span></div>
        <p className="lead">Escolha um ciclo, diga o que vai estudar e comece. Pausar não apaga nada e não gera cobrança.</p>
      </div>
      <div className="focus-goal">
        <span><small className="metric-label">Hoje</small><strong>{formatMinutes(today.minutes)}{goal ? ` / ${formatMinutes(goal)}` : ''}</strong></span>
        <span className="metric-icon"><Icon name="leaf"/></span>
      </div>
    </header>

    <div className="focus-grid">
      <section className="card-surface focus-timer crest-card" aria-labelledby="focus-cycle-title">
        <div className="focus-cycles">
          <div className="focus-cycles-head"><span id="focus-cycle-title" className="metric-label">Ciclos sugeridos</span><span className="tone-mint-text"><Icon name="bolt"/>Ritmo flexível</span></div>
          <div className="cycle-grid" role="group" aria-label="Duração do ciclo">
            {CYCLES.map((item) => <button key={item.minutes} type="button" className="cycle-pill" aria-pressed={!manual && cycle === item.minutes} onClick={() => chooseCycle(item.minutes)}>
              <strong>{item.minutes < 60 ? `${item.minutes} min` : '1h'}</strong><small>{item.title}</small>
            </button>)}
            <button type="button" className="cycle-pill" aria-pressed={manual} aria-expanded={manual} onClick={() => setManual(!manual)}><strong><Icon name="settings"/>Manual</strong><small>Ajuste livre</small></button>
          </div>
          {manual && <div className="cycle-custom">
            <label htmlFor="focus-custom">Duração personalizada (minutos)</label>
            <div className="cycle-stepper">
              <button type="button" className="icon-button" aria-label="Menos 5 minutos" onClick={() => setCustom(Math.max(5, custom - 5))}><Icon name="minus"/></button>
              <input id="focus-custom" type="number" min={1} max={180} value={custom} onChange={(event) => setCustom(Math.max(1, Math.min(180, Number(event.target.value) || 1)))}/>
              <button type="button" className="icon-button" aria-label="Mais 5 minutos" onClick={() => setCustom(Math.min(180, custom + 5))}><Icon name="plus"/></button>
              <Button secondary onClick={() => { setCycle(custom); restartCycle(); }}>Aplicar</Button>
            </div>
          </div>}
        </div>

        <div className="focus-dial">
          <svg viewBox="0 0 280 280" aria-hidden="true" focusable="false">
            <defs><linearGradient id="focus-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--mint)"/><stop offset="60%" stopColor="var(--lume-2)"/><stop offset="100%" stopColor="var(--lume)"/></linearGradient></defs>
            <circle cx="140" cy="140" r={RADIUS} className="focus-dial-track"/>
            <circle cx="140" cy="140" r="98" className="focus-dial-well"/>
            <circle cx="140" cy="140" r={RADIUS} className="focus-dial-progress" stroke="url(#focus-gradient)" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - progress)}/>
          </svg>
          <div className="focus-dial-center">
            <span className="soft-badge tone-mint"><Icon name="leaf"/>Ciclo {completedCycles + 1}</span>
            <strong className="focus-digits" role="timer" aria-label={active ? `Faltam ${digits} no ciclo` : `Ciclo de ${cycle} minutos`}>{digits}</strong>
            <small>{finished ? 'Ciclo concluído. Pausa sugerida de 5 min.' : <>Pausa sugerida de <span className="tone-mint-text">5 min</span> após este ciclo</>}</small>
          </div>
        </div>

        <div className="focus-controls">
          {!active && <Button className="large" onClick={begin}><Icon name="play"/>Iniciar foco</Button>}
          {active && <Button className="large" secondary={active.status !== 'active'} onClick={actions.toggleSessionPause}><Icon name={active.status === 'active' ? 'pause' : 'play'}/>{active.status === 'active' ? 'Pausar' : 'Retomar'}</Button>}
          {active && <Button secondary onClick={restartCycle}><Icon name="restart"/>{finished ? 'Novo ciclo' : 'Reiniciar ciclo'}</Button>}
          {active && <Button secondary onClick={finish}><Icon name="check"/>Encerrar sessão</Button>}
        </div>

        <dl className="focus-stats">
          <div><dt>Ciclos completos</dt><dd>{completedCycles}</dd></div>
          <div><dt>Tempo declarado</dt><dd className="tone-mint-text">{formatSessionDuration(elapsed)}</dd></div>
          <div><dt>Blocos de 30 min</dt><dd className="tone-reward-text">{Math.floor(elapsed / BLOCK_MS)}</dd></div>
        </dl>
        <p className="quiet-note">{account ? 'Ao encerrar, o servidor confirma blocos de 30 minutos (25 XP cada, até 200 XP por dia). Pausas não contam.' : 'Na prévia o tempo fica só nesta página; entre na conta para validar o XP de tempo.'}</p>
      </section>

      <div className="focus-side">
        <section className="card-surface focus-panel" aria-labelledby="focus-material-title">
          <div className="card-heading"><div><span className="card-icon"><Icon name="book"/></span><h2 id="focus-material-title" className="title">O que você vai estudar?</h2></div></div>
          {active
            ? <p className="muted-text">Sessão em andamento: <strong>{active.label}</strong>. Para trocar o material, encerre e comece outra.</p>
            : <label className="field">Material ou trilha
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                <option value="">Estudo livre, sem material</option>
                {state.courses.map((item) => <option key={item.id} value={item.id}>{item.title}{subjectOf(state, item) ? ` · ${subjectOf(state, item).title}` : ''}</option>)}
              </select>
            </label>}
          {course && <div className="focus-material">
            <span className="reading-icon"><Icon name={course.pdf ? 'file' : 'book'}/></span>
            <span className="focus-material-copy"><strong>{lesson && !course.pdf ? lesson.title : course.title}</strong><small>{materialType(course.type).title} · {course.pdf ? materialStanding(state, course).label : lesson ? `Próximo passo de ${course.title}` : 'Material da biblioteca'}</small></span>
            <button type="button" className="icon-button" onClick={openMaterial} aria-label={`Abrir ${course.title}`} title="Abrir material"><Icon name="external"/></button>
          </div>}
          {!active && <label className="field">Intenção desta sessão
            <input value={intention} maxLength={160} onChange={(event) => setIntention(event.target.value)} placeholder="Ex.: ler os artigos 102 e 103 e anotar três dúvidas"/>
          </label>}
          {!active && <p className="quiet-note">A intenção vira o nome da sessão no seu histórico. Clareza vale mais que volume.</p>}
        </section>

        <section className="card-surface focus-panel" aria-labelledby="focus-sound-title">
          <div className="card-heading"><div><span className="card-icon tone-mint"><Icon name="wave"/></span><h2 id="focus-sound-title" className="title">Som de fundo</h2></div><span className="metric-label">Opcional</span></div>
          <div className="sound-grid" role="group" aria-label="Som de fundo">
            {SOUNDSCAPES.map((item) => <button key={item.id} type="button" className="sound-chip" aria-pressed={sound === item.id} onClick={() => chooseSound(item.id)}>
              <Icon name={item.icon}/><span><strong>{item.title}</strong><small>{item.hint}</small></span>
            </button>)}
          </div>
          <label className="volume-row"><Icon name="mute"/><span className="sr-only">Volume</span><input type="range" min={0} max={100} value={volume} onChange={(event) => changeVolume(Number(event.target.value))}/><Icon name="volume"/></label>
          <p className="quiet-note">O som é gerado no próprio aparelho e para quando você sai desta tela.</p>
        </section>
      </div>
    </div>
    <p className="today-quote"><Icon name="leaf"/><span>Respire fundo. Constância suave vale mais que esforço apressado.</span></p>
  </div>;
}
