import { useMemo, useState } from 'react';
import {
  DAY_MINUTE_OPTIONS, WEEKDAYS, buildSchedule, normalizePlan, suggestedAvailability,
} from '../../../public/schedule-domain.js';
import { TASK_PRIORITIES, localDate } from '../../../public/tasks-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Empty, Progress } from '../../ui/ui.jsx';
import SectionTabs from '../../app/SectionTabs.jsx';
import { activeCompletions } from '../../../public/progress-domain.js';
import { localDay, minutesByDay } from '../../../public/session-domain.js';
import { CATEGORIES } from '../../../public/agenda-domain.js';
import { minutesOf } from '../agenda/calendar-model.js';

export function formatMinutes(total) {
  const value = Math.max(0, Math.round(total));
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${String(minutes).padStart(2, '0')} min` : `${hours} h`;
}

function shortDate(date) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : '';
}

function addDaysIso(isoDate, delta) {
  const base = new Date(`${isoDate}T12:00:00`);
  base.setDate(base.getDate() + delta);
  return localDay(base);
}

// Plano de Estudos (Stitch "Plano de Estudos (Agenda)"): faixa de datas com
// Semana, Dia e Mês; distribuição dos blocos à esquerda; ritmo e marcos à
// direita. Os blocos vêm do cronograma (aulas sem horário), da Agenda
// (compromissos com horário) e das conclusões do dia. Nada aqui gera XP.
export function Schedule({ state, actions, open, go, notify }) {
  const today = localDate();
  const plan = normalizePlan(state.plan);
  const schedule = useMemo(() => buildSchedule(state, { today }), [state, today]);
  const firstScheduled = schedule.days.find((day) => day.items.length)?.date || today;
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState(null);
  const selected = picked || firstScheduled;
  const setSelected = setPicked;
  const [showConfig, setShowConfig] = useState(false);

  const hasAvailability = schedule.weeklyMinutes > 0;
  const lastFinish = schedule.courses.map((course) => course.finish).filter(Boolean).sort().at(-1);
  const dayMap = useMemo(() => new Map(schedule.days.map((day) => [day.date, day])), [schedule.days]);
  const studied = useMemo(() => new Map(minutesByDay(state, 60).map((day) => [day.date, day.minutes])), [state]);
  const completions = useMemo(() => activeCompletions(state).filter((event) => !event.historical && event.at), [state]);
  const weekStart = startOfWeek(anchor);
  const week = Array.from({ length: 7 }, (_, index) => addDaysIso(weekStart, index));
  const firstItem = schedule.days[0]?.items[0];

  function blocksOf(date) {
    const planned = (dayMap.get(date)?.items || []).map((item) => ({ kind: 'lesson', key: item.lessonId, item }));
    const appointments = (state.agenda || [])
      .filter((entry) => entry.date === date && !entry.cancelled)
      .sort((a, b) => (a.start || '99').localeCompare(b.start || '99'))
      .map((entry) => ({ kind: 'appointment', key: entry.id, entry }));
    const done = completions
      .filter((event) => localDay(Date.parse(event.at)) === date)
      .map((event) => ({ kind: 'done', key: event.id, event }));
    return [...done, ...appointments, ...planned];
  }
  const summaryOf = (date) => {
    const blocks = blocksOf(date);
    const pending = blocks.filter((block) => block.kind === 'lesson' || (block.kind === 'appointment' && !block.entry.done));
    const capacity = dayMap.get(date)?.capacity ?? (plan.availability[new Date(`${date}T12:00:00`).getDay()] || 0);
    return { blocks, pending, capacity, rest: !capacity && !pending.length };
  };
  const weekBlocks = week.reduce((sum, date) => sum + summaryOf(date).pending.length, 0);

  function move(direction) {
    // "Hoje" volta ao automático: o primeiro dia com blocos a partir de hoje.
    if (!direction) { setAnchor(today); setPicked(null); return; }
    const next = view === 'day' ? addDaysIso(anchor, direction) : view === 'week' ? addDaysIso(anchor, direction * 7) : addMonthsIso(anchor, direction);
    setAnchor(next);
    if (view !== 'month') setSelected(view === 'day' ? next : addDaysIso(selected, direction * 7));
  }
  function choose(date) {
    setSelected(date);
    setAnchor(date);
    if (view === 'month') setView('day');
  }
  function postpone(item, date) {
    const result = actions.postponeLesson(item.lessonId, date);
    if (!result) return;
    notify(`${item.title} foi para ${shortDate(result.target)}. As aulas seguintes de ${item.courseTitle} acompanham.`);
  }

  const rangeLabel = view === 'day'
    ? longDate(anchor)
    : view === 'week'
      ? weekLabel(week[0], week[6])
      : capitalize(new Date(`${anchor}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
  const nextDays = week.filter((date) => date > selected).slice(0, 3);

  return <div className="personal-root plan-root">
    <header className="plan-heading">
      <div>
        <h1 className="display">Plano de Estudos</h1>
        <p className="lead">{!schedule.courses.length
          ? 'Adicione um curso à biblioteca para montar sua rota de estudos.'
          : hasAvailability
            ? <>Sua rota de aprendizado com ritmo sustentável: <strong>{formatMinutes(schedule.weeklyMinutes)} por semana</strong>{lastFinish && !schedule.unscheduled ? <>, conclusão prevista em <strong>{shortDate(lastFinish)}</strong></> : ''}.</>
            : 'Sua rota de aprendizado com ritmo sustentável e equilíbrio. Comece dizendo quanto tempo você tem.'}</p>
      </div>
      <div className="page-heading-actions">
        <button type="button" className="button secondary" onClick={() => setShowConfig((value) => !value)} aria-expanded={showConfig || !hasAvailability} aria-controls="plan-settings"><Icon name="settings"/>Disponibilidade e prazos</button>
        <a className="button primary" href="#agendar"><Icon name="calendar-plus"/>Agendar Sessão</a>
      </div>
    </header>
    <SectionTabs route="plano"/>

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

    <section className="card-surface plan-controls" aria-label="Período">
      <div className="plan-controls-range">
        <div className="plan-stepper">
          <button type="button" aria-label={view === 'day' ? 'Dia anterior' : view === 'week' ? 'Semana anterior' : 'Mês anterior'} onClick={() => move(-1)}><Icon name="chevron-left"/></button>
          <span className="plan-range-label" aria-live="polite">{rangeLabel}</span>
          <button type="button" aria-label={view === 'day' ? 'Próximo dia' : view === 'week' ? 'Próxima semana' : 'Próximo mês'} onClick={() => move(1)}><Icon name="chevron"/></button>
        </div>
        <button type="button" className="plan-today" onClick={() => move(0)}>Hoje</button>
      </div>
      <div className="plan-view-switch" role="group" aria-label="Visualização">
        {[['week', 'Semana'], ['day', 'Dia'], ['month', 'Mês']].map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => { setView(id); setAnchor(selected); }}>{label}</button>)}
      </div>
    </section>

    <div className="plan-layout">
      <div className="plan-main">
        {!schedule.courses.length && !(state.agenda || []).length
          ? <Empty icon="calendar" title="Sem cursos em andamento." onAdd={() => open({ type: 'new' })}>Importe um curso por link ou crie um material; o cronograma usa as aulas e as durações encontradas.</Empty>
          : <section className="card-surface plan-board" aria-labelledby="plan-days-title">
            <div className="plan-board-head">
              <h2 id="plan-days-title" className="title"><Icon name="layers"/>Distribuição dos blocos</h2>
              <span className="muted-text">{view === 'month' ? 'Toque em um dia para ver os blocos' : `7 dias • ${weekBlocks} ${weekBlocks === 1 ? 'sessão estimada' : 'sessões estimadas'}`}</span>
            </div>

            {!hasAvailability && schedule.courses.length > 0 && <div className="plan-setup">
              <strong>Quanto tempo você tem por semana?</strong>
              <p className="muted-text">O cronograma distribui {schedule.unscheduled} aulas na sua disponibilidade. Comece pela sugestão e ajuste os dias depois.</p>
              <Button onClick={() => { if (actions.useSuggestedAvailability()) notify('Disponibilidade definida. Ajuste os dias quando quiser.'); }}>Usar segunda a sexta, {suggestedAvailability(state)[1]} min por dia</Button>
            </div>}

            {view === 'month'
              ? <MonthGrid anchor={anchor} today={today} selected={selected} summaryOf={summaryOf} onChoose={choose}/>
              : <>
                {view === 'week' && <div className="plan-week-strip" role="group" aria-label="Dias da semana">
                  {week.map((date) => {
                    const info = summaryOf(date);
                    return <button key={date} type="button" className={`plan-week-day${date === today ? ' is-today' : ''}${date === selected ? ' is-selected' : ''}${info.rest ? ' is-rest' : ''}`} aria-pressed={date === selected} onClick={() => choose(date)} aria-label={`${longDate(date)}: ${info.pending.length} ${info.pending.length === 1 ? 'bloco' : 'blocos'}`}>
                      <span>{weekdayShort(date)}</span>
                      <strong>{Number(date.slice(8))}</strong>
                      {date === today && <i aria-hidden="true"/>}
                    </button>;
                  })}
                </div>}

                <DayDetail date={selected} today={today} info={summaryOf(selected)} firstItem={firstItem} open={open} go={go} postpone={postpone}/>

                {view === 'week' && nextDays.length > 0 && <div className="plan-next-days">
                  {nextDays.map((date) => {
                    const info = summaryOf(date);
                    const subjects = [...new Set(info.pending.map((block) => block.kind === 'lesson' ? block.item.courseTitle : block.entry.title))];
                    return <button key={date} type="button" className={`plan-mini-day${info.rest ? ' is-rest' : ''}`} onClick={() => choose(date)}>
                      <span className="plan-mini-head"><strong>{weekdayLong(date)} • {Number(date.slice(8))}</strong><small>{info.rest ? 'Descanso' : `${info.pending.length} ${info.pending.length === 1 ? 'bloco' : 'blocos'}`}</small></span>
                      <span className="plan-mini-copy">{info.rest ? 'Pausa sem cobrança' : subjects.length ? subjects.slice(0, 2).join(' & ') : 'Tempo livre'}</span>
                    </button>;
                  })}
                </div>}
              </>}
            {schedule.unscheduled > 0 && hasAvailability && <p className="quiet-note">{schedule.unscheduled} aulas ficam além de seis meses.</p>}
            <p className="quiet-note">{schedule.criteria}</p>
          </section>}

        <section id="plan-settings" className={`card-surface plan-settings ${showConfig || !hasAvailability ? 'is-expanded' : 'is-compact'}`} aria-labelledby="plan-settings-title" hidden={!(showConfig || !hasAvailability)}>
          <div className="plan-settings-head">
            <h2 id="plan-settings-title" className="title">Disponibilidade e prazos</h2>
            {hasAvailability && <button type="button" className="text-button" onClick={() => setShowConfig(false)}>Recolher</button>}
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
        <WeekRhythm week={week} today={today} studied={studied} dayMap={dayMap} plan={plan}/>
        <PlanMilestones state={state} schedule={schedule} today={today}/>
      </aside>
    </div>
  </div>;
}

function DayDetail({ date, today, info, firstItem, open, go, postpone }) {
  const doneCount = info.blocks.filter((block) => block.kind === 'done' || (block.kind === 'appointment' && block.entry.done)).length;
  const current = info.blocks.find((block) => block.kind === 'lesson' || (block.kind === 'appointment' && !block.entry.done));
  return <div className={`plan-day-detail${date === today ? ' is-today' : ''}`}>
    <div className="plan-day-detail-head">
      <span className="plan-day-chips"><span className="soft-badge">{date === today ? `Hoje • ${dayMonth(date)}` : `${weekdayLong(date)} • ${dayMonth(date)}`}</span><span className="muted-text">{info.pending.length} {info.pending.length === 1 ? 'sessão' : 'sessões'}</span></span>
      {doneCount > 0 && <span className="tone-mint-text plan-done-count"><Icon name="check"/>{doneCount} {doneCount === 1 ? 'concluído' : 'concluídos'}</span>}
    </div>
    {info.blocks.length
      ? <ul className="plan-items">{info.blocks.map((block) => {
        if (block.kind === 'done') return <li key={block.key} className="plan-block is-done">
          <span className="plan-block-icon tone-mint"><Icon name="check"/></span>
          <span className="plan-item-copy"><strong>{block.event.title || 'Etapa concluída'}</strong><small className="todo-meta">{block.event.materialTitle || 'Conclusão registrada'}</small></span>
          <span className="soft-badge tone-mint">Concluído</span>
        </li>;
        if (block.kind === 'appointment') {
          const { entry } = block;
          const active = block === current;
          return <li key={block.key} className={`plan-block${entry.done ? ' is-done' : ''}${active ? ' is-current' : ''}`}>
            <span className={`plan-block-icon ${entry.done ? 'tone-mint' : ''}`}><Icon name={entry.done ? 'check' : entry.category === 'exam' ? 'flag' : 'calendar'}/></span>
            <span className="plan-item-copy"><strong>{entry.title}</strong><small className="todo-meta">{entry.start ? `${entry.start} – ${entry.end}` : 'Sem horário'} • {CATEGORIES[entry.category]}</small></span>
            {entry.done ? <span className="soft-badge tone-mint">Concluído</span> : active && date === today && entry.category === 'study'
              ? <Button onClick={() => go('foco')}><Icon name="play"/>Iniciar Foco</Button>
              : <span className="muted-text">{entry.start && entry.end ? formatMinutes(minutesOf(entry.end) - minutesOf(entry.start)) : ''}</span>}
          </li>;
        }
        const { item } = block;
        return <li key={block.key} className={`plan-item plan-block${block === current ? ' is-current' : ''}`}>
          <span className="plan-block-icon"><Icon name="book"/></span>
          <span className="plan-item-copy"><strong>{item.title}</strong><small className="todo-meta">{item.courseTitle} · {formatMinutes(item.minutes)} {item.durationKnown ? '(duração da fonte)' : '(estimativa)'}{item.overflow ? ' · maior que o tempo do dia' : ''}</small></span>
          <span className="plan-item-actions">
            {item === firstItem && <Button onClick={() => open({ type: 'session', id: item.courseId, stepId: item.lessonId })}><Icon name="play"/>Estudar</Button>}
            <button type="button" className="text-button" aria-label={`Adiar ${item.title}`} onClick={() => postpone(item, date)}>Adiar</button>
          </span>
        </li>;
      })}</ul>
      : <p className="quiet-note">{info.capacity ? 'Nenhum bloco neste dia. Aproveite o tempo livre ou agende uma sessão.' : 'Dia de descanso: nenhuma aula é distribuída aqui.'}</p>}
  </div>;
}

function MonthGrid({ anchor, today, selected, summaryOf, onChoose }) {
  const first = `${anchor.slice(0, 7)}-01`;
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addDaysIso(start, index));
  const month = anchor.slice(0, 7);
  return <div className="plan-month" role="grid" aria-label="Mês">
    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => <span key={label} className="plan-month-label" role="columnheader">{label}</span>)}
    {days.map((date) => {
      const info = summaryOf(date);
      return <button key={date} type="button" role="gridcell" className={`plan-month-day${date.slice(0, 7) !== month ? ' is-outside' : ''}${date === today ? ' is-today' : ''}${date === selected ? ' is-selected' : ''}${info.rest ? ' is-rest' : ''}`} onClick={() => onChoose(date)} aria-label={`${longDate(date)}: ${info.pending.length} ${info.pending.length === 1 ? 'bloco' : 'blocos'}`}>
        <strong>{Number(date.slice(8))}</strong>
        {info.pending.length > 0 && <small>{info.pending.length} {info.pending.length === 1 ? 'bloco' : 'blocos'}</small>}
      </button>;
    })}
  </div>;
}

// Ritmo da semana exibida: horas declaradas até hoje e, nos dias seguintes, o
// tempo planejado. A meta é a disponibilidade do Plano, sem cobrança.
function WeekRhythm({ week, today, studied, dayMap, plan }) {
  const goal = week.reduce((sum, date) => sum + (plan.availability[new Date(`${date}T12:00:00`).getDay()] || 0), 0);
  const done = week.reduce((sum, date) => sum + (date <= today ? studied.get(date) || 0 : 0), 0);
  const percent = goal ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const values = week.map((date) => ({ date, minutes: date <= today ? studied.get(date) || 0 : dayMap.get(date)?.used || 0, rest: !(plan.availability[new Date(`${date}T12:00:00`).getDay()] || 0) }));
  const max = Math.max(60, ...values.map((value) => value.minutes));
  const activeDays = values.filter((value) => value.date <= today && value.minutes > 0).length;
  const dailyGoal = goal ? Math.round(goal / Math.max(1, values.filter((value) => !value.rest).length)) : 0;
  return <section className="card-surface plan-rhythm" aria-labelledby="plan-rhythm-title">
    <div className="plan-card-head"><h2 id="plan-rhythm-title" className="title"><Icon name="heart"/>Ritmo da Semana</h2><span className="soft-badge tone-mint">Sustentável</span></div>
    <div className="plan-meter">
      <div className="plan-meter-head"><strong>{formatHours(done)}<span> / {goal ? `${formatHours(goal)} meta flexível` : 'sem meta definida'}</span></strong>{goal > 0 && <span className="tone-mint-text">{percent}%</span>}</div>
      <Progress value={percent} max={100} tone="mint" label="Tempo estudado na semana"/>
      <p className="muted-text">{activeDays ? `${activeDays} ${activeDays === 1 ? 'dia' : 'dias'} com estudo nesta semana, sem picos de sobrecarga.` : 'Nenhuma sessão registrada nesta semana ainda. Tudo bem.'}</p>
    </div>
    <div className="plan-load">
      <div className="plan-load-head"><span>Carga diária (horas)</span>{dailyGoal > 0 && <span>Meta ideal: {formatHours(dailyGoal)}</span>}</div>
      <div className="plan-load-bars" role="img" aria-label={`Carga diária: ${values.map((value) => `${weekdayShort(value.date)} ${value.minutes} minutos${value.date > today ? ' planejados' : ''}`).join(', ')}`}>
        {values.map((value) => <span key={value.date} className={`plan-load-bar${value.date === today ? ' is-today' : value.date > today ? ' is-planned' : ''}${value.rest ? ' is-rest' : ''}`}>
          <i style={{ height: `${Math.max(value.minutes ? 8 : 3, Math.round((value.minutes / max) * 100))}%` }}/>
          <small>{weekdayShort(value.date).charAt(0)}</small>
        </span>)}
      </div>
    </div>
  </section>;
}

// Próximos marcos: provas e entregas da Agenda e prazos de curso do Plano.
function PlanMilestones({ state, schedule, today }) {
  const fromAgenda = (state.agenda || [])
    .filter((entry) => !entry.cancelled && !entry.done && entry.date >= today && (entry.category === 'exam' || entry.category === 'delivery'))
    .map((entry) => ({ id: entry.id, date: entry.date, title: entry.title, detail: CATEGORIES[entry.category], tone: entry.category === 'exam' ? 'warning' : 'lume', note: entry.start ? `Às ${entry.start}` : 'Dia inteiro' }));
  const fromGoals = schedule.courses
    .filter((course) => state.plan?.goals?.[course.courseId]?.deadline >= today)
    .map((course) => {
      const deadline = state.plan.goals[course.courseId].deadline;
      const late = schedule.conflicts.some((conflict) => conflict.courseId === course.courseId);
      return { id: `goal-${course.courseId}`, date: deadline, title: `Prazo de ${course.title}`, detail: `${course.remaining} ${course.remaining === 1 ? 'aula restante' : 'aulas restantes'}`, tone: late ? 'warning' : 'mint', note: late ? 'Não cabe no ritmo atual' : course.finish ? `Termina em ${shortDate(course.finish)}` : 'No ritmo atual' };
    });
  const items = [...fromAgenda, ...fromGoals].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return <section className="card-surface plan-milestones" aria-labelledby="plan-milestones-title">
    <div className="plan-card-head"><h2 id="plan-milestones-title" className="title"><Icon name="bell"/>Próximos Marcos</h2><span className="muted-text">{capitalize(new Date(`${today}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</span></div>
    {items.length
      ? <ul className="plan-milestone-list">{items.map((item) => {
        const days = Math.round((Date.parse(`${item.date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86400000);
        const date = new Date(`${item.date}T12:00:00`);
        return <li key={item.id} className={`plan-milestone tone-${item.tone}`}>
          <span className="plan-milestone-date"><strong>{String(date.getDate()).padStart(2, '0')}</strong><small>{date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small></span>
          <span className="plan-milestone-copy">
            <span className="plan-milestone-top"><strong>{item.title}</strong><small>{days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Faltam ${days} dias`}</small></span>
            <small className="muted-text">{item.detail}</small>
            <span className="plan-milestone-note"><i aria-hidden="true"/>{item.note}</span>
          </span>
        </li>;
      })}</ul>
      : <p className="muted-text">Nenhuma prova, entrega ou prazo pela frente. Defina prazos em Disponibilidade e prazos ou marque na Agenda.</p>}
    <a className="text-link plan-milestones-link" href="#agenda">Ver todos os prazos no calendário completo<Icon name="arrow"/></a>
  </section>;
}

function startOfWeek(date) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return addDaysIso(date, day === 0 ? -6 : 1 - day);
}

function addMonthsIso(date, delta) {
  const base = new Date(`${date.slice(0, 7)}-01T12:00:00`);
  base.setMonth(base.getMonth() + delta);
  return localDay(base);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function weekdayShort(date) {
  return capitalize(new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3));
}

function weekdayLong(date) {
  return capitalize(new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0]);
}

function dayMonth(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

function longDate(date) {
  return capitalize(new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
}

function weekLabel(from, to) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  const month = (value) => value.toLocaleDateString('pt-BR', { month: 'long' });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} a ${b.getDate()} de ${capitalize(month(b))}, ${b.getFullYear()}`
    : `${a.getDate()} de ${month(a)} a ${b.getDate()} de ${month(b)}, ${b.getFullYear()}`;
}

function formatHours(minutes) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}
