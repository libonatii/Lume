import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions, isNewer, isTrustedUrl, parseRelease, checkForUpdate,
} from './update.mjs';

const INSTALLER = 'https://github.com/libonatii/Lume/releases/download/companion-v0.4.0/Lume-Companion-setup.exe';

function release(tag, { draft = false, prerelease = false, asset = INSTALLER } = {}) {
  return {
    tag_name: tag,
    draft,
    prerelease,
    html_url: `https://github.com/libonatii/Lume/releases/tag/${tag}`,
    body: `Notas de ${tag}`,
    published_at: '2026-10-30T12:00:00Z',
    assets: asset ? [{ name: 'Lume-Companion-setup.exe', browser_download_url: asset, size: 1000 }] : [],
  };
}

test('compara versões por número, não por texto', () => {
  assert.equal(compareVersions('0.4.0', '0.3.9'), 1);
  assert.equal(compareVersions('0.3.10', '0.3.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('v0.3.1', '0.3.1'), 0);
  assert.equal(compareVersions('0.2.9', '0.3.0'), -1);
  assert.equal(isNewer('0.4.0', '0.3.1'), true);
  assert.equal(isNewer('0.3.1', '0.3.1'), false);
});

test('só aceita endereços https do GitHub', () => {
  assert.equal(isTrustedUrl(INSTALLER), true);
  assert.equal(isTrustedUrl('https://objects.githubusercontent.com/arquivo.exe'), true);
  assert.equal(isTrustedUrl('http://github.com/arquivo.exe'), false);
  assert.equal(isTrustedUrl('https://exemplo.test/arquivo.exe'), false);
  assert.equal(isTrustedUrl('nada'), false);
});

test('escolhe a maior versão do Companion, ignorando rascunho e prévia', () => {
  const chosen = parseRelease([
    release('companion-v0.3.0'),
    release('companion-v0.4.0'),
    release('companion-v0.5.0', { draft: true }),
    release('companion-v0.6.0', { prerelease: true }),
    release('outra-v9.9.9'),
    release('companion-v0.9.0', { asset: '' }),
  ]);
  assert.equal(chosen.version, '0.4.0');
  assert.equal(chosen.installerUrl, INSTALLER);
});

test('lista vazia ou sem instalador não oferece atualização', () => {
  assert.equal(parseRelease([]), null);
  assert.equal(parseRelease([release('companion-v0.4.0', { asset: '' })]), null);
  assert.equal(parseRelease(null), null);
});

test('verificação compara com a versão instalada', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [release('companion-v0.4.0')] });
  const newer = await checkForUpdate({ current: '0.3.1', fetchImpl });
  assert.equal(newer.available, true);
  assert.equal(newer.latest, '0.4.0');
  assert.equal(newer.installerUrl, INSTALLER);

  const same = await checkForUpdate({ current: '0.4.0', fetchImpl });
  assert.equal(same.available, false);
});

test('falha da API vira erro claro, sem derrubar o programa', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(
    () => checkForUpdate({ current: '0.3.1', fetchImpl }),
    /HTTP 503/,
  );
});
