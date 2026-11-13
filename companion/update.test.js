import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compareVersions, isNewer, isTrustedUrl, parseRelease, checkForUpdate,
  detectLinuxPackageType, installerFilename, downloadInstaller,
} from './update.mjs';

const INSTALLER = 'https://github.com/libonatii/Lume/releases/download/companion-v0.4.0/Lume-Companion-setup.exe';
const LINUX_APPIMAGE = 'https://github.com/libonatii/Lume/releases/download/companion-v0.6.2/Lume.AppImage';
const LINUX_DEB = 'https://github.com/libonatii/Lume/releases/download/companion-v0.6.2/Lume.deb';

function release(tag, { draft = false, prerelease = false, asset = INSTALLER, assets } = {}) {
  const list = assets ?? (asset ? [asset] : []);
  return {
    tag_name: tag,
    draft,
    prerelease,
    html_url: `https://github.com/libonatii/Lume/releases/tag/${tag}`,
    body: `Notas de ${tag}`,
    published_at: '2026-10-30T12:00:00Z',
    assets: list.map((url) => ({ name: String(url).split('/').pop(), browser_download_url: url, size: 1000 })),
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
  ], { platform: 'win32' });
  assert.equal(chosen.version, '0.4.0');
  assert.equal(chosen.installerUrl, INSTALLER);
});

test('lista vazia ou sem instalador não oferece atualização', () => {
  assert.equal(parseRelease([], { platform: 'win32' }), null);
  assert.equal(parseRelease([release('companion-v0.4.0', { asset: '' })], { platform: 'win32' }), null);
  assert.equal(parseRelease(null, { platform: 'win32' }), null);
});

test('verificação compara com a versão instalada', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => [release('companion-v0.4.0')] });
  const newer = await checkForUpdate({ current: '0.3.1', fetchImpl, platform: 'win32' });
  assert.equal(newer.available, true);
  assert.equal(newer.latest, '0.4.0');
  assert.equal(newer.installerUrl, INSTALLER);

  const same = await checkForUpdate({ current: '0.4.0', fetchImpl, platform: 'win32' });
  assert.equal(same.available, false);
});

test('no Linux escolhe AppImage ou deb conforme o ambiente', () => {
  const mixed = [release('companion-v0.6.2', { assets: [INSTALLER, LINUX_APPIMAGE, LINUX_DEB] })];
  const appImage = parseRelease(mixed, { platform: 'linux', packageType: 'appimage' });
  assert.equal(appImage.installerUrl, LINUX_APPIMAGE);
  assert.equal(appImage.assetName, 'Lume.AppImage');

  const deb = parseRelease(mixed, { platform: 'linux', packageType: 'deb' });
  assert.equal(deb.installerUrl, LINUX_DEB);
  assert.equal(deb.assetName, 'Lume.deb');

  const debFallback = parseRelease([release('companion-v0.6.2', { assets: [LINUX_APPIMAGE] })], { platform: 'linux', packageType: 'deb' });
  assert.equal(debFallback.installerUrl, LINUX_APPIMAGE);

  assert.equal(detectLinuxPackageType({ env: { APPIMAGE: '/tmp/Lume.AppImage' }, exists: () => true }), 'appimage');
  assert.equal(detectLinuxPackageType({ env: {}, exists: (path) => path === '/etc/debian_version' }), 'deb');
  assert.equal(detectLinuxPackageType({ env: {}, exists: () => false }), 'appimage');

  assert.equal(installerFilename('0.6.2', { assetName: 'Lume.AppImage' }), 'Lume-0.6.2.AppImage');
  assert.equal(installerFilename('0.6.2', { assetName: 'Lume.deb' }), 'Lume-0.6.2.deb');
  assert.equal(installerFilename('0.6.2', { assetName: 'Lume-setup.exe' }), 'Lume-Companion-setup-0.6.2.exe');
});

test('downloadInstaller preserva extensão Linux e grava no destino pedido', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lume-update-test-'));
  try {
    const fetchImpl = async () => ({
      ok: true,
      url: LINUX_DEB,
      headers: new Headers({ 'content-length': '5' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('hello'));
          controller.close();
        },
      }),
    });
    const file = await downloadInstaller({
      url: LINUX_DEB,
      version: '0.6.2',
      assetName: 'Lume.deb',
      destDir: dir,
      fetchImpl,
    });
    assert.equal(file, join(dir, 'Lume-0.6.2.deb'));
    assert.equal(readFileSync(file, 'utf8'), 'hello');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('falha da API vira erro claro, sem derrubar o programa', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(
    () => checkForUpdate({ current: '0.3.1', fetchImpl }),
    /HTTP 503/,
  );
});
