import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

// XP da conta: resumo, extrato e marco da política, sempre lidos do servidor.
// O navegador nunca calcula o placar; só mostra o que o livro de eventos diz.

const SENT_KEY = 'lume.xp.sent.v1';

function readSent() {
  try {
    const value = JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function useXp(account) {
  const [xp, setXp] = useState(null);
  const [xpStatus, setXpStatus] = useState('idle');
  // Marcações locais do que já foi aceito (sessões de tempo e eventos do extrato).
  const sent = useRef(readSent());

  const persistSent = useCallback(() => {
    try { localStorage.setItem(SENT_KEY, JSON.stringify(sent.current)); } catch { /* A marcação é só uma otimização. */ }
  }, []);

  const refreshXP = useCallback(async () => {
    if (!account?.id) { setXp(null); setXpStatus('idle'); return; }
    setXpStatus((current) => current === 'ready' ? current : 'loading');
    const timeZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } })();
    const result = await api(`/api/xp?timeZone=${encodeURIComponent(timeZone || '')}`);
    if (!result.ok) {
      setXpStatus(result.status === 401 ? 'signed-out' : 'error');
      return;
    }
    setXp(result.data);
    setXpStatus('ready');
    for (const event of result.data.events || []) {
      if (event.eventKey) sent.current[`${account.id}|${event.eventKey}`] = true;
    }
    persistSent();
  }, [account?.id, persistSent]);

  useEffect(() => {
    if (!account?.id) { setXp(null); setXpStatus('idle'); return; }
    refreshXP();
  }, [account?.id, refreshXP]);

  return { xp, xpStatus, refreshXP, sent, persistSent };
}
