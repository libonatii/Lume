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
