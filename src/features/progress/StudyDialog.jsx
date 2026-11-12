import { useState } from 'react';
import { achievements, courseProgress, hasPreparation, materialType } from '../../../public/domain.js';
import { materialSteps, materialLesson } from '../../../public/material-model.js';
import LessonTree from '../library/LessonTree.jsx';
import {
  courseSummary, editalCoverage, formatDuration, isImportedCourse, nextLessonAfter, openLessons, pendingLessonsThrough,
  lessonOrigin, looksLikeExamCourse, sourceLabel,
} from '../../../public/import-domain.js';
import { slidesSummary } from '../../../public/slides-domain.js';
import { nextAction } from '../../../public/study-plan.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Cover, Glow, Progress } from '../../ui/ui.jsx';
import { Steps } from '../library/Study.jsx';
import ImportCourse from '../library/ImportCourse.jsx';
import CourseEditor, { ManualCourseForm } from '../library/CourseEditor.jsx';
import { SlidesEditor, SlidesViewer } from '../library/Slides.jsx';
import AttachPdf from '../library/AttachPdf.jsx';
import PdfReader, { PdfDetails } from '../library/PdfReader.jsx';
import { CollaborationPanel } from '../library/Collaboration.jsx';
import { isCompleted } from '../../../public/progress-domain.js';

const ORIGIN_LABEL = { manual: 'registro manual', integration: 'integração', import: 'progresso importado da fonte' };
const EXTRACTION_LABEL = {
  'structured-data': 'dados publicados pela fonte',
  'page-outline': 'estrutura visível da página',
  'pasted-text': 'texto colado',
  'file-import': 'arquivo enviado',
  'ai-assisted': 'texto organizado por IA',
};

function dateLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function materialLabel(course) {
  return materialType(course?.type).title;
}

// Depois de uma conclusão, a resposta é o próximo passo concreto, não um elogio genérico.
function nextLine(state) {
  const following = nextAction(state);
  return following ? `Próxima: ${following.title} · ${following.courseTitle}.` : 'Não há outra etapa pendente nos seus materiais ativos.';
}

export default function StudyDialog({ modal, state, libraryActions, progressActions, open, close, notify, go, account }) {
  const course = state.courses.find(course => course.id === modal.id);

  if (modal.type === 'new' || modal.type === 'import') {
    return <ImportCourse state={state} actions={libraryActions} close={close} notify={notify} go={go} open={open} modal={{ courseId: modal.type === 'import' ? modal.id : null, capture: modal.capture }}/>;
  }
  if (modal.type === 'pdf-attach') {
    return <AttachPdf state={state} actions={libraryActions} close={close} notify={notify} open={open} go={go} account={account} subjectId={modal.subjectId || ''}/>;
  }
  if (modal.type === 'manual') {
    return <ManualCourseForm actions={libraryActions} close={close} notify={notify} open={open}/>;
  }

  if (modal.type === 'success') return <div className="success-content">
    <Glow palette={modal.preparation ? 'mint' : 'lume'}/>
    <div className="success-body">
      <div className={`dialog-emblem ${modal.preparation ? 'tone-mint' : ''}`}><Icon name={modal.preparation ? 'sprout' : 'spark'}/></div>
      <h2 id="dialog-title" className="headline">{modal.preparation ? 'Material preparado.' : modal.stepTitle ? `Você concluiu ${modal.stepTitle}.` : 'Etapa concluída.'}</h2>
      <p className="muted-text">{modal.preparation ? 'A etapa continua pendente: o avanço é registrado quando você a conclui.' : nextLine(state)}</p>
      <p className="quiet-note">Progresso registrado. Em uma conta, o XP elegível é confirmado pelo servidor e aparece no seu nível e em Conquistas; na prévia, ele não vale para ranking. Preparação não concede XP.</p>
      {state.preferences.gamification && modal.xp > 0 && <span className="success-xp"><Icon name="spark"/>+{modal.xp} XP de legado</span>}
      {modal.award && state.preferences.gamification && <div className="new-achievement"><Icon name={modal.award.icon}/><strong>{modal.award.title}</strong></div>}
      <Button className="full-width" onClick={() => { close(); go('hoje'); }}>Voltar ao Início<Icon name="arrow"/></Button>
      {modal.preparation && <button className="text-button centered" onClick={() => open({ type: 'session', id: modal.id })}>Quero continuar a etapa</button>}
    </div>
  </div>;

  if (!course) return <div className="dialog-content"><h2 id="dialog-title" className="title">Este curso não está disponível.</h2><Button onClick={close}>Voltar</Button></div>;

  if (modal.type === 'delete') return <DeleteCourse course={course} actions={libraryActions} close={close} notify={notify}/>;
  if (modal.type === 'edit') return <CourseEditor course={course} actions={libraryActions} close={close} notify={notify}/>;
  if (course.pdf && ['pdf', 'session'].includes(modal.type)) return <PdfReader course={course} state={state} actions={libraryActions} progressActions={progressActions} notify={notify} open={open} account={account}/>;
  if (course.pdf && modal.type === 'course') return <PdfDetails course={course} state={state} actions={libraryActions} open={open} close={close}/>;
  if (modal.type === 'slides') return <SlidesViewer course={course} state={state} actions={libraryActions} progressActions={progressActions} close={close} notify={notify} account={account}/>;

  if (isImportedCourse(course)) {
    if (modal.type === 'session') return <ImportedSession course={course} state={state} actions={progressActions} open={open} close={close} notify={notify} stepId={modal.stepId} account={account}/>;
    return <ImportedCourse course={course} state={state} actions={libraryActions} progressActions={progressActions} open={open} close={close} notify={notify}/>;
  }

  const action = nextAction({ ...state, courses: [course] });
  const mission = action && { course, step: materialSteps(course).find((step) => step.id === action.lessonId) };
  if (modal.type === 'course') {
    const progress = courseProgress(state, course);
    const deck = slidesSummary(course);
    return <>
      <div className="dialog-course-cover"><Cover art={course.art}/></div>
      <div className="dialog-content">
        <div className="eyebrow">{course.example ? 'Curso de exemplo' : materialLabel(course)}</div>
        <h2 id="dialog-title" className="headline">{course.title}</h2>
        <p className="muted-text">{progress.done} de {progress.total} etapas concluídas. Seu progresso fica com você.</p>
        {course.resumeAt && <p className="resume-pill"><Icon name="return"/>Parou em: {course.resumeAt}</p>}
        <Progress value={progress.percent} tone="lume" label={`Progresso de ${course.title}`}/>
        {course.url ? <a className="text-link" target="_blank" rel="noopener noreferrer" href={course.url}>Abrir conteúdo do curso<Icon name="external"/></a> : <p className="inline-note"><Icon name="book"/><span>Este curso não tem conteúdo vinculado.</span></p>}
        <Steps course={course} state={state}/>
        <div className="dialog-actions">
          <Button secondary onClick={() => open({ type: 'edit', id: course.id })}><Icon name="edit"/>Editar material</Button>
          {deck.total > 0
            ? <Button secondary onClick={() => open({ type: 'slides', id: course.id })}><Icon name="book"/>Abrir apresentação ({deck.total})</Button>
            : <Button secondary onClick={() => open({ type: 'edit', id: course.id })}><Icon name="plus"/>Adicionar slides</Button>}
          {progress.done < progress.total && <Button secondary onClick={() => libraryActions.togglePause(course.id)}><Icon name={course.paused ? 'play' : 'pause'}/>{course.paused ? 'Retomar curso' : 'Pausar curso'}</Button>}
          {mission && <Button onClick={() => { if (libraryActions.selectMaterial(course.id)) open({ type: 'session', id: course.id }); }}>Continuar<Icon name="arrow"/></Button>}
          {progress.done === progress.total && <span className="completed-message"><Icon name="check"/>Um caminho concluído.</span>}
        </div>
        <details className="slides-details">
          <summary>Apresentação e slides</summary>
          <SlidesEditor course={course} actions={libraryActions} notify={notify}/>
        </details>
        <CollaborationPanel course={course} account={account} notify={notify}/>
        <p className="quiet-note">Editar o material não apaga o XP já confirmado. Excluir remove o progresso registrado neste material, com confirmação.</p>
      </div>
    </>;
  }

  if (!mission) return <div className="dialog-content"><h2 id="dialog-title" className="title">Nenhuma etapa disponível agora.</h2><Button onClick={close}>Voltar</Button></div>;
  function finish() {
    const previous = achievements(state);
    const now = new Date().toISOString();
    const result = progressActions.completeMission(course.id, mission.step.id, { preparation: !!modal.preparation, now });
    if (!result) return;
    if (!result.added) { notify('Esse passo já foi registrado.'); close(); return; }
    const award = achievements(result.state).find(item => item.unlocked && !previous.find(old => old.id === item.id)?.unlocked);
    open({ type: 'success', id: course.id, preparation: modal.preparation, xp: result.xp, award, stepTitle: mission.step.title });
  }
  const pendingAfter = materialSteps(course).filter((step) => step.id !== mission.step.id && !isCompleted(state, step.id)).length;
  // Um passo: registra a etapa e já mostra a seguinte do mesmo material.
  function finishAndContinue() {
    const now = new Date().toISOString();
    const result = progressActions.completeMission(course.id, mission.step.id, { now });
    if (!result) return;
    if (!result.added) { notify('Esse passo já foi registrado.'); return; }
    const following = nextAction({ ...result.state, courses: [result.state.courses.find((item) => item.id === course.id)] });
    notify(`Você concluiu ${mission.step.title}.${following ? ` Agora: ${following.title}.` : ''}`);
    open(following ? { type: 'session', id: course.id } : { type: 'course', id: course.id });
  }
  return <div className="session-content">
    <div className={`dialog-emblem ${modal.preparation ? 'tone-mint' : ''}`}><Icon name={modal.preparation ? 'sprout' : 'focus'}/></div>
    <span className="eyebrow">{modal.preparation ? 'Preparação · sem XP' : 'Etapa · registro manual'}</span>
    <h2 id="dialog-title" className="headline">{modal.preparation ? `Preparar: ${mission.step.title}` : mission.step.title}</h2>
    <p className="session-course">{course.title}</p>
    <p className="dialog-text">{modal.preparation ? 'Abra o material, separe o que precisa ou encontre o link da aula.' : 'Conclua a etapa no material e registre aqui. O registro é manual e identificado como seu.'}</p>
    {course.url ? <a href={course.url} className="button secondary full-width" target="_blank" rel="noopener noreferrer">Abrir material<Icon name="external"/></a> : <p className="inline-note"><Icon name="book"/><span>{course.example ? 'Curso de exemplo, sem aula vinculada. A conclusão é uma simulação.' : 'Use o material de estudo que você escolheu. Não há link cadastrado.'}</span></p>}
    {modal.preparation && <p className="quiet-note">Isso não marcará a aula como concluída.</p>}
    <div className="session-actions">
      {!modal.preparation && pendingAfter > 0 && <Button className="full-width" onClick={finishAndContinue}><Icon name="arrow"/>Concluir e seguir para a próxima</Button>}
      <Button className="full-width" secondary={!modal.preparation && pendingAfter > 0} onClick={finish}><Icon name="check"/>{modal.preparation ? 'Preparei meu material' : 'Concluí esse passo'}</Button>
      {!modal.preparation && !hasPreparation(state, mission.step.id) && <button className="text-button centered" onClick={() => open({ type: 'session', id: course.id, preparation: true })}>Dividir em um passo menor<Icon name="sprout"/></button>}
      <button className="text-button centered" onClick={close}>Fechar · o progresso continua salvo</button>
    </div>
  </div>;
}

// ---------------- Curso importado ----------------

function CapabilityPanel({ capabilities }) {
  if (!capabilities?.length) return null;
  return <details className="import-capabilities">
    <summary>O que esta fonte permite</summary>
    <ul>
      {capabilities.map((item) => <li key={item.id}>
        <span>{item.label}</span>
        <strong className={item.available ? 'available' : 'unavailable'}>{item.value}</strong>
      </li>)}
    </ul>
  </details>;
}

function DeleteCourse({ course, actions, close, notify }) {
  const imported = isImportedCourse(course);
  function remove() {
    if (!actions.deleteMaterial(course.id)) return;
    notify(`"${course.title}" foi excluído. O XP já confirmado permanece no extrato.`);
    close();
  }
  if (course.pdf) return <div className="dialog-content">
    <span className="dialog-emblem tone-warn"><Icon name="close"/></span>
    <h2 id="dialog-title" className="headline">Excluir este PDF?</h2>
    <p className="dialog-text"><strong>{course.title}</strong> · {course.pdf.name}</p>
    <p className="muted-text">Remove o material, a página salva e o arquivo guardado na sua conta, liberando o espaço. O XP já confirmado pelo servidor permanece no extrato e nas conquistas. Para estudar de novo, anexe o arquivo outra vez.</p>
    <div className="dialog-actions">
      <Button className="danger-button full-width" onClick={remove}><Icon name="close"/>Sim, excluir PDF</Button>
      <Button secondary onClick={close}>Manter PDF</Button>
    </div>
  </div>;
  return <div className="dialog-content">
    <span className="dialog-emblem tone-warn"><Icon name="close"/></span>
    <h2 id="dialog-title" className="headline">Excluir este curso?</h2>
    <p className="dialog-text"><strong>{course.title}</strong>{imported ? ' · curso importado' : ''}</p>
    <p className="muted-text">Remove o curso, as aulas e o progresso registrado nele neste aparelho e na sua conta. O XP já confirmado pelo servidor permanece no extrato e nas conquistas. Você pode importar o curso de novo depois, mas as conclusões não voltam.</p>
    <div className="dialog-actions">
      <Button className="danger-button full-width" onClick={remove}><Icon name="close"/>Sim, excluir curso</Button>
      <Button secondary onClick={close}>Manter curso</Button>
    </div>
  </div>;
}

function ImportedSession({ course, state, actions, open, close, notify, stepId, account }) {
  const summary = courseSummary(state, course);
  const step = materialSteps(course).find((item) => item.id === stepId) || summary.next || summary.resume;
  if (!step) return <div className="dialog-content"><h2 id="dialog-title" className="title">Todas as aulas selecionadas foram concluídas.</h2><p className="muted-text">Isso vale para as áreas que você escolheu, não necessariamente para o curso inteiro.</p><Button onClick={close}>Voltar</Button></div>;
  const lesson = materialLesson(course, step.id);
  const done = isCompleted(state, step.id);
  const origin = lessonOrigin(state, step.id);
  const link = lesson?.url || course.url;
  const upcoming = done ? null : nextLessonAfter(state, course, step.id);
  const xpNote = account ? 'O XP é confirmado pelo servidor.' : 'Na prévia, o XP não é validado.';
  function finish() {
    const now = new Date().toISOString();
    const result = actions.completeLesson(course.id, step.id, { origin: 'manual', now });
    if (!result) return;
    if (!result.added) { notify('Essa aula já estava registrada.'); return; }
    const following = nextAction(result.state);
    notify(`Você concluiu ${step.title}.${following ? ` Próxima: ${following.title}.` : ''} ${xpNote}`);
    open({ type: 'course', id: course.id });
  }
  // Um passo: registra a aula, abre a próxima na plataforma (no mesmo clique,
  // para o navegador não bloquear a nova aba) e mostra o registro dela.
  function finishAndContinue() {
    const now = new Date().toISOString();
    const result = actions.completeLesson(course.id, step.id, { origin: 'manual', now });
    if (!result) return;
    if (!result.added) { notify('Essa aula já estava registrada.'); return; }
    const following = nextLessonAfter(result.state, course, step.id);
    if (!following) { notify(`Você concluiu ${step.title}. Não há outra aula em aberto neste curso. ${xpNote}`); open({ type: 'course', id: course.id }); return; }
    const target = following.url || course.url;
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
    notify(`Você concluiu ${step.title}. ${target ? 'Abrimos' : 'Agora é'} ${following.title}. ${xpNote}`);
    open({ type: 'session', id: course.id, stepId: following.id });
  }
  return <div className="session-content">
    <div className="dialog-emblem"><Icon name="focus"/></div>
    <span className="eyebrow">{lesson?.discipline || sourceLabel(course.source)}{lesson?.module ? ` · ${lesson.module}` : ''}</span>
    <h2 id="dialog-title" className="headline">{step.title}</h2>
    <p className="session-course">{course.title}</p>
    {lesson?.duration ? <p className="quiet-note"><Icon name="clock"/>Duração informada pela fonte: {formatDuration(lesson.duration)}</p> : null}
    <p className="dialog-text">Abra a aula na plataforma. Ao terminar, registre a conclusão aqui — o Lume não observa o vídeo em outra aba.</p>
    {link ? <a href={link} className="button secondary full-width" target="_blank" rel="noopener noreferrer">Abrir aula na plataforma<Icon name="external"/></a> : <p className="inline-note"><Icon name="book"/><span>A fonte não publicou um link direto para esta aula. Use o link do curso.</span></p>}
    <p className="inline-note"><Icon name="shield"/><span>Origem do registro: {origin ? ORIGIN_LABEL[origin] : 'ainda não concluída'} · nenhuma integração de progresso ativa.</span></p>
    <div className="session-actions">
      {done
        ? <p className="completed-message"><Icon name="check"/>Já registrada como concluída.</p>
        : upcoming
          ? <>
            <Button className="full-width" onClick={finishAndContinue}><Icon name="arrow"/>Concluir e abrir a próxima</Button>
            <Button secondary className="full-width" onClick={finish}><Icon name="check"/>Concluí esta aula</Button>
            <p className="quiet-note">Próxima: {upcoming.title}{upcoming.duration ? ` · ${formatDuration(upcoming.duration)}` : ''}</p>
          </>
          : <Button className="full-width" onClick={finish}><Icon name="check"/>Concluí esta aula</Button>}
      <button className="text-button centered" onClick={() => open({ type: 'course', id: course.id })}>Ver todas as aulas</button>
      <button className="text-button centered" onClick={close}>Fechar · o progresso continua salvo</button>
    </div>
  </div>;
}

// Conclusão em lote: para quem assistiu várias aulas seguidas na plataforma e
// volta para registrar. Cada aula vira um registro manual próprio; o lote não
// rende XP extra.
function BatchCompletion({ course, state, actions, notify }) {
  const open = openLessons(state, course);
  const [through, setThrough] = useState('');
  if (open.length < 2) return null;
  const chosen = open.some((lesson) => lesson.id === through) ? through : open[1].id;
  const count = pendingLessonsThrough(state, course, chosen).length;
  function register() {
    const now = new Date().toISOString();
    const result = actions.completeLessonsThrough(course.id, chosen, { now });
    if (!result) return;
    if (!result.added) { notify('Essas aulas já estavam registradas.'); return; }
    notify(`${result.added} ${result.added === 1 ? 'aula registrada' : 'aulas registradas'} por você, em sequência. Cada uma pode ser desfeita na lista abaixo.`);
    setThrough('');
  }
  return <details className="batch-completion">
    <summary>Já assisti várias aulas em sequência</summary>
    <p className="quiet-note">Registra como concluídas, de uma vez, as aulas em aberto do começo da lista até a aula escolhida. Use só para o que você já estudou.</p>
    <label className="field">Até a aula
      <select value={chosen} onChange={(event) => setThrough(event.target.value)}>
        {open.map((lesson, index) => <option key={lesson.id} value={lesson.id}>{index + 1}. {lesson.title}</option>)}
      </select>
    </label>
    <Button secondary onClick={register}><Icon name="check"/>Registrar {count} {count === 1 ? 'aula' : 'aulas'}</Button>
  </details>;
}

function ImportedCourse({ course, state, actions, progressActions, open, close, notify }) {
  const summary = courseSummary(state, course);
  const [edition, setEdition] = useState(course.edital?.edition || '');
  const [phase, setPhase] = useState(course.edital?.phase || '');
  const [coverage, setCoverage] = useState(null);
  const capabilities = course.source?.capabilities || [];
  const examLike = looksLikeExamCourse(course);
  const nextStep = summary.next;

  function markLesson(stepId) {
    const now = new Date().toISOString();
    const result = progressActions.completeLesson(course.id, stepId, { origin: 'manual', now });
    if (!result) return;
    if (!result.added) { notify('Essa aula já estava registrada.'); return; }
    notify('Conclusão registrada por você. Em uma conta, o XP elegível é confirmado pelo servidor.');
  }
  function undoLesson(stepId) {
    const now = new Date().toISOString();
    const result = progressActions.revertLesson(course.id, stepId, { now });
    if (!result) return;
    if (!result.reverted) {
      notify(result.reason === 'integration'
        ? 'Este registro veio de uma integração e não pode ser desfeito aqui.'
        : result.reason === 'import'
          ? 'Este progresso veio da página importada e não pode ser desfeito por aqui.'
          : 'Nada para desfazer.');
      return;
    }
    notify('Conclusão manual desfeita. O histórico guarda que ela existiu.');
  }
  function saveEdital() {
    const value = { exam: 'OAB', edition: edition.trim(), phase, requestedAt: new Date().toISOString() };
    if (!actions.setEdital(course.id, value)) return;
    setCoverage(editalCoverage(course, { edition: value.edition, phase }));
  }

  const nextLesson = summary.next ? materialLesson(course, summary.next.id) : null;
  const deck = slidesSummary(course);

  return <div className="dialog-content imported-course">
    <span className="eyebrow">{sourceLabel(course.source)}{course.source?.demo ? ' · demonstração' : ''}</span>
    <h2 id="dialog-title" className="headline">{course.title}</h2>
    <div className="dialog-actions inline-actions">
      <Button secondary onClick={() => open({ type: 'edit', id: course.id })}><Icon name="edit"/>Editar material</Button>
      {deck.total > 0
        ? <Button secondary onClick={() => open({ type: 'slides', id: course.id })}><Icon name="book"/>Abrir apresentação ({deck.total})</Button>
        : <Button secondary onClick={() => open({ type: 'edit', id: course.id })}><Icon name="plus"/>Adicionar slides</Button>}
    </div>
    <div className="import-badges">
      <span className={`import-badge ${summary.partial ? 'tone-warn' : 'tone-mint'}`}><Icon name={summary.partial ? 'help' : 'check'}/>{summary.partial ? 'Grade parcial' : 'Grade publicada pela fonte'}</span>
      <span className="import-badge neutral"><Icon name="book"/>{summary.disciplines.length} {summary.disciplines.length === 1 ? 'área' : 'áreas'} · {summary.total} aulas</span>
    </div>

    <section className="import-progress">
      <div className="course-progress-label"><span>{summary.done} de {summary.total} aulas selecionadas</span><strong>{summary.percent}%</strong></div>
      <Progress value={summary.percent} tone="lume" label={`Progresso nas áreas escolhidas de ${course.title}`}/>
      <p className="quiet-note">{summary.partial ? 'Progresso calculado só sobre as áreas e aulas conhecidas. Isso não representa a conclusão do curso inteiro.' : 'Progresso calculado sobre as aulas selecionadas. Conclusão do curso inteiro exige todas as unidades obrigatórias da fonte.'}</p>
      {summary.removedFromSource && <p className="inline-note"><Icon name="help"/><span>Algumas aulas não aparecem mais na fonte. Elas continuam aqui para preservar seu histórico.</span></p>}
      {summary.importedDone > 0 && <p className="inline-note"><Icon name="check"/><span>{summary.importedDone} {summary.importedDone === 1 ? 'aula veio marcada como concluída' : 'aulas vieram marcadas como concluídas'} na página importada. Esse histórico não concede XP; as próximas conclusões manuais são elegíveis.</span></p>}
    </section>

    {summary.disciplines.length > 1 && <section className="import-discipline-progress" aria-label="Progresso por área">
      {summary.disciplines.map((discipline) => <div key={discipline.id} className="import-discipline-progress-row">
        <span>{discipline.title}{discipline.removedFromSource ? ' · removida da fonte' : ''}</span>
        <Progress value={discipline.percent} tone={discipline.percent === 100 ? 'mint' : 'lume'} label={`Progresso em ${discipline.title}`}/>
        <strong>{discipline.done}/{discipline.total}</strong>
      </div>)}
    </section>}

    {nextLesson && <section className="import-next">
      <span className="eyebrow">Próxima aula</span>
      <strong>{nextLesson.title}</strong>
      <small>{nextLesson.discipline}{nextLesson.module ? ` · ${nextLesson.module}` : ''}{nextLesson.duration ? ` · ${formatDuration(nextLesson.duration)}` : ''}</small>
      <div className="action-row">
        <Button onClick={() => open({ type: 'session', id: course.id, stepId: nextLesson.id })}><Icon name="play"/>Abrir e registrar</Button>
        <Button secondary onClick={() => markLesson(nextLesson.id)}><Icon name="check"/>Já concluí</Button>
      </div>
    </section>}
    {!nextLesson && summary.total > 0 && <p className="completed-message"><Icon name="check"/>Áreas selecionadas concluídas. O curso inteiro só é concluído com todas as unidades da fonte.</p>}

    {summary.resume && summary.resume.id !== nextLesson?.id && <p className="quiet-note"><Icon name="return"/>Ponto de retomada: {summary.resume.title} · {dateLabel(summary.lastStudiedAt)}</p>}

    <BatchCompletion course={course} state={state} actions={progressActions} notify={notify}/>

    <LessonTree key={course.id} course={course} state={state} disciplines={summary.disciplines} onComplete={markLesson} onRevert={undoLesson}/>

    <CapabilityPanel capabilities={capabilities}/>

    <details className="slides-details">
      <summary>Apresentação e slides</summary>
      <SlidesEditor course={course} actions={actions} notify={notify}/>
    </details>

    <div className="import-source">
      {course.url ? <a className="text-link" href={course.url} target="_blank" rel="noopener noreferrer">Abrir conteúdo na plataforma<Icon name="external"/></a> : <p className="inline-note"><Icon name="book"/><span>A fonte não tem link público do curso.</span></p>}
      <p className="quiet-note">Conteúdo analisado em {dateLabel(course.source?.fetchedAt)} · {EXTRACTION_LABEL[course.source?.extraction?.kind] || 'conteúdo importado'}.</p>
    </div>

    {examLike && <section className="import-edital">
      <span className="eyebrow">Cobertura do edital</span>
      <p className="quiet-note">A grade do curso e o edital da prova são referências diferentes. Preencha a edição e a fase para comparar.</p>
      <div className="form-grid">
        <label className="field">Edição<input value={edition} onChange={(event) => setEdition(event.target.value)} placeholder="Ex.: 1º Exame de 2026" maxLength={40}/></label>
        <label className="field">Fase<select value={phase} onChange={(event) => setPhase(event.target.value)}><option value="">Não sei ainda</option><option value="1ª fase">1ª fase</option><option value="2ª fase">2ª fase</option></select></label>
      </div>
      <Button secondary onClick={saveEdital}><Icon name="compass"/>Comparar com o edital</Button>
      {coverage && (coverage.available
        ? <div className="import-coverage">
          <p>{coverage.message}</p>
          <p className="quiet-note">Fonte: {coverage.source.name} · publicado em {dateLabel(coverage.source.publishedAt)} · conferido em {dateLabel(coverage.source.checkedAt)}</p>
          <p>Previsto no edital e não encontrado no curso: <strong>{coverage.missing.length ? coverage.missing.join(', ') : 'nenhum tema cadastrado'}</strong></p>
        </div>
        : <p className="inline-note"><Icon name="help"/><span>{coverage.message}</span></p>)}
    </section>}

    <div className="dialog-actions">
      <Button secondary onClick={() => open({ type: 'import', id: course.id })}><Icon name="return"/>Atualizar grade</Button>
      {nextStep && <Button onClick={() => open({ type: 'session', id: course.id, stepId: nextStep.id })}>Continuar<Icon name="arrow"/></Button>}
      <button className="text-button centered" onClick={close}>Fechar</button>
    </div>
  </div>;
}
