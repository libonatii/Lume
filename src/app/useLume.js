import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEY, createInitialState } from '../../public/domain.js';
import { libraryActions } from '../../public/library-actions.js';
import { api, apiError } from '../lib/api.js';
import { clearResources } from '../lib/resources.js';
import { useXp } from '../features/progress/useXp.js';

export const PREVIEW_KEY = 'lume.preview-session.v1';

function clearBrowserStudyData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}.`) || ['lume.xp.sent.v1', 'lume.progress.sent.v1'].includes(key)) localStorage.removeItem(key);
    }
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch { /* O funcionamento não depende de armazenamento local. */ }
}

// A conta lê e grava na API. A prévia dura somente enquanto esta página está
// aberta. Promessas apenas serializam cliques em andamento; não são uma fila
// offline e nunca são guardadas no navegador.
export function useLume(notify) {
  const [state, renderState] = useState(createInitialState);
  const [account, setAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState('checking');
  const [syncStatus, setSyncStatus] = useState('local');
  const [preview, setPreview] = useState(false);
  const [saveError, setSaveError] = useState('');
  const stateRef = useRef(state);
  const accountRef = useRef(null);
  const revision = useRef(0);
  const generation = useRef(0);
  const sequence = useRef(0);
  const pending = useRef(Promise.resolve());
  const failed = useRef(null);
  const blocked = useRef('');
  const { xp, xpStatus, refreshXP } = useXp(account);
  const publish = useCallback((value) => { stateRef.current = value; renderState(value); }, []);

  const loadAccountProgress = useCallback(async (user, signal) => {
    const token = ++generation.current;
    clearResources();
    clearBrowserStudyData();
    failed.current = null;
    blocked.current = '';
    setSaveError('');
    setSyncStatus('loading');
    const result = await api('/api/library', { signal });
    if (token !== generation.current) return;
    if (!result.ok) throw new Error(apiError(result));
    revision.current = result.data.revision;
    publish(result.data.state);
    accountRef.current = user;
    setAccount(user);
    setPreview(false);
    setSyncStatus('saved');
  }, [publish]);

  const send = useCallback(async (operation, token, order) => {
    if (token !== generation.current) return;
    const body = { ...operation, revision: operation.revision ?? revision.current };
    try {
      const result = await api('/api/library/actions', { method: 'POST', body });
      if (token !== generation.current) return;
      if (!result.ok) throw Object.assign(new Error(apiError(result)), { status: result.status });
      revision.current = result.data.revision;
      if (order === sequence.current) {
        publish(result.data.state);
        setSyncStatus('saved');
      }
      failed.current = null;
      blocked.current = '';
      setSaveError('');
      await refreshXP();
    } catch (error) {
      if (token !== generation.current) return;
      // Cancela cliques ainda não enviados. Uma resposta perdida pode ter sido
      // gravada: repetir usa o mesmo id e não concede XP duas vezes.
      generation.current += 1;
      const rejected = error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);
      failed.current = rejected ? null : body;
      const message = error.status === 409
        ? 'A biblioteca mudou. Recarregue os dados e repita sua ação.'
        : rejected ? `${error.message} Recarregue os dados antes de continuar.`
          : 'Não foi possível confirmar a gravação. Tente novamente antes de continuar.';
      blocked.current = message;
      setSaveError(message);
      setSyncStatus('error');
      notify(message);
    }
  }, [notify, publish, refreshXP]);

  const setState = useCallback((updater) => {
    if (blocked.current) { notify(blocked.current); return; }
    const previous = stateRef.current;
    const next = typeof updater === 'function' ? updater(previous) : updater;
    if (!next || next === previous) return;
    publish(next);
    if (!accountRef.current) return;
    const actions = libraryActions(previous, next);
    if (!actions.length) return;
    const token = generation.current;
    const order = ++sequence.current;
    setSyncStatus('saving');
    const operation = { id: crypto.randomUUID(), actions };
    pending.current = pending.current.catch(() => {}).then(() => send(operation, token, order));
  }, [notify, publish, send]);

  const act = useCallback((fn) => {
    if (blocked.current) { notify(blocked.current); return null; }
    const result = fn(stateRef.current);
    if (result?.state) setState(result.state);
    return result;
  }, [notify, setState]);

  const retrySave = useCallback(async () => {
    if (!accountRef.current) return;
    const operation = failed.current;
    if (operation) await send(operation, generation.current, sequence.current);
    if (!failed.current) await loadAccountProgress(accountRef.current);
  }, [loadAccountProgress, send]);

  useEffect(() => {
    clearBrowserStudyData();
    const controller = new AbortController();
    (async () => {
      try {
        const result = await api('/api/me', { signal: controller.signal });
        if (!result.ok || typeof result.data?.authenticated !== 'boolean') throw new Error('API indisponível');
        if (result.data.authenticated) await loadAccountProgress(result.data.user, controller.signal);
        setAccountStatus('ready');
      } catch (error) {
        if (error.name !== 'AbortError') { setAccountStatus('offline'); setSyncStatus('error'); }
      }
    })();
    return () => { controller.abort(); generation.current += 1; };
  }, [loadAccountProgress]);

  const enterPreview = () => { publish(createInitialState()); setPreview(true); };
  const exit = async () => {
    await pending.current;
    if (blocked.current) throw new Error('Resolva a gravação pendente antes de sair.');
    if (accountRef.current) {
      const result = await api('/api/logout', { method: 'POST' });
      if (!result.ok) throw new Error(apiError(result));
    }
    generation.current += 1;
    clearResources();
    accountRef.current = null;
    setAccount(null);
    publish(createInitialState());
    setPreview(false);
    setSyncStatus('local');
  };
  return { state, setState, act, account, accountStatus, setAccountStatus, syncStatus, saveError, retrySave, preview, enterPreview, exit, loadAccountProgress, xp, xpStatus, refreshXP };
}
