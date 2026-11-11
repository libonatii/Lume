import { useRef, useState } from 'react';
import { CATEGORIES, RECURRENCES, conflictsFor } from '../../../public/agenda-domain.js';
import { Button } from '../../ui/ui.jsx';
import Icon from '../../ui/Icon.jsx';
import AgendaPanel from './AgendaPanel.jsx';
import { browserZone, zoneLabel } from './calendar-model.js';

export default function AppointmentDetails({ item, state, actions, taskActions, confirmSave, retrySave, saveError, edit, onRemove, onClose }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveDate, setMoveDate] = useState(item.date);
  const tasks = item.taskIds.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean);
  const done = tasks.filter((task) => task.done).length;
  // A barra cheia brilha uma vez quando o checklist termina com o painel aberto.
  const startedFull = useRef(tasks.length > 0 && done === tasks.length);
  const conflicts = conflictsFor(item, state.agenda || []);
  const locked = busy || Boolean(saveError);
  async function run(action) {
    setError(''); setBusy(true);
    try { const result = await action(); if (result && result.state) await confirmSave(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <AgendaPanel title={item.title} onClose={onClose} busy={busy}>
    <div className="agenda-details">
      <p className="agenda-detail-status"><span className={`agenda-category-dot cat-${item.category}`} aria-hidden="true"/>{CATEGORIES[item.category]} · {item.cancelled ? 'Cancelada' : item.done ? 'Encerrada' : 'Agendada'}</p>
      <p>{new Date(`${item.date}T12:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })}<br/>{item.start ? `${item.start}–${item.end}${item.endDate !== item.date ? ` · término ${item.endDate}` : ''}` : 'Sem horário'}</p>
      {(item.timeZone !== browserZone() || item.seriesId) && <small>{item.timeZone !== browserZone() ? zoneLabel(item.timeZone) : ''}{item.timeZone !== browserZone() && item.seriesId ? ' · ' : ''}{item.seriesId ? RECURRENCES[item.recurrence] : ''}</small>}
      {conflicts.length > 0 && <p className="agenda-conflict">Sobreposição com {conflicts.map((other) => other.title).join(', ')}. Você pode manter os horários.</p>}
      {!!tasks.length && <section>
        <h3 className="title">Checklist · {done}/{tasks.length}</h3>
        <div className={`agenda-checklist-progress${done === tasks.length && !startedFull.current ? ' is-full' : ''}`} aria-hidden="true"><span style={{ transform: `scaleX(${done / tasks.length})` }}/></div>
        <ul className="agenda-checklist">{tasks.map((task) => <li key={task.id}><label className="agenda-checkbox"><span className="agenda-check"><input type="checkbox" checked={task.done} disabled={locked || item.cancelled} aria-label={`${task.done ? 'Reabrir' : 'Concluir'} tarefa ${task.title}`} onChange={() => run(() => task.done ? taskActions.reopenTask(task.id) : taskActions.completeTask(task.id))}/><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span><span>{task.title}{task.dueDate && <small>Prazo: {task.dueDate}</small>}</span></label></li>)}</ul>
      </section>}
      {saveError && <div role="alert" className="form-error form-error-block"><p>{saveError}</p><Button secondary onClick={() => run(retrySave)}>Recarregar ou tentar novamente</Button></div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {confirmDelete
        ? <div className="agenda-confirm" role="group" aria-label="Excluir compromisso"><p>Excluir qual parte da série? As tarefas do checklist continuam em Tarefas.</p>
          <div className="agenda-detail-actions"><Button secondary disabled={locked} onClick={() => run(() => onRemove(item, 'one'))}>Excluir só esta</Button><Button secondary disabled={locked} onClick={() => run(() => onRemove(item, 'future'))}>Esta e as futuras pendentes</Button><button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Voltar</button></div></div>
        : <div className="agenda-detail-actions">
          {!item.cancelled && <Button onClick={() => edit(item)} disabled={busy}><Icon name="edit"/>Editar</Button>}
          <Button secondary className="agenda-delete" disabled={locked} onClick={() => item.seriesId ? setConfirmDelete(true) : run(() => onRemove(item, 'one'))}><Icon name="trash"/>Excluir</Button>
        </div>}
      {!item.cancelled && <details className="agenda-more"><summary><Icon name="more"/>Mais ações</summary><div className="agenda-more-list">
        <div><Button secondary disabled={locked} onClick={() => run(() => actions.update(item.id, { done: !item.done }))}>{item.done ? 'Reabrir atividade' : 'Encerrar atividade'}</Button>
          <small>{item.done ? 'Volta a ficar editável no calendário.' : 'Marca o horário como encerrado. Não conclui tarefas nem registra tempo de estudo.'}</small></div>
        <div><Button secondary disabled={locked} onClick={() => run(() => actions.update(item.id, { cancelled: true }))}>Cancelar ocorrência</Button>
          <small>Guarda o registro como cancelado e o tira do calendário. Para ver de novo, ative o filtro Canceladas.</small></div>
        {item.seriesId && <div><Button secondary disabled={locked} onClick={() => run(() => actions.update(item.id, { cancelled: true }, 'future'))}>Cancelar esta e as futuras pendentes</Button></div>}
        {!item.done && tasks.some((task) => !task.done) && <div><label className="field">Nova data das pendências<input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)}/></label><Button secondary disabled={locked} onClick={() => run(() => actions.movePending(item.id, moveDate))}>Mover só tarefas pendentes</Button>
          <small>Cria outra atividade com o que falta; as concluídas ficam nesta.</small></div>}
      </div></details>}
    </div>
  </AgendaPanel>;
}
