#!/usr/bin/env node
// Lume Companion — agente local que informa qual aplicativo da sua allowlist
// está aberto. Sem dependências externas nesta versão.
//
// O que ele lê: nomes de processo via `tasklist`. Só isso.
// O que ele NÃO lê: título de janela, conteúdo de tela, teclado, arquivos.
// O que ele envia: aplicativo escolhido, categoria e desde quando está aberto.
// Presença observada não é estudo e não gera XP.

import {
  COMPANION_CATEGORIES, MAX_ALLOWLIST, matchAllowlist, normalizeCategory,
  normalizeProcessName,
} from './domain.mjs';
import {
  addAllowlistEntry, configPath, createCompanion, fetchPlan, listProcesses,
  pairDevice, readConfig, removeAllowlistEntry, setPaused, unpairDevice,
} from './core.mjs';

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

async function pair(code, name) {
  log(`Conectando em ${flag('api', readConfig().apiUrl)}…`);
  const result = await pairDevice(code, { name: name || flag('name', 'Meu computador'), apiUrl: flag('api', '') });
  log(`Conectado como "${result.device.name}".`);
  log(`Configuração em ${configPath()}`);
  log('Agora rode: npm run companion');
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
    const plan = (await fetchPlan(config).catch(() => null))?.plan;
    if (plan) log(`Roteiro: faltam ${plan.totals.remaining} aulas. Próxima: ${plan.steps[0]?.title || 'nada pendente'}.`);
  }
}

async function plan() {
  const config = readConfig();
  if (!config.token) throw new Error('Conecte o programa primeiro: node companion/agent.mjs pair <CÓDIGO>');
  const result = await fetchPlan(config);
  if (!result) throw new Error('Não foi possível carregar o roteiro.');
  const value = result.plan;
  if (!value) { log(result.message || 'Sem progresso salvo nesta conta.'); return; }
  console.log(`Faltam ${value.totals.remaining} aulas em ${value.totals.activeCourses} cursos ativos · ${value.totals.pausedCourses} pausados · ${value.totals.completedCourses} concluídos.`);
  console.log(`Critério: ${value.criteria}`);
  if (!value.steps.length) { log(value.note || 'Nada pendente por aqui.'); return; }
  value.steps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step.title} — ${step.courseTitle}${step.discipline ? ` · ${step.discipline}` : ''} (${step.reason.label})`);
  });
}

function allow(processName) {
  const result = addAllowlistEntry(processName, { label: flag('label', ''), category: flag('category', 'study') });
  if (!result.added) { log(`${normalizeProcessName(processName)} já está na lista.`); return; }
  log(`Adicionado: ${result.entry.label} (${result.entry.process}) · ${COMPANION_CATEGORIES.find((item) => item.id === result.entry.category)?.label}`);
}

async function run() {
  const config = readConfig();
  if (!config.token) throw new Error('Este computador ainda não está conectado. Rode: companion pair <código>');
  const dryRun = process.argv.includes('--dry-run');
  const once = process.argv.includes('--once');
  const interval = Number(flag('interval', config.intervalSeconds)) || config.intervalSeconds;

  if (dryRun) {
    const processes = await listProcesses();
    const match = matchAllowlist(processes, config.allowlist);
    if (match) log(`Observando ${match.label} (${match.category}). [dry-run]`);
    else log('Nenhum aplicativo da allowlist está aberto. [dry-run]');
    if (!once) log('Modo dry-run: nada é enviado. Use sem --dry-run para publicar presença.');
    return;
  }

  let lastKey = '';
  const companion = createCompanion({
    intervalSeconds: interval,
    onUpdate: (state) => {
      if (state.error) {
        log(`Aviso: ${state.error}`);
        return;
      }
      const key = state.detected ? `${state.detected.process}|${state.since}` : 'none';
      if (key === lastKey) return;
      lastKey = key;
      if (state.detected) log(`Observando ${state.detected.label} (${state.detected.category}).`);
      else log('Nenhum aplicativo da lista aberto. Presença encerrada.');
      if (state.plan) log(`Faltam ${state.plan.totals.remaining} aulas. Próxima: ${state.plan.steps[0]?.title || 'nada pendente'}.`);
    },
  });

  const shutdown = async () => {
    await companion.stop();
    log('Encerrado. Presença removida.');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log(`Companion ativo · ${config.apiUrl} · intervalo ${interval}s · ${readConfig().paused ? 'pausado' : 'presença ativa'}`);
  log('Só nomes de processo da allowlist são lidos. Ctrl+C encerra e remove a presença.');
  if (once) {
    await companion.refreshPlan();
    await companion.tickOnce();
    log('Execução única concluída. A presença enviada expira sozinha em 90 segundos.');
    return;
  }
  await companion.start();
}

function help() {
  console.log(`Lume Companion — presença local, opcional e sem XP.

  node companion/agent.mjs pair <CÓDIGO> [--name "PC da Ana"] [--api URL]
  node companion/agent.mjs run [--interval 5] [--once] [--dry-run]
  node companion/agent.mjs status
  node companion/agent.mjs plan
  node companion/agent.mjs allow <processo> [--label "Nome"] [--category study]
  node companion/agent.mjs allowlist
  node companion/agent.mjs remove <processo>
  node companion/agent.mjs pause | resume
  node companion/agent.mjs unpair

Categorias: ${COMPANION_CATEGORIES.map((item) => item.id).join(', ')}
Configuração: ${configPath()}
Limite da allowlist: ${MAX_ALLOWLIST} aplicativos

Privacidade: lê apenas nomes de processo via tasklist. Não lê títulos de
janela, tela, teclado ou arquivos. Envia só o aplicativo, a categoria e desde
quando ele está aberto. Presença observada não é estudo e não gera XP.

Para a janela com bandeja: npm run companion:app`);
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
  else if (command === 'allow') allow(positional()[1]);
  else if (command === 'remove') {
    removeAllowlistEntry(positional()[1]);
    log('Aplicativo removido da lista.');
  } else if (command === 'allowlist') listAllow();
  else if (command === 'pause') { setPaused(true); log('Presença pausada.'); }
  else if (command === 'resume') { setPaused(false); log('Presença retomada.'); }
  else if (command === 'unpair') { await unpairDevice(); log('Este computador foi desconectado do Lume.'); }
  else { help(); process.exitCode = 1; }
} catch (error) {
  console.error(`Erro: ${error.message}`);
  process.exitCode = 1;
}
