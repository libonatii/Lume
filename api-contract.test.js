import test from 'node:test';
import { startNodeTarget } from './tests/contract/harness.js';
import { runContract } from './tests/contract/scenario.js';

test('contrato da API no servidor Node', async (t) => {
  const target = await startNodeTarget();
  try {
    await runContract(target, t);
  } finally {
    await target.close();
  }
});
