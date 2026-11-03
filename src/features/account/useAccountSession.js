import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY } from '../../../public/domain.js';
import { api, apiError } from '../../lib/api.js';

const PREVIEW_KEY = 'lume.preview-session.v1';

function clearBrowserStudyData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}.`) || ['lume.xp.sent.v1', 'lume.progress.sent.v1'].includes(key)) localStorage.removeItem(key);
    }
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch { /* O funcionamento não depende de armazenamento local. */ }
}

// O ciclo da sessão decide qual conta está aberta; a biblioteca cuida de suas
// próprias revisões, envios e recuperação de falhas.
export function useAccountSession(account, setAccount, { load, reset, invalidate, unavailable, waitForSave }) {
  const [accountStatus, setAccountStatus] = useState('checking');
  const [preview, setPreview] = useState(false);
  const loadAccountProgress = useCallback(async (user, signal) => {
    clearBrowserStudyData();
    if (!await load(signal)) return;
    setAccount(user);
    setPreview(false);
  }, [load, setAccount]);

  useEffect(() => {
    clearBrowserStudyData();
    const controller = new AbortController();
    (async () => {
      try {
        const result = await api('/api/me', { signal: controller.signal });
        if (!result.ok || typeof result.data?.authenticated !== 'boolean') throw new Error('API indisponível');
        if (result.data.authenticated) await loadAccountProgress(result.data.user, controller.signal);
        if (!controller.signal.aborted) setAccountStatus('ready');
      } catch (error) {
        if (!controller.signal.aborted && error.name !== 'AbortError') { setAccountStatus('offline'); unavailable(); }
      }
    })();
    return () => { controller.abort(); invalidate(); };
  }, [invalidate, loadAccountProgress, unavailable]);

  const enterPreview = () => { reset(); setPreview(true); };
  const exit = async () => {
    await waitForSave();
    if (account) {
      const result = await api('/api/logout', { method: 'POST' });
      if (!result.ok) throw new Error(apiError(result));
    }
    reset();
    setAccount(null);
    setPreview(false);
  };
  return { accountStatus, setAccountStatus, preview, enterPreview, exit, loadAccountProgress };
}
