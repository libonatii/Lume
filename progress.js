// Registro de progresso no servidor (refatoração F3).
//
// O documento de estado continua sendo a cópia da biblioteca, mas a política de
// XP lê as conclusões daqui. Uma conclusão chega por comando (POST /api/progress)
// com o id do evento do documento; o servidor grava o próprio relógio e nunca
// aceita que o cliente adiante uma data. Contas que só usaram clientes antigos
// ficam no modo 'document': o servidor copia o registro do documento para cá a
// cada pedido de XP, com a mesma confiança de antes, até o primeiro comando.

import { AppError } from './api/errors.js';
import { restoreState } from './public/domain.js';

export class ProgressError extends AppError {
  constructor(message, code = 'progress_error', status = 400) {
    super(message, code, status);
    this.name = 'ProgressError';
  }
}

export const MAX_COMMANDS = 200;
const ELIGIBLE_ORIGINS = new Set(['manual', 'integration']);

function iso(value) {
  return new Date(value).toISOString();
}

export async function accountMode(db, userId) {
  const row = await db.first('SELECT mode FROM progress_accounts WHERE user_id = ?', [userId]);
  return row?.mode || 'document';
}

export async function loadLibrary(db, userId) {
  const row = await db.first('SELECT state FROM user_state WHERE user_id = ?', [userId]);
  if (!row?.state) throw new ProgressError('Salve seu progresso na conta antes de registrar conclusões.', 'state_missing', 409);
  return restoreState(row.state);
}

function eventRow(userId, event, { source, recordedAt }) {
  return [
    `INSERT OR IGNORE INTO progress_events
      (user_id, id, type, material_id, unit_id, origin, historical, declared_at, recorded_at, reverted_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId, event.id, event.type, event.materialId || '', event.unitId, event.origin,
      event.historical ? 1 : 0, event.at || null, recordedAt, event.revertedAt || null, source,
    ],
  ];
}

// Modo documento: copia o registro do documento (cliente antigo). Eventos já
// copiados não mudam, salvo uma conclusão desfeita depois.
export async function syncFromDocument(db, userId, state, now = Date.now()) {
  if (await accountMode(db, userId) !== 'document') return;
  const statements = [];
  for (const event of state.progress || []) {
    statements.push(eventRow(userId, event, { source: 'document', recordedAt: event.at || iso(now) }));
    if (event.revertedAt) {
      statements.push(['UPDATE progress_events SET reverted_at = ? WHERE user_id = ? AND id = ? AND reverted_at IS NULL', [event.revertedAt, userId, event.id]]);
    }
  }
  if (statements.length) await db.batch(statements);
}

export async function markCommandMode(db, userId, now = Date.now()) {
  await db.run(
    `INSERT INTO progress_accounts (user_id, mode, updated_at) VALUES (?, 'commands', ?)
     ON CONFLICT(user_id) DO UPDATE SET mode = 'commands', updated_at = excluded.updated_at`,
    [userId, iso(now)],
  );
}

// Momento que vale para a política. Por comando: o menor entre o horário
// declarado e o do servidor — declarar uma data futura não adianta nada, e
// declarar uma data antiga só torna a conclusão legado. Do documento: o
// horário declarado, como era antes dos comandos.
export function effectiveTime(row) {
  const recorded = Date.parse(row.recorded_at);
  const declared = Date.parse(row.declared_at);
  if (row.source === 'command') return Number.isFinite(declared) ? Math.min(declared, recorded) : recorded;
  return Number.isFinite(declared) ? declared : NaN;
}

// Aulas concluídas e o instante que vale para a política. → Map(unitId → instante)
// Conclusão ativa que não pode valer XP (histórica, importada, legado ou sem
// data) entra com -Infinity: está concluída, mas é sempre anterior ao marco.
export async function eligibleCompletions(db, userId, { materialId = null } = {}) {
  const rows = await db.all(
    `SELECT * FROM progress_events
      WHERE user_id = ? AND type = 'completion' AND reverted_at IS NULL
      ${materialId ? 'AND material_id = ?' : ''}`,
    materialId ? [userId, materialId] : [userId],
  );
  const map = new Map();
  for (const row of rows) {
    const at = !row.historical && ELIGIBLE_ORIGINS.has(row.origin) ? effectiveTime(row) : -Infinity;
    const value = Number.isFinite(at) ? at : -Infinity;
    map.set(row.unit_id, Math.max(map.get(row.unit_id) ?? -Infinity, value));
  }
  return map;
}

export async function activeUnitIds(db, userId) {
  const rows = await db.all(
    "SELECT DISTINCT unit_id FROM progress_events WHERE user_id = ? AND type = 'completion' AND reverted_at IS NULL",
    [userId],
  );
  return new Set(rows.map((row) => row.unit_id));
}

function findUnit(state, materialId, unitId) {
  const course = (state.courses || []).find((item) => item.id === materialId);
  const step = course?.steps?.find((item) => item.id === unitId);
  return course && step ? { course, step } : null;
}

// Valida e grava um comando. Devolve o que mudou para o motor de recompensas.
export async function recordCommand(db, userId, state, command, now = Date.now()) {
  const id = typeof command?.id === 'string' ? command.id.trim() : '';
  if (!id || id.length > 200) throw new ProgressError('Comando sem identificador.', 'invalid_command', 400);
  const type = command.type;
  if (type === 'revert') {
    const row = await db.first('SELECT * FROM progress_events WHERE user_id = ? AND id = ?', [userId, id]);
    if (!row) return { id, status: 'unknown' };
    if (row.origin !== 'manual') throw new ProgressError('Só uma conclusão registrada por você pode ser desfeita.', 'not_revertible', 409);
    const changed = await db.run('UPDATE progress_events SET reverted_at = ? WHERE user_id = ? AND id = ? AND reverted_at IS NULL', [iso(now), userId, id]);
    return { id, status: changed ? 'reverted' : 'duplicate' };
  }
  if (type !== 'complete' && type !== 'prepare') throw new ProgressError('Tipo de comando desconhecido.', 'invalid_command', 400);
  const materialId = typeof command.materialId === 'string' ? command.materialId : '';
  const unitId = typeof command.unitId === 'string' ? command.unitId : '';
  const found = findUnit(state, materialId, unitId);
  if (!found) throw new ProgressError('Aula ou etapa não encontrada na sua biblioteca.', 'unit_not_found', 404);
  const origin = ['manual', 'integration', 'import', 'legacy'].includes(command.origin) ? command.origin : 'manual';
  const declared = Number.isFinite(Date.parse(command.at)) ? iso(Date.parse(command.at)) : null;
  const event = {
    id,
    type: type === 'complete' ? 'completion' : 'preparation',
    materialId,
    unitId,
    origin,
    historical: command.historical === true || origin === 'import' || origin === 'legacy',
    at: declared,
  };
  const [sql, params] = eventRow(userId, event, { source: 'command', recordedAt: iso(now) });
  const inserted = await db.run(sql, params);
  return { id, status: inserted ? 'recorded' : 'duplicate', event, ...found };
}
