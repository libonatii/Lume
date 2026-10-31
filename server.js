import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/neurofocus.css', ['neurofocus.css', 'text/css; charset=utf-8']],
  ...['logo','calm','design','code','language','nature','detail'].map(name => [`/assets/stitch/${name}.png`, [`assets/stitch/${name}.png`, 'image/png']]),
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/domain.js', ['domain.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);
const port = Number(process.env.PORT || 4173);

const server = http.createServer(async (request, response) => {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const entry = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!entry) {
    response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Página não encontrada.');
    return;
  }
  try {
    const data = await readFile(fileURLToPath(new URL(entry[0], import.meta.url)));
    response.writeHead(200, { ...headers, 'Content-Type': entry[1] });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(500, headers);
    response.end('Não foi possível abrir o protótipo.');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `A porta ${port} já está em uso. Escolha outra com a variável PORT.`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Lume está disponível em http://localhost:${port}`);
  console.log('Protótipo local. Nenhum dado é enviado para um servidor.');
});
