import { useState } from 'react';
import { CATEGORIES, RECURRENCES, conflictsFor } from '../../../public/agenda-domain.js';
import { Button } from '../../ui/ui.jsx';
import AgendaPanel from './AgendaPanel.jsx';

export default function AppointmentDetails({ item, state, actions, taskActions, confirmSave, retrySave, saveError, edit, onClose }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [moveDate, setMoveDate] = useState(item.date);
  const tasks = item.taskIds.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean);
  const conflicts = conflictsFor(item, state.agenda || []);
  async function run(action) {
    setError(''); setBusy(true);
    try { const result = action(); if (result) await confirmSave(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <AgendaPanel title={item.title} onClose={onClose} busy={busy}>
    <div className="agenda-details">
      <p className="agenda-detail-status">{CATEGORIES[item.category]} · {item.cancelled ? 'Cancelada' : item.done ? 'Encerrada' : 'Agendada'}</p>
      <p>{new Date(`${item.date}T12:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}<br/>{item.start ? `${item.start}–${item.end}${item.endDate !== item.date ? ` · término ${item.endDate}` : ''}` : 'Sem horário'}</p>
      <small>{item.timeZone.replaceAll('_', ' ')}{item.seriesId ? ` · ${RECURRENCES[item.recurrence]}` : ''}</small>
      {conflicts.length > 0 && <p className="agenda-conflict">Sobreposição com {conflicts.map((other) => other.title).join(', ')}. Você pode manter os horários.</p>}
      {!!tasks.length && <section><h3 className="title">Checklist · {tasks.filter((task) => task.done).length}/{tasks.length}</h3><ul className="agenda-checklist">{tasks.map((task) => <li key={task.id}><label className="agenda-checkbox"><input type="checkbox" checked={task.done} disabled={busy || Boolean(saveError) || item.cancelled} aria-label={`${task.done ? 'Reabrir' : 'Concluir'} tarefa ${task.title}`} onChange={() => run(() => task.done ? taskActions.reopenTask(task.id) : taskActions.completeTask(task.id))}/><span>{task.title}{task.dueDate && <small>Prazo: {task.dueDate}</small>}</span></label></li>)}</ul></section>}
      {saveError && <div role="alert"><p>{saveError}</p><Button secondary onClick={() => run(retrySave)}>Recarregar ou tentar novamente</Button></div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {!item.cancelled && <><Button onClick={() => edit(item)} disabled={busy}>Editar / reagendar</Button><details><summary>Mais ações</summary><div className="agenda-form-fields">
        <Button secondary disabled={busy || Boolean(saveError)} onClick={() => run(() => actions.update(item.id, { done: !item.done }))}>{item.done ? 'Reabrir atividade' : 'Encerrar atividade'}</Button>
        <small>Encerrar não conclui tarefas nem registra tempo de estudo.</small>
        <Button secondary disabled={busy || Boolean(saveError)} onClick={() => run(() => actions.update(item.id, { cancelled: true }))}>Cancelar ocorrência</Button>
        {item.seriesId && <Button secondary disabled={busy || Boolean(saveError)} onClick={() => run(() => actions.update(item.id, { cancelled: true }, 'future'))}>Cancelar esta e as futuras pendentes</Button>}
        {!item.done && tasks.some((task) => !task.done) && <><label className="field">Nova data das pendências<input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)}/></label><Button secondary disabled={busy || Boolean(saveError)} onClick={() => run(() => actions.movePending(item.id, moveDate))}>Mover só tarefas pendentes</Button></>}
      </div></details></>}
    </div>
  </AgendaPanel>;
}
