import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopPlatform, isDesktopApp } from '../../src/lib/desktop.js';

const LUME_APP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) lume/0.5.0 Chrome/140.0.0.0 Electron/45.2.1 Safari/537.36';
const LUME_APP_LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) lume/0.6.2 Chrome/140.0.0.0 Electron/45.2.1 Safari/537.36';
const LUME_APP_CAPS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Lume/0.5.0 Chrome/140.0.0.0 Electron/45.2.1 Safari/537.36';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const OTHER_ELECTRON = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) OpenCode/2.2.1 Chrome/152.0.0.0 Electron/44.9.1 Safari/537.36';

test('reconhece o app do Lume pelo User-Agent', () => {
  assert.equal(isDesktopApp(LUME_APP), true);
  assert.equal(isDesktopApp(LUME_APP_LINUX), true);
  assert.equal(isDesktopApp(LUME_APP_CAPS), true);
});

test('não esconde o convite em navegador comum nem em outro app Electron', () => {
  assert.equal(isDesktopApp(CHROME), false);
  assert.equal(isDesktopApp(OTHER_ELECTRON), false, 'o navegador do OpenCode também usa Electron');
  assert.equal(isDesktopApp(''), false);
  assert.equal(isDesktopApp(undefined), false, 'sem navigator no Node, não é o app');
});

test('não confunde "lume" no meio de outra palavra', () => {
  assert.equal(isDesktopApp('Mozilla/5.0 MyLumeThing/1.0 Electron/45'), false);
});

test('identifica a plataforma para download e rótulo do desktop', () => {
  assert.equal(desktopPlatform(LUME_APP_LINUX), 'linux');
  assert.equal(desktopPlatform('Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'), 'linux');
  assert.equal(desktopPlatform(CHROME), 'windows');
  assert.equal(desktopPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36'), 'windows');
});
