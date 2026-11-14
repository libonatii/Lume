// Canal WebSocket. No Worker a conexão passa pelo Durable Object da pessoa; no Node
// o upgrade é tratado em server.js (api/adapters/node-realtime.js).

import { json } from '../http.js';

export function realtimeRoutes(router) {
  router.add('GET', '/api/realtime', { auth: 'Entre na sua conta para receber avisos.', origin: true }, async ({ request, user, realtime }) => {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket' || !realtime?.connect) {
      return json({ error: 'Esta rota exige uma conexão WebSocket.' }, 426);
    }
    return realtime.connect(user.id, request);
  });
}
