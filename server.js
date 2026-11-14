import http from 'node:http';
import dns from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from './api/app.js';
import { applyMigrations, sqliteAdapter } from './api/adapters/sqlite.js';
import { fsMediaBucket } from './api/adapters/fs-media.js';
import { sendResponse, toRequest } from './api/adapters/node-http.js';
import { createNodeRealtime } from './api/adapters/node-realtime.js';
import { currentUser } from './api/session.js';
import { BASE_HEADERS } from './api/http.js';

// Servidor local (Node): serve o build estático do Astro e entrega /api/* ao
// mesmo app do Worker (api/app.js), com SQLite em data/lume.db e imagens em
// data/media/.

const port = Number(process.env.PORT || 4173);

const staticFiles = new Map();
const mime = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', json: 'application/json' };
const dist = fileURLToPath(new URL('./dist/', import.meta.url));
if (existsSync(dist)) {
  for (const file of readdirSync(dist, { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || file.name.startsWith('_') || file.name.startsWith('.')) continue;
    const absolute = join(file.parentPath, file.name);
    const relative = absolute.slice(dist.length).replaceAll('\\', '/');
    const extension = file.name.split('.').pop();
    staticFiles.set(`/${relative}`, [absolute, mime[extension] || 'application/octet-stream']);
  }
  if (staticFiles.has('/index.html')) staticFiles.set('/', staticFiles.get('/index.html'));
}
const headersFile = join(dist, '_headers');
const builtCsp = existsSync(headersFile) ? readFileSync(headersFile, 'utf8').match(/Content-Security-Policy: (.+)/)?.[1] : null;
const csp = builtCsp || "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

// ---------- Banco local ----------

const dataDirectory = process.env.LUME_DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url));
mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(join(dataDirectory, 'lume.db'));
applyMigrations(database, fileURLToPath(new URL('./migrations/', import.meta.url)));
database.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());

// Resolve o domínio antes de conectar: impede apontar a importação para a rede interna.
async function lookupPublicHost(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

const db = sqliteAdapter(database);
const realtime = createNodeRealtime({ authenticate: (request) => currentUser(db, request) });

const app = createApp({
  db,
  realtime,
  media: fsMediaBucket(join(dataDirectory, 'media')),
  env: process.env,
  lookup: lookupPublicHost,
  log(event, details = {}) {
    if (event === 'password_reset_link') console.log(`Link de recuperação: ${details.link}`);
    else if (event === 'unhandled_error') console.error(details.stack || details.error);
  },
});

async function serveStatic(request, response, pathname) {
  const headers = { ...BASE_HEADERS, 'Content-Security-Policy': csp };
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const entry = staticFiles.get(pathname);
  if (!entry) {
    response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Página não encontrada.');
    return;
  }
  const data = entry[2] ?? (entry[2] = await readFile(entry[0]));
  response.writeHead(200, { ...headers, 'Content-Type': entry[1] });
  response.end(request.method === 'HEAD' ? undefined : data);
}

const server = http.createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  try {
    if (!pathname.startsWith('/api/')) return await serveStatic(request, response, pathname);
    const result = await app.fetch(toRequest(request), { clientIp: request.socket.remoteAddress || 'desconhecido' });
    result.headers.set('Content-Security-Policy', csp);
    await sendResponse(response, result);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) {
      response.writeHead(500, { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Não foi possível concluir a operação.' }));
    } else response.end();
  }
});

// Canal de tempo real: só /api/realtime aceita upgrade; o resto é recusado.
server.on('upgrade', (request, socket, head) => realtime.handleUpgrade(request, socket, head));

server.keepAliveTimeout = 60000;
server.headersTimeout = 65000;

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `A porta ${port} já está em uso. Escolha outra com a variável PORT.`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Lume está disponível em http://localhost:${port}`);
  console.log('Contas e sessões ficam em data/lume.db neste computador.');
});
