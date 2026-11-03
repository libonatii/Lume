import { useMemo } from 'react';
import {
  DAY_MINUTE_OPTIONS, WEEKDAYS, buildSchedule, normalizePlan, suggestedAvailability,
} from '../../../public/schedule-domain.js';
import { studyPlan } from '../../../public/study-plan.js';
import { TASK_PRIORITIES, localDate } from '../../../public/tasks-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Empty, Heading } from '../../ui/ui.jsx';

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

// "4 de novembro": sem abreviação, para não gerar ponto duplo no fim da frase.
function shortDate(date) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : '';
}

// Cronograma: o que estudar em cada dia disponível, recalculado a partir de hoje
// sempre que o progresso, a disponibilidade, um prazo ou uma prioridade mudam.
export function Schedule({ state, actions, open, notify }) {
  const today = localDate();
  const plan = normalizePlan(state.plan);
  const schedule = useMemo(() => buildSchedule(state, { today }), [state, today]);
  const hasAvailability = schedule.weeklyMinutes > 0;
  const lastFinish = schedule.courses.map((course) => course.finish).filter(Boolean).sort().at(-1);
  const visibleDays = schedule.days.slice(0, 10);
  const firstItem = visibleDays[0]?.items[0];

  function postpone(item, date) {
    const result = actions.postponeLesson(item.lessonId, date);
    if (!result) return;
    const { target } = result;
    notify(`${item.title} foi para ${shortDate(target)}. As aulas seguintes de ${item.courseTitle} acompanham.`);
  }

  return <div className="personal-root plan-root">
    <Heading title="Plano" eyebrow="Cronograma">
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

    {!schedule.courses.length
      ? <Empty title="Sem cursos em andamento." onAdd={() => open({ type: 'new' })}>Importe um curso por link ou crie um material; o cronograma usa as aulas e as durações encontradas.</Empty>
      : !hasAvailability
        ? <section className="card-surface plan-setup">
          <h2 className="title">Quanto tempo você tem por semana?</h2>
          <p className="muted-text">O cronograma distribui {schedule.unscheduled} aulas na sua disponibilidade. Comece pela sugestão e ajuste os dias abaixo.</p>
          <div className="action-row"><Button onClick={() => { if (actions.useSuggestedAvailability()) notify('Disponibilidade definida. Ajuste os dias quando quiser.'); }}>Usar segunda a sexta, {suggestedAvailability(state)[1]} min por dia</Button></div>
        </section>
        : <section className="plan-days" aria-labelledby="plan-days-title">
          <div className="shelf-header"><h2 id="plan-days-title" className="headline">Próximos dias</h2>{schedule.unscheduled > 0 && <span className="quiet-note">{schedule.unscheduled} aulas ficam além de seis meses</span>}</div>
          <ol className="plan-day-list">
            {visibleDays.map((day) => <li key={day.date} className="card-surface plan-day">
              <div className="plan-day-head"><strong>{dayLabel(day.date, today)}</strong><span className="muted-text">{formatMinutes(day.used)} de {formatMinutes(day.capacity)}</span></div>
              <ul className="plan-items">
                {day.items.map((item) => <li key={item.lessonId} className="plan-item">
                  <span className="plan-item-copy"><strong>{item.title}</strong><small className="todo-meta">{item.courseTitle} · {formatMinutes(item.minutes)} {item.durationKnown ? '(duração da fonte)' : '(estimativa)'}{item.overflow ? ' · maior que o tempo do dia' : ''}</small></span>
                  {item === firstItem && <Button onClick={() => open({ type: 'session', id: item.courseId, stepId: item.lessonId })}><Icon name="play"/>Estudar</Button>}
                  <button type="button" className="text-button" aria-label={`Adiar ${item.title}`} onClick={() => postpone(item, day.date)}>Adiar</button>
                </li>)}
              </ul>
            </li>)}
          </ol>
          {schedule.days.length > visibleDays.length && <p className="quiet-note">Mais {schedule.days.length - visibleDays.length} dias planejados depois destes.</p>}
          <p className="quiet-note">{schedule.criteria}</p>
        </section>}

    <section className="card-surface plan-settings" aria-labelledby="plan-settings-title">
      <h2 id="plan-settings-title" className="title">Disponibilidade e prazos</h2>
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
    </ol> : <Empty title="Nenhum curso em andamento." onAdd={() => open({ type: 'new' })}>{plan.note}</Empty>}
  </div>;
}
