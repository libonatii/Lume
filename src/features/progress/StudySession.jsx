import { useEffect, useState } from 'react';
import { formatSessionDuration, sessionElapsed } from '../../../public/session-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button } from '../../ui/ui.jsx';

// O relógio é informativo; o batimento evita contar dias de aba esquecida.
export default function StudySession({ active, actions, mission, notify, account }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const beat = setInterval(actions.touchSession, 60000);
    return () => { clearInterval(clock); clearInterval(beat); };
  }, [active?.id, active?.status, actions]);

  const elapsed = active ? sessionElapsed(active, now) : 0;
  const begin = () => actions.startSession({
    courseId: mission?.course?.id || '',
    stepId: mission?.step?.id || '',
    label: mission ? mission.step.title : 'Estudo livre',
  });
  const finish = () => {
    const result = actions.endSession(Date.now());
    if (result?.session) notify(account
      ? `Sessão registrada: ${formatSessionDuration(result.session.durationMs)}. O servidor confirma os blocos de 30 minutos.`
      : `Sessão registrada: ${formatSessionDuration(result.session.durationMs)}. Nesta prévia o tempo fica local; entre na conta para o XP de tempo.`);
  };

  return <section className={`card-surface session-bar ${active ? 'is-active' : ''}`} aria-labelledby="session-title">
    <span className={`session-dot ${active?.status === 'paused' ? 'is-paused' : ''}`} aria-hidden="true"/>
    <div className="session-copy">
      <span className="eyebrow">{active ? active.label : 'Tempo de estudo'}</span>
      <h2 id="session-title" className="title">{active ? (active.status === 'active' ? 'Sessão em andamento' : 'Sessão pausada') : 'Sessão de estudo'}</h2>
      <p className="muted-text">{active
        ? <>Tempo declarado: <strong className="session-clock" role="timer" aria-label="Tempo da sessão">{formatSessionDuration(elapsed)}</strong> · {active.courseId ? 'vinculado ao seu material' : 'sem material vinculado'}</>
        : 'Inicie ao começar a estudar e encerre ao terminar. Em uma conta, o servidor confirma blocos de 30 minutos (25 XP cada, até 200 XP por dia); pausas não contam.'}</p>
    </div>
    <div className="session-controls">
      {!active && <Button onClick={begin}><Icon name="play"/>Começar sessão</Button>}
      {active && <Button secondary onClick={actions.toggleSessionPause}><Icon name={active.status === 'active' ? 'pause' : 'play'}/>{active.status === 'active' ? 'Pausar' : 'Retomar'}</Button>}
      {active && <Button onClick={finish}><Icon name="check"/>Encerrar sessão</Button>}
    </div>
  </section>;
}
