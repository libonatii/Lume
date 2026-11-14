// Tempo real no Cloudflare: um Durable Object por pessoa guarda as conexões
// WebSocket dela (abas e app de desktop). O canal só avisa "há novidade"; o
// conteúdo continua vindo das rotas HTTP, então perder um aviso nunca perde dado.
// A API de hibernação deixa o objeto dormir enquanto ninguém fala.

const MAX_SOCKETS = 8;

export class UserChannel {
  constructor(ctx) {
    this.ctx = ctx;
    // Batimento respondido sem acordar o objeto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/notify') {
      const body = await request.text();
      for (const socket of this.ctx.getWebSockets()) {
        try { socket.send(body); } catch { /* conexão já encerrada */ }
      }
      return new Response(null, { status: 204 });
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Esta rota exige uma conexão WebSocket.', { status: 426 });
    }
    const open = this.ctx.getWebSockets();
    if (open.length >= MAX_SOCKETS) {
      try { open[0].close(1008, 'Conexões demais.'); } catch { /* já fechada */ }
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage() { /* o cliente só envia o batimento, tratado na resposta automática */ }

  webSocketClose(socket, code) {
    try { socket.close(code === 1005 ? 1000 : code); } catch { /* já fechada */ }
  }
}

// Porta usada pelo app: connect(userId, request) abre o canal; notify(userId, evento) avisa.
export function durableRealtime(namespace) {
  const stubFor = (userId) => namespace.get(namespace.idFromName(userId));
  return {
    connect: (userId, request) => stubFor(userId).fetch(request),
    async notify(userId, event) {
      await stubFor(userId).fetch('https://channel/notify', { method: 'POST', body: JSON.stringify(event) });
    },
  };
}
