// Recursos do servidor com cache compartilhado. Telas diferentes que pedem o
// mesmo endereço (o contador de não lidas no menu e na tela de Mensagens, por
// exemplo) usam uma única requisição e um único intervalo de atualização.

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api, apiError } from './api.js';

const entries = new Map();
const EMPTY = Object.freeze({ data: undefined, error: '', loading: false, updatedAt: 0 });

function entryFor(key) {
  let entry = entries.get(key);
  if (!entry) {
    entry = { snapshot: EMPTY, listeners: new Set(), intervals: new Map(), timer: null, inflight: null, path: key, generation: 0, controller: null };
    entries.set(key, entry);
  }
  return entry;
}

function publish(entry, patch) {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.listeners.forEach((listener) => listener());
}

// Busca de novo; chamadas simultâneas compartilham a mesma promessa.
export function refreshResource(key) {
  const entry = entryFor(key);
  if (entry.inflight) return entry.inflight;
  const generation = entry.generation;
  const controller = new AbortController();
  entry.controller = controller;
  publish(entry, { loading: true });
  entry.inflight = api(entry.path, { signal: controller.signal })
    .then((result) => {
      if (generation !== entry.generation) return { ok: false, status: 0, data: null };
      if (result.ok) publish(entry, { data: result.data, error: '', loading: false, updatedAt: Date.now() });
      else publish(entry, { error: apiError(result), loading: false, status: result.status });
      return result;
    })
    .catch((error) => {
      if (generation !== entry.generation) return { ok: false, status: 0, data: null };
      publish(entry, { error: error.message, loading: false });
      return { ok: false, status: 0, data: null };
    })
    .finally(() => { if (generation === entry.generation) { entry.inflight = null; entry.controller = null; } });
  return entry.inflight;
}

// Atualiza o valor em cache sem ir ao servidor (ex.: mensagem recém-enviada).
export function mutateResource(key, updater) {
  const entry = entryFor(key);
  publish(entry, { data: typeof updater === 'function' ? updater(entry.snapshot.data) : updater });
}

// Marca como desatualizados todos os recursos cujo endereço começa com `prefix`.
export function invalidateResources(prefix) {
  for (const [key, entry] of entries) {
    if (key.startsWith(prefix) && entry.listeners.size) refreshResource(key);
  }
}

// Ao sair da conta, nada do cache anterior pode aparecer para a próxima pessoa.
export function clearResources() {
  for (const entry of entries.values()) {
    entry.generation += 1;
    entry.controller?.abort();
    entry.controller = null;
    entry.inflight = null;
    clearInterval(entry.timer);
    entry.timer = null;
    entry.snapshot = EMPTY;
    entry.listeners.forEach((listener) => listener());
  }
}

function reschedule(entry) {
  clearInterval(entry.timer);
  entry.timer = null;
  const values = [...entry.intervals.values()].filter((value) => value > 0);
  if (!values.length) return;
  // Aba oculta não consulta o servidor; ao voltar, o ouvinte abaixo atualiza na hora.
  entry.timer = setInterval(() => { if (document.visibilityState !== 'hidden') refreshResource(entry.path); }, Math.min(...values));
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') return;
    for (const entry of entries.values()) if (entry.timer) refreshResource(entry.path);
  });
}

export function useResource(key, { interval = 0, enabled = true } = {}) {
  const active = Boolean(enabled && key);
  const subscribe = useCallback((listener) => {
    if (!active) return () => {};
    const entry = entryFor(key);
    entry.listeners.add(listener);
    entry.intervals.set(listener, interval);
    reschedule(entry);
    // Mostra o cache imediatamente e revalida ao reabrir a tela: outra pessoa
    // pode ter respondido a um convite enquanto o recurso não tinha ouvintes.
    if (!entry.inflight) refreshResource(key);
    return () => {
      entry.listeners.delete(listener);
      entry.intervals.delete(listener);
      reschedule(entry);
    };
  }, [key, interval, active]);
  const snapshot = useSyncExternalStore(subscribe, () => (active ? entryFor(key).snapshot : EMPTY), () => EMPTY);
  const refresh = useCallback(() => (active ? refreshResource(key) : Promise.resolve(null)), [key, active]);
  const mutate = useCallback((updater) => mutateResource(key, updater), [key]);
  useEffect(() => {
    if (active && !entryFor(key).snapshot.updatedAt) refreshResource(key);
  }, [key, active]);
  return { ...snapshot, refresh, mutate };
}
