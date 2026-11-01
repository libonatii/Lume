// Ponte entre node:http e a Fetch API usada pelo app.

import { Readable } from 'node:stream';

export function toRequest(incoming) {
  const forwarded = String(incoming.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwarded === 'https' ? 'https' : 'http';
  const url = `${protocol}://${incoming.headers.host || 'localhost'}${incoming.url}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const hasBody = !['GET', 'HEAD'].includes(incoming.method);
  return new Request(url, {
    method: incoming.method,
    headers,
    body: hasBody ? Readable.toWeb(incoming) : undefined,
    duplex: hasBody ? 'half' : undefined,
  });
}

export async function sendResponse(outgoing, response) {
  const headers = {};
  response.headers.forEach((value, name) => {
    if (name === 'set-cookie') return;
    headers[name] = value;
  });
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) headers['set-cookie'] = cookies;
  outgoing.writeHead(response.status, headers);
  if (!response.body) {
    outgoing.end();
    return;
  }
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}
