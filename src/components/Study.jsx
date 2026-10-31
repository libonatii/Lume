import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Atropos from 'atropos/react';
import { studyRhythm, nextMission, hasPreparation, courseProgress, courseStatus, weekCount, journeyPlan } from '../../public/domain.js';
import { courseSummary, isImportedCourse, sourceLabel } from '../../public/import-domain.js';
import {
  endSession, formatSessionDuration, pauseSession, resumeSession, sessionElapsed,
  startSession, touchSession,
} from '../../public/session-domain.js';
import Icon from './Icon.jsx';
import { AnimatedNumber, Button, Cover, Empty, Glow, Heading, Progress, Ring, ease, enter } from './ui.jsx';

export function Home({ state, open, go, update, notify }) {
  const mission = nextMission(state);
  const plan = studyRhythm(state);
  const journey = journeyPlan(state);
  const importedMission = mission ? isImportedCourse(mission.course) : false;
  const prepare = mission && !importedMission && plan.prepareFirst && !hasPreparation(state, mission.step.id);
  const progress = mission ? courseProgress(state, mission.course) : null;
  const count = weekCount(state);
  return <div className="study-root">
    <Heading
      eyebrow="Espaço seu · sem urgência"
      title={<>Olá. <em>Que bom ter você aqui.</em></>}
      actions={<button className="chip-button" onClick={() => go('inicio')}><Icon name="settings"/>Seu ritmo: {plan.title} · ajustar</button>}
    >{plan.message}</Heading>

    <section className="hero-bento" aria-labelledby="next-title">
      <div className="study-focus">
        <Glow palette="lume"/>
        <div className="study-focus-body">
          <div className="study-focus-head">
            <span className="eyebrow on-glow">Ação focal única · {mission?.course.title || 'Seu caminho de descobertas'}</span>
            {mission?.course.resumeAt && <span className="resume-pill"><Icon name="return"/>Parou em: {mission.course.resumeAt}</span>}
          </div>
          <h2 id="next-title" className="headline">{mission ? 'O começo pode ser pequeno.' : 'Cada passo já faz parte do seu caminho.'}</h2>
          <p className="muted-text">Você não precisa fazer tudo agora. Escolha um próximo movimento, no seu tempo.</p>
          {mission ? <>
            <div className="mission-spotlight">
              <span className="spotlight-icon"><Icon name="focus"/></span>
              <div className="spotlight-copy">
                <strong>{prepare ? `Preparar o material: ${mission.course.title}` : mission.step.title}</strong>
                <small>Sem tempo mínimo · {mission.course.example ? 'Curso de exemplo' : importedMission ? 'Registro manual da aula' : 'Registro manual'}</small>
              </div>
              {progress && <span className="spotlight-badge">{progress.done}/{progress.total}</span>}
            </div>
            <div className="action-row">
              {importedMission
                ? <Button onClick={() => open({ type: 'session', id: mission.course.id, stepId: mission.step.id })}><Icon name="play"/>Abrir próxima aula</Button>
                : <>
                  <Button onClick={() => open({ type: 'session', id: mission.course.id, preparation: !!prepare })}><Icon name="play"/>{prepare ? 'Preparar meu material' : 'Começar este passo'}</Button>
                  <Button secondary onClick={() => open({ type: 'session', id: mission.course.id, preparation: !prepare })}><Icon name="sprout"/>{prepare ? 'Fazer a etapa completa' : 'Tornar ainda menor'}</Button>
                </>}
            </div>
          </> : <Button onClick={() => go('biblioteca')}>Explorar biblioteca<Icon name="arrow"/></Button>}
        </div>
      </div>

      <aside className="rest-card">
        <div className="rest-card-top">
          <span className="eyebrow">Cuidado com seu ritmo</span>
          <h3 className="title">Pausa consciente</h3>
          <p className="muted-text">Se hoje não der, você pode descansar. Seu progresso continua aqui para quando quiser voltar.</p>
        </div>
        <div className="rest-visual">
          <img src="/assets/stitch/calm.png" alt=""/>
          <div className="rest-overlay">
            <Button secondary onClick={() => open({ type: 'break' })}><Icon name="leaf"/>Fazer uma pausa</Button>
            <small>Pausar sem culpa · não retira XP nem conquistas</small>
          </div>
        </div>
      </aside>
    </section>

    <StudySession state={state} update={update} mission={mission} notify={notify}/>

    <div className="metrics-bento">
      <section className="card-surface metric-card">
        <div className="metric-card-row">
          <div>
            <span className="eyebrow">Ritmo da semana</span>
            <h2 className="title">{count} de {state.preferences.weeklyGoal} passos</h2>
            <p className="muted-text">Sem cobrança. Seu progresso não expira.</p>
          </div>
          <Ring value={count} max={Math.max(count, state.preferences.weeklyGoal)} size={68} stroke={6} label="Passos na semana">
            <strong><AnimatedNumber value={count}/></strong>
          </Ring>
        </div>
        <Progress value={count} max={Math.max(count, state.preferences.weeklyGoal)} label="Passos registrados nesta semana"/>
      </section>

      <section className="card-surface metric-card">
        <span className="eyebrow">Trilha atual</span>
        <h2 className="title">{mission?.course.title || 'Um caminho percorrido'}</h2>
        <p className="muted-text">Continue de onde parou.</p>
        <Progress value={progress?.percent ?? 100} tone="lume" label="Progresso da trilha atual"/>
        <button className="text-button accent" onClick={() => mission ? open({ type: 'course', id: mission.course.id }) : go('biblioteca')}>Ver detalhes da trilha<Icon name="arrow"/></button>
      </section>

      <section className="card-surface metric-card">
        <span className="eyebrow">Adaptação de foco</span>
        <h2 className="title">Mudar de jornada</h2>
        <p className="muted-text">Alterne para outro interesse sem perder seu progresso.</p>
        <div className="metric-links">
          <a className="text-link" href="#biblioteca">Explorar toda a biblioteca<Icon name="arrow"/></a>
          <button className="text-button" onClick={() => open({ type: 'new' })}><Icon name="plus"/>Adicionar um novo interesse</button>
        </div>
      </section>
    </div>

    <div className="Split-bento">
      <section className="card-surface journey-card" aria-labelledby="journey-title">
        <span className="eyebrow">Seu momento · {journey.journey === 'starting' ? 'Quero começar' : journey.journey === 'sometimes' ? 'Estudo de vez em quando' : journey.journey === 'often' ? 'Estudo com frequência' : 'Ainda explorando'}</span>
        <h2 id="journey-title" className="title">{journey.title}</h2>
        <p className="muted-text">{journey.detail}</p>
        {journey.firstActivity && <p className="next-activity-pill"><Icon name="spark"/><span>Próxima atividade: <strong>{journey.firstActivity}</strong></span></p>}
        <button className="text-button accent" onClick={() => go('inicio')}>Rever meu ritmo sem apagar o progresso<Icon name="arrow"/></button>
      </section>

      <section className="card-surface comfort-banner">
        <span className="pace-icon"><Icon name="sun"/></span>
        <div>
          <h2 className="title">Lembrete de conforto</h2>
          <p className="muted-text">Você pode parar e voltar depois. Seu caminho não precisa seguir o ritmo de ninguém.</p>
          <a className="text-link" href="#configuracoes">Ajustar meu espaço<Icon name="arrow"/></a>
        </div>
      </section>
    </div>
  </div>;
}

// Sessão declarada: a pessoa inicia e encerra. O relógio é informativo e não
// concede XP; o batimento de 60 s evita contar dias de aba esquecida.
function StudySession({ state, update, mission, notify }) {
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
    if (result.session) notify(`Sessão registrada: ${formatSessionDuration(result.session.durationMs)}. Tempo declarado, sem XP.`);
  };

  return <section className={`card-surface session-bar ${active ? 'is-active' : ''}`} aria-labelledby="session-title">
    <span className={`session-dot ${active?.status === 'paused' ? 'is-paused' : ''}`} aria-hidden="true"/>
    <div className="session-copy">
      <span className="eyebrow">{active ? (active.status === 'active' ? 'Em sessão' : 'Sessão pausada') : 'Sessão de estudo'}</span>
      <h2 id="session-title" className="title">{active ? active.label : 'Estou estudando agora'}</h2>
      <p className="muted-text">{active
        ? <>Tempo declarado: <strong className="session-clock" role="timer" aria-label="Tempo da sessão">{formatSessionDuration(elapsed)}</strong> · {active.courseId ? 'vinculado ao seu material' : 'sem material vinculado'}</>
        : 'Um tempo que você inicia, pausa e encerra. Não é observação de atividade e não gera XP.'}</p>
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
  return <motion.button {...enter} whileHover={{ y: -4 }} whileTap={{ scale: .99 }} className={`course-card ${state.selectedCourseId === course.id ? 'selected-course' : ''}`} onClick={() => open({ type: 'course', id: course.id })} aria-label={`${course.title}, ${statuses[status]}, ${scope}`}>
    <div className="course-image">
      <Cover art={art}/>
      <span className={`course-status status-${status}`}>{statuses[status]}</span>
      {imported && <span className="course-source-chip">{sourceLabel(course.source)}</span>}
      {course.resumeAt && <span className="course-resume-chip"><Icon name="return"/>{course.resumeAt}</span>}
    </div>
    <div className="course-card-body">
      <h3 className="title">{course.title}</h3>
      <p className="course-description">{imported ? sourceLabel(course.source) : course.category}{course.example ? ' · Exemplo' : ''}{imported && summary.partial ? ' · grade parcial' : ''}</p>
      <div className="course-progress-label"><span>{scope}</span><strong>{progress.percent}%</strong></div>
      <Progress value={progress.percent} tone={status === 'completed' ? 'mint' : 'lume'} label={`Progresso de ${course.title}`}/>
    </div>
  </motion.button>;
}

export function Library({ state, open }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const courses = state.courses.filter(course => (filter === 'all' || courseStatus(state, course) === filter) && course.title.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  const selected = state.courses.find(course => course.id === state.selectedCourseId) || state.courses[0];
  const next = selected && nextMission({ ...state, courses: [selected] }, selected.id);
  const selectedArt = selected && (['design', 'code', 'language', 'nature'].includes(selected.art) ? selected.art : 'nature');

  return <div className="library-root">
    <Heading eyebrow="Estante viva & continuidade" title="Biblioteca" actions={<Button onClick={() => open({ type: 'new' })}><Icon name="plus"/>Adicionar curso</Button>}>
      Guarde seus cursos e tópicos de estudo. Continue de onde parou, no seu ritmo.
    </Heading>

    <div className="library-toolbar">
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
    </div>

    <div className="library-grid">
      <section className="library-shelf">
        <div className="shelf-header">
          <h2 className="headline">Minha estante <span className="shelf-count">{state.courses.length} trilhas</span></h2>
          <div role="status" className="search-result-count">{courses.length} {courses.length === 1 ? 'trilha encontrada' : 'trilhas encontradas'}</div>
        </div>
        <div className="course-grid" id="library-results">
          {courses.map(course => <CourseCard key={course.id} course={course} state={state} open={open}/>)}
          {!courses.length && <Empty title="Nenhum curso por aqui. Ainda." onAdd={() => open({ type: 'new' })}>Tente outro filtro ou adicione algo que você quer aprender.</Empty>}
        </div>
        <p className="quiet-note">Capas ilustrativas. Os cursos de exemplo não incluem aulas.</p>
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
        {isImportedCourse(selected)
          ? <ImportedInspector course={selected} state={state}/>
          : <Steps course={selected} state={state}/>}
        <Progress value={courseProgress(state, selected).percent} tone="lume" label={`Progresso de ${selected.title}`}/>
        <p className="quiet-note">Ritmo livre · sem pressa. Não há penalidades por pausas.</p>
      </aside>}
    </div>
  </div>;
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
