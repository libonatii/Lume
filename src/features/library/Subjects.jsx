import { useState } from 'react';
import { SUBJECT_COLORS, SUBJECT_COLOR_LABELS, subjectOverview, subjectsOverview } from '../../../public/subject-domain.js';
import { materialType } from '../../../public/domain.js';
import Icon from '../../ui/Icon.jsx';
import { Button, Heading, Progress } from '../../ui/ui.jsx';

// Abre o ponto de retomada de um material: PDF no leitor, demais no diálogo.
function resumeTarget(course) {
  return course.pdf ? { type: 'pdf', id: course.id } : { type: 'course', id: course.id };
}

function resumeText(item) {
  return item.course.pdf && item.course.reading ? `${item.course.title} · p. ${item.course.reading.page}` : item.course.title;
}

function SubjectForm({ actions, notify, initial = null, onDone }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [keywords, setKeywords] = useState((initial?.keywords || []).join(', '));
  const [color, setColor] = useState(initial?.color || 'lume');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    try {
      const result = initial ? actions.updateSubject(initial.id, { title, keywords, color }) : actions.addSubject({ title, keywords, color });
      if (!result) return;
      setError('');
      if (!initial) { setTitle(''); setKeywords(''); setColor('lume'); }
      notify(initial ? 'Disciplina atualizada.' : 'Disciplina criada. Vincule PDFs e outros materiais a ela.');
      onDone?.();
    } catch (exception) {
      setError(exception.message);
    }
  }
  return <form className="form-stack subject-form" onSubmit={submit}>
    <label className="field">Nome da disciplina
      <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Direito Penal" required/>
    </label>
    <label className="field">Palavras-chave (opcional)
      <input value={keywords} maxLength={600} onChange={(event) => setKeywords(event.target.value)} placeholder="Ex.: inquérito, ação penal, prisão preventiva"/>
    </label>
    <div className="stitch-color-row">
      <span>Cor de identificação</span>
      <div className="stitch-color-pills" role="radiogroup" aria-label="Cor da disciplina">
        {SUBJECT_COLORS.map((item) => <button key={item} type="button" role="radio" aria-checked={color === item} aria-label={SUBJECT_COLOR_LABELS[item]} title={SUBJECT_COLOR_LABELS[item]} className={`stitch-color-dot color-${item} ${color === item ? 'is-selected' : ''}`} onClick={() => setColor(item)}>{color === item && <Icon name="check"/>}</button>)}
      </div>
    </div>
    <p className="quiet-note">As palavras-chave ajudam o leitor inteligente a reconhecer páginas desta disciplina. Separe com vírgulas.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="action-row">
      <Button type="submit"><Icon name={initial ? 'check' : 'plus'}/>{initial ? 'Salvar disciplina' : 'Criar disciplina'}</Button>
      {initial && <Button ghost onClick={onDone}>Cancelar</Button>}
    </div>
  </form>;
}

function SubjectDetail({ state, id, actions, open, go, notify }) {
  const overview = subjectOverview(state, id);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [linking, setLinking] = useState('');
  const subject = overview.subject;
  if (!subject) return <section className="card-surface settings-panel">
    <h2 className="title">Disciplina não encontrada.</h2>
    <Button onClick={() => go('disciplinas')}>Ver disciplinas</Button>
  </section>;
  const unlinked = state.courses.filter((course) => !course.subjectId);
  return <div className="subject-detail">
    <Heading eyebrow="Disciplina" title={subject.title} actions={<>
      <Button secondary onClick={() => go('disciplinas')}><Icon name="back"/>Todas as disciplinas</Button>
      <Button onClick={() => open({ type: 'pdf-attach', subjectId: subject.id })}><Icon name="plus"/>Anexar PDF</Button>
    </>}>
      {overview.total ? `${overview.done} de ${overview.total} materiais concluídos.` : 'Nenhum material vinculado ainda.'}
      {overview.pagesTotal ? ` Páginas abertas nos PDFs: até ${overview.pagesReached} de ${overview.pagesTotal}.` : ''}
    </Heading>

    {overview.resume && <section className="card-surface subject-resume" aria-labelledby="subject-resume-title">
      <span className="pill"><Icon name="return"/>Retomar de onde parou</span>
      <h2 id="subject-resume-title" className="headline">{resumeText(overview.resume)}</h2>
      {overview.resume.course.reading?.section && <p className="muted-text">{overview.resume.course.reading.section}</p>}
      <div className="action-row"><Button onClick={() => open(resumeTarget(overview.resume.course))}><Icon name="play"/>Continuar</Button></div>
    </section>}

    <section className="card-surface subject-materials" aria-labelledby="subject-materials-title">
      <h2 id="subject-materials-title" className="title">Materiais</h2>
      {overview.materials.length ? <ul className="subject-material-list">{overview.materials.map((item) => <li key={item.course.id}>
        <div className="subject-material-head">
          <button type="button" className="text-button" onClick={() => open(resumeTarget(item.course))}><Icon name="book"/>{item.course.title}</button>
          <small>{materialType(item.course.type).title} · {item.label}{item.course.paused ? ' · pausado' : ''}</small>
        </div>
        <Progress value={item.percent} tone={item.done ? 'mint' : 'lume'} label={`Avanço em ${item.course.title}`}/>
        {item.sections.length > 0 && <details className="subject-sections">
          <summary>{item.sections.length} {item.sections.length === 1 ? 'seção percorrida' : 'seções percorridas'}</summary>
          <ul>{item.sections.map((title, index) => <li key={`${title}-${index}`}>{title}</li>)}</ul>
        </details>}
        <button type="button" className="text-button subtle" onClick={() => actions.linkSubject(item.course.id, '')}>Desvincular</button>
      </li>)}</ul> : <p className="muted-text">Anexe um PDF ou vincule um material que já está na biblioteca.</p>}
      {unlinked.length > 0 && <form className="subject-link" onSubmit={(event) => { event.preventDefault(); if (linking && actions.linkSubject(linking, subject.id)) setLinking(''); }}>
        <label className="field">Vincular material da biblioteca
          <select value={linking} onChange={(event) => setLinking(event.target.value)}>
            <option value="">Escolha um material…</option>
            {unlinked.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
        <Button secondary type="submit" disabled={!linking}><Icon name="plus"/>Vincular</Button>
      </form>}
      <p className="quiet-note">Seções percorridas vêm do sumário do PDF até a página mais adiante aberta. É um mapa de retomada, não prova de leitura.</p>
    </section>

    <section className="card-surface subject-settings" aria-labelledby="subject-settings-title">
      <h2 id="subject-settings-title" className="title">Ajustes da disciplina</h2>
      {editing
        ? <SubjectForm actions={actions} notify={notify} initial={subject} onDone={() => setEditing(false)}/>
        : <>
          <p className="muted-text">{subject.keywords.length ? `Palavras-chave: ${subject.keywords.join(', ')}.` : 'Sem palavras-chave.'}</p>
          <div className="action-row">
            <Button secondary onClick={() => setEditing(true)}><Icon name="edit"/>Editar</Button>
            {confirming
              ? <><Button className="danger" onClick={() => { if (actions.deleteSubject(subject.id)) { notify('Disciplina excluída. Os materiais continuam na biblioteca.'); go('disciplinas'); } }}><Icon name="trash"/>Confirmar exclusão</Button><Button ghost onClick={() => setConfirming(false)}>Cancelar</Button></>
              : <Button ghost onClick={() => setConfirming(true)}><Icon name="trash"/>Excluir disciplina</Button>}
          </div>
          {confirming && <p className="quiet-note" role="status">Excluir só desfaz os vínculos. Materiais, progresso e XP permanecem.</p>}
        </>}
    </section>
  </div>;
}

export default function Subjects({ state, actions, open, go, notify, id = '' }) {
  if (id) return <div className="subjects-root"><SubjectDetail state={state} id={id} actions={actions} open={open} go={go} notify={notify}/></div>;
  const overviews = subjectsOverview(state);
  const unlinked = state.courses.filter((course) => !course.subjectId).length;
  return <div className="subjects-root">
    <Heading eyebrow="Matérias & retomada" title="Disciplinas" actions={<Button onClick={() => open({ type: 'pdf-attach' })}><Icon name="plus"/>Anexar PDF</Button>}>
      Agrupe PDFs e outros materiais por matéria, veja o que já percorreu e continue de onde parou.
    </Heading>
    <div className="subjects-grid">
      {overviews.map((overview) => <article key={overview.subject.id} className={`card-surface subject-card color-${overview.subject.color || 'lume'}`}>
        <h2 className="title"><a className="text-link" href={`#disciplinas?id=${encodeURIComponent(overview.subject.id)}`}>{overview.subject.title}</a></h2>
        <p className="muted-text">{overview.total} {overview.total === 1 ? 'material' : 'materiais'} · {overview.done} {overview.done === 1 ? 'concluído' : 'concluídos'}{overview.pagesTotal ? ` · até p. ${overview.pagesReached} de ${overview.pagesTotal}` : ''}</p>
        <Progress value={overview.percent} tone="lume" label={`Avanço em ${overview.subject.title}`}/>
        {overview.resume
          ? <Button secondary onClick={() => open(resumeTarget(overview.resume.course))}><Icon name="play"/>Continuar: {resumeText(overview.resume)}</Button>
          : <p className="quiet-note">{overview.total ? 'Tudo concluído ou pausado nesta disciplina.' : 'Sem materiais vinculados.'}</p>}
      </article>)}
      <section className="card-surface subject-card subject-new" aria-labelledby="subject-new-title">
        <h2 id="subject-new-title" className="title">{overviews.length ? 'Nova disciplina' : 'Crie sua primeira disciplina'}</h2>
        <SubjectForm actions={actions} notify={notify}/>
      </section>
    </div>
    {unlinked > 0 && <p className="quiet-note">{unlinked} {unlinked === 1 ? 'material da biblioteca está' : 'materiais da biblioteca estão'} sem disciplina. Vincule pela página da disciplina ou pelo detalhe do material.</p>}
    <p className="quiet-note">Disciplinas organizam a biblioteca e não geram XP. O XP vem de concluir aulas, leituras e entregas.</p>
  </div>;
}
