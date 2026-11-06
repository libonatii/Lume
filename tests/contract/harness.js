// Alvos dos testes de contrato: o mesmo roteiro HTTP roda contra o servidor
// Node e, quando disponível, contra o Worker no Miniflare. Cada alvo devolve
// `{ origin, close }`; o roteiro só fala HTTP.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitFor(url, child, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`O servidor encerrou com código ${child.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`O servidor não respondeu a tempo: ${lastError?.message || 'sem resposta'}`);
}

export async function startNodeTarget(extraEnv = {}) {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), 'lume-contract-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      LUME_DATA_DIR: dataDir,
      BCRYPT_ROUNDS: '4',
      LUME_ATTEMPT_LIMIT: '200',
      LUME_EMAIL_PROVIDER: '',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  try {
    await waitFor(`${origin}/api/me`, child);
  } catch (error) {
    child.kill();
    throw new Error(`${error.message}\n${output}`);
  }
  return {
    name: 'node',
    origin,
    output: () => output,
    async close() {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

// Cliente com cookie e cabeçalho Origin, como o navegador do próprio site.
export function client(origin) {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    async request(method, path, { body, headers = {}, raw = false, sameOrigin = true } = {}) {
      const response = await fetch(`${origin}${path}`, {
        method,
        headers: {
          ...(sameOrigin ? { Origin: origin } : { Origin: 'https://example.invalid' }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const pair = setCookie.split(';')[0];
        cookie = pair.endsWith('=') ? '' : pair;
      }
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { status: response.status, data, headers: response.headers };
    },
  };
}

// Worker real (workerd) pelo `wrangler dev` local, com D1 local e as migrações
// aplicadas. Usa uma configuração temporária sem o passo de build do Astro.
export async function startWorkerTarget() {
  const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const { existsSync, writeFileSync, mkdirSync } = await import('node:fs');
  if (!existsSync(wrangler)) return null;
  const persist = mkdtempSync(join(tmpdir(), 'lume-d1-'));
  const assets = join(persist, 'assets');
  mkdirSync(assets);
  writeFileSync(join(assets, 'index.html'), '<!doctype html><title>Lume</title>');
  const config = join(root, `wrangler.contract-${process.pid}.jsonc`);
  writeFileSync(config, JSON.stringify({
    name: 'lume-contract',
    main: 'worker.js',
    compatibility_date: '2026-10-30',
    assets: { directory: assets, binding: 'ASSETS', not_found_handling: 'none' },
    d1_databases: [{ binding: 'DB', database_name: 'lume', database_id: 'local-contract', migrations_dir: 'migrations' }],
    vars: { SHOW_RESET_LINK: 'true', BCRYPT_ROUNDS: '4', ATTEMPT_LIMIT: '200' },
  }));
  const run = (args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args, '--config', config], { cwd: root, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('exit', (code) => (code === 0 ? resolve(output) : reject(new Error(output))));
  });
  const cleanup = () => {
    rmSync(config, { force: true });
    try { rmSync(persist, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* o workerd pode segurar arquivos no Windows. */ }
  };
  try {
    await run(['d1', 'migrations', 'apply', 'lume', '--local', '--persist-to', persist]);
  } catch (error) {
    cleanup();
    throw error;
  }
  const port = await freePort();
  const child = spawn(process.execPath, [wrangler, 'dev', '--config', config, '--local', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', persist, '--log-level', 'error'], {
    cwd: root,
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  try {
    await waitFor(`${origin}/api/me`, child, 60000);
  } catch (error) {
    child.kill();
    cleanup();
    throw new Error(`${error.message}
${output}`);
  }
  return {
    name: 'worker',
    origin,
    async close() {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
      cleanup();
    },
  };
}
