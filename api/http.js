// Utilidades HTTP sobre Request/Response (Fetch API), iguais no Node e no Worker.

import { AppError } from './errors.js';

export const BASE_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
});

export function json(body, status = 200, headers = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function empty(status = 204, headers = {}) {
  return new Response(null, { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function methodNotAllowed(allowed) {
  return json({ error: 'Método não permitido.' }, 405, { Allow: allowed.join(', ') });
}

// Lê o corpo em pedaços e interrompe assim que passa do limite, sem depender
// de Content-Length (que o cliente pode omitir ou falsear).
export async function readBytes(request, limit, tooLarge = () => new AppError('Corpo grande demais.', null, 413)) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readText(request, limit, tooLarge) {
  return new TextDecoder().decode(await readBytes(request, limit, tooLarge));
}

export async function readJson(request, limit, { tooLarge, invalid } = {}) {
  const text = await readText(request, limit, tooLarge);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw invalid ? invalid() : new AppError('JSON inválido.', null, 400);
  }
}

// Pedido do próprio site. Sem Origin, só vale o Sec-Fetch-Site do navegador.
export function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  if (!origin) return request.headers.get('Sec-Fetch-Site') === 'same-origin';
  return origin === `http://${url.host}` || origin === `https://${url.host}`;
}

export function isLocalHost(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

export function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
