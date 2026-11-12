import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { studyRhythm, hasPreparation, courseProgress, courseStatus, materialType } from '../../../public/domain.js';
import { materialLesson, materialSteps } from '../../../public/material-model.js';
import { nextAction } from '../../../public/study-plan.js';
import { focusedTask, isOverdue, priorityLabel, taskAgenda } from '../../../public/tasks-domain.js';
import { overdueMessage } from '../plan/Tasks.jsx';
import { courseSummary, isImportedCourse, sourceLabel } from '../../../public/import-domain.js';
import { slidePositionLabel, slidesSummary } from '../../../public/slides-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Empty, Heading, Progress, Skeleton, ease, enter } from '../../ui/ui.jsx';
import { activeCompletions, isCompleted } from '../../../public/progress-domain.js';
import { formatMinutes, localDay, weeklyRhythm } from '../../../public/session-domain.js';
import { CATEGORIES } from '../../../public/agenda-domain.js';
import { useResource } from '../../lib/resources.js';
import { materialStanding, subjectOf, subjectsOverview } from '../../../public/subject-domain.js';
import { readingLabel } from '../../../public/pdf-domain.js';

export function Home({ state, open, go, planActions, notify, account }) {
  const action = nextAction(state);
  const plan = studyRhythm(state);
  const agenda = taskAgenda(state);
  const unit = action?.imported ? 'aula' : 'etapa';
  const prepare = action && !action.imported && plan.prepareFirst && !hasPreparation(state, action.lessonId);
  const course = action ? state.courses.find((item) => item.id === action.courseId) : null;
  const focus = focusedTask(state);
  const focusCourse = focus?.courseId ? state.courses.find((item) => item.id === focus.courseId) : null;
  const focusLesson = focusCourse && focus.lessonId ? materialLesson(focusCourse, focus.lessonId) : null;

  function completeTask(task) {
    const now = new Date().toISOString();
    const result = planActions.completeTask(task.id, now);
    if (!result?.added) return;
    notify(`Tarefa concluída: ${task.title}.${task.lessonId ? ' A conclusão da aula vinculada foi registrada.' : ''}`);
  }

  function toggleFocus(task) {
    if (focus?.id === task.id) {
      if (planActions.clearTaskFocus()) notify(`${task.title} saiu do foco. A Hoje volta a sugerir pelo roteiro.`);
      return;
    }
    if (planActions.focusTask(task.id)) notify(`Foco agora: ${task.title}.`);
  }

  const rhythm = weeklyRhythm(state);
  const today = rhythm.days.at(-1);
  const goal = state.plan?.availability?.[new Date().getDay()] || state.preferences?.dailyMinutes || 90;
  const goalPercent = goal ? Math.min(100, Math.round((today.minutes / goal) * 100)) : 0;
  const sessionsToday = today.sessions + (state.activeSession ? 1 : 0);
  const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCompletions = activeCompletions(state).filter((event) => !event.historical && event.at && Date.parse(event.at) >= weekStart).length;
  const weeklyGoalMinutes = Math.max(120, (Number(state.preferences?.dailyMinutes) || 90) * 5);
  const weekMinutesPercent = Math.min(100, Math.round((rhythm.current / weeklyGoalMinutes) * 100));
  const firstName = (account?.name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Boa noite' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const nextPercent = action?.pdf
    ? materialStanding(state, course).percent
    : action
      ? Math.round(((action.total - action.remaining) / Math.max(1, action.total)) * 100)
      : 0;

  return <div className="study-root today-root">
    <section className="card-surface today-welcome" aria-labelledby="today-title">
      <div className="today-welcome-copy">
        <h1 id="today-title" className="sr-only">Hoje</h1>
        <div className="soft-badges">
          <button type="button" className="soft-badge tone-mint" onClick={() => go('inicio')} title="Ajustar seu ritmo">
            <span className="soft-dot" aria-hidden="true"/>
            Ritmo: {plan.title}
          </button>
          <span className="soft-badge tone-lume">
            <Icon name="leaf"/>
            {rhythm.activeDays > 0 ? `${rhythm.activeDays} de 7 dias com estudo` : 'Sem cobrança diária'}
          </span>
        </div>
        <p className="today-greeting">
          {greeting}{firstName ? `, ${firstName}` : ''}. <span>Um passo de cada vez, no seu ritmo.</span>
        </p>
        <p className="lead">
          {focus
            ? <>Seu foco agora é <strong>{focus.title}</strong>, escolhido por você.</>
            : action?.pdf
              ? <>Continue <strong>{action.courseTitle}</strong> na página {action.pdf.page}. Reserve {action.minutes} minutos para avançar.</>
              : action
                ? <>Sua próxima {unit} é <strong>{action.title}</strong>. Reserve {action.minutes} minutos para avançar.</>
                : 'Adicione um curso ou material à biblioteca para receber a próxima ação.'}
        </p>
      </div>
      <div className="today-welcome-actions">
        <Button onClick={() => go('foco')}><Icon name="leaf"/>Iniciar sessão de foco</Button>
        <Button secondary onClick={() => go('agendar')}><Icon name="calendar-plus"/>Agendar sessão</Button>
      </div>
    </section>

    <section className="today-metrics" aria-label="Seu ritmo hoje">
      <Metric
        label="Tempo de foco hoje"
        icon="timer"
        tone="mint"
        value={formatMinutes(today.minutes)}
        unit={goal ? `/ ${formatMinutes(goal)}` : ''}
        percent={goalPercent}
        note={goal ? (goalPercent >= 100 ? 'Meta flexível do dia concluída' : `${goalPercent}% do planejado para hoje`) : <a className="text-link" href="#plano">Definir tempo no Plano</a>}
      />
      <Metric
        label="Sessões hoje"
        icon="check"
        tone="lume"
        value={String(sessionsToday)}
        unit={sessionsToday === 1 ? 'sessão registrada' : 'sessões registradas'}
        percent={Math.min(100, sessionsToday * 50)}
        note={state.activeSession ? (state.activeSession.status === 'active' ? 'Uma sessão está em andamento' : 'Uma sessão está pausada') : sessionsToday ? 'Encerradas e salvas no seu histórico' : 'Comece quando estiver pronta'}
      />
      <Metric
        label="Conclusões na semana"
        icon="book"
        tone="reward"
        value={String(weekCompletions)}
        unit={weekCompletions === 1 ? 'aula ou leitura' : 'aulas e leituras'}
        percent={Math.min(100, weekCompletions * 20)}
        note="Contam só conclusões confirmadas nos últimos 7 dias"
      />
      <Metric
        label="Ritmo sustentável"
        icon="trend"
        tone="mint"
        value={rhythm.change === null ? formatMinutes(rhythm.current) : `${rhythm.change > 0 ? '+' : ''}${rhythm.change}%`}
        unit={rhythm.change === null ? 'nos últimos 7 dias' : 'vs. semana anterior'}
        percent={weekMinutesPercent}
        note={`Média de ${formatMinutes(rhythm.average)} por dia, sem cobrança`}
      />
    </section>

    <section className={`card-surface next-action today-hero-block ${focus ? 'is-focus' : ''}`} aria-labelledby="next-title">
      {focus ? <>
        <div className="next-hero-top">
          <div className="soft-badges">
            <span className="pill"><Icon name="focus"/>Foco agora · escolhido por você</span>
            {focusCourse && <span className="soft-badge tone-mint">{focusCourse.title}</span>}
          </div>
          <div className="next-hero-meta">
            <span>{taskMeta(focus)}</span>
          </div>
        </div>
        <div className="next-hero-body">
          <h2 id="next-title" className="headline">{focus.title}</h2>
          {action && <p className="muted-text">Roteiro: próxima {unit} é <strong>{action.title}</strong> ({action.courseTitle}).</p>}
        </div>
        <div className="next-linked-material">
          <span className="next-linked-icon"><Icon name="book"/></span>
          <div className="next-linked-copy">
            <strong>{focusCourse ? focusCourse.title : 'Sem curso vinculado.'}</strong>
            <small>{focusLesson ? `Aula vinculada: ${focusLesson.title}` : focus.subtasks?.length ? `${focus.subtasks.filter(s => s.done).length} de ${focus.subtasks.length} subtarefas concluídas` : 'Estude pelo seu material e marque ao finalizar'}</small>
          </div>
          <span className="soft-badge">{focusCourse ? 'Vínculo ativo' : 'Checklist'}</span>
        </div>
        <div className="action-row">
          <Button onClick={() => go('foco')}><Icon name="play"/>Iniciar Estudo</Button>
          {focusCourse && <Button secondary onClick={() => open({ type: 'course', id: focusCourse.id })}><Icon name="book"/>Abrir Material na Biblioteca</Button>}
          {focusLesson && <Button secondary onClick={() => open({ type: 'session', id: focusCourse.id, stepId: focusLesson.id })}><Icon name="check"/>Abrir a aula</Button>}
          <Button secondary={!focusLesson} onClick={() => completeTask(focus)}><Icon name="check"/>Concluir tarefa</Button>
          <Button ghost onClick={() => toggleFocus(focus)}>Tirar do foco</Button>
        </div>
      </> : action?.pdf ? <>
        <div className="next-hero-top">
          <div className="soft-badges">
            <span className="pill"><Icon name="focus"/>Trilha ativa · {action.courseTitle}</span>
            <span className="soft-badge tone-mint">Próximo bloco</span>
            {subjectOf(state, course) && <span className="soft-badge">{subjectOf(state, course).title}</span>}
          </div>
          <div className="next-hero-meta">
            <span><Icon name="clock"/>{action.minutes} min <small>estimativa</small></span>
            <span><Icon name="file"/>Leitura em PDF</span>
          </div>
        </div>
        <div className="next-hero-body">
          <h2 id="next-title" className="headline">{action.pdf.started ? `Continuar ${action.courseTitle} na página ${action.pdf.page}` : `Começar ${action.courseTitle}`}</h2>
          <p className="muted-text">{action.reason.label}. {action.reason.detail}</p>
        </div>
        <div className="next-linked-material">
          <span className="next-linked-icon"><Icon name="file"/></span>
          <div className="next-linked-copy">
            <strong>{action.courseTitle}</strong>
            <small>{action.pdf.started ? readingLabel(course.reading, action.pdf.pages) : `${action.pdf.pages} páginas · ainda não aberto`}{action.pdf.section ? ` · ${action.pdf.section}` : ''}</small>
          </div>
          <span className="soft-badge tone-mint">{nextPercent}% lido</span>
        </div>
        <Progress value={nextPercent} max={100} tone="mint" label={`Avanço em ${action.courseTitle}`}/>
        <div className="action-row">
          <Button onClick={() => open({ type: 'pdf', id: action.courseId })}><Icon name="book"/>{action.pdf.started ? `Continuar na p. ${action.pdf.page}` : 'Abrir no leitor'}</Button>
          <Button secondary onClick={() => go('foco')}><Icon name="timer"/>Iniciar Estudo</Button>
          <Button ghost onClick={() => open({ type: 'course', id: action.courseId })}><Icon name="external"/>Abrir Material na Biblioteca</Button>
        </div>
      </> : action ? <>
        <div className="next-hero-top">
          <div className="soft-badges">
            <span className="pill"><Icon name="focus"/>Trilha ativa · {action.courseTitle}</span>
            <span className="soft-badge tone-mint">Próximo bloco</span>
          </div>
          <div className="next-hero-meta">
            <span><Icon name="clock"/>{action.minutes} min <small>{action.durationKnown ? 'duração informada pela fonte' : 'estimativa'}</small></span>
            <span><Icon name="book"/>{remainingText(action, unit)}</span>
          </div>
        </div>
        <div className="next-hero-body">
          {(action.discipline || action.module) && <span className="metric-label">{[action.discipline, action.module].filter(Boolean).join(' · ')}</span>}
          <h2 id="next-title" className="headline">{action.title}</h2>
          <p className="muted-text"><strong>{action.reason.label}.</strong> {action.reason.detail}</p>
        </div>
        <div className="next-linked-material">
          <span className="next-linked-icon"><Icon name="book"/></span>
          <div className="next-linked-copy">
            <strong>{action.courseTitle}</strong>
            <small>{action.url ? `Fonte vinculada disponível${course?.resumeAt ? ` · parou em ${course.resumeAt}` : ''}` : `Sem link cadastrado${course?.resumeAt ? ` · parou em ${course.resumeAt}` : ''}`}</small>
          </div>
          <span className="soft-badge">{nextPercent}% concluído</span>
        </div>
        <Progress value={action.total - action.remaining} max={action.total} tone="lume" label={`Progresso de ${action.courseTitle}`}/>
        <div className="action-row">
          <Button onClick={() => go('foco')}><Icon name="play"/>Iniciar Estudo</Button>
          {prepare
            ? <Button secondary onClick={() => open({ type: 'session', id: action.courseId, preparation: true })}><Icon name="leaf"/>Preparar o material</Button>
            : <Button secondary onClick={() => open({ type: 'session', id: action.courseId, stepId: action.lessonId })}><Icon name="check"/>Registrar conclusão</Button>}
          {!action.imported && <Button secondary onClick={() => open({ type: 'session', id: action.courseId, preparation: !prepare })}><Icon name="sprout"/>{prepare ? 'Ir direto à etapa' : 'Dividir em um passo menor'}</Button>}
          <Button ghost onClick={() => open({ type: 'course', id: action.courseId })}><Icon name="external"/>Abrir Material na Biblioteca</Button>
        </div>
        <p className="quiet-note">Reserve {action.minutes} minutos para avançar ({action.durationKnown ? 'duração da fonte' : 'estimativa'}). {!action.imported && 'Preparar ou dividir organiza o caminho; o XP vem ao concluir a etapa.'}</p>
      </> : <>
        <span className="pill"><Icon name="focus"/>Próximo bloco</span>
        <h2 id="next-title" className="headline">Nenhum material em andamento.</h2>
        <p className="muted-text">Importe um curso por link, anexe um PDF ou crie um material. A próxima aula aparece aqui com o tempo sugerido.</p>
        <div className="action-row"><Button onClick={() => go('biblioteca')}><Icon name="plus"/>Ir para a biblioteca</Button></div>
      </>}
    </section>

    <div className="today-columns">
      <div className="today-main">
        <section className="card-surface today-tasks" aria-labelledby="today-tasks-title">
          <div className="card-heading">
            <div>
              <span className="card-icon tone-mint"><Icon name="list"/></span>
              <div>
                <h2 id="today-tasks-title" className="title">Plano do dia</h2>
                <p className="card-subtitle">Suas etapas e tarefas organizadas para hoje</p>
              </div>
            </div>
            <div className="today-plan-actions">
              <button type="button" className="chip-button" onClick={() => go('agendar')}><Icon name="plus"/>Adicionar bloco</button>
              <a className="text-link" href="#tarefas">Abrir lista<Icon name="arrow"/></a>
            </div>
          </div>
          {agenda.overdue > 0 && <p className="inline-note todo-overdue-note" role="status"><Icon name="flag"/><span>{overdueMessage(agenda.overdue)}</span></p>}
          {agenda.next.length
            ? <ul className="today-task-list">{agenda.next.map((task) => <li key={task.id} className={`todo-item ${focus?.id === task.id ? 'is-focus' : ''}`}>
              <button type="button" aria-pressed={focus?.id === task.id} title={focus?.id === task.id ? 'Tirar do foco' : 'Focar na Hoje'} aria-label={focus?.id === task.id ? `Tirar ${task.title} do foco` : `Focar em ${task.title} na Hoje`} className="todo-focus" onClick={() => toggleFocus(task)}><Icon name="focus"/></button>
              <span className="todo-copy"><strong>{task.title}</strong><small className="todo-meta">{focus?.id === task.id ? 'Em foco · ' : ''}{taskMeta(task)}</small></span>
              <button type="button" role="checkbox" aria-checked="false" title="Concluir" aria-label={`Concluir tarefa ${task.title}`} className="todo-check today-task-done" onClick={() => completeTask(task)}><Icon name="check"/></button>
            </li>)}</ul>
            : <p className="muted-text">Sem tarefas pendentes. Defina o próximo passo em <a className="text-link" href="#tarefas">Tarefas</a> ou agende um bloco.</p>}
          {agenda.pending > agenda.next.length && <p className="quiet-note">Mais {agenda.pending - agenda.next.length} na lista.</p>}
        </section>

        <Milestones state={state}/>

        <div className="today-calm-card card-surface">
          <span className="card-icon tone-mint"><Icon name="leaf"/></span>
          <div>
            <strong>Recomendação do santuário</strong>
            <p className="muted-text">Pausar faz parte do caminho: o Lume não pune dias sem estudo e preserva seu lugar em cada material.</p>
          </div>
        </div>
      </div>

      <div className="today-side">
        <WeeklyRhythm rhythm={rhythm}/>
        <FriendsCard account={account}/>
      </div>
    </div>
  </div>;
}

function Metric({ label, icon, tone, value, unit, percent = null, note }) {
  return <div className={`card-surface metric-card tone-${tone}`}>
    <div className="metric-head"><span className="metric-label">{label}</span><span className="metric-icon"><Icon name={icon}/></span></div>
    <p className="metric-value"><strong>{value}</strong>{unit && <span>{unit}</span>}</p>
    {percent !== null && <Progress value={percent} max={100} tone={tone === 'reward' ? 'reward' : 'mint'} label={label}/>}
    <span className="metric-note">{note}</span>
  </div>;
}

// Barras dos últimos sete dias: ritmo declarado, sem meta punitiva.
export function WeeklyRhythm({ rhythm }) {
  const max = Math.max(60, ...rhythm.days.map((day) => day.minutes));
  const last = rhythm.days.length - 1;
  return <section className="card-surface weekly-rhythm" aria-labelledby="weekly-rhythm-title">
    <div className="card-heading"><div><span className="card-icon tone-mint"><Icon name="chart"/></span><div><span className="metric-label">Ritmo semanal</span><h2 id="weekly-rhythm-title" className="title">Constância confortável</h2></div></div></div>
    <div className="rhythm-bars" role="img" aria-label={`Minutos de estudo nos últimos 7 dias: ${rhythm.days.map((day) => `${weekdayShort(day.date)} ${day.minutes}`).join(', ')}`}>
      {rhythm.days.map((day, index) => <div key={day.date} className={`rhythm-bar ${index === last ? 'is-today' : ''}`}>
        <span className="rhythm-bar-track"><span className="rhythm-bar-fill" style={{ height: `${Math.max(day.minutes ? 6 : 2, Math.round((day.minutes / max) * 100))}%` }}/></span>
        <small>{index === last ? 'Hoje' : weekdayShort(day.date)}</small>
      </div>)}
    </div>
    <p className="rhythm-foot"><span>Média: <strong>{formatMinutes(rhythm.average)}/dia</strong></span><span className="tone-mint-text">Sem sobrecarga</span></p>
  </section>;
}

function weekdayShort(date) {
  const label = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1, 3);
}

// Próximas provas, entregas e compromissos da Agenda.
export function Milestones({ state }) {
  const today = localDay();
  const upcoming = (state.agenda || [])
    .filter((item) => !item.cancelled && !item.done && item.date >= today)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
    .slice(0, 3);
  return <section className="card-surface today-milestones" aria-labelledby="milestones-title">
    <div className="card-heading"><div><span className="card-icon tone-reward"><Icon name="calendar"/></span><h2 id="milestones-title" className="title">Próximos marcos</h2></div><a className="text-link" href="#agenda">Calendário<Icon name="arrow"/></a></div>
    {upcoming.length
      ? <ul className="milestone-list">{upcoming.map((item) => {
        const days = Math.round((Date.parse(`${item.date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86400000);
        return <li key={item.id} className={`milestone milestone-${item.category}`}>
          <span className="milestone-copy"><strong>{item.title}</strong><small>{CATEGORIES[item.category]}{item.start ? ` · ${item.start}` : ''}</small></span>
          <span className="milestone-when"><span className="soft-badge">{days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`}</span><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small></span>
        </li>;
      })}</ul>
      : <p className="muted-text">Nenhum compromisso pela frente. <a className="text-link" href="#agendar">Agendar uma sessão</a></p>}
  </section>;
}

// Amizades aceitas. Não há presença em tempo real aqui: só a lista e o atalho.
function FriendsCard({ account }) {
  const resource = useResource('/api/friends', { enabled: Boolean(account) });
  const friends = resource.data?.friends || [];
  return <section className="card-surface today-friends" aria-labelledby="today-friends-title">
    <div className="card-heading"><div><span className="card-icon"><Icon name="users"/></span><h2 id="today-friends-title" className="title">Amigos</h2></div>{account && friends.length > 0 && <span className="metric-label">{friends.length} {friends.length === 1 ? 'amizade' : 'amizades'}</span>}</div>
    {!account
      ? <p className="muted-text">Amigos, mensagens e ranking ficam disponíveis com uma conta.</p>
      : !resource.data
        ? <Skeleton label="Carregando amigos…" rows={2}/>
        : friends.length
          ? <ul className="today-friend-list">{friends.slice(0, 3).map((friend) => <li key={friend.id}>
            <span className="avatar small" aria-hidden="true">{String(friend.name || '?').slice(0, 1).toUpperCase()}</span>
            <span className="friend-copy"><strong>{friend.name}</strong><small>Amigos desde {new Date(friend.since).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small></span>
            <a className="text-link" href={`#mensagens?com=${encodeURIComponent(friend.id)}`} aria-label={`Mensagem para ${friend.name}`}>Mensagem</a>
          </li>)}</ul>
          : <p className="muted-text">Estudar junto é opcional. Um convite começa a lista.</p>}
    <a className="button secondary full-width" href="#amigos"><Icon name="users"/>{friends.length ? 'Ver todos os amigos' : 'Convidar amigos'}</a>
  </section>;
}

function remainingText(action, unit) {
  const parts = [`${action.remaining} de ${action.total} ${unit}s restantes`];
  if (action.remainingKnownMinutes > 0) {
    const hours = Math.floor(action.remainingKnownMinutes / 60);
    const minutes = action.remainingKnownMinutes % 60;
    parts.push(`${[hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean).join(' ')} de duração conhecida`);
    if (action.remainingWithoutDuration > 0) parts.push(`${action.remainingWithoutDuration} sem duração informada`);
  }
  if (action.partial) parts.push('grade parcial');
  return parts.join(' · ');
}

function taskMeta(task) {
  const late = isOverdue(task);
  return [
    task.priority > 0 ? `Prioridade ${priorityLabel(task.priority).toLowerCase()}` : '',
    late ? 'Atrasada' : '',
    task.dueDate ? `${late ? 'venceu' : 'vence'} em ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : 'sem prazo',
  ].filter(Boolean).join(' · ');
}

const statuses = { all: 'Todos', active: 'Em andamento', new: 'Para começar', paused: 'Em pausa', completed: 'Concluídos' };

// Menu "…" no canto do cartão. Fica ao lado do cartão (e não dentro dele) porque
// um botão não pode conter outro botão.
function CourseMenu({ course, open }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const outside = (event) => { if (!root.current?.contains(event.target)) setMenuOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  return <div className="course-menu" ref={root}>
    <button type="button" className="course-menu-button" aria-label={`Mais ações de ${course.title}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><Icon name="more"/></button>
    {menuOpen && <div className="course-menu-list" role="menu">
      <button type="button" role="menuitem" className="course-menu-item danger" onClick={() => { setMenuOpen(false); open({ type: 'delete', id: course.id }); }}><Icon name="close"/>Excluir curso</button>
    </div>}
  </div>;
}

export function CourseCard({ course, state, open, compact = false }) {
  const progress = courseProgress(state, course);
  const status = courseStatus(state, course);
  const imported = isImportedCourse(course);
  const summary = imported ? courseSummary(state, course) : null;
  const scope = imported ? `${summary.done} de ${summary.total} aulas` : `${progress.done} de ${progress.total} etapas`;
  const deck = slidesSummary(course);
  const reading = course.pdf ? materialStanding(state, course) : null;
  const subject = subjectOf(state, course);
  const shownScope = reading ? reading.label : scope;
  const percent = reading ? reading.percent : progress.percent;
  const label = `${course.title}, ${statuses[status]}, ${shownScope}`;

  if (compact) return <div className="course-card-wrap is-row"><button type="button" className={`reading-row ${state.selectedCourseId === course.id ? 'selected-course' : ''}`} onClick={() => open({ type: 'course', id: course.id })} aria-label={label}>
    <span className="reading-icon"><Icon name="file"/></span>
    <span className="reading-copy"><strong>{course.title}</strong><small>{shownScope}{subject ? ` · ${subject.title}` : ''}{course.pdf ? ` · ${course.pdf.pages} p.` : ''}</small></span>
    <span className="reading-progress"><Progress value={percent} tone="mint" label={`Progresso de ${course.title}`}/><strong>{percent}%</strong></span>
    <span className="reading-cta">{status === 'completed' ? 'Revisar' : 'Ler'}</span>
  </button><CourseMenu course={course} open={open}/></div>;

  return <div className="course-card-wrap">
    <motion.button
      {...enter}
      whileHover={{ y: -2 }}
      whileTap={{ scale: .99 }}
      className={`course-card stitch-course-card ${state.selectedCourseId === course.id ? 'selected-course' : ''}`}
      onClick={() => open({ type: 'course', id: course.id })}
      aria-label={label}
    >
      <div className="stitch-course-top">
        <div className="stitch-course-badges">
          <span className="soft-badge tone-lume">{subject ? subject.title : materialType(course.type).title}</span>
          <span className="stitch-course-scope">{shownScope}</span>
          {imported && <span className="soft-badge">{sourceLabel(course.source)}</span>}
          {deck.total > 0 && <span className="soft-badge">{deck.total} slides</span>}
        </div>
        <strong className={`stitch-course-percent status-${status}`}>{percent}%</strong>
      </div>
      <h3 className="title">{course.title}</h3>
      <p className="course-description">
        {course.resumeAt ? `Retomar em ${course.resumeAt}` : materialType(course.type).title}
        {course.example ? ' · Exemplo' : ''}
        {imported && summary.partial ? ' · grade parcial' : ''}
      </p>
      <div className="stitch-course-foot">
        <Progress value={percent} tone={status === 'completed' ? 'mint' : 'lume'} label={`Progresso de ${course.title}`}/>
        <div className="stitch-course-foot-row">
          <span className={`course-status status-${status}`}>{statuses[status]}</span>
          <span className="stitch-course-open">Acessar<Icon name="chevron"/></span>
        </div>
      </div>
    </motion.button>
    <CourseMenu course={course} open={open}/>
  </div>;
}

const kinds = { all: 'Todas as frentes', courses: 'Cursos e trilhas', pdfs: 'PDFs e leituras' };

export function Library({ state, open, actions }) {
  const [filter, setFilter] = useState('all');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [showStatusFilters, setShowStatusFilters] = useState(true);

  const query = search.toLocaleLowerCase('pt-BR');
  const courses = state.courses.filter(course => (filter === 'all' || courseStatus(state, course) === filter)
    && (kind === 'all' || (kind === 'pdfs') === Boolean(course.pdf))
    && (!subjectFilter || (subjectFilter === 'none' ? !course.subjectId : course.subjectId === subjectFilter))
    && course.title.toLocaleLowerCase('pt-BR').includes(query));
  const trails = courses.filter((course) => !course.pdf);
  const readings = courses.filter((course) => course.pdf);
  const subjects = subjectsOverview(state).filter((item) => item.subject && (!query || item.subject.title.toLocaleLowerCase('pt-BR').includes(query)));
  const selected = state.courses.find(course => course.id === state.selectedCourseId) || state.courses[0];
  const action = selected && nextAction({ ...state, courses: [selected] });
  const next = action && { course: selected, step: materialSteps(selected).find((step) => step.id === action.lessonId) };
  const selectedDeck = selected ? slidesSummary(selected) : null;
  const selectedStanding = selected ? (selected.pdf ? materialStanding(state, selected) : null) : null;
  const selectedPercent = selected ? (selected.pdf ? selectedStanding.percent : courseProgress(state, selected).percent) : 0;
  const selectedSubject = selected ? subjectOf(state, selected) : null;

  return <div className="library-root">
    <Heading
      eyebrow="Estante viva & continuidade"
      title="Biblioteca"
      actions={<>
        <Button secondary onClick={() => open({ type: 'manual' })}><Icon name="edit"/>Criar manualmente</Button>
        <Button secondary onClick={() => open({ type: 'pdf-attach' })}><Icon name="book"/>Anexar PDF</Button>
        <Button onClick={() => open({ type: 'new' })}><Icon name="plus"/>Adicionar curso</Button>
      </>}
    >
      Seus cursos, livros, PDFs e disciplinas organizados com o ponto exato de retomada.
    </Heading>

    {state.courses.length > 0 && <div className="library-toolbar">
      <label className="search-field">
        <Icon name="search"/>
        <input
          type="search"
          id="course-search"
          placeholder="Buscar na biblioteca por título, disciplina ou assunto…"
          aria-label="Buscar um curso pelo nome"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
        {search && <button className="icon-button" onClick={() => { setSearch(''); document.getElementById('course-search').focus(); }} aria-label="Limpar busca"><Icon name="close"/></button>}
      </label>

      <div className="library-filters">
        <div className="kind-tabs" role="group" aria-label="Mostrar cursos ou PDFs">
          {Object.entries(kinds).map(([id, title]) => <button key={id} type="button" className="kind-tab" aria-pressed={kind === id} onClick={() => setKind(id)}>
            <Icon name={id === 'pdfs' ? 'file' : id === 'courses' ? 'layers' : 'book'}/><span>{title}</span>
            <span className="kind-count">{id === 'all' ? state.courses.length : state.courses.filter((course) => (id === 'pdfs') === Boolean(course.pdf)).length}</span>
          </button>)}
        </div>

        <div className="library-quick-right">
          {(state.subjects || []).length > 0 && <label className="subject-filter">
            <span className="sr-only">Filtrar por disciplina</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} aria-label="Filtrar por disciplina">
              <option value="">Todas as disciplinas</option>
              {state.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}
              <option value="none">Sem disciplina</option>
            </select>
          </label>}
          <button
            type="button"
            className={`kind-tab ${showStatusFilters || filter !== 'all' ? 'is-open' : ''}`}
            aria-expanded={showStatusFilters}
            onClick={() => setShowStatusFilters(v => !v)}
          >
            <Icon name="tune"/><span>Situação{filter !== 'all' ? `: ${statuses[filter]}` : ''}</span>
          </button>
        </div>
      </div>

      {(showStatusFilters || filter !== 'all') && <div className="filter-tabs" role="group" aria-label="Filtrar cursos por situação">
        {Object.entries(statuses).map(([id, title]) => <button className="filter-btn" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
          {filter === id && <motion.span className="selection-highlight" layoutId="library-filter" transition={{ duration: .26, ease }}/>}
          <span>{title} ({id === 'all' ? state.courses.length : state.courses.filter(course => courseStatus(state, course) === id).length})</span>
        </button>)}
      </div>}
    </div>}

    {state.courses.length === 0
      ? <FirstStudyArea actions={actions} open={open}/>
      : <>
      {selected && <section className="library-resume" aria-labelledby="library-resume-title">
        <div className="library-section-label">
          <span><Icon name="play"/>Continuar agora</span>
          {next && <span className="soft-badge tone-mint"><span className="soft-dot" aria-hidden="true"/>{selected.reading || state.activeSession?.courseId === selected.id ? 'Em andamento' : 'Próximo passo'}</span>}
        </div>
        <div className="card-surface resume-card">
          <div className="resume-copy">
            <div className="resume-meta">
              {selectedSubject && <span className="soft-badge tone-mint">{selectedSubject.title}</span>}
              <span>{materialType(selected.type).title}{isImportedCourse(selected) ? ` · ${sourceLabel(selected.source)}` : ''}</span>
            </div>
            <h2 id="library-resume-title" className="title">{selected.title}</h2>
            {next?.step && !selected.pdf && <p className="muted-text">Próximo passo: {next.step.title}</p>}
            {selected.pdf && <p className="muted-text">{selectedStanding.label}</p>}
            <div className="resume-progress"><Progress value={selectedPercent} tone="mint" label={`Progresso de ${selected.title}`}/><strong>{selectedPercent}%</strong></div>
          </div>
          <div className="resume-actions">
            <Button ghost onClick={() => open({ type: 'course', id: selected.id })}>Detalhes</Button>
            {selectedDeck?.total > 0 && <Button secondary onClick={() => open({ type: 'slides', id: selected.id })}><Icon name="book"/>Abrir apresentação · <small>{slidePositionLabel(selectedDeck)}</small></Button>}
            {selected.pdf
              ? <Button onClick={() => open({ type: next ? 'pdf' : 'course', id: selected.id })}><Icon name="book"/>{next ? (selected.reading ? `Continuar na p. ${selected.reading.page}` : 'Abrir no leitor') : 'Ver detalhes do PDF'}</Button>
              : <Button onClick={() => open({ type: next ? 'session' : 'course', id: selected.id })}><Icon name={next ? 'play' : 'book'}/>{next ? 'Continuar meu próximo passo' : 'Ver detalhes da trilha'}</Button>}
          </div>
        </div>
        {isImportedCourse(selected) && <ImportedInspector course={selected} state={state}/>}
      </section>}

      <div role="status" className="search-result-count">{courses.length} {courses.length === 1 ? 'trilha encontrada' : 'trilhas encontradas'}</div>

      {subjects.length > 0 && kind === 'all' && <section className="library-section" aria-labelledby="library-subjects-title">
        <div className="library-section-head">
          <span className="card-icon tone-mint"><Icon name="school"/></span>
          <div><h2 id="library-subjects-title" className="title">Disciplinas</h2><p className="card-subtitle">Materiais agrupados e por onde retomar.</p></div>
          <a className="text-link" href="#disciplinas">Organizar<Icon name="arrow"/></a>
        </div>
        <div className="subject-card-grid">{subjects.map((item) => <a key={item.subject.id} className={`card-surface subject-tile color-${item.subject.color || 'lume'}`} href={`#disciplinas?id=${encodeURIComponent(item.subject.id)}`}>
          <span className="subject-tile-meta"><span className="soft-badge tone-mint">{item.total} {item.total === 1 ? 'material' : 'materiais'}</span>{item.materials.some((material) => material.course.pdf) && <span className="soft-badge"><Icon name="file"/>{item.materials.filter((material) => material.course.pdf).length} PDFs</span>}<strong className="subject-tile-percent">{item.percent}%</strong></span>
          <strong className="subject-tile-title">{item.subject.title}</strong>
          <small className="muted-text">{item.resume ? `Retomar: ${item.resume.course.title}` : item.total ? 'Tudo concluído por aqui' : 'Nenhum material ainda'}</small>
          <Progress value={item.percent} tone="mint" label={`Progresso em ${item.subject.title}`}/>
          <span className="subject-tile-open"><span>Caderno</span><span className="subject-open-arrow">Abrir<Icon name="chevron"/></span></span>
        </a>)}</div>
      </section>}

      {trails.length > 0 && <section className="library-section" aria-labelledby="library-courses-title">
        <div className="library-section-head">
          <span className="card-icon tone-reward"><Icon name="layers"/></span>
          <div><h2 id="library-courses-title" className="title">Cursos e trilhas</h2><p className="card-subtitle">Aulas, etapas e projetos com o ponto de retomada.</p></div>
          <span className="metric-label">{trails.length} {trails.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div className="course-grid" id="library-results">{trails.map(course => <CourseCard key={course.id} course={course} state={state} open={open}/>)}</div>
      </section>}

      {readings.length > 0 && <section className="library-section" aria-labelledby="library-readings-title">
        <div className="library-section-head">
          <span className="card-icon"><Icon name="file"/></span>
          <div><h2 id="library-readings-title" className="title">Materiais e leituras</h2><p className="card-subtitle">PDFs anexados, com a página onde você parou.</p></div>
          <span className="metric-label">{readings.length} {readings.length === 1 ? 'leitura' : 'leituras'}</span>
        </div>
        <div className="reading-list">{readings.map(course => <CourseCard key={course.id} course={course} state={state} open={open} compact/>)}</div>
      </section>}

      {!courses.length && <Empty title="Nenhum material neste filtro." onAdd={() => open({ type: 'new' })}>Troque o filtro ou importe um curso por link.</Empty>}
      <p className="today-quote"><Icon name="leaf"/><span>Feito com cuidado para quem aprende no próprio compasso.</span></p>
    </>}
  </div>;
}

function FirstStudyArea({ actions, open }) {
  const [area, setArea] = useState('');
  const [firstStep, setFirstStep] = useState('');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const title = area.trim();
    if (!title) { setError('Diga qual área você quer estudar.'); return; }
    try {
      if (!actions.addMaterial({
        title,
        type: 'course',
        firstActivity: firstStep.trim() || `Encontrar meu primeiro material de ${title}`,
        planning: !firstStep.trim(),
      }, 'manual')) return;
      setError('');
    } catch (exception) {
      setError(exception.message);
    }
  }
  return <section className="card-surface settings-panel first-area" aria-labelledby="first-area-title">
    <span className="eyebrow">Seu primeiro passo</span>
    <h2 id="first-area-title" className="title">Qual área você quer estudar?</h2>
    <p className="muted-text">Digite a área de atuação. O Lume cria sua primeira trilha, sem conteúdo de exemplo e sem conceder XP.</p>
    <form className="form-stack" onSubmit={submit}>
      <label className="field">Área de atuação
        <input name="study-area" maxLength={100} value={area} onChange={event => setArea(event.target.value)} placeholder="Ex.: Direito, Programação, Inglês" autoComplete="off"/>
      </label>
      <label className="field">Primeiro passo (opcional)
        <input name="study-first-step" maxLength={180} value={firstStep} onChange={event => setFirstStep(event.target.value)} placeholder={area.trim() ? `Ex.: Encontrar um curso de ${area.trim()}` : 'Ex.: Encontrar meu primeiro material'}/>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit"><Icon name="plus"/>Criar minha trilha</Button>
    </form>
    <p className="quiet-note">Já tem um link? <button className="text-button accent" type="button" onClick={() => open({ type: 'new' })}>Detectar o curso pelo link<Icon name="arrow"/></button></p>
    <p className="quiet-note">Estuda por PDF? <button className="text-button accent" type="button" onClick={() => open({ type: 'pdf-attach' })}>Anexar um PDF, sem curso<Icon name="arrow"/></button></p>
  </section>;
}

export function Steps({ course, state }) {
  return <ol className="course-step-list">{materialSteps(course).map((step, index) => {
    const done = isCompleted(state, step.id);
    const prepared = hasPreparation(state, step.id) && !done;
    return <li className={done ? 'completed-step' : prepared ? 'prepared-step' : ''} key={step.id}>
      <span className="step-number">{done ? <Icon name="check"/> : String(index + 1).padStart(2, '0')}</span>
      <span className="step-copy">{step.title}{prepared && <small className="preparation-label">Material preparado</small>}</span>
    </li>;
  })}</ol>;
}

// Resumo compacto no painel da biblioteca. A lista completa fica no diálogo do
// curso, para o painel continuar curto no celular.
function ImportedInspector({ course, state }) {
  const summary = courseSummary(state, course);
  return <div className="import-inspector">
    <p className="quiet-note">{sourceLabel(course.source)} · {summary.disciplines.length} {summary.disciplines.length === 1 ? 'área' : 'áreas'} · {summary.total} aulas selecionadas</p>
    {summary.next
      ? <p className="import-inspector-next"><Icon name="play"/><span>Próxima aula: <strong>{summary.next.title}</strong></span></p>
      : <p className="import-inspector-next"><Icon name="check"/><span>Áreas selecionadas concluídas. O curso inteiro pode ter mais conteúdo.</span></p>}
    <ul className="import-inspector-areas">
      {summary.disciplines.slice(0, 4).map((discipline) => <li key={discipline.id}><span>{discipline.title}</span><strong>{discipline.done}/{discipline.total}</strong></li>)}
    </ul>
    {summary.disciplines.length > 4 && <p className="quiet-note">+ {summary.disciplines.length - 4} áreas no detalhe do curso.</p>}
    {summary.partial && <p className="inline-note"><Icon name="help"/><span>Grade parcial: o curso pode ter mais conteúdo do que o encontrado.</span></p>}
  </div>;
}
