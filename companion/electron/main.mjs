// Lume Companion — processo principal do app de bandeja.
//
// O app não lê a tela: só nomes de processo da allowlist, via o mesmo núcleo
// do agente de linha de comando.

import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } from 'electron';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCompanion, pairDevice, readConfig, setPaused, unpairDevice,
} from '../core.mjs';
import { checkForUpdate, downloadInstaller, RELEASES_PAGE } from '../update.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const assets = app.isPackaged ? join(process.resourcesPath, 'assets') : join(here, '..', 'assets');
const smoke = process.argv.includes('--smoke') || process.env.LUME_COMPANION_SMOKE === '1';

let tray = null;
let window = null;
let companion = null;
let quitting = false;
let state = {
  running: false, paused: false, paired: false, deviceName: '', apiUrl: '',
  detected: null, since: null, plan: null, error: null,
};
let updateInfo = {
  status: 'idle', currentVersion: '', latest: null, progress: 0, error: null, file: null, page: RELEASES_PAGE,
};

app.setAppUserModelId('com.lume.companion');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(async () => {
    companion = createCompanion({
      onUpdate: (value) => {
        state = value;
        broadcast();
      },
    });
    state = companion.getState();

    tray = new Tray(trayImage(state));
    tray.on('click', () => showWindow());
    tray.on('double-click', () => showWindow());
    buildMenu();

    if (smoke) {
      // Verificação automática: grava o resultado e encerra sem abrir janela.
      const file = process.env.LUME_COMPANION_SMOKE_FILE || join(here, '..', 'smoke-result.json');
      try {
        writeFileSync(file, `${JSON.stringify({
          ok: true,
          electron: process.versions.electron,
          tray: Boolean(tray),
          paired: state.paired,
          menu: tray?.getToolTip?.() || null,
        }, null, 2)}\n`);
      } catch (error) {
        console.error(`companion-smoke:write-failed ${error.message}`);
      }
      quitting = true;
      app.quit();
      return;
    }

    createWindow();
    if (state.paired) await companion.start();
  }).catch((error) => {
    console.error(`companion:startup-failed ${error?.stack || error}`);
    if (smoke) {
      try {
        writeFileSync(process.env.LUME_COMPANION_SMOKE_FILE || join(here, '..', 'smoke-result.json'), `${JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2)}\n`);
      } catch { /* sem marcador, o teste falha por ausência. */ }
      quitting = true;
      app.quit();
    }
  });
}

app.on('window-all-closed', () => {
  // No Windows o app continua na bandeja.
});

app.on('before-quit', async (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  try { await companion?.stop(); } catch { /* sair mesmo assim. */ }
  app.quit();
});

function image(name) {
  return nativeImage.createFromPath(join(assets, name));
}

function trayImage(value) {
  if (!value.paired) return image('tray-off.png');
  if (value.paused) return image('tray-paused.png');
  return image('tray-active.png');
}

function trayLabel(value) {
  if (!value.paired) return 'Lume Companion · desconectado';
  if (value.paused) return 'Lume Companion · presença pausada';
  if (value.detected) return `Lume · ${value.detected.label} · ${value.detected.category}`;
  return 'Lume Companion · aguardando um aplicativo da lista';
}

function buildMenu() {
  if (!tray) return;
  const items = [
    { label: trayLabel(state), enabled: false },
    { type: 'separator' },
    { label: 'Abrir painel', click: () => showWindow() },
    { label: 'Abrir o Lume no navegador', click: () => shell.openExternal(state.apiUrl || readConfig().apiUrl) },
  ];
  if (state.paired) {
    items.push({ type: 'separator' });
    items.push({ label: state.paused ? 'Retomar presença' : 'Pausar presença', click: () => togglePause() });
    items.push({ label: 'Desconectar este computador', click: () => disconnect() });
  }
  if (state.plan) {
    items.push({ type: 'separator' });
    items.push({ label: `Faltam ${state.plan.totals.remaining} aulas`, enabled: false });
    const next = state.plan.steps?.[0];
    if (next) items.push({ label: `Próxima: ${truncate(next.title, 42)}`, enabled: false, click: () => showWindow() });
  }
  items.push({ type: 'separator' }, { label: 'Sair', click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(trayLabel(state));
}

function truncate(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function snapshot() {
  return { ...state, update: { ...updateInfo, currentVersion: app.getVersion() } };
}

function broadcast() {
  if (tray) {
    tray.setImage(trayImage(state));
    buildMenu();
  }
  if (window && !window.isDestroyed()) window.webContents.send('state', snapshot());
}

// ---------- Atualização ----------

async function checkUpdate() {
  updateInfo = { ...updateInfo, status: 'checking', error: null, progress: 0 };
  broadcast();
  try {
    const result = await checkForUpdate({ current: app.getVersion() });
    updateInfo = {
      ...updateInfo,
      status: result.available ? 'available' : 'current',
      latest: result.latest,
      installerUrl: result.installerUrl || null,
      size: result.size || 0,
      notes: result.notes || '',
      page: result.page || RELEASES_PAGE,
      file: null,
      progress: 0,
    };
  } catch (error) {
    updateInfo = { ...updateInfo, status: 'error', error: error.message || String(error) };
  }
  broadcast();
  return snapshot();
}

async function downloadUpdate() {
  if (!updateInfo.installerUrl) throw new Error('Verifique a atualização antes de baixar.');
  updateInfo = { ...updateInfo, status: 'downloading', progress: 0, error: null };
  broadcast();
  try {
    const file = await downloadInstaller({
      url: updateInfo.installerUrl,
      version: updateInfo.latest,
      onProgress: (percent) => {
        updateInfo = { ...updateInfo, progress: percent ?? updateInfo.progress };
        broadcast();
      },
    });
    updateInfo = { ...updateInfo, status: 'ready', file, progress: 100 };
  } catch (error) {
    updateInfo = { ...updateInfo, status: 'error', error: error.message || String(error), progress: 0 };
  }
  broadcast();
  return snapshot();
}

async function installUpdate() {
  if (!updateInfo.file) throw new Error('Nenhum instalador baixado ainda.');
  const failure = await shell.openPath(updateInfo.file);
  if (failure) throw new Error(failure);
  updateInfo = { ...updateInfo, status: 'installing' };
  broadcast();
  return snapshot();
}

function createWindow() {
  window = new BrowserWindow({
    width: 400,
    height: 640,
    minWidth: 340,
    minHeight: 480,
    show: false,
    title: 'Lume Companion',
    backgroundColor: '#080d17',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.loadFile(join(here, 'renderer', 'index.html'));
  window.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    window.hide();
  });
  window.webContents.on('did-finish-load', () => window.webContents.send('state', snapshot()));
}

function showWindow() {
  if (!window || window.isDestroyed()) createWindow();
  window.show();
  window.focus();
}

async function togglePause() {
  const next = !readConfig().paused;
  setPaused(next);
  if (next) await companion.stop();
  else await companion.start();
  state = companion.getState();
  broadcast();
  return state;
}

async function disconnect() {
  await companion.stop();
  await unpairDevice();
  state = companion.getState();
  broadcast();
  return state;
}

ipcMain.handle('action', async (_event, name, payload = {}) => {
  switch (name) {
    case 'state':
      return snapshot();
    case 'pair': {
      const code = String(payload.code || '').trim();
      if (!code) throw new Error('Informe o código mostrado no Lume.');
      const result = await pairDevice(code, {
        name: String(payload.name || '').trim() || 'Meu computador',
        apiUrl: String(payload.apiUrl || '').trim(),
      });
      await companion.stop();
      await companion.refreshPlan();
      await companion.start();
      state = companion.getState();
      broadcast();
      return { ...state, device: result.device };
    }
    case 'toggle-pause':
      return togglePause();
    case 'unpair':
      return disconnect();
    case 'refresh':
      await companion.refreshPlan();
      state = companion.getState();
      broadcast();
      return state;
    case 'open-lume':
      await shell.openExternal(state.apiUrl || readConfig().apiUrl);
      return state;
    case 'open-settings':
      await shell.openExternal(`${(state.apiUrl || readConfig().apiUrl).replace(/\/+$/, '')}/#aplicativo`);
      return state;
    case 'update-check':
      return checkUpdate();
    case 'update-download':
      return downloadUpdate();
    case 'update-install':
      return installUpdate();
    case 'hide':
      window?.hide();
      return state;
    case 'quit':
      app.quit();
      return state;
    default:
      throw new Error('Ação desconhecida.');
  }
});
