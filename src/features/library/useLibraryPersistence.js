import { useCallback, useRef, useState } from 'react';
import { createInitialState } from '../../../public/domain.js';
import { libraryActions } from '../../../public/library-actions.js';
import { api, apiError } from '../../lib/api.js';
import { clearResources } from '../../lib/resources.js';

// As requisições são serializadas somente em memória. Falhas interrompem novos
// envios; repetir conserva a identidade da operação cujo resultado é incerto.
export function useLibraryPersistence(notify, onSaved) {
  const [state, renderState] = useState(createInitialState);
  const [syncStatus, setSyncStatus] = useState('local');
  const [saveError, setSaveError] = useState('');
  const current = useRef(state);
  const connected = useRef(false);
  const revision = useRef(0);
  const generation = useRef(0);
  const sequence = useRef(0);
  const pending = useRef(Promise.resolve());
  const failed = useRef(null);
  const blocked = useRef('');
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const publish = useCallback((value) => { current.current = value; renderState(value); }, []);
  const invalidate = useCallback(() => { generation.current += 1; }, []);
  const unavailable = useCallback(() => setSyncStatus('error'), []);

  const load = useCallback(async (signal) => {
    const token = ++generation.current;
    connected.current = false;
    clearResources();
    failed.current = null;
    blocked.current = '';
    setSaveError('');
    setSyncStatus('loading');
    const result = await api('/api/library', { signal });
    if (token !== generation.current) return false;
    if (!result.ok) {
      const message = apiError(result);
      blocked.current = message;
      setSaveError(message);
      notify(message);
      throw new Error(message);
    }
    revision.current = result.data.revision;
    publish(result.data.state);
    connected.current = true;
    setSyncStatus('saved');
    return true;
  }, [notify, publish]);

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
      // A sequência intermediária não precisa reler XP: a última gravação
      // consulta o livro já com todas as operações anteriores confirmadas.
      if (order === sequence.current) await saved.current();
    } catch (error) {
      if (token !== generation.current) return;
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
  }, [notify, publish]);

  const act = useCallback((rule) => {
    if (blocked.current) { notify(blocked.current); return null; }
    const previous = current.current;
    const result = rule(previous);
    const next = result?.state;
    if (!next || next === previous) return result;
    publish(next);
    if (!connected.current) return result;
    const actions = libraryActions(previous, next);
    if (!actions.length) return result;
    const token = generation.current;
    const order = ++sequence.current;
    setSyncStatus('saving');
    const operation = { id: crypto.randomUUID(), actions };
    pending.current = pending.current.catch(() => {}).then(() => send(operation, token, order));
    return result;
  }, [notify, publish, send]);

  const retrySave = useCallback(async () => {
    if (!connected.current) return;
    if (failed.current) await send(failed.current, generation.current, sequence.current);
    if (!failed.current) await load();
  }, [load, send]);

  const waitForSave = useCallback(async () => {
    await pending.current;
    if (blocked.current) throw new Error('Resolva a gravação pendente antes de sair.');
    return current.current;
  }, []);

  const reset = useCallback(() => {
    invalidate();
    clearResources();
    connected.current = false;
    failed.current = null;
    blocked.current = '';
    setSaveError('');
    publish(createInitialState());
    setSyncStatus('local');
  }, [invalidate, publish]);

  return { state, act, syncStatus, saveError, retrySave, load, reset, invalidate, unavailable, waitForSave };
}
