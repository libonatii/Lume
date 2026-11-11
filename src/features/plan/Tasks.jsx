import { useRef, useState } from 'react';
import { Reorder, motion, useDragControls } from 'motion/react';
import {
  MAX_SUBTASKS, MAX_TASKS, TASK_PRIORITIES, isOverdue, localDate,
  priorityLabel, sortTasks,
} from '../../../public/tasks-domain.js';
import Icon from '../../ui/Icon.jsx';
import { materialSteps } from '../../../public/material-model.js';
import { DAILY_SUBTASK_XP_CAP, XP_VALUES } from '../../../public/xp-policy.js';
import { Button, Empty, Heading, stagger } from '../../ui/ui.jsx';

// Lista de tarefas de estudo para uma prova. Criar e organizar não gera XP;
// concluir uma tarefa vinculada registra a aula, sem recompensa própria.
export function overdueMessage(count) {
  return count === 1
    ? 'Uma tarefa passou do prazo. Reorganize a semana para manter seu objetivo.'
    : `${count} tarefas passaram do prazo. Reorganize a semana para manter seu objetivo.`;
}

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const NO_SUBTASKS = [];

// Uma subtarefa: arrastar pela alça (ou setas do teclado nela), renomear no
// lugar com Enter/Esc, marcar e remover.
function SubtaskItem({ task, item, index, count, actions, onDragEnd, onError }) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.title);
  const [dragging, setDragging] = useState(false);
  function startEditing() {
    setName(item.title);
    setEditing(true);
  }
  function save() {
    if (name.trim() === item.title) {
      setEditing(false);
      return;
    }
    try {
      if (!actions.renameSubtask(task.id, item.id, name)) return;
      setEditing(false);
      onError('');
    } catch (exception) {
      onError(exception.message);
    }
  }
  function moveWithKeys(event) {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const target = index + step;
    if (target >= 0 && target < count) actions.moveSubtask(task.id, item.id, target);
  }
  return <Reorder.Item as="li" value={item} dragListener={false} dragControls={controls} onDragStart={() => setDragging(true)} onDragEnd={() => { setDragging(false); onDragEnd(item); }} className={`${item.done ? 'is-done' : ''} ${editing ? 'is-editing' : ''} ${dragging ? 'is-dragging' : ''}`}>
    {count > 1 && <button type="button" className="subtask-handle" title="Arraste ou use as setas para mover" aria-label={`Mover subtarefa ${item.title}`} onPointerDown={(event) => controls.start(event)} onKeyDown={moveWithKeys}><Icon name="grip"/></button>}
    {editing
      ? <span className="subtask">
        <input type="checkbox" checked={item.done} aria-label={item.title} onChange={() => actions.toggleSubtask(task.id, item.id)}/>
        <input
          className="subtask-rename"
          aria-label={`Novo nome da subtarefa ${item.title}`}
          maxLength={140}
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); save(); }
            if (event.key === 'Escape') { event.preventDefault(); setEditing(false); onError(''); }
          }}
        />
      </span>
      : <label className="subtask"><input type="checkbox" checked={item.done} onChange={() => actions.toggleSubtask(task.id, item.id)}/><span onDoubleClick={(event) => { event.preventDefault(); startEditing(); }}>{item.title}</span></label>}
    {!editing && <button type="button" className="todo-icon-button" title="Renomear subtarefa" aria-label={`Renomear subtarefa ${item.title}`} onClick={startEditing}><Icon name="edit"/></button>}
    <button type="button" className="todo-icon-button is-danger" title="Remover subtarefa" aria-label={`Remover subtarefa ${item.title}`} onMouseDown={(event) => editing && event.preventDefault()} onClick={() => actions.removeSubtask(task.id, item.id)}><Icon name="close"/></button>
  </Reorder.Item>;
}

// Subtarefas: aparecem só quando a pessoa decide dividir a tarefa.
function Subtasks({ task, actions }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const items = task.subtasks || NO_SUBTASKS;
  const done = items.filter((item) => item.done).length;
  // Ordem provisória só durante o arrasto; grava uma vez, ao soltar.
  const [dragOrder, setDragOrder] = useState(null);
  const dragRef = useRef(null);
  const order = dragOrder || items;
  function reorder(next) {
    dragRef.current = next;
    setDragOrder(next);
  }
  function drop(item) {
    const index = (dragRef.current || items).indexOf(item);
    dragRef.current = null;
    setDragOrder(null);
    if (index >= 0 && index !== items.indexOf(item)) actions.moveSubtask(task.id, item.id, index);
  }
  function add(event) {
    event.preventDefault();
    try {
      if (!actions.addSubtask(task.id, draft)) return;
      setDraft('');
      setError('');
    } catch (exception) {
      setError(exception.message);
    }
  }
  const percent = items.length ? Math.round(done / items.length * 100) : 0;
  return <details className={`todo-subtasks ${items.length ? 'has-items' : ''}`} open={items.length > 0 && done < items.length ? true : undefined}>
    <summary>
      <Icon name="chevron"/>
      <span>{items.length ? `Subtarefas ${done}/${items.length}` : 'Dividir em subtarefas'}</span>
      {items.length > 0 && <span className={`subtask-meter ${done === items.length ? 'is-full' : ''}`} aria-hidden="true"><span style={{ width: `${percent}%` }}/></span>}
    </summary>
    {items.length > 0 && <Reorder.Group as="ul" axis="y" className="subtask-list" values={order} onReorder={reorder}>
      {order.map((item, index) => <SubtaskItem key={item.id} task={task} item={item} index={index} count={order.length} actions={actions} onDragEnd={drop} onError={setError}/>)}
    </Reorder.Group>}
    {!task.done && items.length < MAX_SUBTASKS && <form className="subtask-form" onSubmit={add}>
      <Icon name="plus"/>
      <input aria-label={`Nova subtarefa de ${task.title}`} maxLength={140} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Próximo passo pequeno, ex.: ler os artigos 5º a 7º"/>
      <button type="submit" className="subtask-add" disabled={!draft.trim()}>Adicionar</button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </details>;
}

export default function Tasks({ state, actions, notify, onSchedule }) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('0');
  const [error, setError] = useState('');
  const today = localDate();
  const tasks = sortTasks(state.tasks || [], today);
  const pending = tasks.filter((task) => !task.done);
  const overdue = pending.filter((task) => isOverdue(task, today)).length;
  const done = tasks.filter((task) => task.done);
  const gamified = state.preferences.gamification;
  const courses = new Map(state.courses.map((course) => [course.id, course.title]));
  const lessons = new Map(state.courses.flatMap((course) => materialSteps(course).map((step) => [step.id, step.title])));
  const chosenCourse = state.courses.find((course) => course.id === courseId);

  function submit(event) {
    event.preventDefault();
    if (!title.trim()) {
      setError('Dê um nome para a tarefa.');
      return;
    }
    try {
      if (!actions.addTask({ title, courseId, lessonId, dueDate, priority })) return;
      setTitle('');
      setLessonId('');
      setDueDate('');
      setPriority('0');
      setError('');
      notify('Tarefa adicionada. Só a conclusão de uma aula vinculada pode gerar sua recompensa.');
    } catch (exception) {
      setError(exception.message);
    }
  }

  function toggle(task) {
    if (task.done) {
      if (!actions.reopenTask(task.id)) return;
      notify('Tarefa reaberta. A aula e sua recompensa foram preservadas.');
      return;
    }
    const now = new Date().toISOString();
    const result = actions.completeTask(task.id, now);
    if (!result?.added) return;
    notify(`Tarefa concluída: ${task.title}.${task.lessonId ? ' A conclusão da aula vinculada foi registrada.' : ''}`);
  }

  function prioritize(task, value) {
    actions.setTaskPriority(task.id, value);
  }

  function remove(task) {
    if (!actions.removeTask(task.id)) return;
    notify('Tarefa removida.');
  }

  function taskRow(task, index) {
    const course = task.courseId ? courses.get(task.courseId) : '';
    const late = isOverdue(task, today);
    return <motion.li className={`todo-item ${task.done ? 'is-done' : ''} ${late ? 'is-late' : ''} priority-${task.priority || 0}`} key={task.id} {...stagger(index)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done ? 'true' : 'false'}
        aria-label={task.done ? `Reabrir tarefa ${task.title}` : `Concluir tarefa ${task.title}`}
        className="todo-check"
        onClick={() => toggle(task)}
      >
        <Icon name="check"/>
      </button>
      <span className="todo-copy">
        <strong>{task.title}</strong>
        <span className="todo-chips">
          {!task.done && task.priority > 0 && <span className="todo-chip todo-priority">Prioridade {priorityLabel(task.priority).toLowerCase()}</span>}
          {late && <span className="todo-chip todo-late">Atrasada</span>}
          {task.dueDate && <span className="todo-chip"><Icon name="calendar"/>{late ? 'Venceu' : 'Vence'} em {dateLabel(task.dueDate)}</span>}
          {course && <span className="todo-chip"><Icon name="book"/>{course}</span>}
          {task.lessonId && lessons.get(task.lessonId) && <span className="todo-chip">{lessons.get(task.lessonId)}</span>}
          {task.done && task.lessonId && <span className="todo-chip">Aula vinculada</span>}
        </span>
      </span>
      <span className="todo-actions">
        {!task.done && <select className="todo-priority-select" aria-label={`Prioridade de ${task.title}`} value={String(task.priority || 0)} onChange={(event) => prioritize(task, event.target.value)}>
          {TASK_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>}
        {onSchedule && <button type="button" className="todo-icon-button" title="Agendar" aria-label={`Agendar tarefa ${task.title}`} onClick={() => onSchedule(task)}><Icon name="calendar"/></button>}
        <button type="button" className="todo-icon-button is-danger" title="Remover" aria-label={`Remover tarefa ${task.title}`} onClick={() => remove(task)}><Icon name="trash"/></button>
      </span>
      <Subtasks task={task} actions={actions}/>
    </motion.li>;
  }

  return <div className="personal-root">
    <Heading eyebrow="Agenda" title="Tarefas">
      Liste as ações concretas da sua preparação e defina o que vem primeiro. Concluir uma tarefa vinculada registra a conclusão da aula. Tarefas sem aula vinculada não geram XP; cada subtarefa concluída rende um pouco de XP.
    </Heading>

    <section className="card-surface settings-panel">
      <div className="panel-title"><span className="pace-icon"><Icon name="list"/></span><div><h2 className="title">Nova tarefa</h2><p className="muted-text">Escreva uma ação concreta, não um tema vago.</p></div></div>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">Tarefa
          <input name="task-title" maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Resolver 20 questões de constitucional" autoComplete="off"/>
        </label>
        <div className="form-grid todo-form-row">
          <label className="field">Curso ou prova (opcional)
            <select name="task-course" value={courseId} onChange={(event) => { setCourseId(event.target.value); setLessonId(''); }}>
              <option value="">Sem vínculo</option>
              {state.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          {chosenCourse && <label className="field">Aula ou etapa (opcional)
            <select name="task-lesson" value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
              <option value="">Curso inteiro</option>
              {materialSteps(chosenCourse).map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}
            </select>
          </label>}
          <label className="field">Prazo (opcional)
            <input name="task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/>
          </label>
          <label className="field">Prioridade
            <select name="task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
              {TASK_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={(state.tasks || []).length >= MAX_TASKS}><Icon name="plus"/>Adicionar tarefa</Button>
      </form>
      {gamified
        ? <p className="quiet-note">O servidor concede o XP da aula vinculada uma única vez, mesmo com várias tarefas. Reabrir a tarefa não desfaz a aula nem repete a recompensa. Cada subtarefa concluída vale {XP_VALUES.subtask} XP uma única vez, até {DAILY_SUBTASK_XP_CAP} XP por dia.</p>
        : <p className="quiet-note">Os indicadores de XP estão ocultos nas preferências. As tarefas continuam funcionando.</p>}
    </section>

    <section className="todo-section" aria-labelledby="todo-pending-title">
      <div className="shelf-header">
        <h2 id="todo-pending-title" className="headline">Para fazer <span className="shelf-count">{pending.length}</span></h2>
      </div>
      {overdue > 0 && <p className="inline-note todo-overdue-note" role="status"><Icon name="flag"/><span>{overdueMessage(overdue)}</span></p>}
      {pending.length
        ? <ul className="todo-list">{pending.map(taskRow)}</ul>
        : <Empty icon="list" title="Sem tarefas pendentes.">Defina a próxima ação concreta da sua preparação no formulário acima.</Empty>}
    </section>

    {done.length > 0 && <section className="todo-section" aria-labelledby="todo-done-title">
      <div className="shelf-header">
        <h2 id="todo-done-title" className="headline">Concluídas <span className="shelf-count">{done.length}</span></h2>
      </div>
      <ul className="todo-list">{done.map(taskRow)}</ul>
    </section>}
  </div>;
}
