// Comandos de progresso (POST /api/progress): grava cada evento no registro do
// servidor e avalia as regras de recompensa na mesma requisição.
//
// Atomicidade por idempotência: o evento tem chave (usuário, id) e cada
// recompensa tem chave única em xp_events. Se a requisição cair no meio, o
// cliente reenvia os mesmos comandos e o resultado converge, sem duplicar.

import { ensureXpSettings } from './xp.js';
import { MAX_COMMANDS, ProgressError, eligibleCompletions, loadLibrary, markCommandMode, recordCommand } from './progress.js';
import { runRules } from './rewards.js';

export async function applyProgressCommands(db, userId, input, { now = Date.now() } = {}) {
  const commands = Array.isArray(input?.commands) ? input.commands : null;
  if (!commands || !commands.length) throw new ProgressError('Nenhum comando enviado.', 'empty_commands', 400);
  if (commands.length > MAX_COMMANDS) throw new ProgressError(`Envie no máximo ${MAX_COMMANDS} comandos por vez.`, 'too_many_commands', 413);

  const state = await loadLibrary(db, userId);
  const settings = await ensureXpSettings(db, userId, { now });
  await markCommandMode(db, userId, now);

  const results = [];
  const touched = new Map();
  const decks = new Map();
  for (const command of commands) {
    try {
      if (command?.type === 'deck') {
        const course = (state.courses || []).find((item) => item.id === command.materialId);
        if (!course) throw new ProgressError('Material não encontrado na sua biblioteca.', 'unit_not_found', 404);
        decks.set(course.id, course);
        results.push({ id: String(command.id || ''), status: 'recorded' });
        continue;
      }
      const result = await recordCommand(db, userId, state, command, now);
      results.push({ id: result.id, status: result.status });
      // Repetição também reavalia: se a recompensa falhou antes, ela sai agora.
      if (result.event?.type === 'completion' && ['recorded', 'duplicate'].includes(result.status)) {
        touched.set(`${result.course.id}|${result.step.id}`, { course: result.course, step: result.step });
      }
    } catch (error) {
      if (!(error instanceof ProgressError)) throw error;
      results.push({ id: String(command?.id || ''), status: 'rejected', code: error.code, error: error.message });
    }
  }

  const granted = [];
  const collect = (outcomes) => outcomes.forEach((outcome) => { if (outcome.added) granted.push(outcome.event); });
  const completionsByMaterial = new Map();
  for (const { course, step } of touched.values()) {
    if (!completionsByMaterial.has(course.id)) completionsByMaterial.set(course.id, await eligibleCompletions(db, userId, { materialId: course.id }));
    collect(await runRules(db, userId, 'unit.completed', { course, step, settings, completions: completionsByMaterial.get(course.id) }, { now }));
  }
  for (const course of decks.values()) {
    collect(await runRules(db, userId, 'deck.completed', { course, settings }, { now }));
  }
  return { results, xp: granted };
}
