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
    if (result.status === 401) {
      // O cookie não corresponde mais a uma sessão: aqui a entrada é necessária.
      setAccount(null);
      return;
    }
    if (!result.ok || !result.data) {
      // Autenticado, mas a cópia remota não veio. Entra na conta sem sobrescrevê-la:
      // ready.current continua false, então nada é enviado até um carregamento válido.
      setAccount(user);
      setSyncStatus('error');
      notify('Você está conectada, mas o progresso da conta não carregou agora. Sua cópia local está preservada.');
      return;
    }
    if (result.data.state) {
      // Preserva a cópia anterior antes de carregar o estado remoto.
      try { localStorage.setItem(`${STORAGE_KEY}.before-account`, JSON.stringify(stateRef.current)); } catch { /* Cópia em memória permanece disponível. */ }
      setState(reconcileSession(restoreState(JSON.stringify(result.data.state))));
    }
    setAccount(user);
    ready.current = true;
    setSyncStatus('saved');
  }, [notify]);

  useEffect(() => {
    const controller = new AbortController();
    const askSession = async () => {
      const result = await api('/api/me', { signal: controller.signal });
      if (typeof result.data?.authenticated !== 'boolean') throw new Error('API indisponível');
      return result.data;
    };
    (async () => {
      try {
        let data;
        try {
          data = await askSession();
        } catch (error) {
          // Uma falha isolada de rede não pode expulsar quem já tem sessão.
          if (error.name === 'AbortError') throw error;
          await new Promise((resolve) => setTimeout(resolve, 1200));
          if (controller.signal.aborted) return;
          data = await askSession();
        }
        if (data.authenticated) await loadAccountProgress(data.user, controller.signal);
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
      // Sem cópia remota carregada, enviar o estado local sobrescreveria o da conta.
      if (ready.current) await saveRemote(stateRef.current);
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
