// Tempo real no servidor local (Node): mesmo protocolo do Durable Object, com as
// conexões em memória. O app só conhece a porta { notify } (ver api/realtime.js).

import { WebSocketServer } from 'ws';
import { toRequest } from './node-http.js';
import { sameOrigin } from '../http.js';

const MAX_SOCKETS = 8;

function refuse(socket, status, text) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

// authenticate(request) devolve a pessoa da sessão ou null.
export function createNodeRealtime({ authenticate }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const channels = new Map();

  function join(userId, socket) {
    const set = channels.get(userId) || new Set();
    channels.set(userId, set);
    if (set.size >= MAX_SOCKETS) set.values().next().value.close(1008, 'Conexões demais.');
    set.add(socket);
    socket.on('message', (data) => { if (String(data) === 'ping') socket.send('pong'); });
    socket.on('close', () => {
      set.delete(socket);
      if (!set.size) channels.delete(userId);
    });
  }

  return {
    notify(userId, event) {
      const body = JSON.stringify(event);
      for (const socket of channels.get(userId) || []) {
        try { socket.send(body); } catch { /* conexão já encerrada */ }
      }
    },
    async handleUpgrade(incoming, socket, head) {
      try {
        const request = toRequest(incoming);
        const url = new URL(request.url);
        if (url.pathname !== '/api/realtime') return refuse(socket, 404, 'Not Found');
        if (!sameOrigin(request, url)) return refuse(socket, 403, 'Forbidden');
        const user = await authenticate(request);
        if (!user) return refuse(socket, 401, 'Unauthorized');
        wss.handleUpgrade(incoming, socket, head, (ws) => join(user.id, ws));
      } catch {
        refuse(socket, 500, 'Internal Server Error');
      }
    },
    close() {
      for (const set of channels.values()) for (const socket of set) socket.terminate();
      wss.close();
    },
  };
}
