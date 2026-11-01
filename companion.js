// Lógica de servidor do Lume Companion, compartilhada pelo servidor local
// (SQLite) e pelo Worker (D1). O adaptador de banco expõe run/first/all
// assíncronos; assim a mesma regra roda nos dois lugares.
//
// O programa conectado recebe um token próprio. Ele não usa a sessão do
// navegador e só pode relatar presença — não lê estado, não conclui aulas e
// não recebe XP.

import { createSessionToken, hashSessionToken } from './auth.js';
import {
  MAX_ALLOWLIST, MAX_DEVICES, PAIR_CODE_LENGTH, PAIR_TTL_MS, PRESENCE_TTL_MS,
  cleanAppLabel, formatPairCode, generatePairCode, normalizeCategory,
  normalizePairCode, presenceState,
} from './companion/domain.mjs';
import { studyPlan } from './public/study-plan.js';
import { AppError } from './api/errors.js';

export class CompanionError extends AppError {
  constructor(message, code = 'companion_error', status = 400) {
    super(message, code, status);
    this.name = 'CompanionError';
  }
}

function cleanDeviceName(value) {
  const name = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) throw new CompanionError('Dê um nome ao dispositivo.', 'missing_device_name', 400);
  if (name.length > 40) throw new CompanionError('O nome do dispositivo pode ter até 40 caracteres.', 'invalid_device_name', 400);
  return name;
}

function iso(now) {
  return new Date(now).toISOString();
}

export async function createPairCode(db, userId, now = Date.now()) {
  const code = generatePairCode();
  const codeHash = await hashSessionToken(normalizePairCode(code));
  // Apenas o código mais recente vale: evita códigos esquecidos por aí.
  await db.run('DELETE FROM companion_pair_codes WHERE user_id = ? AND used_at IS NULL', [userId]);
  await db.run(
    'INSERT INTO companion_pair_codes (code_hash, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)',
    [codeHash, userId, iso(now), iso(now + PAIR_TTL_MS)],
  );
  return { code: formatPairCode(code), expiresAt: iso(now + PAIR_TTL_MS), ttlSeconds: Math.round(PAIR_TTL_MS / 1000) };
}

export async function redeemPairCode(db, { code, deviceName }, now = Date.now()) {
  const normalized = normalizePairCode(code);
  if (normalized.length !== PAIR_CODE_LENGTH) {
    throw new CompanionError('Código incompleto. Confira os oito caracteres mostrados no Lume.', 'invalid_code', 400);
  }
  const codeHash = await hashSessionToken(normalized);
  const row = await db.first('SELECT user_id, expires_at, used_at FROM companion_pair_codes WHERE code_hash = ?', [codeHash]);
  if (!row) throw new CompanionError('Código não encontrado. Gere outro no Lume.', 'invalid_code', 400);
  if (row.used_at) throw new CompanionError('Este código já foi usado. Gere outro no Lume.', 'used_code', 400);
  if (Date.parse(row.expires_at) <= now) throw new CompanionError('Este código expirou. Gere outro no Lume.', 'expired_code', 400);

  const count = await db.first('SELECT COUNT(*) AS total FROM companion_devices WHERE user_id = ?', [row.user_id]);
  if (Number(count?.total ?? 0) >= MAX_DEVICES) {
    throw new CompanionError(`Você já tem ${MAX_DEVICES} dispositivos conectados. Remova um antes de conectar outro.`, 'device_limit', 409);
  }

  const name = cleanDeviceName(deviceName);
  // Uso único garantido pela condição no UPDATE, não por uma leitura anterior.
  const consumed = await db.run(
    'UPDATE companion_pair_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL',
    [iso(now), codeHash],
  );
  if (consumed !== 1) throw new CompanionError('Este código já foi usado. Gere outro no Lume.', 'used_code', 400);

  const { token, tokenHash } = await createSessionToken();
  const id = crypto.randomUUID();
  await db.run(
    'INSERT INTO companion_devices (id, user_id, name, token_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, row.user_id, name, tokenHash, iso(now), iso(now)],
  );
  return { token, device: { id, name } };
}

export async function authenticateDevice(db, token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const tokenHash = await hashSessionToken(token);
  const row = await db.first('SELECT id, user_id, name FROM companion_devices WHERE token_hash = ?', [tokenHash]);
  return row ?? null;
}

export async function reportPresence(db, device, { app, category, since }, now = Date.now()) {
  const label = cleanAppLabel(app);
  if (!label) throw new CompanionError('Informe o aplicativo em uso.', 'invalid_app', 400);
  const sinceIso = Number.isFinite(Date.parse(since)) ? new Date(since).toISOString() : iso(now);
  const updatedAt = iso(now);
  await db.run(
    `INSERT INTO companion_presence (device_id, user_id, app, category, since, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET app = excluded.app, category = excluded.category, since = excluded.since, updated_at = excluded.updated_at`,
    [device.id, device.user_id, label, normalizeCategory(category), sinceIso, updatedAt],
  );
  await db.run('UPDATE companion_devices SET last_seen_at = ? WHERE id = ?', [updatedAt, device.id]);
  return { app: label, category: normalizeCategory(category), since: sinceIso, updatedAt };
}

export async function clearPresence(db, deviceId, now = Date.now()) {
  await db.run('DELETE FROM companion_presence WHERE device_id = ?', [deviceId]);
  await db.run('UPDATE companion_devices SET last_seen_at = ? WHERE id = ?', [iso(now), deviceId]);
}

export async function listCompanion(db, userId, now = Date.now()) {
  const rows = await db.all(
    `SELECT d.id, d.name, d.created_at, d.last_seen_at,
            p.app, p.category, p.since, p.updated_at
       FROM companion_devices d
       LEFT JOIN companion_presence p ON p.device_id = d.id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC`,
    [userId],
  );
  const devices = rows.map((row) => {
    const presence = row.app ? presenceState({
      app: row.app,
      category: row.category,
      since: row.since,
      updatedAt: row.updated_at,
    }, now) : { active: false };
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      presence,
    };
  });
  return {
    devices,
    active: devices.filter((device) => device.presence.active),
    ttlSeconds: Math.round(PRESENCE_TTL_MS / 1000),
    maxDevices: MAX_DEVICES,
    maxAllowlist: MAX_ALLOWLIST,
  };
}

export async function revokeDevice(db, userId, deviceId) {
  if (!deviceId || typeof deviceId !== 'string') throw new CompanionError('Dispositivo inválido.', 'invalid_device', 400);
  const owned = await db.first('SELECT id FROM companion_devices WHERE id = ? AND user_id = ?', [deviceId, userId]);
  if (!owned) throw new CompanionError('Esse dispositivo não pertence à sua conta.', 'not_found', 404);
  await db.run('DELETE FROM companion_presence WHERE device_id = ?', [deviceId]);
  await db.run('DELETE FROM companion_devices WHERE id = ? AND user_id = ?', [deviceId, userId]);
  return { revoked: true, deviceId };
}

// O agente usa este endpoint para confirmar que o token ainda vale antes de
// começar a enviar presença.
export async function companionSelf(db, device, now = Date.now()) {
  const row = await db.first(
    `SELECT p.app, p.category, p.since, p.updated_at FROM companion_presence p WHERE p.device_id = ?`,
    [device.id],
  );
  return {
    device: { id: device.id, name: device.name },
    presence: row?.app ? presenceState({ app: row.app, category: row.category, since: row.since, updatedAt: row.updated_at }, now) : { active: false },
  };
}

// Leitura do roteiro pela ótica do programa. O token do dispositivo dá acesso
// somente leitura à cópia do estado da conta: nada é alterado e nada vira XP.
export async function studySnapshot(db, device, now = Date.now()) {
  const row = await db.first('SELECT state FROM user_state WHERE user_id = ?', [device.user_id]);
  let state = null;
  try { state = row?.state ? JSON.parse(row.state) : null; } catch { state = null; }
  if (!state || typeof state !== 'object' || !Array.isArray(state.courses)) {
    return { available: false, reason: 'no_state', message: 'Ainda não há progresso salvo nesta conta. Adicione um curso no Lume.', plan: null };
  }
  return { available: true, plan: studyPlan(state, { now }) };
}
