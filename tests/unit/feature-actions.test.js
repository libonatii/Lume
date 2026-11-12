import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../../public/domain.js';
import { normalizePayload } from '../../public/import-domain.js';
import { createLibraryActions } from '../../src/features/library/actions.js';
import { createPlanActions } from '../../src/features/plan/actions.js';
import { createProgressActions } from '../../src/features/progress/actions.js';
import { createSettingsActions } from '../../src/features/settings/actions.js';
import { createAccountActions } from '../../src/features/account/actions.js';
import { materialSteps, materialStructure, materialLesson, splitMaterial } from '../../public/material-model.js';

function model() {
  let state = createInitialState();
  const act = (rule) => {
    const result = rule(state);
    state = result.state;
    return result;
  };
  return { read: () => state, library: createLibraryActions(act), plan: createPlanActions(act), progress: createProgressActions(act), settings: createSettingsActions(act), account: createAccountActions(act) };
}

test('ações mantêm tarefa e conclusão criadas enquanto um editor de material estava aberto', () => {
  const app = model();
  const created = app.library.addMaterial({ title: 'Livro', type: 'book', steps: ['Capítulo um', 'Capítulo dois'] });
  const course = created.state.courses[0];
  app.plan.addTask({ title: 'Revisar leitura', courseId: course.id });
  app.progress.completeMission(course.id, materialSteps(course)[0].id);
  app.library.editMaterial(course.id, { title: 'Livro revisado' }, ['Introdução', 'Capítulo dois']);
  assert.equal(app.read().tasks[0].title, 'Revisar leitura');
  assert.equal(app.read().courses[0].title, 'Livro revisado');
  assert.equal(app.read().progress[0].unitId, materialSteps(course)[0].id);
  assert.equal(materialSteps(app.read().courses[0])[0].id, materialSteps(course)[0].id);
});

test('ações criadas antes de uma importação preservam os materiais e as subtarefas mais recentes', () => {
  const app = model();
  app.library.addMaterial({ title: 'Material manual', steps: ['Ler'] });
  app.plan.addTask({ title: 'Revisar' });
  const task = app.read().tasks[0];
  app.plan.addSubtask(task.id, 'Resolver questões');
  app.plan.toggleSubtask(task.id, app.read().tasks[0].subtasks[0].id);
  app.library.importCourse(normalizePayload({ title: 'Curso importado', disciplines: [{ title: 'Área', modules: [{ title: 'Módulo', lessons: [{ title: 'Aula' }] }] }] }));
  assert.equal(app.read().courses.length, 2);
  assert.equal(app.read().tasks[0].subtasks[0].done, true);
  assert.deepEqual(app.read().progress, []);
});

test('ações bloqueadas não devolvem sucesso nem executam a regra', () => {
  const denied = () => null;
  assert.equal(createLibraryActions(denied).addMaterial({ title: '' }), null);
  assert.equal(createPlanActions(denied).addTask({ title: '' }), null);
  assert.equal(createProgressActions(denied).completeMission('missing', 'missing'), null);
  assert.equal(createSettingsActions(denied).restoreBackup(null), null);
  assert.equal(createAccountActions(denied).finishJourney({}, 0), null);
});

test('seletores apresentam a mesma grade a partir de unidades persistidas ou documento antigo', () => {
  const app = model();
  app.library.importCourse(normalizePayload({ title: 'Curso', disciplines: [{ title: 'Área', modules: [{ title: 'Módulo', lessons: [{ title: 'Aula', externalId: 'aula-42', duration: 90 }] }] }] }));
  const course = app.read().courses[0];
  const { material, units } = splitMaterial(course);
  const normalized = { ...material, units };
  assert.deepEqual(materialSteps(normalized), materialSteps(course));
  assert.deepEqual(materialStructure(normalized), materialStructure(course));
  const lesson = materialLesson(normalized, materialSteps(normalized)[0].id);
  assert.equal(lesson.externalId, 'aula-42');
  assert.equal(lesson.duration, 90);
  assert.equal(lesson.discipline, 'Área');
});

test('restaurar cópia e criar projeto preservam privacidade, perfil e materiais editados durante a análise', () => {
  const app = model();
  const backup = model();
  backup.library.addMaterial({ title: 'Livro da cópia', steps: ['Ler capítulo'] });
  backup.settings.setSharingPreference('library', true);
  app.settings.setSharingPreference('library', false);
  app.settings.updateProfile({ bio: 'Minha descrição' });
  app.library.addMaterial({ title: 'Material recente', steps: ['Estudar'] });
  app.library.addMaterial({ title: 'Projeto', type: 'project', steps: ['Validar a API'] });
  app.settings.restoreBackup(backup.read());
  assert.deepEqual(app.read().courses.map((course) => course.title), ['Material recente', 'Projeto', 'Livro da cópia']);
  assert.equal(app.read().preferences.sharing.library, false);
  assert.equal(app.read().profile.bio, 'Minha descrição');
  assert.equal(app.read().courses[1].type, 'project');
  assert.deepEqual(app.read().progress, []);
});
