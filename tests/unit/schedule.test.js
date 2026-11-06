import test from 'node:test';
import { materialSteps } from '../../public/material-model.js';
import assert from 'node:assert/strict';
import { addCourse, createInitialState, restoreState, totalXP } from '../../public/domain.js';
import { applyCourseImport, completeLesson, normalizePayload } from '../../public/import-domain.js';
import { isCompleted } from '../../public/progress-domain.js';
import {
  addDays, applyAvailability, buildSchedule, increaseWeekly, nextAvailableDay, normalizePlan, postponeLesson,
  setAvailability, setGoal, suggestedAvailability, weeklyMinutes,
} from '../../public/schedule-domain.js';

const MONDAY = '2026-11-02';

function importedCourse(state, title, lessons) {
  const payload = normalizePayload({
    title,
    provider: { id: 'grancursos' },
    sourceUrl: `https://www.grancursosonline.com.br/curso/${encodeURIComponent(title)}`,
    disciplines: [{ title: 'Direito Constitucional', modules: [{ title: 'Módulo 1', lessons }] }],
  });
  const next = applyCourseImport(state, payload);
  return { state: next, course: next.courses.at(-1) };
}

function base() {
  const { state, course } = importedCourse(createInitialState(), 'OAB', [
    { title: 'Aula 1', duration: '25:00' },
    { title: 'Aula 2', duration: '30:00' },
    { title: 'Aula 3', duration: '50:00' },
    { title: 'Aula 4' },
  ]);
  return { state: applyAvailability(state, { 1: 60, 3: 60 }), course };
}

test('sem disponibilidade o cronograma não inventa datas', () => {
  const { course } = base();
  const state = applyAvailability(base().state, {});
  const schedule = buildSchedule(state, { today: MONDAY });
  assert.equal(schedule.days.length, 0);
  assert.equal(schedule.unscheduled, 4);
  assert.equal(schedule.courses[0].courseId, course.id);
});

test('aulas seguem a sequência e respeitam o tempo de cada dia', () => {
  const { state } = base();
  const schedule = buildSchedule(state, { today: MONDAY });
  assert.equal(schedule.weeklyMinutes, 120);
  assert.deepEqual(schedule.days.map((day) => [day.date, day.items.map((item) => item.title)]), [
    ['2026-11-02', ['Aula 1', 'Aula 2']],
    ['2026-11-04', ['Aula 3']],
    ['2026-11-09', ['Aula 4']],
  ]);
  assert.equal(schedule.days[0].used, 55);
  assert.equal(schedule.lessonsWithoutDuration, 1);
  assert.equal(schedule.days[2].items[0].durationKnown, false, 'aula sem duração usa estimativa rotulada');
  assert.equal(schedule.unscheduled, 0);
});

test('concluir uma aula recalcula o cronograma sem apagar progresso', () => {
  const { state, course } = base();
  const done = completeLesson(state, course.id, materialSteps(course)[0].id).state;
  const schedule = buildSchedule(done, { today: MONDAY });
  assert.deepEqual(schedule.days[0].items.map((item) => item.title), ['Aula 2']);
  assert.equal(schedule.courses[0].remaining, 3);
  assert.ok(isCompleted(done, materialSteps(course)[0].id));
});

test('adiar uma aula adia as seguintes do mesmo curso', () => {
  const { state, course } = base();
  const later = postponeLesson(state, materialSteps(course)[0].id, '2026-11-04');
  const schedule = buildSchedule(later, { today: MONDAY });
  assert.equal(schedule.days[0].date, '2026-11-04');
  assert.deepEqual(schedule.days[0].items.map((item) => item.title), ['Aula 1', 'Aula 2']);
  assert.equal(nextAvailableDay(state, MONDAY), '2026-11-04');
});

test('aula maior que o dia ocupa um dia inteiro e é sinalizada', () => {
  const { state } = importedCourse(createInitialState(), 'Longa', [{ title: 'Aula extensa', duration: '1:30:00' }]);
  const schedule = buildSchedule(applyAvailability(state, { 2: 45 }), { today: MONDAY });
  assert.equal(schedule.days[0].date, '2026-11-03');
  assert.equal(schedule.days[0].items[0].overflow, true);
});

test('prazo que não cabe gera conflito com números e opções aplicáveis', () => {
  const { state, course } = base();
  const tight = setGoal(state, course.id, { deadline: '2026-11-03' });
  const schedule = buildSchedule(tight, { today: MONDAY });
  assert.equal(schedule.conflicts.length, 1);
  const conflict = schedule.conflicts[0];
  assert.equal(conflict.courseId, course.id);
  assert.equal(conflict.finish, '2026-11-09');
  assert.equal(conflict.neededMinutes, 130);
  assert.ok(conflict.extraWeeklyMinutes >= 15);

  // Opção 1: aumentar a disponibilidade resolve sem mexer no prazo.
  const more = increaseWeekly(tight, 600);
  assert.ok(weeklyMinutes(more.plan) > weeklyMinutes(tight.plan));
  assert.equal(buildSchedule(more, { today: MONDAY }).conflicts.length, 0);
  // Opção 2: aceitar a data calculada como novo prazo.
  const moved = setGoal(tight, course.id, { deadline: conflict.finish });
  assert.equal(buildSchedule(moved, { today: MONDAY }).conflicts.length, 0);
});

test('prioridade escolhida vem antes da ordem do roteiro', () => {
  let { state } = base();
  state = addCourse(state, { title: 'Penal', steps: ['Seção 1'] }, 'penal');
  state = setGoal(state, 'penal', { priority: 1 });
  const schedule = buildSchedule(state, { today: MONDAY });
  assert.equal(schedule.courses[0].courseId, 'penal');
  assert.equal(schedule.days[0].items[0].courseId, 'penal');
});

test('planejar não gera XP e o plano sobrevive à restauração', () => {
  const { state, course } = base();
  let planned = setGoal(state, course.id, { deadline: '2026-12-15', priority: 2 });
  planned = setAvailability(planned, 6, 120);
  planned = postponeLesson(planned, materialSteps(course)[1].id, '2026-11-20');
  assert.equal(totalXP(planned), totalXP(state));
  const restored = restoreState(JSON.stringify(planned));
  assert.deepEqual(restored.plan.availability, { 1: 60, 3: 60, 6: 120 });
  assert.deepEqual(restored.plan.goals[course.id], { deadline: '2026-12-15', priority: 2 });
  assert.equal(restored.plan.postponed[materialSteps(course)[1].id], '2026-11-20');
});

test('dados inválidos do plano são descartados sem perder o restante', () => {
  const plan = normalizePlan({ availability: { 1: -5, 2: 'x', 3: 9999, 9: 30 }, goals: { ghost: { deadline: '2026-01-01' }, real: { deadline: 'amanhã', priority: 7 } }, postponed: { a: 'ontem' } }, new Set(['real']));
  assert.deepEqual(plan.availability, { 3: 600 });
  assert.deepEqual(plan.goals, {});
  assert.deepEqual(plan.postponed, {});
  const old = createInitialState();
  delete old.plan;
  assert.deepEqual(restoreState(JSON.stringify(old)).plan.availability, {});
  assert.deepEqual(suggestedAvailability({ onboarding: { answers: { sessionMinutes: 30 } } }), { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30 });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
