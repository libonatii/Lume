import { useMemo, useState } from 'react';
import {
  DAY_MINUTE_OPTIONS, WEEKDAYS, buildSchedule, normalizePlan, suggestedAvailability,
} from '../../../public/schedule-domain.js';
import { studyPlan } from '../../../public/study-plan.js';
import { TASK_PRIORITIES, localDate } from '../../../public/tasks-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Empty, Heading } from '../../ui/ui.jsx';
import { Milestones, WeeklyRhythm } from '../library/Study.jsx';
import { weeklyRhythm } from '../../../public/session-domain.js';

export function formatMinutes(total) {
  const value = Math.max(0, Math.round(total));
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${String(minutes).padStart(2, '0')} min` : `${hours} h`;
}

function dayLabel(date, today) {
  if (date === today) return 'Hoje';
  const label = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shortDate(date) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : '';
}

function addDaysIso(isoDate, delta) {
  const base = new Date(`${isoDate}T12:00:00`);
  base.setDate(base.getDate() + delta);
  return base.toISOString().slice(0, 10);
}

// Cronograma: o que estudar em cada dia disponível, recalculado a partir de hoje
// sempre que o progresso, a disponibilidade, um prazo ou uma prioridade mudam.
export function Schedule({ state, actions, open, notify }) {
  const today = localDate();
  const plan = normalizePlan(state.plan);
  const schedule = useMemo(() => buildSchedule(state, { today }), [state, today]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState('week');
  const [selectedDay, setSelectedDay] = useState(today);
  const [showConfig, setShowConfig] = useState(true);

  const hasAvailability = schedule.weeklyMinutes > 0;
  const lastFinish = schedule.courses.map((course) => course.finish).filter(Boolean).sort().at(-1);
  const dayMap = useMemo(() => new Map(schedule.days.map((d) => [d.date, d])), [schedule.days]);
  const weekDays = useMemo(() => {
    const start = addDaysIso(today, weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDaysIso(start, i);
      const entry = dayMap.get(date);
      const dt = new Date(`${date}T12:00:00`);
      const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3);
      return {
        date,
        weekday: wd.charAt(0).toUpperCase() + wd.slice(1),
        dayNum: String(dt.getDate()).padStart(2, '0'),
        used: entry?.used || 0,
        capacity: entry?.capacity ?? (plan.availability[dt.getDay()] || 0),
        items: entry?.items || [],
      };
    });
  }, [today, weekOffset, dayMap, plan.availability]);

  const activeDay = weekDays.find((d) => d.date === selectedDay) || weekDays[0];
  const visibleDays = viewMode === 'day'
    ? (activeDay ? [activeDay] : [])
    : viewMode === 'week'
      ? weekDays.filter((d) => d.items.length > 0 || d.date === today)
      : schedule.days.slice(0, 10);
  const firstItem = schedule.days[0]?.items[0];
  const weekRangeLabel = `${shortDate(weekDays[0]?.date)} – ${shortDate(weekDays[6]?.date)}`;

  function postpone(item, date) {
    const result = actions.postponeLesson(item.lessonId, date);
    if (!result) return;
    const { target } = result;
    notify(`${item.title} foi para ${shortDate(target)}. As aulas seguintes de ${item.courseTitle} acompanham.`);
  }

  return <div className="personal-root plan-root">
    <Heading
      title="Plano"
      eyebrow="Plano de estudos · Cronograma"
      actions={<>
        <button type="button" className="button secondary" onClick={() => setShowConfig((v) => !v)} aria-expanded={showConfig}>
          <Icon name="tune"/>Disponibilidade e prazos
        </button>
        <a className="button primary" href="#agendar"><Icon name="calendar-plus"/>Agendar sessão</a>
      </>}
    >
      {!schedule.courses.length
        ? 'Adicione um curso à biblioteca para montar o cronograma.'
        : hasAvailability
          ? <>Você reservou <strong>{formatMinutes(schedule.weeklyMinutes)} por semana</strong>. Faltam {formatMinutes(schedule.totalMinutes)} de estudo{lastFinish && !schedule.unscheduled ? <>, com conclusão prevista em <strong>{shortDate(lastFinish)}</strong></> : ''}.</>
          : 'Defina quanto tempo você tem em cada dia da semana para distribuir as aulas.'}
    </Heading>

    {schedule.conflicts.map((conflict) => <section key={conflict.courseId} className="card-surface plan-conflict" role="status" aria-labelledby={`conflict-${conflict.courseId}`}>
      <h2 id={`conflict-${conflict.courseId}`} className="title"><Icon name="flag"/>O prazo de {conflict.title} não cabe no plano atual</h2>
      <p className="muted-text">Faltam {formatMinutes(conflict.neededMinutes)} de estudo (contando o que vem antes na ordem) e há {formatMinutes(conflict.availableMinutes)} disponíveis até {shortDate(conflict.deadline)}. {conflict.finish ? `No ritmo atual, termina em ${shortDate(conflict.finish)}.` : 'No ritmo atual, não termina nos próximos seis meses.'}</p>
      <div className="action-row">
        <Button secondary onClick={() => { if (actions.increaseWeekly(conflict.extraWeeklyMinutes)) notify(`Disponibilidade aumentada em ${formatMinutes(conflict.extraWeeklyMinutes)} por semana.`); }}>Aumentar {formatMinutes(conflict.extraWeeklyMinutes)} por semana</Button>
        {conflict.finish && <Button secondary onClick={() => { if (actions.setGoal(conflict.courseId, { deadline: conflict.finish })) notify(`Prazo de ${conflict.title} ajustado para ${shortDate(conflict.finish)}.`); }}>Mudar o prazo para {shortDate(conflict.finish)}</Button>}
        {!conflict.prioritized && <Button secondary onClick={() => { if (actions.setGoal(conflict.courseId, { priority: 1 })) notify(`${conflict.title} passou para prioridade alta.`); }}>Dar prioridade alta a este curso</Button>}
      </div>
      <p className="quiet-note">Nenhum ajuste é aplicado sem a sua escolha.</p>
    </section>)}

    <div className="plan-layout">
      <div className="plan-main">
        {!schedule.courses.length ? (
          <Empty icon="calendar" title="Sem cursos em andamento." onAdd={() => open({ type: 'new' })}>
            Importe um curso por link ou crie um material; o cronograma usa as aulas e as durações encontradas.
          </Empty>
        ) : !hasAvailability ? (
          <section className="card-surface plan-setup">
            <h2 className="title">Quanto tempo você tem por semana?</h2>
            <p className="muted-text">O cronograma distribui {schedule.unscheduled} aulas na sua disponibilidade. Comece pela sugestão e ajuste os dias abaixo.</p>
            <div className="action-row">
              <Button onClick={() => { if (actions.useSuggestedAvailability()) notify('Disponibilidade definida. Ajuste os dias quando quiser.'); }}>
                Usar segunda a sexta, {suggestedAvailability(state)[1]} min por dia
              </Button>
            </div>
          </section>
        ) : <>
          <section className="card-surface stitch-plan-strip-card" aria-labelledby="plan-days-title">
            <div className="stitch-plan-toolbar">
              <div className="stitch-plan-nav-group">
                <button type="button" className="icon-button" aria-label="Semana anterior" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0}>
                  <Icon name="chevron"/>
                </button>
                <div className="stitch-plan-range">
                  <h2 id="plan-days-title" className="title">Distribuição dos blocos</h2>
                  <small>{weekRangeLabel}</small>
                </div>
                <button type="button" className="icon-button is-next" aria-label="Próxima semana" onClick={() => setWeekOffset((w) => Math.min(8, w + 1))}>
                  <Icon name="chevron"/>
                </button>
              </div>
              <div className="segmented" role="group" aria-label="Visualização do cronograma">
                {[['week', 'Semana'], ['day', 'Dia'], ['list', 'Lista']].map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={viewMode === id} onClick={() => setViewMode(id)}>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="stitch-week-strip" role="group" aria-label="Dias da semana">
              {weekDays.map((day) => {
                const isSelected = activeDay?.date === day.date;
                const isToday = day.date === today;
                return <button
                  key={day.date}
                  type="button"
                  className={`stitch-week-pill ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => { setSelectedDay(day.date); if (viewMode === 'list') setViewMode('day'); }}
                >
                  <span className="stitch-week-wd">{day.weekday}</span>
                  <strong className="stitch-week-num">{day.dayNum}</strong>
                  <small className="stitch-week-load">{day.items.length ? `${day.items.length} · ${formatMinutes(day.used)}` : day.capacity ? 'livre' : 'pausa'}</small>
                </button>;
              })}
            </div>
          </section>

          <section className="plan-days">
            {schedule.unscheduled > 0 && <p className="quiet-note">{schedule.unscheduled} aulas ficam além de seis meses</p>}
            {visibleDays.length ? <ol className="plan-day-list">
              {visibleDays.map((day) => <li key={day.date} className={`card-surface plan-day${day.date === today ? ' is-today' : ''}`}>
                <div className="plan-day-head">
                  <strong>{dayLabel(day.date, today)}</strong>
                  <span className="soft-badge">{formatMinutes(day.used)} de {formatMinutes(day.capacity)}</span>
                </div>
                {day.items.length ? <ul className="plan-items">
                  {day.items.map((item) => <li key={item.lessonId} className="plan-item">
                    <span className="plan-item-copy">
                      <strong>{item.title}</strong>
                      <small className="todo-meta">{item.courseTitle} · {formatMinutes(item.minutes)} {item.durationKnown ? '(duração da fonte)' : '(estimativa)'}{item.overflow ? ' · maior que o tempo do dia' : ''}</small>
                    </span>
                    <div className="plan-item-actions">
                      {item === firstItem && <Button onClick={() => open({ type: 'session', id: item.courseId, stepId: item.lessonId })}><Icon name="play"/>Estudar</Button>}
                      <button type="button" className="text-button" aria-label={`Adiar ${item.title}`} onClick={() => postpone(item, day.date)}>Adiar</button>
                    </div>
                  </li>)}
                </ul> : <p className="quiet-note">Nenhum bloco programado para este dia.</p>}
              </li>)}
            </ol> : <p className="muted-text">Nenhum bloco programado para os dias filtrados.</p>}
            <p className="quiet-note">{schedule.criteria}</p>
          </section>
        </>}

        <section className={`card-surface plan-settings ${!hasAvailability || showConfig ? 'is-expanded' : 'is-compact'}`} aria-labelledby="plan-settings-title">
          <div className="plan-settings-head">
            <h2 id="plan-settings-title" className="title">Disponibilidade e prazos</h2>
            {hasAvailability && <button type="button" className="text-button" onClick={() => setShowConfig((v) => !v)}>{showConfig ? 'Recolher' : 'Editar horários'}</button>}
          </div>
          <div className="availability-grid" role="group" aria-label="Minutos por dia da semana">
            {WEEKDAYS.map((day) => <label key={day.id} className="field availability-day">{day.label}
              <select value={String(plan.availability[day.id] || 0)} onChange={(event) => actions.setAvailability(day.id, event.target.value)}>
                {[...new Set([...DAY_MINUTE_OPTIONS, plan.availability[day.id] || 0])].sort((a, b) => a - b).map((minutes) => <option key={minutes} value={minutes}>{minutes ? formatMinutes(minutes) : 'Sem estudo'}</option>)}
              </select>
            </label>)}
          </div>
          {schedule.courses.length > 0 && <div className="goal-list">
            {schedule.courses.map((course) => <div key={course.courseId} className="goal-row">
              <span className="goal-title"><strong>{course.title}</strong><small className="todo-meta">{course.remaining} aulas · {formatMinutes(course.remainingMinutes || 0)}{course.finish ? ` · termina em ${shortDate(course.finish)}` : ''}</small></span>
              <label className="field">Prazo
                <input type="date" value={plan.goals[course.courseId]?.deadline || ''} onChange={(event) => actions.setGoal(course.courseId, { deadline: event.target.value })}/>
              </label>
              <label className="field">Prioridade
                <select value={String(plan.goals[course.courseId]?.priority || 0)} onChange={(event) => actions.setGoal(course.courseId, { priority: event.target.value })}>
                  {TASK_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>)}
          </div>}
          <p className="quiet-note">Planejar, adiar e priorizar organizam o estudo e não geram XP. Pausar um curso na biblioteca tira suas aulas do cronograma sem apagar o progresso.</p>
        </section>
      </div>

      <aside className="plan-aside" aria-label="Ritmo e marcos">
        <WeeklyRhythm rhythm={weeklyRhythm(state)}/>
        <Milestones state={state}/>
        <div className="card-surface plan-cadence-note">
          <a className="text-link" href="#agenda">Ver todos os prazos no calendário completo<Icon name="arrow"/></a>
          <p className="quiet-note">Dias sem estudo redistribuem as aulas seguintes sem penalidade.</p>
        </div>
      </aside>
    </div>
  </div>;
}

// Roteiro: a próxima aula de cada curso ativo, com o motivo da ordem. Usa o
// mesmo critério da página Hoje e do programa de desktop.
export function Roadmap({ state, open }) {
  const plan = studyPlan(state, { limit: 20 });
  return <div className="personal-root">
    <Heading title="Roteiro" eyebrow="Plano">{plan.criteria}</Heading>
    {plan.courses.length ? <ol className="roadmap-list">
      {plan.courses.map((course) => <li key={course.id} className="card-surface roadmap-item">
        <span className="eyebrow">{course.reason.label} · {course.source}</span>
        <h2 className="title">{course.next?.title || 'Sem aula pendente'}</h2>
        <p className="muted-text">{course.title} · {course.remaining} de {course.total} restantes{course.partial ? ' · grade parcial' : ''}. {course.reason.detail}</p>
        {course.next && <div className="action-row"><Button secondary onClick={() => open({ type: 'session', id: course.id, stepId: course.next.id })}>Estudar esta aula<Icon name="arrow"/></Button></div>}
      </li>)}
    </ol> : <Empty icon="calendar" title="Nenhum curso em andamento." onAdd={() => open({ type: 'new' })}>{plan.note}</Empty>}
  </div>;
}
