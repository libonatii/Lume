import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Atropos from 'atropos/react';
import { studyRhythm, nextMission, hasPreparation, courseProgress, courseStatus, addMaterial, materialType } from '../../public/domain.js';
import { nextAction } from '../../public/study-plan.js';
import { completeTask, isOverdue, priorityLabel, taskAgenda } from '../../public/tasks-domain.js';
import { XP_KIND_LABELS, levelProgress } from '../../public/xp-policy.js';
import { overdueMessage } from './Tasks.jsx';
import { courseSummary, isImportedCourse, sourceLabel } from '../../public/import-domain.js';
import { slidePositionLabel, slidesSummary } from '../../public/slides-domain.js';
import {
  endSession, formatSessionDuration, pauseSession, resumeSession, sessionElapsed,
  startSession, touchSession,
} from '../../public/session-domain.js';
import Icon from './Icon.jsx';
import { Button, Cover, Empty, Heading, Progress, ease, enter } from './ui.jsx';

export function Home({ state, open, go, update, notify, account, xp }) {
  const action = nextAction(state);
  const plan = studyRhythm(state);
  const agenda = taskAgenda(state);
  const unit = action?.imported ? 'aula' : 'etapa';
  const prepare = action && !action.imported && plan.prepareFirst && !hasPreparation(state, action.lessonId);
  const course = action ? state.courses.find((item) => item.id === action.courseId) : null;
  return <div className="study-root today-root">
    <Heading
      title="Hoje"
      actions={<button className="chip-button" onClick={() => go('inicio')}><Icon name="settings"/>Ritmo: {plan.title}</button>}
    >{action
      ? <>Sua próxima {unit} é <strong>{action.title}</strong>. Reserve {action.minutes} minutos para avançar.</>
      : 'Adicione um curso ou material à biblioteca para receber a próxima ação.'}</Heading>

    <section className="card-surface next-action" aria-labelledby="next-title">
      {action ? <>
        <span className="eyebrow">Próxima ação · {action.courseTitle}</span>
        <h2 id="next-title" className="headline">{action.title}</h2>
        {(action.discipline || action.module) && <p className="muted-text">{[action.discipline, action.module].filter(Boolean).join(' · ')}</p>}
        <dl className="next-facts">
          <div><dt>Por que agora</dt><dd><strong>{action.reason.label}.</strong> {action.reason.detail}</dd></div>
          <div><dt>Reserve</dt><dd><strong>{action.minutes} min</strong> <span className="fact-source">{action.durationKnown ? 'duração informada pela fonte' : 'estimativa'}</span></dd></div>
          <div><dt>Material</dt><dd>{action.url
            ? <a className="text-link" href={action.url} target="_blank" rel="noopener noreferrer">Abrir {unit} na fonte<Icon name="external"/></a>
            : 'Sem link cadastrado. Use o material que você escolheu.'}{course?.resumeAt ? <span className="fact-source"> · parou em {course.resumeAt}</span> : null}</dd></div>
          <div><dt>O que falta</dt><dd>{remainingText(action, unit)}</dd></div>
        </dl>
        <Progress value={action.total - action.remaining} max={action.total} tone="lume" label={`Progresso de ${action.courseTitle}`}/>
        <div className="action-row">
          {prepare
            ? <Button onClick={() => open({ type: 'session', id: action.courseId, preparation: true })}><Icon name="play"/>Preparar o material</Button>
            : <Button onClick={() => open({ type: 'session', id: action.courseId, stepId: action.lessonId })}><Icon name="check"/>Registrar conclusão</Button>}
          {!action.imported && <Button secondary onClick={() => open({ type: 'session', id: action.courseId, preparation: !prepare })}><Icon name="sprout"/>{prepare ? 'Ir direto à etapa' : 'Dividir em um passo menor'}</Button>}
          <Button ghost onClick={() => open({ type: 'course', id: action.courseId })}>Ver o curso<Icon name="arrow"/></Button>
        </div>
        {!action.imported && <p className="quiet-note">Preparar ou dividir organiza o caminho; o XP vem ao concluir a etapa.</p>}
      </> : <>
        <span className="eyebrow">Próxima ação</span>
        <h2 id="next-title" className="headline">Nenhum material em andamento.</h2>
        <p className="muted-text">Importe um curso por link ou crie um material. A próxima aula aparece aqui, com o tempo a reservar.</p>
        <div className="action-row"><Button onClick={() => go('biblioteca')}><Icon name="plus"/>Ir para a biblioteca</Button></div>
      </>}
    </section>

    <StudySession state={state} update={update} mission={action ? { course: { id: action.courseId }, step: { id: action.lessonId, title: action.title } } : null} notify={notify} account={account}/>

    <div className="today-grid">
      <section className="card-surface today-tasks" aria-labelledby="today-tasks-title">
        <div className="shelf-header"><h2 id="today-tasks-title" className="title">Tarefas</h2><a className="text-link" href="#tarefas">Abrir lista<Icon name="arrow"/></a></div>
        {agenda.overdue > 0 && <p className="inline-note todo-overdue-note" role="status"><Icon name="flag"/><span>{overdueMessage(agenda.overdue)}</span></p>}
        {agenda.next.length
          ? <ul className="today-task-list">{agenda.next.map((task) => <li key={task.id} className="todo-item">
            <button type="button" role="checkbox" aria-checked="false" aria-label={`Concluir tarefa ${task.title}`} className="todo-check" onClick={() => {
              const result = completeTask(state, task.id);
              if (!result.added) return;
              update(result.state);
              notify(`Tarefa concluída: ${task.title}.`);
            }}><Icon name="plus"/></button>
            <span className="todo-copy"><strong>{task.title}</strong><small className="todo-meta">{taskMeta(task)}</small></span>
          </li>)}</ul>
          : <p className="muted-text">Sem tarefas pendentes. Defina a próxima ação concreta da sua preparação em Tarefas.</p>}
        {agenda.pending > agenda.next.length && <p className="quiet-note">Mais {agenda.pending - agenda.next.length} na lista.</p>}
      </section>

      <Evolution state={state} account={account} xp={xp}/>
    </div>
  </div>;
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

// Evolução: nível e a última recompensa confirmada, sempre com o material de origem.
function Evolution({ state, account, xp }) {
  if (!state.preferences.gamification) return <section className="card-surface today-evolution" aria-labelledby="evolution-title">
    <h2 id="evolution-title" className="title">Evolução</h2>
    <p className="muted-text">Os indicadores de XP estão ocultos nas preferências. Seu progresso continua registrado.</p>
  </section>;
  const summary = xp?.summary;
  const level = account ? levelProgress(summary?.totalXP || 0) : null;
  const last = account ? (xp?.events || []).find((event) => event.xp > 0 && event.kind !== 'adjustment') : null;
  const achievement = account ? xp?.achievements?.[0] : null;
  return <section className="card-surface today-evolution" aria-labelledby="evolution-title">
    <div className="shelf-header"><h2 id="evolution-title" className="title">Evolução</h2><a className="text-link" href="#historico">Ver extrato<Icon name="arrow"/></a></div>
    {account
      ? (summary ? <>
        <p className="evolution-level"><strong>Nível {level.level}</strong> · {level.current} / {level.next} XP · faltam {level.next - level.current} XP para o nível {level.level + 1}</p>
        <Progress value={level.current} max={level.next} tone="lume" label="Experiência até o próximo nível"/>
        {last
          ? <p className="muted-text">Última recompensa: <strong>+{last.xp} XP</strong> · {XP_KIND_LABELS[last.kind] || 'Evento'}{last.stepTitle || last.materialTitle ? ` · ${last.stepTitle || last.materialTitle}` : ''}</p>
          : <p className="muted-text">Conclua uma aula, leitura ou entrega para receber o primeiro XP validado.</p>}
        {achievement && <p className="muted-text">Conquista mais recente: <strong>{achievement.title}</strong></p>}
      </> : <p className="muted-text">Carregando XP confirmado pelo servidor…</p>)
      : <p className="muted-text">Na prévia, o progresso fica neste navegador e não gera XP validado. Entre na conta para registrar XP, nível e conquistas.</p>}
  </section>;
}

// Sessão declarada: a pessoa inicia e encerra. O relógio é informativo e não
// concede XP; o batimento de 60 s evita contar dias de aba esquecida.
function StudySession({ state, update, mission, notify, account }) {
  const active = state.activeSession;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const beat = setInterval(() => update((previous) => touchSession(previous)), 60000);
    return () => { clearInterval(clock); clearInterval(beat); };
  }, [active?.id, active?.status, update]);

  const elapsed = active ? sessionElapsed(active, now) : 0;
  const begin = () => update((previous) => startSession(previous, {
    courseId: mission?.course?.id || '',
    stepId: mission?.step?.id || '',
    label: mission ? mission.step.title : 'Estudo livre',
  }));
  const finish = () => {
    const result = endSession(state);
    update(result.state);
    if (result.session) notify(account
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
      {active && <Button secondary onClick={() => update((previous) => active.status === 'active' ? pauseSession(previous) : resumeSession(previous))}><Icon name={active.status === 'active' ? 'pause' : 'play'}/>{active.status === 'active' ? 'Pausar' : 'Retomar'}</Button>}
      {active && <Button onClick={finish}><Icon name="check"/>Encerrar sessão</Button>}
    </div>
  </section>;
}

const statuses = { all: 'Todos', active: 'Em andamento', new: 'Para começar', paused: 'Em pausa', completed: 'Concluídos' };

export function CourseCard({ course, state, open }) {
  const progress = courseProgress(state, course);
  const status = courseStatus(state, course);
  const art = ['design', 'code', 'language', 'nature'].includes(course.art) ? course.art : 'nature';
  const imported = isImportedCourse(course);
  const summary = imported ? courseSummary(state, course) : null;
  const scope = imported ? `${summary.done} de ${summary.total} aulas` : `${progress.done} de ${progress.total} etapas`;
  const deck = slidesSummary(course);
  return <motion.button {...enter} whileHover={{ y: -4 }} whileTap={{ scale: .99 }} className={`course-card ${state.selectedCourseId === course.id ? 'selected-course' : ''}`} onClick={() => open({ type: 'course', id: course.id })} aria-label={`${course.title}, ${statuses[status]}, ${scope}`}>
    <div className="course-image">
      <Cover art={art}/>
      <span className={`course-status status-${status}`}>{statuses[status]}</span>
      {imported && <span className="course-source-chip">{sourceLabel(course.source)}</span>}
      {deck.total > 0 && <span className="course-slide-chip"><Icon name="book"/>{deck.total} slides</span>}
      {course.resumeAt && <span className="course-resume-chip"><Icon name="return"/>{course.resumeAt}</span>}
    </div>
    <div className="course-card-body">
      <h3 className="title">{course.title}</h3>
      <p className="course-description">{materialType(course.type).title}{imported ? ` · ${sourceLabel(course.source)}` : ''}{course.example ? ' · Exemplo' : ''}{imported && summary.partial ? ' · grade parcial' : ''}</p>
      <div className="course-progress-label"><span>{scope}</span><strong>{progress.percent}%</strong></div>
      <Progress value={progress.percent} tone={status === 'completed' ? 'mint' : 'lume'} label={`Progresso de ${course.title}`}/>
    </div>
  </motion.button>;
}

export function Library({ state, open, update }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const courses = state.courses.filter(course => (filter === 'all' || courseStatus(state, course) === filter) && course.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const selected = state.courses.find(course => course.id === state.selectedCourseId) || state.courses[0];
  const next = selected && nextMission({ ...state, courses: [selected] }, selected.id);
  const selectedArt = selected && (['design', 'code', 'language', 'nature'].includes(selected.art) ? selected.art : 'nature');
  const selectedDeck = selected ? slidesSummary(selected) : null;

  return <div className="library-root">
    <Heading eyebrow="Estante viva & continuidade" title="Biblioteca" actions={<><a className="button secondary" href="#github"><Icon name="external"/>GitHub</a><Button secondary onClick={() => open({ type: 'manual' })}><Icon name="edit"/>Criar manualmente</Button><Button onClick={() => open({ type: 'new' })}><Icon name="plus"/>Adicionar curso</Button></>}>
      Seus cursos, leituras e projetos, com o ponto onde cada um parou e o que falta para concluir.
    </Heading>

    {state.courses.length > 0 && <div className="library-toolbar">
      <label className="search-field">
        <Icon name="search"/>
        <input type="search" id="course-search" placeholder="Buscar nas minhas trilhas…" aria-label="Buscar um curso pelo nome" value={search} onChange={event => setSearch(event.target.value)}/>
        {search && <button className="icon-button" onClick={() => { setSearch(''); document.getElementById('course-search').focus(); }} aria-label="Limpar busca"><Icon name="close"/></button>}
      </label>
      <div className="filter-tabs" role="group" aria-label="Filtrar cursos por situação">
        {Object.entries(statuses).map(([id, title]) => <button className="filter-btn" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
          {filter === id && <motion.span className="selection-highlight" layoutId="library-filter" transition={{ duration: .26, ease }}/>}
          <span>{title} ({id === 'all' ? state.courses.length : state.courses.filter(course => courseStatus(state, course) === id).length})</span>
        </button>)}
      </div>
    </div>}

    {state.courses.length === 0
      ? <FirstStudyArea update={update} open={open}/>
      : <div className="library-grid">
      <section className="library-shelf">
        <div className="shelf-header">
          <h2 className="headline">Minha estante <span className="shelf-count">{state.courses.length} trilhas</span></h2>
          <div role="status" className="search-result-count">{courses.length} {courses.length === 1 ? 'trilha encontrada' : 'trilhas encontradas'}</div>
        </div>
        <div className="course-grid" id="library-results">
          {courses.map(course => <CourseCard key={course.id} course={course} state={state} open={open}/>)}
          {!courses.length && <Empty title="Nenhum material neste filtro." onAdd={() => open({ type: 'new' })}>Troque o filtro ou importe um curso por link.</Empty>}
        </div>
        <p className="quiet-note">Capas ilustrativas. Cada trilha reúne os passos que você registrou.</p>
      </section>

      {selected && <aside className="library-inspector">
        {/* Profundidade tátil suave com Atropos (FGLibs) na capa da trilha em foco */}
        <Atropos className="inspector-atropos" activeOffset={18} shadow={false} highlight={true} rotateXMax={6} rotateYMax={6}>
          <div className="detail-image" data-atropos-offset="0">
            <img src={`/assets/stitch/${selectedArt === 'design' ? 'detail' : selectedArt}.png`} alt="" data-atropos-offset="-2"/>
            <div className="detail-image-caption" data-atropos-offset="3">
              <span className="green-pill">Sua trilha atual</span>
              <h2 className="title">{selected.title}</h2>
            </div>
          </div>
        </Atropos>
        <Button className="full-width" onClick={() => open({ type: next ? 'session' : 'course', id: selected.id })}><Icon name={next ? 'play' : 'book'}/>{next ? 'Continuar meu próximo passo' : 'Ver detalhes da trilha'}</Button>
        {selectedDeck?.total > 0 && <Button secondary className="full-width" onClick={() => open({ type: 'slides', id: selected.id })}><Icon name="book"/>Abrir apresentação · <small>{slidePositionLabel(selectedDeck)}</small></Button>}
        {isImportedCourse(selected)
          ? <ImportedInspector course={selected} state={state}/>
          : <Steps course={selected} state={state}/>}
        <Progress value={courseProgress(state, selected).percent} tone="lume" label={`Progresso de ${selected.title}`}/>
        <p className="quiet-note">Pausar um curso tira suas aulas do roteiro e preserva o progresso e o XP.</p>
      </aside>}
    </div>}
  </div>;
}

function FirstStudyArea({ update, open }) {
  const [area, setArea] = useState('');
  const [firstStep, setFirstStep] = useState('');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const title = area.trim();
    if (!title) { setError('Diga qual área você quer estudar.'); return; }
    try {
      update(previous => addMaterial(previous, {
        title,
        type: 'course',
        firstActivity: firstStep.trim() || `Encontrar meu primeiro material de ${title}`,
        planning: !firstStep.trim(),
      }, 'manual'));
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
  </section>;
}

export function Steps({ course, state }) {
  return <ol className="course-step-list">{course.steps.map((step, index) => {
    const done = state.completed.includes(step.id);
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
