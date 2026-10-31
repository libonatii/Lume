import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEY, createInitialState, restoreState } from '../../public/domain.js';
import { reconcileSession } from '../../public/session-domain.js';
import { api, apiError } from '../lib/api.js';

export const PREVIEW_KEY = 'lume.preview-session.v1';
function readLocal() {
  try { return reconcileSession(restoreState(localStorage.getItem(STORAGE_KEY))); }
  catch { return createInitialState(); }
}
export function useLume(notify) {
  const [state, setState] = useState(readLocal);
  const [account, setAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState('checking');
  const [syncStatus, setSyncStatus] = useState('local');
  const [preview, setPreview] = useState(() => { try { return sessionStorage.getItem(PREVIEW_KEY) === 'open'; } catch { return false; } });
  const stateRef = useRef(state);
  const ready = useRef(false);
  const timer = useRef(null);
  const syncGeneration = useRef(0);
  const pendingSave = useRef(Promise.resolve());
  stateRef.current = state;

  const saveRemote = useCallback((snapshot) => {
    const generation = syncGeneration.current;
    setSyncStatus('saving');
    // Serializa gravações: uma resposta lenta não pode sobrescrever a mais nova.
    const save = pendingSave.current.catch(() => {}).then(async () => {
      if (generation !== syncGeneration.current) return;
      const result = await api('/api/state', { method: 'PUT', body: snapshot });
      if (!result.ok) throw new Error(apiError(result));
    });
    pendingSave.current = save;
    return save.then(() => { if (generation === syncGeneration.current) setSyncStatus('saved'); })
      .catch(() => {
        if (generation === syncGeneration.current) {
          setSyncStatus('error');
          notify('Não foi possível sincronizar. Sua cópia local está preservada.');
        }
      });
  }, [notify]);

  const loadAccountProgress = useCallback(async (user, signal) => {
    ready.current = false;
    clearTimeout(timer.current);
    syncGeneration.current += 1;
    const result = await api('/api/state', { signal });
    if (!result.ok || !result.data) throw new Error('Não foi possível carregar o progresso da conta.');
    if (result.data.state) {
      // Preserva a cópia anterior antes de carregar o estado remoto.
      try { localStorage.setItem(`${STORAGE_KEY}.before-account`, JSON.stringify(stateRef.current)); } catch { /* Cópia em memória permanece disponível. */ }
      setState(reconcileSession(restoreState(JSON.stringify(result.data.state))));
    }
    setAccount(user);
    ready.current = true;
    setSyncStatus('saved');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const result = await api('/api/me', { signal: controller.signal });
        if (typeof result.data?.authenticated !== 'boolean') throw new Error('API indisponível');
        if (result.data.authenticated) await loadAccountProgress(result.data.user, controller.signal);
        setAccountStatus('ready');
      } catch (error) {
        if (error.name !== 'AbortError') setAccountStatus('offline');
      }
    })();
    return () => { controller.abort(); clearTimeout(timer.current); };
  }, [loadAccountProgress]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { notify('Não foi possível salvar neste navegador. Exporte uma cópia do seu progresso.'); }
    if (account && ready.current) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => saveRemote(state), 900);
    }
    return () => clearTimeout(timer.current);
  }, [state, account, saveRemote, notify]);

  const enterPreview = () => {
    setPreview(true);
    try { sessionStorage.setItem(PREVIEW_KEY, 'open'); } catch { /* Sessão em memória. */ }
  };
  const exit = async () => {
    if (account) {
      clearTimeout(timer.current);
      await saveRemote(stateRef.current);
      const result = await api('/api/logout', { method: 'POST' });
      if (!result.ok) throw new Error(apiError(result));
      try { localStorage.setItem(`${STORAGE_KEY}.account-backup`, JSON.stringify(stateRef.current)); } catch { /* Estado ainda em memória. */ }
      ready.current = false;
      syncGeneration.current += 1;
      setAccount(null);
      setState(createInitialState());
      setSyncStatus('local');
    }
    setPreview(false);
    try { sessionStorage.removeItem(PREVIEW_KEY); } catch { /* Sessão em memória. */ }
  };
  return { state, setState, account, accountStatus, setAccountStatus, syncStatus, preview, enterPreview, exit, loadAccountProgress };
}
