import { useState } from 'react';
import { REMINDERS, shiftDate } from '../../../public/agenda-domain.js';
import { localDate } from '../../../public/tasks-domain.js';
import { nextAction } from '../../../public/study-plan.js';
import { weeklyMinutes } from '../../../public/schedule-domain.js';
import { formatMinutes } from '../../../public/session-domain.js';
import { subjectOf } from '../../../public/subject-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Progress } from '../../ui/ui.jsx';
import { browserZone, minutesOf, timeOf } from './calendar-model.js';

// Estilos de sessão: só compõem o título sugerido. A Agenda guarda o
// compromisso como Estudo; nada aqui gera XP.
const STYLES = [
  { id: 'reading', title: 'Leitura e teoria', text: 'Foco calmo, assimilação e reflexão.', icon: 'book' },
  { id: 'practice', title: 'Prática e questões', text: 'Exercícios, casos e fixação ativa.', icon: 'quiz' },
  { id: 'review', title: 'Revisão', text: 'Resumos, flashcards e retomada.', icon: 'restart' },
  { id: 'writing', title: 'Produção e escrita', text: 'Sínteses, redações, peças ou código.', icon: 'pen' },
];
const DURATIONS = [25, 45, 90, 120];

function addMinutes(time, minutes) {
  return timeOf(Math.min(minutesOf(time) + minutes, 23 * 60 + 45));
}

function dayLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ScheduleSession({ state, actions, confirmSave, notify, go }) {
  const today = localDate();
  const suggestion = nextAction(state);
  const [courseId, setCourseId] = useState(suggestion?.courseId || '');
  const [pickingMaterial, setPickingMaterial] = useState(false);
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('reading');
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(() => timeOf(Math.min(Math.ceil((new Date().getHours() * 60 + new Date().getMinutes() + 30) / 15) * 15, 22 * 60)));
  const [duration, setDuration] = useState(45);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminder, setReminder] = useState(15);
  const [silenceNotice, setSilenceNotice] = useState(true);
  const [linkTask, setLinkTask] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const course = state.courses.find((item) => item.id === courseId) || null;
  const lesson = course && suggestion?.courseId === course.id ? suggestion : null;
  const courseSubject = course ? subjectOf(state, course) : null;
  const styleTitle = STYLES.find((item) => item.id === style).title;
  const title = (topic.trim() || (course ? `${styleTitle}: ${course.title}` : styleTitle)).slice(0, 180);
  const end = addMinutes(start, duration);
  const minutes = minutesOf(end) - minutesOf(start);
  const weekEnd = shiftDate(today, 6);
  const planned = (state.agenda || [])
    .filter((item) => item.category === 'study' && !item.cancelled && item.start && item.date >= today && item.date <= weekEnd)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const plannedMinutes = planned.reduce((sum, item) => sum + Math.max(0, minutesOf(item.end) - minutesOf(item.start)), 0);
  const weekly = weeklyMinutes(state.plan || {});

  async function confirm(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    try {
      const tasks = linkTask && course ? [{ title: lesson ? lesson.title : `Estudar ${course.title}`, courseId: course.id, lessonId: lesson?.lessonId || '' }] : [];
      const appliedReminder = reminderEnabled ? reminder : -1;
      const result = actions.save({
        title,
        category: 'study',
        date,
        start,
        end,
        endDate: date,
        timeZone: browserZone(),
        reminder: appliedReminder,
        recurrence: 'none',
        taskIds: [],
        tasks,
      });
      if (!result) return;
      setSaving(true);
      await confirmSave();
      notify(`Sessão agendada: ${dayLabel(date)}, ${start} às ${end}.`);
      go('agenda');
    } catch (exception) { setError(exception.message); }
    finally { setSaving(false); }
  }

  return <form className="schedule-root" onSubmit={confirm}>
    <div className="schedule-top">
      <a className="back-link" href="#agenda"><Icon name="back"/>Voltar para a Agenda</a>
      <span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>Ritmo constante · foco sem sobrecarga</span>
    </div>
    <header className="schedule-heading">
      <h1 className="display">Agendar sessão de estudo</h1>
      <p className="lead">Defina o foco, vincule um material da Biblioteca e escolha o momento. A sessão entra na sua Agenda sem cobranças.</p>
    </header>

    <div className="schedule-grid">
      <div className="schedule-main">
        <section className="card-surface schedule-card crest-card" aria-labelledby="schedule-subject-title">
          <div className="schedule-card-head-row">
            <h2 id="schedule-subject-title" className="title"><span className="card-icon"><Icon name="book"/></span>1. Matéria e material de apoio</h2>
            {courseSubject && <span className="soft-badge tone-lume">{courseSubject.title}</span>}
          </div>

          <div className="schedule-linked-box">
            <span className="reading-icon"><Icon name={course?.pdf ? 'file' : 'book'}/></span>
            <div className="schedule-linked-copy">
              <small>Vincular material de apoio</small>
              <strong>{course ? course.title : 'Estudo livre, sem material vinculado'}</strong>
              <span>{course ? (lesson ? `Próxima etapa: ${lesson.title}` : course.pdf ? `${course.pdf.pages} páginas` : 'Material da Biblioteca') : 'Você pode escolher um curso ou PDF abaixo'}</span>
            </div>
            <button type="button" className="chip-button" onClick={() => setPickingMaterial((v) => !v)} aria-expanded={pickingMaterial}>
              {pickingMaterial ? 'Fechar' : 'Trocar'}
            </button>
          </div>

          {(pickingMaterial || !course) && <label className="field">Escolher material ou trilha
            <select value={courseId} onChange={(event) => { setCourseId(event.target.value); setPickingMaterial(false); }}>
              <option value="">Estudo livre, sem material</option>
              {state.courses.map((item) => <option key={item.id} value={item.id}>{item.title}{subjectOf(state, item) ? ` · ${subjectOf(state, item).title}` : ''}</option>)}
            </select>
          </label>}

          <label className="field">Tópico ou atividade
            <input value={topic} maxLength={180} onChange={(event) => setTopic(event.target.value)} placeholder={lesson ? lesson.title : 'Ex.: controle de constitucionalidade'}/>
          </label>
        </section>

        <section className="card-surface schedule-card" aria-labelledby="schedule-style-title">
          <h2 id="schedule-style-title" className="title"><span className="card-icon"><Icon name="spark"/></span>2. Estilo da sessão</h2>
          <div className="style-grid" role="radiogroup" aria-label="Estilo da sessão">
            {STYLES.map((item) => <button key={item.id} type="button" role="radio" aria-checked={style === item.id} className="style-card" onClick={() => setStyle(item.id)}>
              <span className="style-card-top"><span className="reading-icon"><Icon name={item.icon}/></span><span className="style-check" aria-hidden="true">{style === item.id && <Icon name="check"/>}</span></span>
              <strong>{item.title}</strong><small>{item.text}</small>
            </button>)}
          </div>
        </section>

        <section className="card-surface schedule-card" aria-labelledby="schedule-time-title">
          <h2 id="schedule-time-title" className="title"><span className="card-icon"><Icon name="calendar"/></span>3. Momento e duração</h2>
          <div className="day-chips" role="group" aria-label="Dia">
            {[[today, 'Hoje'], [shiftDate(today, 1), 'Amanhã']].map(([value, label]) => <button key={value} type="button" className="day-chip" aria-pressed={date === value} onClick={() => setDate(value)}>{label} <small>{new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small></button>)}
            <label className="day-chip day-chip-date"><Icon name="calendar"/><span className="sr-only">Escolher data</span><input type="date" min={today} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} aria-label="Data da sessão"/></label>
          </div>
          <div className="form-grid">
            <label className="field">Início<input type="time" step={900} value={start} onChange={(event) => event.target.value && setStart(event.target.value)} required/></label>
            <label className="field">Término<input type="time" value={end} readOnly aria-describedby="schedule-end-note"/></label>
          </div>
          <div className="duration-pills" role="group" aria-label="Duração">
            {DURATIONS.map((value) => <button key={value} type="button" className="duration-pill" aria-pressed={duration === value} onClick={() => setDuration(value)}>{formatMinutes(value)}{value === 45 ? ' · sugerido' : ''}</button>)}
          </div>
          <p id="schedule-end-note" className="inline-note"><Icon name="clock"/><span>Sessões de até 1h30 com uma pausa no meio costumam ser mais confortáveis. O término segue a duração escolhida.</span></p>
        </section>
      </div>

      <aside className="schedule-side">
        <section className="card-surface schedule-card" aria-labelledby="schedule-comfort-title">
          <h2 id="schedule-comfort-title" className="title"><span className="card-icon tone-mint"><Icon name="bell"/></span>Conforto &amp; Foco</h2>

          <label className="toggle-row">
            <span><strong>Lembrete suave antes</strong><small>Avisa com o Lume aberto no navegador ou app.</small></span>
            <input type="checkbox" role="switch" switch="" checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)}/>
          </label>

          {reminderEnabled && <label className="field">Antecedência do aviso
            <select value={reminder} onChange={(event) => setReminder(Number(event.target.value))}>
              {REMINDERS.filter((v) => v >= 0).map((value) => <option key={value} value={value}>{value === 0 ? 'No início da sessão' : `${value} minutos antes`}</option>)}
            </select>
          </label>}

          <label className="toggle-row">
            <span><strong>Tom tranquilo na preparação</strong><small>Mantém avisos discretos durante a sessão.</small></span>
            <input type="checkbox" role="switch" switch="" checked={silenceNotice} onChange={(event) => setSilenceNotice(event.target.checked)}/>
          </label>

          {course && <label className="toggle-row">
            <span><strong>Criar tarefa vinculada</strong><small>{lesson ? `Concluir a tarefa conclui “${lesson.title}”.` : 'Inclui tarefa ligada ao material no checklist.'}</small></span>
            <input type="checkbox" role="switch" switch="" checked={linkTask} onChange={(event) => setLinkTask(event.target.checked)}/>
          </label>}
        </section>

        <section className="card-surface schedule-summary" aria-labelledby="schedule-summary-title">
          <div className="schedule-summary-head"><h2 id="schedule-summary-title" className="metric-label">Resumo do Santuário</h2><span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>Pronto para confirmar</span></div>
          <dl className="summary-list">
            <div><dt><Icon name="calendar"/>Quando</dt><dd>{dayLabel(date)} · {start} às {end} ({formatMinutes(minutes)})</dd></div>
            <div><dt><Icon name="book"/>O quê</dt><dd>{title}</dd></div>
            <div><dt><Icon name="trend"/>Meta semanal</dt><dd>
              {weekly
                ? <><Progress value={Math.min(weekly, plannedMinutes + minutes)} max={weekly} tone="mint" label="Tempo agendado na semana"/><small>{formatMinutes(plannedMinutes + minutes)} agendados de {formatMinutes(weekly)} disponíveis no seu Plano</small></>
                : <small>{formatMinutes(plannedMinutes + minutes)} de estudo agendados nos próximos 7 dias</small>}
            </dd></div>
          </dl>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" className="full-width large" disabled={saving}><Icon name="check"/>{saving ? 'Salvando…' : 'Confirmar agendamento'}</Button>
          <a className="text-button centered" href="#agenda">Descartar e voltar</a>
        </section>

        <section className="card-surface schedule-card" aria-labelledby="schedule-week-title">
          <div className="card-heading"><div><h2 id="schedule-week-title" className="title">Já agendadas nesta semana</h2></div><span className="metric-label">{planned.length}</span></div>
          {planned.length
            ? <ul className="planned-list">{planned.slice(0, 4).map((item) => <li key={item.id}><span className="soft-dot tone-mint-text" aria-hidden="true"/><span><strong>{item.title}</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}, {item.start} · {formatMinutes(minutesOf(item.end) - minutesOf(item.start))}</small></span></li>)}</ul>
            : <p className="muted-text">Nenhuma sessão de estudo marcada nos próximos 7 dias.</p>}
        </section>
      </aside>
    </div>
  </form>;
}
