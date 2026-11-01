import test from 'node:test';
import { startNodeTarget, startWorkerTarget } from './tests/contract/harness.js';
import { runContract } from './tests/contract/scenario.js';

test('contrato da API no servidor Node', async (t) => {
  const target = await startNodeTarget();
  try {
    await runContract(target, t);
  } finally {
    await target.close();
  }
});

// O Worker é o que está publicado: o mesmo roteiro roda no workerd local.
test('contrato da API no Worker (wrangler dev)', async (t) => {
  const target = await startWorkerTarget();
  if (!target) {
    t.skip('wrangler indisponível');
    return;
  }
  try {
    await runContract(target, t);
  } finally {
    await target.close();
  }
});
