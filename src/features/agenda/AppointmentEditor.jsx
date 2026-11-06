import { useState } from 'react';
import { CATEGORIES, RECURRENCES, REMINDERS, conflictsFor } from '../../../public/agenda-domain.js';
import { materialSteps } from '../../../public/material-model.js';
import { Button } from '../../ui/ui.jsx';
import AgendaPanel from './AgendaPanel.jsx';

function TaskFields({ task, courses, onChange, onRemove, index }) {
  const course = courses.find((item) => item.id === task.courseId);
  return <div className="agenda-task-edit">
    <div className="agenda-task-title"><label className="field">Item {index + 1}<input required maxLength={180} value={task.title} disabled={task.done} onChange={(e) => onChange({ ...task, title: e.target.value })}/></label><button type="button" className="text-button" onClick={onRemove} aria-label={`Retirar item ${index + 1}`}>Retirar</button></div>
    <details><summary>{course ? `${course.title}${task.lessonId ? ' · aula vinculada' : ''}` : 'Vincular material ou aula'}</summary>
      <label className="field">Material do item {index + 1}<select disabled={task.done} value={task.courseId || ''} onChange={(e) => onChange({ ...task, courseId: e.target.value, lessonId: '' })}><option value="">Sem vínculo</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {course && <label className="field">Aula do item {index + 1}<select disabled={task.done} value={task.lessonId || ''} onChange={(e) => onChange({ ...task, lessonId: e.target.value })}><option value="">Sem aula vinculada</option>{materialSteps(course).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      {task.done && <small>O vínculo da tarefa concluída é preservado.</small>}
    </details>
  </div>;
}

export default function AppointmentEditor({ initial, initialExpected = null, state, actions, confirmSave, retrySave, saveError, onClose }) {
  const [draft, setDraft] = useState(initial);
  const [tasks, setTasks] = useState(() => [
    ...(initial.taskIds || []).map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean),
    ...(initial.tasks || []).map((task) => ({ ...task, key: crypto.randomUUID() })),
  ]);
  const [scope, setScope] = useState('one');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expected, setExpected] = useState(initialExpected);
  const [linkOpen, setLinkOpen] = useState(false);
  const [search, setSearch] = useState('');
  const editing = Boolean(initial.id);
  const field = (name, value) => setDraft((old) => ({ ...old, [name]: value }));
  let conflicts = [];
  try { conflicts = conflictsFor(draft, state.agenda || []); } catch { /* A validação completa ocorre ao salvar. */ }
  function addItem(task = { title: '', courseId: '', lessonId: '' }) { setTasks((old) => [...old, { ...task, key: crypto.randomUUID() }]); }
  async function save(event) {
    event.preventDefault(); setError('');
    try {
      let pending = expected;
      if (!pending) {
        const { title, category, date, start, end, endDate, timeZone, reminder, recurrence, count } = draft;
        const result = actions.save({ id: initial.id, title, category, date, start, end, endDate, timeZone, reminder, recurrence, count: Number(count),
          taskIds: tasks.filter((task) => task.id).map((task) => task.id), tasks: tasks.filter((task) => !task.id),
          taskChanges: tasks.filter((task) => initial.taskIds?.includes(task.id)),
        }, scope);
        if (!result) return;
        pending = Object.fromEntries(['agenda', 'tasks'].map((key) => [key, result.state[key].filter((item) => JSON.stringify(item) !== JSON.stringify(state[key]?.find((old) => old.id === item.id)))]));
        setExpected(pending);
      }
      setSaving(true);
      const confirmed = await confirmSave();
      if (Object.entries(pending).some(([key, items]) => items.some((item) => JSON.stringify(item) !== JSON.stringify(confirmed[key]?.find((saved) => saved.id === item.id))))) {
        setExpected(null);
        throw new Error('A alteração não foi gravada ou mudou após a recarga. Revise os campos e salve novamente.');
      }
      onClose();
    } catch (exception) { setError(exception.message); }
    finally { setSaving(false); }
  }
  return <AgendaPanel title={editing ? 'Editar compromisso' : 'Novo compromisso'} onClose={onClose} busy={saving}>
    <form className="agenda-editor-form" onSubmit={save}>
      <fieldset disabled={Boolean(expected)} className="agenda-form-fields">
        <label className="field agenda-title-field">Título do compromisso<input data-autofocus required placeholder="O que você vai fazer?" maxLength={180} value={draft.title} onChange={(e) => field('title', e.target.value)}/></label>
        <label className="field">Data<input type="date" required value={draft.date} onChange={(e) => setDraft((old) => ({ ...old, date: e.target.value, endDate: old.endDate === old.date ? e.target.value : old.endDate }))}/></label>
        <label className="agenda-checkbox"><input type="checkbox" checked={!draft.start} onChange={(e) => setDraft((old) => ({ ...old, start: e.target.checked ? '' : '09:00', end: e.target.checked ? '' : '09:30', endDate: old.date }))}/>Sem horário</label>
        {!!draft.start && <div className="agenda-time-fields"><label className="field">Início<input required type="time" value={draft.start} onChange={(e) => field('start', e.target.value)}/></label><label className="field">Fim<input required type="time" value={draft.end} onChange={(e) => field('end', e.target.value)}/></label></div>}
        <small className="agenda-zone">Horários em {draft.timeZone.replaceAll('_', ' ')}{draft.endDate !== draft.date ? ` · termina em ${draft.endDate}` : ''}</small>
        {conflicts.length > 0 && <p className="agenda-conflict">Sobreposição com {conflicts.map((item) => item.title).join(', ')}. Você pode manter os horários.</p>}
        <fieldset className="agenda-form-fields" disabled={scope === 'future'}>
          {tasks.length > 0 && <div className="agenda-checklist-editor"><h3 className="title">Checklist</h3>{tasks.map((task, index) => <TaskFields key={task.id || task.key} task={task} courses={state.courses} index={index} onChange={(value) => setTasks((old) => old.map((item, i) => i === index ? value : item))} onRemove={() => setTasks((old) => old.filter((_, i) => i !== index))}/>)}</div>}
          <div className="agenda-add-links"><button type="button" className="text-button" onClick={() => setLinkOpen(!linkOpen)}>+ Vincular material ou tarefa</button><button type="button" className="text-button" onClick={() => addItem()}>+ Adicionar checklist</button></div>
          {linkOpen && <div className="agenda-link-picker"><label className="field">Buscar material ou tarefa<input value={search} onChange={(e) => setSearch(e.target.value)}/></label>
            {state.tasks.filter((task) => !tasks.some((chosen) => chosen.id === task.id) && !task.done && task.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((task) => <button type="button" key={task.id} onClick={() => { setTasks((old) => [...old, task]); setLinkOpen(false); }}>Tarefa · {task.title}</button>)}
            {state.courses.filter((course) => course.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((course) => <button type="button" key={course.id} onClick={() => { addItem({ title: draft.title || course.title, courseId: course.id, lessonId: '' }); setLinkOpen(false); }}>Material · {course.title}</button>)}
            {!state.tasks.length && !state.courses.length && <p>Sem materiais ou tarefas. Você pode criar um checklist livre.</p>}
          </div>}
        </fieldset>
        <details className="agenda-options"><summary>Mais opções</summary><div className="agenda-form-fields">
          <label className="field">Tipo<select value={draft.category} onChange={(e) => field('category', e.target.value)}>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {!!draft.start && <><label className="agenda-checkbox"><input type="checkbox" checked={draft.endDate !== draft.date} onChange={(e) => field('endDate', e.target.checked ? new Date(Date.parse(`${draft.date}T12:00Z`) + 86400000).toISOString().slice(0, 10) : draft.date)}/>Termina em outro dia</label>{draft.endDate !== draft.date && <label className="field">Data de término<input type="date" required value={draft.endDate} min={draft.date} onChange={(e) => field('endDate', e.target.value)}/></label>}</>}
          <label className="field">Lembrete<select value={draft.reminder} onChange={(e) => field('reminder', Number(e.target.value))}>{REMINDERS.map((value) => <option key={value} value={value}>{value === -1 ? 'Sem lembrete' : value === 0 ? 'No início' : `${value} minutos antes`}</option>)}</select></label>
          {!draft.start && draft.reminder >= 0 && <small>Sem horário, o aviso usa 09h.</small>}
          {!editing && <><label className="field">Repetição<select value={draft.recurrence} onChange={(e) => field('recurrence', e.target.value)}>{Object.entries(RECURRENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{draft.recurrence !== 'none' && <label className="field">Ocorrências<input type="number" min="2" max="52" required value={draft.count} onChange={(e) => field('count', e.target.value)}/></label>}</>}
          <label className="field">Fuso do compromisso<input required value={draft.timeZone} onChange={(e) => field('timeZone', e.target.value)}/></label>
        </div></details>
        {initial.seriesId && <label className="field">Aplicar alteração<select value={scope} onChange={(e) => setScope(e.target.value)}><option value="one">Somente esta ocorrência</option><option value="future">Esta e as futuras pendentes</option></select><small>Alterações futuras preservam checklists e ocorrências encerradas.</small></label>}
      </fieldset>
      {saveError && <div role="alert"><p>{saveError}</p><Button secondary type="button" disabled={saving} onClick={async () => { setSaving(true); try { await retrySave(); } catch (e) { setError(e.message); } finally { setSaving(false); } }}>Recarregar ou tentar novamente</Button></div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {expected && !saving && <small>A operação já foi enviada. Resolva a gravação e confirme novamente, sem duplicar o compromisso.</small>}
      <footer className="agenda-panel-footer"><Button secondary type="button" disabled={saving} onClick={onClose}>Cancelar edição</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar compromisso'}</Button></footer>
    </form>
  </AgendaPanel>;
}
