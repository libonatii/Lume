import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, restoreState, totalXP } from '../../public/domain.js';
import {
  MAX_SESSION_MS, STALE_SESSION_MS, endSession, formatSessionDuration, pauseSession,
  reconcileSession, resumeSession, sessionElapsed, startSession, touchSession,
  formatMinutes, localDay, minutesByDay, weeklyRhythm,
} from '../../public/session-domain.js';

const T0 = Date.parse('2026-10-31T10:00:00Z');
const MINUTE = 60 * 1000;

test('começar uma sessão não gera XP e conta tempo declarado', () => {
  let state = startSession(createInitialState(), { courseId: 'design', stepId: 'design-1', label: 'Ler a aula 1' }, T0);
  assert.equal(state.activeSession.status, 'active');
  assert.equal(state.activeSession.label, 'Ler a aula 1');
  assert.equal(state.activeSession.courseId, 'design');
  assert.equal(sessionElapsed(state.activeSession, T0), 0);
  assert.equal(sessionElapsed(state.activeSession, T0 + 5 * MINUTE), 5 * MINUTE);
  assert.equal(totalXP(state), 0);
  assert.deepEqual(state.studySessions, []);
  assert.deepEqual(state.progress, []);
});

test('pausar congela o tempo e retomar continua de onde parou', () => {
  let state = startSession(createInitialState(), { label: 'Estudo' }, T0);
  state = pauseSession(state, T0 + 10 * MINUTE);
  assert.equal(state.activeSession.status, 'paused');
  assert.equal(sessionElapsed(state.activeSession, T0 + 10 * MINUTE), 10 * MINUTE);
  assert.equal(sessionElapsed(state.activeSession, T0 + 60 * MINUTE), 10 * MINUTE, 'pausa não conta');
  state = resumeSession(state, T0 + 30 * MINUTE);
  assert.equal(state.activeSession.status, 'active');
  assert.equal(sessionElapsed(state.activeSession, T0 + 40 * MINUTE), 20 * MINUTE);
});

test('encerrar guarda a sessão sem tocar em XP ou histórico', () => {
  let state = startSession(createInitialState(), { courseId: 'design', label: 'Primeira aula' }, T0);
  const result = endSession(state, T0 + 25 * MINUTE);
  state = result.state;
  assert.equal(state.activeSession, null);
  assert.equal(state.studySessions.length, 1);
  assert.equal(state.studySessions[0].durationMs, 25 * MINUTE);
  assert.equal(state.studySessions[0].origin, 'declared');
  assert.equal(result.session.label, 'Primeira aula');
  assert.equal(totalXP(state), 0);
  assert.deepEqual(state.progress, []);
});

test('começar outra sessão encerra a anterior em vez de perder o tempo', () => {
  let state = startSession(createInitialState(), { label: 'A' }, T0);
  state = startSession(state, { label: 'B' }, T0 + 5 * MINUTE);
  assert.equal(state.activeSession.label, 'B');
  assert.equal(state.studySessions.length, 1);
  assert.equal(state.studySessions[0].label, 'A');
  assert.equal(state.studySessions[0].durationMs, 5 * MINUTE);
});

test('sessão esquecida é pausada ao carregar, sem inflar o tempo', () => {
  let state = startSession(createInitialState(), { label: 'Aberta por dias' }, T0);
  state = touchSession(state, T0 + 30 * MINUTE);
  const reconciled = reconcileSession(state, T0 + 48 * 60 * MINUTE);
  assert.equal(reconciled.activeSession.status, 'paused');
  assert.equal(sessionElapsed(reconciled.activeSession, T0 + 48 * 60 * MINUTE), 30 * MINUTE);
  // Antes do limite de inatividade, nada muda.
  const fresh = reconcileSession(state, T0 + 31 * MINUTE);
  assert.equal(fresh.activeSession.status, 'active');
  assert.equal(reconcileSession(state, T0 + STALE_SESSION_MS / 2).activeSession.status, 'active');
});

test('o tempo de uma sessão é limitado a doze horas', () => {
  let state = startSession(createInitialState(), { label: 'Longa' }, T0);
  const result = endSession(state, T0 + 30 * 60 * MINUTE);
  assert.equal(result.session.durationMs, MAX_SESSION_MS);
  assert.equal(formatSessionDuration(MAX_SESSION_MS), '12:00:00');
});

test('formatação do relógio é estável', () => {
  assert.equal(formatSessionDuration(0), '0:00');
  assert.equal(formatSessionDuration(65 * 1000), '1:05');
  assert.equal(formatSessionDuration(59 * MINUTE + 59000), '59:59');
  assert.equal(formatSessionDuration(2 * 60 * MINUTE + 7000), '2:00:07');
  assert.equal(formatSessionDuration(-50), '0:00');
});

test('sessão e histórico de sessões sobrevivem à restauração', () => {
  let state = startSession(createInitialState(), { courseId: 'design', label: 'Persistente' }, T0);
  state = endSession(state, T0 + 15 * MINUTE).state;
  state = startSession(state, { label: 'Em andamento' }, T0 + 20 * MINUTE);
  const restored = restoreState(JSON.stringify(state));
  assert.equal(restored.activeSession.label, 'Em andamento');
  assert.equal(restored.activeSession.status, 'active');
  assert.equal(restored.studySessions.length, 1);
  assert.equal(restored.studySessions[0].durationMs, 15 * MINUTE);

  // Dados antigos, sem os campos novos, continuam válidos.
  const legacy = createInitialState();
  delete legacy.activeSession;
  delete legacy.studySessions;
  const legacyRestored = restoreState(JSON.stringify(legacy));
  assert.equal(legacyRestored.activeSession, null);
  assert.deepEqual(legacyRestored.studySessions, []);

  // Dados inválidos não derrubam o documento.
  const broken = { ...state, activeSession: { label: 'sem datas' }, studySessions: [{ id: 'x' }] };
  const sanitized = restoreState(JSON.stringify(broken));
  assert.equal(sanitized.activeSession, null);
  assert.deepEqual(sanitized.studySessions, []);
});

test('ritmo semanal soma minutos declarados por dia local, incluindo a sessão ativa', () => {
  const now = new Date(2026, 9, 31, 18, 0).getTime();
  const day = (offset, hour) => new Date(2026, 9, 31 - offset, hour, 0).getTime();
  let state = createInitialState();
  state = endSession(startSession(state, { label: 'Ontem' }, day(1, 9)), day(1, 9) + 40 * MINUTE).state;
  state = endSession(startSession(state, { label: 'Semana passada' }, day(9, 9)), day(9, 9) + 20 * MINUTE).state;
  state = startSession(state, { label: 'Agora' }, now - 15 * MINUTE);
  const days = minutesByDay(state, 7, now);
  assert.equal(days.length, 7);
  assert.equal(days.at(-1).date, localDay(now));
  assert.equal(days.at(-1).minutes, 15);
  assert.equal(days.at(-2).minutes, 40);
  assert.equal(days.at(-2).sessions, 1);
  const rhythm = weeklyRhythm(state, now);
  assert.equal(rhythm.current, 55);
  assert.equal(rhythm.previous, 20);
  assert.equal(rhythm.change, 175);
  assert.equal(rhythm.activeDays, 2);
  assert.equal(totalXP(state), 0);
});

test('sem semana anterior, o ritmo não inventa porcentagem', () => {
  const now = new Date(2026, 9, 31, 18, 0).getTime();
  const state = endSession(startSession(createInitialState(), {}, now - 30 * MINUTE), now).state;
  assert.equal(weeklyRhythm(state, now).change, null);
  assert.equal(formatMinutes(30), '30 min');
  assert.equal(formatMinutes(135), '2h 15m');
  assert.equal(formatMinutes(180), '3h');
});
