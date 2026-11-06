import { hashPassword, verifyPassword, bcryptRounds } from '../api/domain/auth.js';

// Somente credenciais sintéticas; não lê contas nem acessa a rede.
// Tempos locais de parede, não CPU medida pela Cloudflare.
const password = 'senha-sintetica-benchmark';
const rounds = bcryptRounds(process.argv[2]);
const start = performance.now();
const stored = await hashPassword(password, rounds);
const coldHashMs = performance.now() - start;
const samples = { hash: [], verify: [] };
for (let index = 0; index < 25; index += 1) {
  for (const [operation, run] of [
    ['hash', () => hashPassword(password, rounds)],
    ['verify', () => verifyPassword(password, stored)],
  ]) {
    const before = performance.now();
    await run();
    const elapsed = performance.now() - before;
    if (index >= 5) samples[operation].push(elapsed);
  }
}
console.log(JSON.stringify({ rounds, coldHashMs, timings: Object.fromEntries(
  Object.entries(samples).map(([operation, values]) => {
    values.sort((a, b) => a - b);
    return [operation, { medianMs: values[10], p95Ms: values[18] }];
  }),
) }, null, 2));
console.log('Medição local; validar CPU das rotas completas no Worker publicado, incluindo partidas frias.');
