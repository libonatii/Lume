import { useState } from 'react';
import { CATEGORIES, RECURRENCES, REMINDERS, agendaSuggestions, conflictsFor, shiftDate, validDate } from '../../../public/agenda-domain.js';
import { localDate } from '../../../public/tasks-domain.js';
import { materialSteps } from '../../../public/material-model.js';
import { Button, Heading } from '../../ui/ui.jsx';
import { requestNotifications } from './Reminders.jsx';

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const labelDate = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
function daysFor(date, view) {
  if (view === 'day') return [date];
  const value = new Date(`${view === 'month' ? `${date.slice(0, 7)}-01` : date}T12:00Z`);
  const first = shiftDate(value.toISOString().slice(0, 10), -((value.getUTCDay() + 6) % 7));
  return Array.from({ length: view === 'month' ? 42 : 7 }, (_, index) => shiftDate(first, index));
}
function emptyDraft(date, taskId = '') {
  return { title: '', category: 'study', date, endDate: date, start: '', end: '', timeZone: browserZone(), taskIds: taskId ? [taskId] : [], reminder: -1, recurrence: 'none', count: 4 };
}

function AppointmentForm({ initial, state, actions, confirmSave, onClose }) {
  const [draft, setDraft] = useState(initial);
  const [checklist, setChecklist] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [scope, setScope] = useState('one');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expectedEntries, setExpectedEntries] = useState([]);
  const editing = Boolean(initial.id);
  const field = (name, value) => setDraft((old) => ({ ...old, [name]: value }));
  const chosen = state.courses.find((course) => course.id === courseId);
  async function save(event) {
    event.preventDefault(); setError('');
    try {
      const value = { ...draft, reminder: Number(draft.reminder), count: Number(draft.count) };
      let expected = expectedEntries;
      if (!submitted) {
        const { title, category, date, start, end, endDate, timeZone, taskIds, reminder } = value;
        const result = editing ? actions.update(initial.id, { title, category, date, start, end, endDate, timeZone, taskIds, reminder }, scope)
          : actions.create({ ...value, tasks: checklist.split('\n').map((title) => title.trim()).filter(Boolean).map((title) => ({ title, courseId, lessonId })) });
        if (!result) return;
        expected = result.state.agenda.filter((item) => JSON.stringify(item) !== JSON.stringify(state.agenda?.find((old) => old.id === item.id)));
        setExpectedEntries(expected);
        setSubmitted(true);
      }
      setSaving(true);
      const confirmed = await confirmSave();
      if (expected.some((item) => JSON.stringify(item) !== JSON.stringify(confirmed.agenda?.find((entry) => entry.id === item.id)))) {
        setSubmitted(false);
        throw new Error('A alteração não foi gravada ou mudou após a recarga. Revise os campos e salve novamente.');
      }
      onClose();
    } catch (exception) { setError(exception.message); }
    finally { setSaving(false); }
  }
  return <section className="card-surface agenda-editor" aria-label={editing ? 'Editar compromisso' : 'Novo compromisso'}>
    <h2 className="title">{editing ? 'Editar compromisso' : 'Novo compromisso'}</h2>
    <form className="form-stack" onSubmit={save}>
      <fieldset className="agenda-form-fields" disabled={submitted}>
      <label className="field">Título do compromisso<input autoFocus required maxLength={180} value={draft.title} onChange={(e) => field('title', e.target.value)}/></label>
      <div className="field-row">
        <label className="field">Tipo<select value={draft.category} onChange={(e) => field('category', e.target.value)}>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field">Data<input type="date" required value={draft.date} onChange={(e) => setDraft((old) => ({ ...old, date: e.target.value, endDate: old.endDate === old.date ? e.target.value : old.endDate }))}/></label>
        <label className="field">Início (opcional)<input type="time" value={draft.start} onChange={(e) => field('start', e.target.value)}/></label>
        <label className="field">Fim (opcional)<input type="time" value={draft.end} onChange={(e) => field('end', e.target.value)}/></label>
        <label className="field">Data de término<input type="date" required value={draft.endDate} onChange={(e) => field('endDate', e.target.value)}/></label>
      </div>
      <div className="field-row">
        <label className="field">Fuso do compromisso<input required value={draft.timeZone} placeholder="America/Sao_Paulo" onChange={(e) => field('timeZone', e.target.value)}/></label>
        <label className="field">Lembrete<select value={draft.reminder} onChange={(e) => field('reminder', Number(e.target.value))}>{REMINDERS.map((value) => <option key={value} value={value}>{value === -1 ? 'Sem lembrete' : value === 0 ? 'No início' : `${value} minutos antes`}</option>)}</select></label>
      </div>
      <p className="quiet-note">Sem horário, o lembrete usa 09h no fuso indicado. Horários permanecem nesse fuso ao trocar de dispositivo. Compromissos pessoais são privados.</p>
      {!editing && <div className="field-row">
        <label className="field">Repetição<select value={draft.recurrence} onChange={(e) => field('recurrence', e.target.value)}>{Object.entries(RECURRENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {draft.recurrence !== 'none' && <label className="field">Ocorrências<input type="number" min="2" max="52" required value={draft.count} onChange={(e) => field('count', e.target.value)}/></label>}
      </div>}
      {editing && initial.seriesId && <label className="field">Aplicar alteração<select value={scope} onChange={(e) => setScope(e.target.value)}><option value="one">Somente esta ocorrência</option><option value="future">Esta e as futuras pendentes</option></select></label>}
      <fieldset className="agenda-task-picker" disabled={scope === 'future'}><legend>Tarefas existentes (opcional)</legend>
        <p className="quiet-note">Selecione uma tarefa isolada ou várias para a atividade. Na repetição, as próximas ocorrências recebem cópias desmarcadas.</p>
        {state.tasks.length ? state.tasks.map((task) => <label key={task.id}><input type="checkbox" checked={draft.taskIds.includes(task.id)} onChange={(e) => field('taskIds', e.target.checked ? [...draft.taskIds, task.id] : draft.taskIds.filter((id) => id !== task.id))}/>{task.title}{task.done ? ' · concluída' : ''}{task.dueDate ? ` · prazo ${task.dueDate}` : ''}</label>) : <p>Nenhuma tarefa cadastrada.</p>}
      </fieldset>
      {!editing && <>
        <label className="field">Novas tarefas (uma por linha)<textarea rows={3} value={checklist} onChange={(e) => setChecklist(e.target.value)} placeholder="Assistir à aula&#10;Revisar anotações"/></label>
        <div className="field-row"><label className="field">Material das novas tarefas<select value={courseId} onChange={(e) => { setCourseId(e.target.value); setLessonId(''); }}><option value="">Sem vínculo</option>{state.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          {chosen && <label className="field">Aula vinculada às novas tarefas<select value={lessonId} onChange={(e) => setLessonId(e.target.value)}><option value="">Sem aula vinculada</option>{materialSteps(chosen).map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}</select></label>}
        </div>
      </>}
      {editing && <p className="quiet-note">Crie outras tarefas na aba Tarefas e vincule-as aqui. Alterações de série preservam os checklists e as ocorrências passadas ou concluídas.</p>}
      </fieldset>
      {submitted && !saving && <p className="quiet-note">A operação já foi enviada. Resolva o aviso de gravação acima e confirme novamente; o compromisso não será duplicado.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="action-row"><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar compromisso'}</Button><Button secondary type="button" disabled={saving} onClick={onClose}>Fechar edição</Button></div>
    </form>
  </section>;
}

function AppointmentCard({ item, state, actions, taskActions, edit, report }) {
  const [moveDate, setMoveDate] = useState(item.date);
  const tasks = item.taskIds.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean);
  const conflicts = conflictsFor(item, state.agenda || []);
  const done = tasks.filter((task) => task.done).length;
  function run(action) { try { action(); } catch (error) { report(error.message); } }
  return <article className={`agenda-card ${item.done ? 'is-complete' : ''}`} aria-label={item.title}>
    <header><strong>{item.title}</strong><span>{CATEGORIES[item.category]} · {item.cancelled ? 'Cancelada' : item.done ? 'Encerrada' : done && done < tasks.length ? 'Parcial' : 'Pendente'}</span></header>
    <p>{labelDate(item.date)} · {item.start ? `${item.start}–${item.end}${item.endDate !== item.date ? ` (${item.endDate})` : ''}` : 'Sem horário'} · {item.timeZone}</p>
    {item.seriesId && <small>{RECURRENCES[item.recurrence]} · checklist desta ocorrência</small>}
    {!item.cancelled && conflicts.length > 0 && <p className="agenda-conflict">Sobreposição com {conflicts.map((other) => other.title).join(', ')}. Você pode manter os horários.</p>}
    {!!tasks.length && <><p>{done}/{tasks.length} tarefas concluídas</p><ul className="agenda-checklist">{tasks.map((task) => <li key={task.id}><label><input type="checkbox" checked={task.done} disabled={item.cancelled} aria-label={`${task.done ? 'Reabrir' : 'Concluir'} tarefa ${task.title}`} onChange={() => run(() => task.done ? taskActions.reopenTask(task.id) : taskActions.completeTask(task.id))}/>{task.title}</label>{task.dueDate && <small>Prazo: {task.dueDate}</small>}</li>)}</ul></>}
    {!item.cancelled && <details><summary>Ações do compromisso</summary>
      <div className="action-row"><Button secondary onClick={() => edit(item)}>Editar / reagendar</Button><Button secondary onClick={() => run(() => actions.update(item.id, { done: !item.done }))}>{item.done ? 'Reabrir atividade' : 'Encerrar atividade'}</Button><Button secondary onClick={() => run(() => actions.update(item.id, { cancelled: true }))}>Cancelar ocorrência</Button></div>
      <p className="quiet-note">Encerrar a atividade não conclui tarefas nem registra tempo de estudo.</p>
      {item.seriesId && <Button secondary onClick={() => run(() => actions.update(item.id, { cancelled: true }, 'future'))}>Cancelar esta e as futuras pendentes</Button>}
      {!item.done && tasks.some((task) => !task.done) && <div className="field-row"><label className="field">Nova data das pendências<input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)}/></label><Button secondary onClick={() => run(() => actions.movePending(item.id, moveDate))}>Mover só tarefas pendentes</Button></div>}
    </details>}
  </article>;
}

export default function Agenda({ state, actions, taskActions, confirmSave, syncStatus, params }) {
  const today = localDate();
  const initialDate = validDate(params?.get('dia')) ? params.get('dia') : today;
  const task = state.tasks.find((item) => item.id === params?.get('tarefa'));
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState('day');
  const [draft, setDraft] = useState(task ? { ...emptyDraft(initialDate, task.id), title: task.title } : null);
  const [editorKey, setEditorKey] = useState(0);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState('Notification' in window ? Notification.permission : 'unsupported');
  const entries = state.agenda || [];
  const suggestions = agendaSuggestions(state, today);
  const days = daysFor(date, view);
  function edit(item) { setDraft({ ...item }); setEditorKey((key) => key + 1); }
  function navigate(direction) {
    if (view !== 'month') { setDate(shiftDate(date, direction * (view === 'week' ? 7 : 1))); return; }
    const value = new Date(`${date.slice(0, 7)}-01T12:00Z`); value.setUTCMonth(value.getUTCMonth() + direction); setDate(value.toISOString().slice(0, 10));
  }
  function card(item) { return <AppointmentCard key={item.id} item={item} state={state} actions={actions} taskActions={taskActions} edit={edit} report={setError}/>; }
  function suggest(item) {
    edit({ ...emptyDraft(item.date), title: item.title });
    // A pessoa revisa a sugestão e escolhe o horário. A tarefa é criada no aceite.
    setDraft({ ...emptyDraft(item.date), title: item.title, suggestion: item });
  }
  const late = entries.filter((item) => !item.done && !item.cancelled && item.date < today);
  return <div className="personal-root agenda-root">
    <Heading title="Agenda" eyebrow="Seu calendário">Estudos e compromissos pessoais, com tarefas e horários escolhidos por você.</Heading>
    <div className="agenda-toolbar"><div className="action-row">{[['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([value, label]) => <Button key={value} secondary={view !== value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</Button>)}</div><Button onClick={() => edit(emptyDraft(date))} disabled={syncStatus === 'loading' || syncStatus === 'error'}>Novo compromisso</Button></div>
    <div className="agenda-toolbar"><div className="action-row"><Button secondary aria-label="Período anterior" onClick={() => navigate(-1)}>←</Button><Button secondary onClick={() => setDate(today)}>Hoje</Button><Button secondary aria-label="Próximo período" onClick={() => navigate(1)}>→</Button></div><label className="field">Data exibida<input type="date" value={date} onChange={(e) => { if (validDate(e.target.value)) setDate(e.target.value); }}/></label></div>
    {syncStatus === 'loading' && <p role="status">Carregando Agenda…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {draft && <AppointmentForm key={editorKey} initial={draft} state={state} actions={draft.suggestion ? { ...actions, create: (input) => actions.create({ ...input, tasks: [...(input.tasks || []), { title: draft.suggestion.title, courseId: draft.suggestion.courseId, lessonId: draft.suggestion.lessonId }] }) } : actions} confirmSave={confirmSave} onClose={() => setDraft(null)}/>}
    <div className={`agenda-calendar agenda-${view}`} aria-label={`Calendário: ${view === 'month' ? 'mês' : view === 'week' ? 'semana' : 'dia'}`}>
      {days.map((day) => {
        const items = entries.filter((item) => item.date <= day && item.endDate >= day).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
        return <section key={day} className={`agenda-day ${day === today ? 'is-today' : ''}`} aria-label={day}>
          <h2><button className="text-button" onClick={() => { setDate(day); setView('day'); }}>{labelDate(day)}</button></h2>
          {view === 'month' ? <>{items.map((item) => <button key={item.id} className="agenda-month-item" onClick={() => { setDate(day); setView('day'); }}>{item.start || 'Dia'} · {item.title}{item.cancelled ? ' · cancelada' : item.done ? ' ✓' : ''}</button>)}<button className="text-button" aria-label={`Agendar em ${day}`} onClick={() => edit(emptyDraft(day))}>+ Agendar</button></>
            : view === 'week' ? <><div className="agenda-all-day">{items.filter((item) => !item.start).map(card)}</div><div className="agenda-hours">{Array.from({ length: 24 }, (_, hour) => <div className="agenda-hour" key={hour}><small>{String(hour).padStart(2, '0')}:00</small><div>{items.filter((item) => item.start && (item.date === day ? Number(item.start.slice(0, 2)) : 0) === hour).map(card)}</div></div>)}</div></>
              : items.length ? items.map(card) : <p className="muted-text">Nenhum compromisso neste dia. Adicione uma atividade ou agende uma tarefa.</p>}
        </section>;
      })}
    </div>
    {late.length > 0 && <details className="card-surface agenda-pending"><summary>{late.length} atividades pendentes de dias anteriores</summary><p>As datas foram mantidas. Reagende quando decidir.</p>{late.map(card)}</details>}
    <section className="card-surface agenda-suggestions"><h2 className="title">Sugestões de estudo</h2><p>Derivadas da disponibilidade, das prioridades e das durações do <a href="#plano">Plano</a>. Não são compromissos até você salvar. Escolha o horário ao revisar; sobreposições são apenas avisadas.</p>
      {suggestions.length ? <ul>{suggestions.map((item) => <li key={`${item.courseId}:${item.lessonId}`}><span>{item.date} · {item.title} · {item.minutes} min {item.durationKnown ? '(duração conhecida)' : '(estimativa)'}</span><Button secondary onClick={() => suggest(item)}>Revisar sugestão</Button></li>)}</ul> : <p>Sem sugestões disponíveis. Defina sua disponibilidade no Plano ou adicione materiais.</p>}
    </section>
    <section className="card-surface agenda-notification-settings"><h2 className="title">Lembretes</h2><p>Avisos no Lume e, com sua permissão, no computador. Mantenha o site aberto ou o aplicativo executando; ele pode ficar minimizado. Sem rede ou com o programa encerrado, não há entrega. Avisos vencidos há até 15 minutos são recuperados; depois disso, consulte as pendências.</p><p>Um lembrete é entregue a uma aba ou dispositivo conectado da conta. Na prévia temporária, os lembretes não são enviados.</p>
      <Button secondary onClick={async () => { try { setPermission(await requestNotifications()); } catch { setPermission('denied'); } }}>Ativar notificações no computador</Button><p role="status">{permission === 'granted' ? 'Notificações autorizadas neste dispositivo.' : permission === 'denied' ? 'Notificações bloqueadas. Altere a permissão do site para ativar; os avisos internos continuam disponíveis.' : permission === 'unsupported' ? 'Este ambiente não oferece notificações do sistema.' : 'Notificações do computador ainda não autorizadas.'}</p>
    </section>
  </div>;
}
