import { useEffect, useRef, useState } from 'react';
import { nextAction } from '../../../public/study-plan.js';
import { focusedTask } from '../../../public/tasks-domain.js';
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

export default function FocusSession({ state, actions, settingsActions, open, notify, account }) {
  const active = state.activeSession;
  const focus = focusedTask(state);
  const suggestion = nextAction(state);
  const [courseId, setCourseId] = useState(() => active?.courseId || focus?.courseId || suggestion?.courseId || '');
  const [intention, setIntention] = useState('');
  const [cycle, setCycle] = useState(30);
  const [manual, setManual] = useState(false);
  const [custom, setCustom] = useState(25);
  const [offset, setOffset] = useState(0);
  const [sound, setSound] = useState(() => state.preferences?.soundscape || 'off');
  const [volume, setVolume] = useState(45);
  const [zenNotesOpen, setZenNotesOpen] = useState(true);
  const [notes, setNotes] = useState(() => state.preferences?.focusNotes || '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef(null);
  const chimed = useRef(false);

  const shieldEnabled = Boolean(state.preferences?.focusShield);

  useEffect(() => {
    setNotes(state.preferences?.focusNotes || '');
    setNotesDirty(false);
  }, [state.preferences?.focusNotes]);

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
  const eligibleBlocks = Math.floor(elapsed / BLOCK_MS);
  const today = minutesByDay(state, 1)[0];
  const goal = state.plan?.availability?.[new Date().getDay()] || state.preferences?.dailyMinutes || 0;

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
    settingsActions?.setPreference?.('soundscape', id);
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

  function saveNotes(value = notes) {
    if (!settingsActions?.setPreference) return;
    if (settingsActions.setPreference('focusNotes', value)) {
      setNotesDirty(false);
    }
  }

  function toggleShield(checked) {
    settingsActions?.setPreference?.('focusShield', checked);
  }

  function begin() {
    const label = intention.trim() || focus?.title || (lesson ? lesson.title : course?.title) || 'Sessão de foco';
    if (!actions.startSession({ courseId: course?.id || '', stepId: lesson?.lessonId || '', label })) return;
    setLastSummary(null);
    setOffset(0);
    chimed.current = false;
    if (sound && sound !== 'off') {
      sounds().setVolume(volume / 100);
      sounds().play(sound);
    }
  }

  function finish() {
    if (notesDirty) saveNotes(notes);
    const result = actions.endSession(Date.now());
    if (!result?.session) return;
    sounds().play('off');
    setOffset(0);
    chimed.current = false;
    setLastSummary({
      label: result.session.label || 'Sessão de foco',
      durationMs: result.session.durationMs,
      blocks: Math.floor(result.session.durationMs / BLOCK_MS),
    });
    notify(
      account
        ? `Sessão registrada: ${formatSessionDuration(result.session.durationMs)}. O servidor confirma os blocos de 30 minutos.`
        : `Sessão registrada: ${formatSessionDuration(result.session.durationMs)}. Nesta prévia o tempo fica local; entre na conta para o XP de tempo.`,
      { important: true },
    );
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
        <div className="focus-title-row">
          <h1 className="display">Sessão de foco</h1>
          <span className="soft-badge tone-mint">
            <span className="soft-dot" aria-hidden="true"/>
            {active ? (active.status === 'active' ? 'Em foco' : 'Pausada') : 'Pronta para começar'}
          </span>
          {shieldEnabled && active && <span className="soft-badge tone-lume"><Icon name="shield"/>Escudo ativo</span>}
        </div>
        <p className="lead">Escolha um ciclo, vincule seu material e estude em serenidade. Pausar não apaga nada.</p>
      </div>
      <div className="focus-goal">
        <span><small className="metric-label">Hoje</small><strong>{formatMinutes(today.minutes)}{goal ? ` / ${formatMinutes(goal)}` : ''}</strong></span>
        <span className="metric-icon"><Icon name="leaf"/></span>
      </div>
    </header>

    {lastSummary && <section className="card-surface focus-summary-banner" role="status" aria-label="Resumo da sessão encerrada">
      <div className="focus-summary-copy">
        <span className="soft-badge tone-mint"><Icon name="check"/>Sessão encerrada</span>
        <strong>{lastSummary.label}</strong>
        <p className="muted-text">
          Tempo focado: <strong>{formatSessionDuration(lastSummary.durationMs)}</strong> · {lastSummary.blocks} {lastSummary.blocks === 1 ? 'bloco de 30 min elegível' : 'blocos de 30 min elegíveis'}.
        </p>
      </div>
      <div className="focus-summary-actions">
        {course && <Button secondary onClick={openMaterial}><Icon name="book"/>Marcar avanço no material</Button>}
        <Button ghost onClick={() => setLastSummary(null)}>Fechar</Button>
      </div>
    </section>}

    <div className="focus-grid">
      <div className="focus-main-col">
        <section className="card-surface focus-timer crest-card" aria-labelledby="focus-cycle-title">
          <div className="focus-cycles">
            <div className="focus-cycles-head">
              <span id="focus-cycle-title" className="metric-label">Ciclos sugeridos</span>
              <span className="tone-mint-text"><Icon name="bolt"/>Ritmo flexível</span>
            </div>
            <div className="cycle-grid" role="group" aria-label="Duração do ciclo">
              {CYCLES.map((item) => <button key={item.minutes} type="button" className="cycle-pill" aria-pressed={!manual && cycle === item.minutes} onClick={() => chooseCycle(item.minutes)}>
                <strong>{item.minutes < 60 ? `${item.minutes} min` : '1h'}</strong><small>{item.title}</small>
              </button>)}
              <button type="button" className="cycle-pill" aria-pressed={manual} aria-expanded={manual} onClick={() => setManual(!manual)}>
                <strong><Icon name="settings"/>Manual</strong><small>Ajuste livre</small>
              </button>
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
              <defs>
                <linearGradient id="focus-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--mint)"/>
                  <stop offset="60%" stopColor="var(--lume-2)"/>
                  <stop offset="100%" stopColor="var(--lume)"/>
                </linearGradient>
              </defs>
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
            {active && <Button secondary onClick={restartCycle}><Icon name="restart"/>{finished ? 'Novo ciclo' : 'Reiniciar'}</Button>}
            {active && <Button secondary onClick={finish}><Icon name="check"/>Finalizar com resumo</Button>}
          </div>

          <dl className="focus-stats">
            <div><dt>Ciclos concluídos</dt><dd>{completedCycles}</dd></div>
            <div><dt>Tempo focado</dt><dd className="tone-mint-text">{formatSessionDuration(elapsed)}</dd></div>
            <div><dt>Blocos de 30 min</dt><dd className="tone-reward-text">{eligibleBlocks}</dd></div>
          </dl>
          <p className="quiet-note">
            {account
              ? 'Ao finalizar, o servidor confirma os blocos completos de 30 minutos (25 XP cada, limite diário de 200 XP). Pausas não contam.'
              : 'Na prévia o tempo fica apenas nesta página; entre na conta para validar o XP de tempo.'}
          </p>
        </section>

        <blockquote className="card-surface focus-quote-card">
          <Icon name="leaf"/>
          <div>
            <p>“O segredo da continuidade duradoura não está na pressa de fechar etapas, mas na calma em compreendê-las.”</p>
            <small>Seu ritmo permanece preservado em cada pausa.</small>
          </div>
        </blockquote>
      </div>

      <div className="focus-side">
        <section className="card-surface focus-panel" aria-labelledby="focus-material-title">
          <div className="card-heading">
            <div>
              <span className="card-icon"><Icon name="book"/></span>
              <h2 id="focus-material-title" className="title">Material de apoio vinculado</h2>
            </div>
          </div>
          {active
            ? <p className="muted-text">Sessão em andamento: <strong>{active.label}</strong>. Para trocar o material, finalize esta sessão antes.</p>
            : <label className="field">Material ou trilha
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                <option value="">Estudo livre, sem material</option>
                {state.courses.map((item) => <option key={item.id} value={item.id}>{item.title}{subjectOf(state, item) ? ` · ${subjectOf(state, item).title}` : ''}</option>)}
              </select>
            </label>}
          {course && <div className="focus-material">
            <span className="reading-icon"><Icon name={course.pdf ? 'file' : 'book'}/></span>
            <span className="focus-material-copy">
              <strong>{lesson && !course.pdf ? lesson.title : course.title}</strong>
              <small>{materialType(course.type).title} · {course.pdf ? materialStanding(state, course).label : lesson ? `Próximo passo de ${course.title}` : 'Material da biblioteca'}</small>
            </span>
            <button type="button" className="icon-button" onClick={openMaterial} aria-label={`Abrir ${course.title}`} title="Abrir material"><Icon name="external"/></button>
          </div>}
          {!active && <label className="field">Intenção desta sessão
            <input value={intention} maxLength={160} onChange={(event) => setIntention(event.target.value)} placeholder="Ex.: ler os artigos 102 e 103 e anotar três dúvidas"/>
          </label>}
        </section>

        <section className="card-surface focus-panel focus-zen-notes" aria-labelledby="focus-notes-title">
          <div className="card-heading">
            <div>
              <span className="card-icon tone-lume"><Icon name="notes"/></span>
              <h2 id="focus-notes-title" className="title">Anotações rápidas (modo Zen)</h2>
            </div>
            <button type="button" className="text-button" aria-expanded={zenNotesOpen} onClick={() => setZenNotesOpen(o => !o)}>
              {zenNotesOpen ? 'Recolher' : 'Abrir'}
            </button>
          </div>
          {zenNotesOpen && <>
            <label className="sr-only" htmlFor="zen-focus-notes">Anotações rápidas da sessão</label>
            <textarea
              id="zen-focus-notes"
              rows={4}
              maxLength={4000}
              value={notes}
              placeholder="Anote dúvidas, trechos importantes ou um lembrete para a próxima sessão…"
              onChange={(event) => { setNotes(event.target.value); setNotesDirty(true); }}
              onBlur={() => { if (notesDirty) saveNotes(); }}
            />
            <div className="zen-notes-foot">
              <small>{notesDirty ? 'Alterações pendentes — salvas ao sair do campo' : notes ? 'Salvo nas suas preferências' : 'Espaço livre para rascunhos'}</small>
              <div className="zen-notes-actions">
                {notes && <button type="button" className="text-button" onClick={() => { setNotes(''); saveNotes(''); }}>Limpar</button>}
                {notesDirty && <button type="button" className="chip-button" onClick={() => saveNotes()}>Salvar nota</button>}
              </div>
            </div>
          </>}
        </section>

        <section className="card-surface focus-panel" aria-labelledby="focus-sound-title">
          <div className="card-heading">
            <div>
              <span className="card-icon tone-mint"><Icon name="shield"/></span>
              <h2 id="focus-sound-title" className="title">Escudo e conforto sonoro</h2>
            </div>
            <span className="metric-label">Opcional</span>
          </div>

          <label className="focus-shield-row">
            <span>
              <strong>Escudo de foco absoluto</strong>
              <small>Silencia avisos não essenciais enquanto a sessão estiver ativa.</small>
            </span>
            <input type="checkbox" role="switch" switch="" checked={shieldEnabled} onChange={(event) => toggleShield(event.target.checked)}/>
          </label>

          <div className="sound-grid" role="group" aria-label="Som de fundo">
            {SOUNDSCAPES.map((item) => <button key={item.id} type="button" className="sound-chip" aria-pressed={sound === item.id} onClick={() => chooseSound(item.id)}>
              <Icon name={item.icon}/><span><strong>{item.title}</strong><small>{item.hint}</small></span>
            </button>)}
          </div>
          <label className="volume-row"><Icon name="mute"/><span className="sr-only">Volume</span><input type="range" min={0} max={100} value={volume} onChange={(event) => changeVolume(Number(event.target.value))}/><Icon name="volume"/></label>
          <p className="quiet-note">O som é sintetizado localmente no seu aparelho e interrompe ao sair da página.</p>
        </section>
      </div>
    </div>
  </div>;
}
