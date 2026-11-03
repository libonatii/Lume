import { useState } from 'react';
import {
  STUDY_TYPES, formatVideoTime, normalizePosition, resumeLabel,
} from '../../../public/domain.js';
import { isImportedCourse } from '../../../public/import-domain.js';
import { materialSteps } from '../../../public/material-model.js';
import Icon from '../../ui/Icon.jsx';
import { Button } from '../../ui/ui.jsx';

export function ManualCourseForm({ actions, close, notify, open }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('course');
  const [url, setUrl] = useState('');
  const [steps, setSteps] = useState('');
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const lines = steps.split('\n').map((line) => line.trim()).filter(Boolean);
      const result = actions.addMaterial({
        title,
        url,
        type,
        steps: lines,
        firstActivity: 'Concluir a primeira atividade',
        planning: false,
      }, 'manual');
      if (!result) return;
      notify('Material criado. Agora você pode adicionar slides e registrar seu progresso.');
      const id = result.state.selectedCourseId;
      close();
      if (id) open({ type: 'course', id });
    } catch (exception) {
      setError(exception.message);
    }
  }
  return <div className="dialog-content course-editor">
    <span className="eyebrow">Sem depender de um link</span>
    <h2 id="dialog-title" className="headline">Criar material manualmente</h2>
    <p className="muted-text">Use quando o conteúdo é um livro, uma aula presencial, um projeto ou outra fonte que não tem uma página para importar.</p>
    <form className="form-stack" onSubmit={submit}>
      <label className="field">Título
        <input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Introdução a Processo Penal" required/>
      </label>
      <label className="field">Tipo de material
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {STUDY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <label className="field">Link (opcional)
        <input value={url} maxLength={2000} inputMode="url" onChange={(event) => setUrl(event.target.value)} placeholder="https://…"/>
      </label>
      <label className="field">Etapas, uma por linha (opcional)
        <textarea value={steps} rows={4} maxLength={2000} onChange={(event) => setSteps(event.target.value)} placeholder={'Ler a introdução\nResolver os exercícios do capítulo'} />
      </label>
      <p className="quiet-note">Criar o material não concede XP. As etapas podem ser editadas depois.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button type="submit"><Icon name="plus"/>Criar material</Button>
        <Button secondary type="button" onClick={close}>Cancelar</Button>
      </div>
    </form>
  </div>;
}

export default function CourseEditor({ course, actions, close, notify }) {
  const imported = isImportedCourse(course);
  const [title, setTitle] = useState(course.title);
  const [url, setUrl] = useState(course.url || '');
  const [type, setType] = useState(course.type || 'course');
  const [position, setPosition] = useState(() => normalizePosition(course.position, course.type) || {});
  const [steps, setSteps] = useState(() => materialSteps(course).map((step) => step.title));
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  function changeStep(index, value) {
    setSteps((previous) => previous.map((step, position) => position === index ? value : step));
  }
  function removeStep(index) {
    setSteps((previous) => previous.filter((_, position) => position !== index));
  }
  function moveStep(index, direction) {
    setSteps((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function save(event) {
    event.preventDefault();
    setError('');
    try {
      if (!actions.editMaterial(course.id, { title, url, type, position }, imported ? undefined : steps)) return;
      notify('Material atualizado.');
      close();
    } catch (exception) {
      setError(exception.message);
    }
  }
  function removeCourse() {
    if (!actions.deleteMaterial(course.id)) return;
    notify('Material excluído. O XP já concedido permanece no seu extrato.');
    close();
  }

  return <div className="dialog-content course-editor">
    <span className="eyebrow">Editar material</span>
    <h2 id="dialog-title" className="headline">{course.title}</h2>
    <form className="form-stack" onSubmit={save}>
      <label className="field">Título
        <input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} required/>
      </label>
      {!imported && <label className="field">Link do material (opcional)
        <input value={url} maxLength={2000} inputMode="url" onChange={(event) => setUrl(event.target.value)} placeholder="https://…"/>
      </label>}
      <label className="field">Tipo de material
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {STUDY_TYPES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      {type === 'video' && <label className="field">{resumeLabel(type)}
        <input value={position.value ?? (Number.isFinite(position.seconds) ? formatVideoTime(position.seconds) : '')} onChange={(event) => setPosition({ kind: 'video', value: event.target.value })} placeholder="Ex.: 12:30" inputMode="numeric"/>
      </label>}
      {type === 'article' && <div className="field-row">
        <label className="field">Página
          <input value={position.page || ''} onChange={(event) => setPosition((previous) => ({ ...previous, page: event.target.value }))} placeholder="Ex.: 12" maxLength={40}/>
        </label>
        <label className="field">Seção
          <input value={position.section || ''} onChange={(event) => setPosition((previous) => ({ ...previous, section: event.target.value }))} placeholder="Ex.: seção 3" maxLength={80}/>
        </label>
      </div>}
      {type === 'book' && <label className="field">{resumeLabel(type)}
        <input value={position.chapter || ''} onChange={(event) => setPosition({ chapter: event.target.value })} placeholder="Ex.: capítulo 4" maxLength={120}/>
      </label>}
      {type === 'exercise' && <div className="field-row">
        <label className="field">Exercício atual
          <input value={position.current || ''} onChange={(event) => setPosition((previous) => ({ ...previous, current: event.target.value }))} placeholder="Ex.: questão 8" maxLength={120}/>
        </label>
        <label className="field">Tentativas
          <input type="number" min="0" max="999" value={position.attempts || ''} onChange={(event) => setPosition((previous) => ({ ...previous, attempts: Number(event.target.value) || 0 }))}/>
        </label>
      </div>}
      {(type === 'project' || type === 'lesson' || type === 'course') && <label className="field">{resumeLabel(type)}
        <input value={position.next || ''} onChange={(event) => setPosition({ next: event.target.value })} placeholder={type === 'project' ? 'Ex.: implementar a autenticação' : 'Ex.: aula 3'} maxLength={120}/>
      </label>}
      <p className="quiet-note">A posição é declarada por você; o Lume não observa a reprodução ou a leitura de outro site.</p>

      {imported
        ? <p className="inline-note"><Icon name="lock"/><span>As etapas deste curso vêm da fonte. Para mudar a grade, use <strong>Atualizar grade</strong> no detalhe do curso.</span></p>
        : <section className="course-steps-editor" aria-labelledby="steps-editor-title">
          <div className="course-steps-head">
            <div>
              <strong id="steps-editor-title" className="title">Etapas</strong>
              <p className="quiet-note">Renomear mantém o progresso da mesma posição. Remover uma etapa apaga o registro dela.</p>
            </div>
            <Button secondary type="button" onClick={() => setSteps((previous) => [...previous, ''])} disabled={steps.length >= 40}><Icon name="plus"/>Adicionar etapa</Button>
          </div>
          <ol className="course-steps-edit-list">
            {steps.map((step, index) => <li key={index} className="course-step-edit">
              <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
              <input value={step} maxLength={180} aria-label={`Etapa ${index + 1}`} onChange={(event) => changeStep(index, event.target.value)} placeholder="Ex.: Assistir à aula 1"/>
              <div className="step-edit-actions">
                <button type="button" className="icon-button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label={`Mover a etapa ${index + 1} para cima`}><Icon name="chevron-up"/></button>
                <button type="button" className="icon-button" onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} aria-label={`Mover a etapa ${index + 1} para baixo`}><Icon name="chevron-down"/></button>
                <button type="button" className="icon-button" onClick={() => removeStep(index)} disabled={steps.length === 1} aria-label={`Remover a etapa ${index + 1}`}><Icon name="close"/></button>
              </div>
            </li>)}
          </ol>
        </section>}

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button type="submit"><Icon name="check"/>Salvar alterações</Button>
        <Button secondary type="button" onClick={close}>Cancelar</Button>
      </div>
    </form>

    <section className="danger-zone" aria-labelledby="delete-course-title">
      <div>
        <strong id="delete-course-title" className="title">Excluir este material</strong>
        <p className="muted-text">Remove o material, as etapas e o progresso registrado nele. O XP já confirmado permanece no extrato e nas conquistas.</p>
      </div>
      {confirming
        ? <div className="dialog-actions inline-actions">
          <Button className="danger-button" type="button" onClick={removeCourse}><Icon name="close"/>Sim, excluir</Button>
          <Button secondary type="button" onClick={() => setConfirming(false)}>Manter material</Button>
        </div>
        : <Button secondary type="button" onClick={() => setConfirming(true)}><Icon name="close"/>Excluir material</Button>}
    </section>
  </div>;
}
