import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCapture } from './scripts/build-extension.mjs';

// extension/capture.js é gerado a partir de extension/src/ e do registro de
// provedores. Se alguém editar a fonte e esquecer de gerar, a extensão
// carregada no Chrome fica com o leitor antigo.
test('extension/capture.js está em dia com a fonte', async () => {
  const fresh = await buildCapture({ write: false });
  const committed = readFileSync(new URL('./extension/capture.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(committed, fresh.replace(/\r\n/g, '\n'), 'rode npm run extension:build');
});
