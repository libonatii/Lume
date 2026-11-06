import test from 'node:test';
import assert from 'node:assert/strict';
import { clearResources, refreshResource } from '../../src/lib/resources.js';

test('sair invalida respostas pendentes e a próxima conta faz outra requisição', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', () => new Promise((resolve) => requests.push(resolve)));
  const old = refreshResource('/api/messages');
  clearResources();
  const current = refreshResource('/api/messages');
  assert.equal(requests.length, 2);
  requests[0](new Response(JSON.stringify({ conversations: ['Conta anterior'] })));
  assert.equal((await old).data, null);
  requests[1](new Response(JSON.stringify({ conversations: ['Conta atual'] })));
  assert.deepEqual((await current).data.conversations, ['Conta atual']);
  clearResources();
});
