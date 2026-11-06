import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';

// XP sempre vem do servidor; não há marcações de envio no navegador.
export function useXp(account) {
  const [xp, setXp] = useState(null);
  const [xpStatus, setXpStatus] = useState('idle');
  const currentAccount = useRef(account?.id);
  currentAccount.current = account?.id;
  const refreshXP = useCallback(async () => {
    const id = account?.id;
    if (!id) { setXp(null); setXpStatus('idle'); return; }
    setXpStatus((current) => current === 'ready' ? current : 'loading');
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await api(`/api/xp?timeZone=${encodeURIComponent(timeZone || '')}`);
      if (currentAccount.current !== id) return;
      if (!result.ok) { setXpStatus(result.status === 401 ? 'signed-out' : 'error'); return; }
      setXp(result.data);
      setXpStatus('ready');
    } catch { if (currentAccount.current === id) setXpStatus('error'); }
  }, [account?.id]);
  useEffect(() => { setXp(null); refreshXP(); }, [refreshXP]);
  return { xp, xpStatus, refreshXP };
}
