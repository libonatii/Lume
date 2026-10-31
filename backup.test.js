import test from 'node:test';
import assert from 'node:assert/strict';
import { addCourse, createInitialState, restoreState } from './public/domain.js';
import { addTask, completeTask } from './public/tasks-domain.js';
import { BackupError, mergeBackup, previewBackup, readBackup } from './public/backup-domain.js';

function current() {
  let state = addCourse(createInitialState(), { title: 'Curso atual', steps: ['Aula 1', 'Aula 2'] });
  state = addTask(state, { title: 'Tarefa atual' });
  state = completeTask(state, state.tasks[0].id).state;
  state.preferences.weeklyGoal = 5;
  return state;
}

test('cópia válida é lida e mesclada sem substituir preferências ou títulos atuais', () => {
  const base = current();
  const incoming = addCourse(createInitialState(), { title: 'Curso da cópia', steps: ['Leitura 1', 'Leitura 2'] });
  incoming.courses[0].type = 'article';
  incoming.completed = [incoming.courses[0].steps[0].id];
  incoming.history = [{
    id: `step:${incoming.courses[0].steps[0].id}`,
    courseId: incoming.courses[0].id,
    stepId: incoming.courses[0].steps[0].id,
    title: 'Leitura 1',
    courseTitle: 'Curso da cópia',
    preparation: false,
    xp: 0,
    at: '2026-10-31T12:00:00Z',
  }];
  incoming.tasks = [{ id: 'task-copy', title: 'Tarefa da cópia', courseId: '', dueDate: '', done: false, createdAt: '2026-10-31T12:00:00Z', completedAt: null }];
  const backup = readBackup(JSON.stringify(incoming));
  const merged = mergeBackup(base, backup);
  assert.equal(merged.courses.length, 2);
  assert.equal(merged.courses[0].title, 'Curso atual');
  assert.equal(merged.courses[1].title, 'Curso da cópia');
  assert.equal(merged.courses[1].type, 'article');
  assert.equal(merged.preferences.weeklyGoal, 5);
  assert.equal(merged.tasks.length, 2);
  assert.equal(merged.completed.length, 1);
  assert.equal(merged.history.length, 1);
  const restored = restoreState(JSON.stringify(merged));
  assert.equal(restored.courses.length, 2);
  assert.equal(restored.history.length, 1);
});

test('mesclar a mesma cópia duas vezes não duplica curso, progresso ou tarefa', () => {
  const base = current();
  const incoming = readBackup(JSON.stringify(base));
  const merged = mergeBackup(base, incoming);
  assert.equal(merged.courses.length, base.courses.length);
  assert.equal(merged.completed.length, base.completed.length);
  assert.equal(merged.tasks.length, base.tasks.length);
  assert.equal(merged.history.length, base.history.length);
});

test('prévia conta o que entra sem alterar o estado', () => {
  const base = current();
  const incoming = addCourse(createInitialState(), { title: 'Novo', steps: ['A'] });
  incoming.completed = [incoming.courses[0].steps[0].id];
  const preview = previewBackup(base, incoming);
  assert.equal(preview.newCourseCount, 1);
  assert.deepEqual(preview.newCourses, ['Novo']);
  assert.equal(preview.newCompleted, 1);
  assert.equal(base.courses.length, 1);
});

test('arquivo inválido, vazio ou grande demais é recusado com mensagem', () => {
  assert.throws(() => readBackup(''), (error) => error instanceof BackupError && error.code === 'empty');
  assert.throws(() => readBackup('{'), (error) => error.code === 'invalid_json');
  assert.throws(() => readBackup(JSON.stringify({ version: 2, courses: [], completed: [], history: [] })), (error) => error.code === 'invalid_version');
  const big = 'x'.repeat(2 * 1024 * 1024 + 1);
  assert.throws(() => readBackup(big), (error) => error.code === 'too_large');
});
