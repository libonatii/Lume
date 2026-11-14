import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createNodeRealtime } from '../../api/adapters/node-realtime.js';
import { announce } from '../../api/realtime.js';

async function serve(authenticate) {
  const realtime = createNodeRealtime({ authenticate });
  const server = http.createServer((request, response) => { response.writeHead(404); response.end(); });
  server.on('upgrade', (request, socket, head) => realtime.handleUpgrade(request, socket, head));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { realtime, port, origin: `http://127.0.0.1:${port}`, stop: async () => { realtime.close(); await new Promise((resolve) => server.close(resolve)); } };
}

function open(url, origin) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers: origin ? { Origin: origin } : {} });
    socket.once('open', () => resolve(socket));
    socket.once('unexpected-response', (_request, response) => reject(Object.assign(new Error('recusado'), { status: response.statusCode })));
    socket.once('error', reject);
  });
}

const next = (socket) => new Promise((resolve) => socket.once('message', (data) => resolve(String(data))));

test('aviso chega só às conexões da pessoa certa e o batimento é respondido', async () => {
  const { realtime, port, origin, stop } = await serve(async (request) => (request.headers.get('cookie') === 'a' ? { id: 'ana' } : request.headers.get('cookie') === 'b' ? { id: 'bia' } : null));
  try {
    const url = `ws://127.0.0.1:${port}/api/realtime`;
    const withCookie = (cookie) => new Promise((resolve, reject) => {
      const socket = new WebSocket(url, { headers: { Origin: origin, Cookie: cookie } });
      socket.once('open', () => resolve(socket));
      socket.once('error', reject);
    });
    const ana = await withCookie('a');
    const bia = await withCookie('b');
    const received = { ana: [], bia: [] };
    ana.on('message', (data) => received.ana.push(String(data)));
    bia.on('message', (data) => received.bia.push(String(data)));

    await announce(realtime, 'ana', { type: 'message', from: 'bia' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(received.ana.map((item) => JSON.parse(item)), [{ type: 'message', from: 'bia' }]);
    assert.deepEqual(received.bia, []);

    ana.send('ping');
    assert.equal(await next(ana), 'pong');
    ana.close();
    bia.close();
  } finally {
    await stop();
  }
});

test('conexão sem sessão ou de outra origem é recusada', async () => {
  const { port, origin, stop } = await serve(async () => null);
  try {
    const url = `ws://127.0.0.1:${port}/api/realtime`;
    await assert.rejects(open(url, origin), { status: 401 });
    await assert.rejects(open(url, 'http://outro.example'), { status: 403 });
    await assert.rejects(open(`ws://127.0.0.1:${port}/api/outra`, origin), { status: 404 });
  } finally {
    await stop();
  }
});

test('falha ao avisar não derruba quem chamou', async () => {
  const events = [];
  await announce({ notify: async () => { throw new Error('canal fora'); } }, 'ana', { type: 'message' }, (event) => events.push(event));
  await announce(null, 'ana', { type: 'message' });
  assert.deepEqual(events, ['realtime_notify_failed']);
});
