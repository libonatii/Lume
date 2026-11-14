import test from 'node:test';
import assert from 'node:assert/strict';
import { clearResources, prefetchResource, refreshResource } from '../../src/lib/resources.js';

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

test('busca antecipada não repete enquanto há busca em curso ou valor recente, e sair limpa o cache', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls += 1; return new Response(JSON.stringify({ profile: { name: 'Carla' } })); });
  const key = '/api/profile/@carla';
  const first = prefetchResource(key);
  prefetchResource(key);
  assert.equal(calls, 1, 'busca em curso é reaproveitada');
  await first;
  await prefetchResource(key);
  assert.equal(calls, 1, 'valor recente não é buscado de novo');
  await prefetchResource(key, 0);
  assert.equal(calls, 2, 'com validade zero, busca de novo');
  clearResources();
  await prefetchResource(key);
  assert.equal(calls, 3, 'depois de sair, não resta cache da conta anterior');
  clearResources();
});
