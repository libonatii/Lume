// Canal de tempo real (WebSocket). O servidor só avisa que há novidade; os dados
// continuam vindo das rotas HTTP pelo cache de resources.js. Com o canal aberto,
// a consulta periódica fica como reserva (intervalos longos); sem ele, volta aos
// intervalos curtos, então a conversa nunca depende só do WebSocket.

import { useEffect, useSyncExternalStore } from 'react';
import { invalidateResources } from './resources.js';

const HEARTBEAT_MS = 25000;
const PONG_WAIT_MS = 10000;
const MAX_BACKOFF_MS = 30000;

let live = false;
const listeners = new Set();

function setLive(value) {
  if (live === value) return;
  live = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Verdadeiro enquanto o canal está aberto.
export function useRealtimeStatus() {
  return useSyncExternalStore(subscribe, () => live, () => false);
}

export function openChannel() {
  if (typeof WebSocket === 'undefined') return () => {};
  let socket = null;
  let closed = false;
  let attempt = 0;
  let retryTimer = null;
  let beatTimer = null;
  let pongTimer = null;

  function stopBeat() {
    clearInterval(beatTimer);
    clearTimeout(pongTimer);
  }

  function connect() {
    if (closed) return;
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${scheme}://${location.host}/api/realtime`);
    const current = socket;
    current.onopen = () => {
      attempt = 0;
      setLive(true);
      // O que chegou enquanto o canal estava fora é buscado agora.
      invalidateResources('/api/messages');
      beatTimer = setInterval(() => {
        if (current.readyState !== WebSocket.OPEN) return;
        current.send('ping');
        pongTimer = setTimeout(() => current.close(), PONG_WAIT_MS);
      }, HEARTBEAT_MS);
    };
    current.onmessage = (event) => {
      if (event.data === 'pong') { clearTimeout(pongTimer); return; }
      try {
        if (JSON.parse(event.data)?.type === 'message') invalidateResources('/api/messages');
      } catch { /* aviso ilegível: a consulta periódica cobre */ }
    };
    current.onclose = () => {
      stopBeat();
      if (socket === current) setLive(false);
      if (closed) return;
      const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) + Math.random() * 500;
      attempt += 1;
      retryTimer = setTimeout(connect, wait);
    };
    current.onerror = () => current.close();
  }

  // Voltar à aba com o canal fora do ar reconecta na hora.
  function wake() {
    if (document.visibilityState === 'hidden' || closed) return;
    if (socket && socket.readyState <= WebSocket.OPEN) return;
    clearTimeout(retryTimer);
    attempt = 0;
    connect();
  }
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  connect();

  return () => {
    closed = true;
    clearTimeout(retryTimer);
    stopBeat();
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
    socket?.close();
    setLive(false);
  };
}

// Mantém o canal aberto enquanto há conta (montar uma vez, no aviso de mensagem).
export function useRealtime(account) {
  useEffect(() => (account ? openChannel() : undefined), [account?.id]);
}
