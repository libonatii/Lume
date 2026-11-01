import { useEffect, useRef } from 'react';
import { api } from '../../lib/api.js';
import { BATCH_SIZE, pendingCommands, readSent, writeSent } from '../../lib/outbox.js';

// Envia o progresso ao servidor. Conclusões, preparações, desfazer e
// apresentações vão como comandos (src/lib/outbox.js): o servidor grava com o
// próprio relógio e as regras de recompensa respondem na mesma requisição.
// Sessões declaradas seguem pela rota de tempo. A biblioteca é salva antes,
// porque o servidor confere a aula nela.
export function useProgressSync({ state, account, ready, saveRemote, xp, refreshXP, xpSent, persistSent }) {
  const busy = useRef(false);
  const outbox = useRef(readSent());

  useEffect(() => {
    if (!account?.id || !ready.current || !xp?.settings?.eligibleSince) return undefined;
    const eligibleSince = xp.settings.eligibleSince;
    const isSent = (key) => Boolean(xpSent.current[`${account.id}|${key}`]);
    const commands = pendingCommands(state, account.id, outbox.current);
    const sessions = (state.studySessions || []).filter((session) => {
      if (!Number.isFinite(Date.parse(session.endedAt)) || Date.parse(session.endedAt) < Date.parse(eligibleSince)) return false;
      return !isSent(`session|${session.id}`);
    });
    if (!commands.length && !sessions.length) return undefined;

    const timerId = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      const sent = (key) => { xpSent.current[`${account.id}|${key}`] = true; };
      const unsent = (key) => { delete xpSent.current[`${account.id}|${key}`]; };
      try {
        if (ready.current && !(await saveRemote(state))) return;
        for (let start = 0; start < commands.length; start += BATCH_SIZE) {
          const batch = commands.slice(start, start + BATCH_SIZE);
          try {
            const result = await api('/api/progress', { method: 'POST', body: { commands: batch.map((item) => item.command) } });
            // Erro de servidor ou rede: tenta de novo depois. Recusa (4xx) não muda com repetição.
            if (!result.ok && (result.status >= 500 || result.status === 0)) break;
            batch.forEach((item) => { outbox.current[`${account.id}|${item.key}`] = true; });
            writeSent(outbox.current);
          } catch { break; }
        }
        for (const session of sessions) {
          const key = `session|${session.id}`;
          sent(key);
          try {
            const result = await api('/api/xp/time', {
              method: 'POST',
              body: {
                sessionId: session.id,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
                durationSeconds: Math.round(Number(session.durationMs || 0) / 1000),
                courseId: session.courseId,
              },
            });
            if (!result.ok && result.status >= 500) unsent(key);
          } catch { unsent(key); }
        }
        persistSent();
        await refreshXP();
      } finally {
        busy.current = false;
      }
    }, 1500);
    return () => clearTimeout(timerId);
  }, [state, account?.id, xp?.settings?.eligibleSince, saveRemote, refreshXP, persistSent, ready, xpSent]);
}
