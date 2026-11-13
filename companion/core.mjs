// Núcleo compartilhado pelo agente de linha de comando e pelo app Electron.
//
// Lê apenas nomes de processo (tasklist no Windows; ps ou /proc/<pid>/comm no Linux).
// Nunca títulos de janela, tela, teclado ou arquivos. Presença observada não é
// estudo e não gera XP.

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import {
  MAX_ALLOWLIST, cleanAppLabel, matchAllowlist, normalizeCategory,
  normalizeProcessName, parsePs, parseTasklist,
} from './domain.mjs';
import { DISCORD_CLIENT_ID_PLACEHOLDER, discordFieldsFrom } from './discord-presence.mjs';

const exec = promisify(execFile);

export const DEFAULT_API = process.env.LUME_API_URL || 'https://lumeacademy.site';
export const PLAN_REFRESH_TICKS = 12;

// O endereço workers.dev foi desligado em 10/11/2026. Configurações salvas por versões
// anteriores ainda o guardam e levariam a janela a uma página de erro.
const LEGACY_HOST = 'lume.lume-prototype.workers.dev';
export function migrateLegacyUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === LEGACY_HOST ? DEFAULT_API : value;
  } catch {
    return value;
  }
}

const WINDOWS_ALLOWLIST = [
  { process: 'anki', label: 'Anki', category: 'study' },
  { process: 'code', label: 'VS Code', category: 'project' },
  { process: 'acrord32', label: 'Leitor de PDF', category: 'reading' },
  { process: 'notion', label: 'Notion', category: 'study' },
];

const LINUX_ALLOWLIST = [
  { process: 'anki', label: 'Anki', category: 'study' },
  { process: 'code', label: 'VS Code', category: 'project' },
  { process: 'evince', label: 'Leitor de PDF', category: 'reading' },
  { process: 'okular', label: 'Okular', category: 'reading' },
  { process: 'notion', label: 'Notion', category: 'study' },
];

export const DEFAULT_ALLOWLIST = WINDOWS_ALLOWLIST;

export function defaultAllowlist(platform = process.platform) {
  const list = platform === 'linux' ? LINUX_ALLOWLIST : WINDOWS_ALLOWLIST;
  return list.map((entry) => ({ ...entry }));
}

export function configPath(platform = process.platform) {
  if (platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Lume', 'companion.json');
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  const xdgPath = join(xdgConfig, 'Lume', 'companion.json');
  if (process.env.XDG_CONFIG_HOME || existsSync(xdgPath)) return xdgPath;
  const legacy = join(homedir(), '.lume', 'companion.json');
  if (existsSync(legacy)) return legacy;
  return xdgPath;
}

export function readConfig() {
  const path = configPath();
  if (!existsSync(path)) {
    const initial = {
      apiUrl: DEFAULT_API, token: '', deviceName: '', intervalSeconds: 5,
      paused: false, allowlist: defaultAllowlist(),
      discordPresence: true,
      discordClientId: DISCORD_CLIENT_ID_PLACEHOLDER,
      discordPublicUrl: '',
    };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(initial, null, 2)}\n`, { mode: 0o600 });
    return initial;
  }
  let value = {};
  try { value = JSON.parse(readFileSync(path, 'utf8')); } catch { value = {}; }
  return {
    apiUrl: typeof value.apiUrl === 'string' && value.apiUrl ? migrateLegacyUrl(value.apiUrl.replace(/\/+$/, '')) : DEFAULT_API,
    token: typeof value.token === 'string' ? value.token : '',
    deviceName: typeof value.deviceName === 'string' ? value.deviceName : '',
    intervalSeconds: Number.isFinite(value.intervalSeconds) && value.intervalSeconds >= 3 ? Math.min(value.intervalSeconds, 120) : 5,
    paused: value.paused === true,
    allowlist: Array.isArray(value.allowlist) ? value.allowlist.slice(0, MAX_ALLOWLIST) : defaultAllowlist(),
    ...discordFieldsFrom(value),
  };
}

export function saveConfig(config) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function setPaused(paused) {
  const config = readConfig();
  saveConfig({ ...config, paused: paused === true });
  return readConfig();
}

export function setDiscordPresence(enabled) {
  const config = readConfig();
  saveConfig({ ...config, discordPresence: enabled === true });
  return readConfig();
}

export function addAllowlistEntry(processName, { label = '', category = 'study' } = {}) {
  const config = readConfig();
  const normalized = normalizeProcessName(processName);
  if (!normalized) throw new Error('Informe o nome do processo.');
  if (config.allowlist.some((entry) => normalizeProcessName(entry.process) === normalized)) {
    return { added: false, entry: config.allowlist.find((entry) => normalizeProcessName(entry.process) === normalized) };
  }
  if (config.allowlist.length >= MAX_ALLOWLIST) throw new Error(`A lista aceita até ${MAX_ALLOWLIST} aplicativos.`);
  const entry = { process: normalized, label: cleanAppLabel(label) || normalized, category: normalizeCategory(category) };
  saveConfig({ ...config, allowlist: [...config.allowlist, entry] });
  return { added: true, entry };
}

export function removeAllowlistEntry(processName) {
  const config = readConfig();
  const normalized = normalizeProcessName(processName);
  saveConfig({ ...config, allowlist: config.allowlist.filter((entry) => normalizeProcessName(entry.process) !== normalized) });
  return readConfig();
}

async function readProcComm() {
  const entries = await readdir('/proc', { withFileTypes: true });
  const pids = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => entry.name);
  const results = await Promise.all(pids.map(async (pid) => {
    try {
      const comm = await readFile(`/proc/${pid}/comm`, 'utf8');
      const process = normalizeProcessName(comm);
      return process ? { process, pid: Number(pid) } : null;
    } catch {
      return null;
    }
  }));
  return results.filter(Boolean);
}

async function listLinuxProcesses() {
  try {
    const { stdout } = await exec('ps', ['-eo', 'pid=,comm='], { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
    return parsePs(stdout);
  } catch (error) {
    // Sistemas mínimos sem `ps` compatível com `-eo`: lê apenas `/proc/<pid>/comm`.
    if (existsSync('/proc')) return readProcComm();
    throw error;
  }
}

export async function listProcesses() {
  if (process.platform === 'win32') {
    const { stdout } = await exec('tasklist', ['/fo', 'csv', '/nh'], { timeout: 8000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    return parseTasklist(stdout);
  }
  if (process.platform === 'linux') {
    return listLinuxProcesses();
  }
  throw new Error(`Esta versão do Companion não oferece suporte para ${process.platform}.`);
}

export async function callApi(config, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

export async function pairDevice(code, { name = 'Meu computador', apiUrl = '' } = {}) {
  const config = readConfig();
  const url = (apiUrl || config.apiUrl).replace(/\/+$/, '');
  const result = await callApi({ ...config, apiUrl: url }, '/api/companion/redeem', {
    method: 'POST',
    body: { code, deviceName: name },
  });
  if (!result.ok) throw new Error(result.data?.error || 'Não foi possível conectar o Companion.');
  saveConfig({ ...config, apiUrl: url, token: result.data.token, deviceName: result.data.device.name });
  return { device: result.data.device, apiUrl: url };
}

export async function unpairDevice() {
  const config = readConfig();
  if (config.token) await callApi(config, '/api/companion/presence', { method: 'DELETE' }).catch(() => {});
  saveConfig({ ...config, token: '' });
  return readConfig();
}

export async function fetchPlan(config = readConfig()) {
  if (!config.token) return null;
  const result = await callApi(config, '/api/companion/study');
  if (!result.ok) return { available: false, reason: result.data?.code || 'unavailable', message: result.data?.error || null };
  return result.data;
}

// Loop único usado pela CLI e pela janela. Emite o estado para quem escuta.
export function createCompanion({ onUpdate = () => {}, intervalSeconds } = {}) {
  let timer = null;
  let running = false;
  let detected = null;
  let since = null;
  let plan = null;
  let error = null;
  let ticks = 0;

  function snapshot() {
    const config = readConfig();
    return {
      running,
      paused: config.paused,
      paired: Boolean(config.token),
      deviceName: config.deviceName,
      apiUrl: config.apiUrl,
      detected,
      since,
      plan,
      error,
    };
  }

  function emit() {
    try { onUpdate(snapshot()); } catch { /* quem escuta não derruba o loop. */ }
  }

  async function publish(match, from) {
    const config = readConfig();
    if (!config.token) return;
    const result = await callApi(config, '/api/companion/presence', {
      method: 'PUT',
      body: { app: match.label, category: match.category, since: from },
    });
    if (result.status === 401) {
      throw Object.assign(new Error('O Lume não reconhece mais este computador. Conecte de novo.'), { fatal: true });
    }
    if (!result.ok) throw new Error(result.data?.error || 'Falha ao enviar presença.');
  }

  async function clearRemote() {
    const config = readConfig();
    if (!config.token) return;
    await callApi(config, '/api/companion/presence', { method: 'DELETE' }).catch(() => {});
  }

  async function refreshPlan() {
    try {
      const result = await fetchPlan();
      plan = result?.plan || null;
      emit();
    } catch {
      /* roteiro indisponível não interrompe a presença. */
    }
  }

  async function tick() {
    const config = readConfig();
    ticks += 1;
    if (config.paused) {
      if (detected) {
        detected = null;
        since = null;
        await clearRemote();
        emit();
      }
      return;
    }
    const processes = await listProcesses();
    const match = matchAllowlist(processes, config.allowlist);
    if (!match) {
      if (detected) {
        detected = null;
        since = null;
        await clearRemote();
        emit();
      }
      return;
    }
    if (!detected || detected.process !== match.process) {
      detected = match;
      since = new Date().toISOString();
      emit();
    }
    await publish(match, since);
    if (ticks % PLAN_REFRESH_TICKS === 0) await refreshPlan();
  }

  return {
    getState: snapshot,
    async start() {
      if (running) return snapshot();
      running = true;
      error = null;
      emit();
      await refreshPlan();
      const interval = Number(intervalSeconds) || readConfig().intervalSeconds;
      await tick().catch((cause) => { error = cause.message; emit(); });
      timer = setInterval(() => {
        tick().catch((cause) => {
          error = cause.message;
          emit();
          if (cause.fatal) {
            clearInterval(timer);
            timer = null;
            running = false;
            detected = null;
            emit();
          }
        });
      }, interval * 1000);
      return snapshot();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      running = false;
      detected = null;
      since = null;
      await clearRemote();
      emit();
      return snapshot();
    },
    async tickOnce() {
      await tick();
      return snapshot();
    },
    refreshPlan,
  };
}
