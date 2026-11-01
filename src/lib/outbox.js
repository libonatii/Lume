// Fila de saída do progresso. Cada evento do registro único (state.progress)
// vira um comando para POST /api/progress; o servidor grava a conclusão com o
// próprio relógio e devolve o XP concedido. A marcação local só evita reenviar
// o que já foi aceito — a proteção real contra repetição é a chave no servidor.

import { slideProgressSnapshot } from '../../public/xp-policy.js';

export const OUTBOX_KEY = 'lume.progress.sent.v1';
export const BATCH_SIZE = 200;

export function readSent() {
  try {
    const value = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function writeSent(sent) {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(sent)); } catch { /* Só uma otimização. */ }
}

// Comandos ainda não aceitos para esta conta, na ordem do registro.
// → [{ key, command }]
export function pendingCommands(state, accountId, sent) {
  const pending = [];
  const isSent = (key) => Boolean(sent[`${accountId}|${key}`]);
  for (const event of state?.progress || []) {
    if (event.type === 'preparation') {
      const key = `p|${event.id}`;
      if (!isSent(key)) pending.push({ key, command: { id: event.id, type: 'prepare', materialId: event.materialId, unitId: event.unitId, at: event.at } });
      continue;
    }
    const completeKey = `c|${event.id}`;
    if (!isSent(completeKey)) {
      pending.push({
        key: completeKey,
        command: {
          id: event.id, type: 'complete', materialId: event.materialId, unitId: event.unitId,
          origin: event.origin, historical: event.historical, at: event.at,
        },
      });
    }
    if (event.revertedAt && event.origin === 'manual') {
      const revertKey = `r|${event.id}`;
      if (!isSent(revertKey)) pending.push({ key: revertKey, command: { id: event.id, type: 'revert' } });
    }
  }
  for (const course of state?.courses || []) {
    const deck = slideProgressSnapshot(course);
    const key = `d|${course.id}|${deck.completedAt}`;
    if (deck.completed && !isSent(key)) pending.push({ key, command: { id: `deck:${course.id}`, type: 'deck', materialId: course.id } });
  }
  return pending;
}
