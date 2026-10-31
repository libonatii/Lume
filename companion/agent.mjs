#!/usr/bin/env node
// Lume Companion — agente local que informa qual aplicativo da sua allowlist
// está aberto. Sem dependências externas nesta versão.
//
// O que ele lê: nomes de processo via `tasklist`. Só isso.
// O que ele NÃO lê: título de janela, conteúdo de tela, teclado, arquivos,
// histórico do navegador ou de outros aplicativos.
// O que ele envia: nome do aplicativo escolhido, categoria e o horário em que
// começou a ser observado. Presença observada não é estudo e não gera XP.

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import {
  COMPANION_CATEGORIES, MAX_ALLOWLIST, cleanAppLabel, matchAllowlist,
  normalizeCategory, normalizeProcessName, parseTasklist,
} from '../public/companion-domain.js';

const exec = promisify(execFile);
const DEFAULT_API = process.env.LUME_API_URL || 'https://lume.lume-prototype.workers.dev';
const DEFAULT_ALLOWLIST = [
  { process: 'anki', label: 'Anki', category: 'study' },
  { process: 'code', label: 'VS Code', category: 'project' },
  { process: 'acrord32', label: 'Leitor de PDF', category: 'reading' },
  { process: 'notion', label: 'Notion', category: 'study' },
];

function configPath() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, 'Lume', 'companion.json');
  }
  return join(homedir(), '.lume', 'companion.json');
}

function readConfig() {
  const path = configPath();
  if (!existsSync(path)) {
    const initial = { apiUrl: DEFAULT_API, token: '', deviceName: '', intervalSeconds: 5, paused: false, allowlist: DEFAULT_ALLOWLIST };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(initial, null, 2)}\n`, { mode: 0o600 });
    return initial;
  }
  const value = JSON.parse(readFileSync(path, 'utf8'));
  return {
    apiUrl: typeof value.apiUrl === 'string' && value.apiUrl ? value.apiUrl.replace(/\/+$/, '') : DEFAULT_API,
    token: typeof value.token === 'string' ? value.token : '',
    deviceName: typeof value.deviceName === 'string' ? value.deviceName : '',
    intervalSeconds: Number.isFinite(value.intervalSeconds) && value.intervalSeconds >= 3 ? Math.min(value.intervalSeconds, 120) : 5,
    paused: value.paused === true,
    allowlist: Array.isArray(value.allowlist) ? value.allowlist.slice(0, MAX_ALLOWLIST) : DEFAULT_ALLOWLIST,
  };
}

function saveConfig(config) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function log(message) {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${message}`);
}

function flag(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function positional() {
  return process.argv.slice(2).filter((value, index, list) => !value.startsWith('--') && !(list[index - 1] || '').startsWith('--'));
}

async function listProcesses() {
  if (process.platform !== 'win32') {
    throw new Error('Esta versão do Companion funciona apenas no Windows. O Linux e o macOS ficam para uma próxima etapa.');
  }
  const { stdout } = await exec('tasklist', ['/fo', 'csv', '/nh'], { timeout: 8000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return parseTasklist(stdout);
}

async function callApi(config, path, { method = 'GET', body } = {}) {
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

async function pair(code, name) {
  const config = readConfig();
  const apiUrl = flag('api', config.apiUrl).replace(/\/+$/, '');
  const deviceName = name || flag('name', 'Meu computador');
  log(`Conectando em ${apiUrl} como "${deviceName}"…`);
  const result = await callApi({ ...config, apiUrl }, '/api/companion/redeem', {
    method: 'POST',
    body: { code, deviceName },
  });
  if (!result.ok) {
    throw new Error(result.data?.error || 'Não foi possível conectar o Companion.');
  }
  saveConfig({ ...config, apiUrl, token: result.data.token, deviceName: result.data.device.name });
  log(`Conectado como "${result.data.device.name}".`);
  log(`Configuração em ${configPath()}`);
  log('Agora rode: npm run companion');
}

function setPaused(value) {
  const config = readConfig();
  saveConfig({ ...config, paused: value });
  log(value ? 'Presença pausada. O Lume deixa de mostrar sua atividade.' : 'Presença retomada.');
}

function addAllow(processName) {
  const config = readConfig();
  const normalized = normalizeProcessName(processName);
  if (!normalized) throw new Error('Informe o nome do processo. Ex.: companion allow anki --label Anki --category study');
  if (config.allowlist.some((entry) => normalizeProcessName(entry.process) === normalized)) {
    log(`${normalized} já está na lista.`);
    return;
  }
  if (config.allowlist.length >= MAX_ALLOWLIST) throw new Error(`A lista aceita até ${MAX_ALLOWLIST} aplicativos.`);
  const category = normalizeCategory(flag('category', 'study'));
  const entry = { process: normalized, label: cleanAppLabel(flag('label', normalized)) || normalized, category };
  config.allowlist = [...config.allowlist, entry];
  saveConfig(config);
  log(`Adicionado: ${entry.label} (${entry.process}) · ${COMPANION_CATEGORIES.find((item) => item.id === category)?.label}`);
}

function listAllow() {
  const config = readConfig();
  if (!config.allowlist.length) {
    log('A lista está vazia. Use: companion allow <processo> --label "Nome" --category study');
    return;
  }
  for (const entry of config.allowlist) {
    const category = COMPANION_CATEGORIES.find((item) => item.id === normalizeCategory(entry.category))?.label;
    console.log(`  ${normalizeProcessName(entry.process).padEnd(14)} ${String(entry.label).padEnd(22)} ${category}`);
  }
}

async function status() {
  const config = readConfig();
  const processes = await listProcesses();
  const match = matchAllowlist(processes, config.allowlist);
  console.log(`Windows · ${processes.length} processos observados · allowlist com ${config.allowlist.length} entradas`);
  if (match) {
    log(`Agora: ${match.label} (${match.process}) · categoria ${match.category}`);
  } else {
    log('Nenhum aplicativo da allowlist está aberto.');
    const visible = processes.filter((item) => /^(code|anki|notion|acrord32|obsidian|zotero|winword|excel|powerpnt|chrome|msedge|firefox)$/.test(item.process));
    if (visible.length) console.log(`  Em execução, fora da lista: ${[...new Set(visible.map((item) => item.process))].join(', ')}`);
  }
  console.log(`Token: ${config.token ? 'configurado' : 'ausente — rode companion pair <código>'}`);
  console.log(`Presença: ${config.paused ? 'pausada' : 'ativa'}`);
  if (config.token) {
    const summary = await callApi(config, '/api/companion/study').catch(() => null);
    const plan = summary?.data?.plan;
    if (plan) log(`Roteiro: faltam ${plan.totals.remaining} aulas. Próxima: ${plan.steps[0]?.title || 'nada pendente'}.`);
  }
}

async function plan() {
  const config = readConfig();
  if (!config.token) throw new Error('Conecte o programa primeiro: node companion/agent.mjs pair <CÓDIGO>');
  const result = await callApi(config, '/api/companion/study');
  if (!result.ok) throw new Error(result.data?.error || 'Não foi possível carregar o roteiro.');
  const plan = result.data?.plan;
  if (!plan) { log(result.data?.message || 'Sem progresso salvo nesta conta.'); return; }
  console.log(`Faltam ${plan.totals.remaining} aulas em ${plan.totals.activeCourses} cursos ativos · ${plan.totals.pausedCourses} pausados · ${plan.totals.completedCourses} concluídos.`);
  console.log(`Critério: ${plan.criteria}`);
  if (!plan.steps.length) { log(plan.note || 'Nada pendente por aqui.'); return; }
  plan.steps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step.title} — ${step.courseTitle}${step.discipline ? ` · ${step.discipline}` : ''} (${step.reason.label})`);
  });
}

async function unpair() {
  const config = readConfig();
  if (config.token) {
    await callApi(config, '/api/companion/presence', { method: 'DELETE' }).catch(() => {});
  }
  saveConfig({ ...config, token: '' });
  log('Este computador foi desconectado do Lume.');
}

async function run() {
  const config = readConfig();
  if (!config.token) throw new Error('Este computador ainda não está conectado. Rode: companion pair <código>');
  const dryRun = process.argv.includes('--dry-run');
  const once = process.argv.includes('--once');
  const interval = Number(flag('interval', config.intervalSeconds)) || config.intervalSeconds;
  let current = null;
  let since = null;
  let stopped = false;

  async function publish(match) {
    if (dryRun) return;
    const result = await callApi(config, '/api/companion/presence', {
      method: 'PUT',
      body: { app: match.label, category: match.category, since },
    });
    if (result.status === 401) {
      throw Object.assign(new Error('O Lume não reconhece mais este computador. Rode companion pair <código> de novo.'), { fatal: true });
    }
    if (!result.ok) throw new Error(result.data?.error || 'Falha ao enviar presença.');
  }

  async function clearRemote() {
    if (dryRun || !config.token) return;
    await callApi(config, '/api/companion/presence', { method: 'DELETE' }).catch(() => {});
  }

  async function tick() {
    const live = readConfig();
    if (live.paused) {
      if (current) { log('Presença pausada; nada está sendo enviado.'); await clearRemote(); current = null; since = null; }
      return;
    }
    const processes = await listProcesses();
    const match = matchAllowlist(processes, live.allowlist);
    if (!match) {
      if (current) { log('Nenhum aplicativo da lista aberto. Presença encerrada.'); await clearRemote(); current = null; since = null; }
      return;
    }
    if (!current || current.process !== match.process) {
      current = match;
      since = new Date().toISOString();
      log(`Observando ${match.label} (${match.category}).${dryRun ? ' [dry-run]' : ''}`);
    }
    await publish(match);
  }

  process.on('SIGINT', async () => { stopped = true; await clearRemote(); log('Encerrado. Presença removida.'); process.exit(0); });
  process.on('SIGTERM', async () => { stopped = true; await clearRemote(); process.exit(0); });

  log(`Companion ativo · ${config.apiUrl} · intervalo ${interval}s${dryRun ? ' · dry-run' : ''}`);
  log('Só nomes de processo da allowlist são lidos. Ctrl+C encerra e remove a presença.');
  do {
    try {
      await tick();
    } catch (error) {
      if (error.fatal) { log(error.message); process.exitCode = 1; return; }
      log(`Aviso: ${error.message}. Tentando de novo no próximo ciclo.`);
    }
    if (once || stopped) break;
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  } while (!stopped);
}

function help() {
  console.log(`Lume Companion — presença local, opcional e sem XP.

  node companion/agent.mjs pair <CÓDIGO> [--name "PC da Ana"] [--api URL]
  node companion/agent.mjs run [--interval 5] [--once] [--dry-run]
  node companion/agent.mjs status
  node companion/agent.mjs plan
  node companion/agent.mjs allow <processo> [--label "Nome"] [--category study]
  node companion/agent.mjs allowlist
  node companion/agent.mjs pause | resume
  node companion/agent.mjs unpair

Categorias: ${COMPANION_CATEGORIES.map((item) => item.id).join(', ')}
Configuração: ${configPath()}

Privacidade: lê apenas nomes de processo via tasklist. Não lê títulos de
janela, tela, teclado ou arquivos. Envia só o aplicativo, a categoria e desde
quando ele está aberto. Presença observada não é estudo e não gera XP.`);
}

const command = process.argv[2];
try {
  if (!command || command === 'help' || command === '--help') help();
  else if (command === 'pair') {
    const code = positional()[1];
    if (!code) throw new Error('Informe o código mostrado no Lume: companion pair ABCD-EFGH');
    await pair(code, flag('name', ''));
  } else if (command === 'run') await run();
  else if (command === 'status') await status();
  else if (command === 'plan') await plan();
  else if (command === 'allow') addAllow(positional()[1]);
  else if (command === 'allowlist') listAllow();
  else if (command === 'pause') setPaused(true);
  else if (command === 'resume') setPaused(false);
  else if (command === 'unpair') await unpair();
  else { help(); process.exitCode = 1; }
} catch (error) {
  console.error(`Erro: ${error.message}`);
  process.exitCode = 1;
}
