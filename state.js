// Leitura e gravação do documento de estado com revisão otimista.
//
// O cliente envia a revisão em que sua cópia se baseia. Se outro dispositivo
// salvou antes, o servidor devolve o estado atual e o cliente mescla antes de
// tentar de novo. O documento continua sendo a cópia da biblioteca/progresso;
// o XP elegível vive em xp_events e não é alterado por esta rota.

import { AppError } from './api/errors.js';

export class StateError extends AppError {
  constructor(message, code = 'state_error', status = 400) {
    super(message, code, status);
    this.name = 'StateError';
  }
}

const MAX_STATE_BYTES = 320 * 1024;

export function parseStateBody(text) {
  if (typeof text !== 'string' || !text) throw new StateError('Progresso em formato inválido.', 'invalid_state', 400);
  if (text.length > MAX_STATE_BYTES) throw new StateError('O progresso enviado é grande demais.', 'state_too_large', 413);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StateError('Progresso em formato inválido.', 'invalid_state', 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new StateError('Progresso em formato inválido.', 'invalid_state', 400);
  }
  // Formato novo: { state, baseRevision }. O formato antigo (o próprio estado)
  // continua aceito para não quebrar clientes já abertos.
  if (parsed.state !== undefined) {
    if (!parsed.state || typeof parsed.state !== 'object' || Array.isArray(parsed.state)) {
      throw new StateError('Progresso em formato inválido.', 'invalid_state', 400);
    }
    const baseRevision = Number.isInteger(parsed.baseRevision) && parsed.baseRevision >= 0 ? parsed.baseRevision : null;
    return { state: parsed.state, text: JSON.stringify(parsed.state), baseRevision };
  }
  return { state: parsed, text, baseRevision: null };
}

function formatVersion(value) {
  if (value && typeof value === 'object') return Number(value.version) || 0;
  const match = /"version"s*:s*(d+)/.exec(String(value || '').slice(0, 200));
  if (match) return Number(match[1]);
  try { return Number(JSON.parse(value)?.version) || 0; } catch { return 0; }
}

export async function readState(db, userId) {
  const row = await db.first('SELECT state, updated_at, revision FROM user_state WHERE user_id = ?', [userId]);
  if (!row) return { state: null, updatedAt: null, revision: 0 };
  try {
    return { state: JSON.parse(row.state), updatedAt: row.updated_at, revision: Number(row.revision || 1) };
  } catch {
    return { state: null, updatedAt: row.updated_at, revision: Number(row.revision || 1) };
  }
}

export async function writeState(db, userId, { state, text, baseRevision }, { now = Date.now() } = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new StateError('Progresso em formato inválido.', 'invalid_state', 400);
  }
  const raw = typeof text === 'string' ? text : JSON.stringify(state);
  if (raw.length > MAX_STATE_BYTES) throw new StateError('O progresso enviado é grande demais.', 'state_too_large', 413);
  const current = await db.first('SELECT revision, state FROM user_state WHERE user_id = ?', [userId]);
  const currentRevision = Number(current?.revision || 0);

  // Um aba antiga (versão anterior do site, ainda em cache) não pode gravar o
  // formato velho por cima do novo: ela leria o documento novo como vazio.
  if (current && formatVersion(current.state) > formatVersion(state)) {
    throw new StateError('O Lume foi atualizado em outro dispositivo. Recarregue a página para continuar salvando.', 'client_outdated', 409);
  }

  // Sem baseRevision, mantém o comportamento antigo (última escrita vence),
  // mas ainda incrementa a revisão para que os próximos clientes percebam.
  if (baseRevision !== null && current && baseRevision !== currentRevision) {
    const remote = await readState(db, userId);
    return { conflict: true, current: remote };
  }
  if (baseRevision !== null && !current && baseRevision !== 0) {
    return { conflict: true, current: { state: null, updatedAt: null, revision: 0 } };
  }

  const nextRevision = currentRevision + 1;
  const updatedAt = new Date(now).toISOString();
  await db.run(
    `INSERT INTO user_state (user_id, state, updated_at, revision) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at, revision = excluded.revision`,
    [userId, raw, updatedAt, nextRevision],
  );
  return { conflict: false, updatedAt, revision: nextRevision };
}
