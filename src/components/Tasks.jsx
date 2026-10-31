import { useState } from 'react';
import { motion } from 'motion/react';
import {
  MAX_TASKS, TASK_XP, addTask, completeTask, removeTask, reopenTask, sortTasks,
} from '../../public/tasks-domain.js';
import Icon from './Icon.jsx';
import { Button, Empty, Heading, stagger } from './ui.jsx';

// Lista de tarefas de estudo para uma prova. Criar e organizar não gera XP;
// concluir uma tarefa vale TASK_XP uma vez. O modelo ainda é o legado do
// protótipo e não substitui a validação no servidor.
function dateLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function Tasks({ state, update, notify }) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const tasks = sortTasks(state.tasks || []);
  const pending = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);
  const gamified = state.preferences.gamification;
  const courses = new Map(state.courses.map((course) => [course.id, course.title]));

  function submit(event) {
    event.preventDefault();
    if (!title.trim()) {
      setError('Dê um nome para a tarefa.');
      return;
    }
    try {
      update((previous) => addTask(previous, { title, courseId, dueDate }));
      setTitle('');
      setDueDate('');
      setError('');
      notify('Tarefa adicionada. Criar não gera XP; concluir gera uma vez.');
    } catch (exception) {
      setError(exception.message);
    }
  }

  function toggle(task) {
    if (task.done) {
      update((previous) => reopenTask(previous, task.id));
      notify('Tarefa reaberta. O XP da conclusão sai do total enquanto ela estiver aberta.');
      return;
    }
    const result = completeTask(state, task.id);
    if (!result.added) return;
    update(result.state);
    notify(gamified ? `Tarefa concluída. +${TASK_XP} XP de legado.` : 'Tarefa concluída.');
  }

  function remove(task) {
    update((previous) => removeTask(previous, task.id));
    notify('Tarefa removida.');
  }

  function taskRow(task, index) {
    const course = task.courseId ? courses.get(task.courseId) : '';
    return <motion.li className={`todo-item ${task.done ? 'is-done' : ''}`} key={task.id} {...stagger(index)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done ? 'true' : 'false'}
        aria-label={task.done ? `Reabrir tarefa ${task.title}` : `Concluir tarefa ${task.title}`}
        className="todo-check"
        onClick={() => toggle(task)}
      >
        <Icon name={task.done ? 'check' : 'plus'}/>
      </button>
      <span className="todo-copy">
        <strong>{task.title}</strong>
        <small className="todo-meta">
          {course || 'Sem curso vinculado'}
          {task.dueDate ? ` · vence em ${dateLabel(task.dueDate)}` : ''}
          {task.done && gamified ? ` · +${TASK_XP} XP de legado` : ''}
        </small>
      </span>
      <button type="button" className="text-button" aria-label={`Remover tarefa ${task.title}`} onClick={() => remove(task)}>Remover</button>
    </motion.li>;
  }

  return <div className="personal-root">
    <Heading eyebrow="Preparação para a prova" title="Tarefas">
      Liste o que precisa fazer para estudar. Criar tarefas é preparação e não gera XP; concluir uma tarefa de estudo vale XP uma vez.
    </Heading>

    <section className="card-surface settings-panel">
      <div className="panel-title"><span className="pace-icon"><Icon name="list"/></span><div><h2 className="title">Nova tarefa</h2><p className="muted-text">Escreva uma ação concreta, não um tema vago.</p></div></div>
      <form className="form-stack" onSubmit={submit}>
        <label className="field">Tarefa
          <input name="task-title" maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Resolver 20 questões de constitucional" autoComplete="off"/>
        </label>
        <div className="field-row">
          <label className="field">Curso ou prova (opcional)
            <select name="task-course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">Sem vínculo</option>
              {state.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="field">Prazo (opcional)
            <input name="task-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={(state.tasks || []).length >= MAX_TASKS}><Icon name="plus"/>Adicionar tarefa</Button>
      </form>
      {gamified
        ? <p className="quiet-note">Cada tarefa concluída vale {TASK_XP} XP de legado. O XP é calculado neste navegador e ainda não é validado pelo servidor.</p>
        : <p className="quiet-note">Os indicadores de XP estão ocultos nas preferências. As tarefas continuam funcionando.</p>}
    </section>

    <section className="todo-section" aria-labelledby="todo-pending-title">
      <div className="shelf-header">
        <h2 id="todo-pending-title" className="headline">Para fazer <span className="shelf-count">{pending.length}</span></h2>
      </div>
      {pending.length
        ? <ul className="todo-list">{pending.map(taskRow)}</ul>
        : <Empty title="Nada pendente por aqui.">Adicione uma tarefa acima ou aproveite para revisar o que já concluiu.</Empty>}
    </section>

    {done.length > 0 && <section className="todo-section" aria-labelledby="todo-done-title">
      <div className="shelf-header">
        <h2 id="todo-done-title" className="headline">Concluídas <span className="shelf-count">{done.length}</span></h2>
      </div>
      <ul className="todo-list">{done.map(taskRow)}</ul>
    </section>}
  </div>;
}
