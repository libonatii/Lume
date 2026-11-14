import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { hasPreparation, courseProgress, courseStatus, materialType } from '../../../public/domain.js';
import { materialSteps } from '../../../public/material-model.js';
import { resumeMaterial } from '../../../public/study-plan.js';
import { courseSummary, isImportedCourse, sourceLabel } from '../../../public/import-domain.js';
import { slidePositionLabel, slidesSummary } from '../../../public/slides-domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Empty, Heading, Progress, ease, enter } from '../../ui/ui.jsx';
import { isCompleted } from '../../../public/progress-domain.js';
import { materialStanding, subjectOf, subjectsOverview } from '../../../public/subject-domain.js';

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

function CourseCard({ course, state, open, compact = false, icon = 'file' }) {
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
    <span className="reading-icon"><Icon name={icon}/></span>
    <span className="reading-copy"><strong>{course.title}</strong><small>{shownScope}{subject ? ` · ${subject.title}` : ''}{reading?.done ? ` · ${course.pdf.pages} p.` : ''}</small></span>
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
  // Concluídos saem de Cursos e Leituras e ficam só em "Trilhas concluídas".
  const done = (course) => courseStatus(state, course) === 'completed';
  const trails = courses.filter((course) => !course.pdf && !done(course));
  const readings = courses.filter((course) => course.pdf && !done(course));
  const finished = courses.filter(done);
  const subjects = subjectsOverview(state).filter((item) => item.subject && (!query || item.subject.title.toLocaleLowerCase('pt-BR').includes(query)));
  // "Continuar agora" segue a disciplina escolhida (regra em study-plan.js).
  const resume = resumeMaterial(state);
  const action = resume?.action || null;
  const selected = resume?.course || null;
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
            <Icon name="tune"/><span>Filtro{filter !== 'all' ? `: ${statuses[filter]}` : ''}</span>
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
      {resume?.subjectDone && <section className="library-resume" aria-labelledby="library-resume-title">
        <div className="library-section-label"><span><Icon name="play"/>Continuar agora</span></div>
        <div className="card-surface resume-card">
          <div className="resume-copy">
            <div className="resume-meta"><span className="soft-badge tone-mint">{resume.subjectDone.title}</span></div>
            <h2 id="library-resume-title" className="title">Disciplina concluída</h2>
            <p className="muted-text">Todos os materiais de {resume.subjectDone.title} estão concluídos. Escolha um material de outra disciplina para continuar por ela.</p>
          </div>
          <div className="resume-actions">
            <a className="button secondary" href={`#disciplinas?id=${encodeURIComponent(resume.subjectDone.id)}`}><Icon name="school"/>Abrir disciplina</a>
          </div>
        </div>
      </section>}
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
              ? <Button onClick={() => open({ type: 'pdf', id: selected.id })}><Icon name="book"/>{selected.reading ? `Continuar na p. ${selected.reading.page}` : 'Abrir no leitor'}</Button>
              : <Button onClick={() => open({ type: 'session', id: selected.id })}><Icon name="play"/>Continuar meu próximo passo</Button>}
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

      {finished.length > 0 && <section className="library-section" aria-labelledby="library-finished-title">
        <div className="library-section-head">
          <span className="card-icon tone-mint"><Icon name="trophy"/></span>
          <div><h2 id="library-finished-title" className="title">Trilhas concluídas</h2><p className="card-subtitle">Cursos e leituras que você levou até o fim.</p></div>
          <span className="metric-label">{finished.length} {finished.length === 1 ? 'concluída' : 'concluídas'}</span>
        </div>
        <div className="reading-list">{finished.map(course => <CourseCard key={course.id} course={course} state={state} open={open} compact icon="check"/>)}</div>
      </section>}

      {!courses.length && <Empty title="Nenhum material neste filtro." onAdd={() => open({ type: 'new' })}>Troque o filtro ou importe um curso por link.</Empty>}
      <p className="today-quote"><Icon name="compass"/><span>Feito com cuidado para quem aprende no próprio compasso.</span></p>
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
