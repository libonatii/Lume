// Service worker do Lume: mantém CSS, fontes e bundles em cache para as visitas
// seguintes não baixarem tudo de novo.
//
// Decisões:
// - navegação NÃO é interceptada: o documento continua vindo da rede, então uma
//   versão nova do HTML nunca fica presa atrás de um cache antigo. Sem internet,
//   o programa de desktop mostra a página local de "sem conexão" e o navegador
//   mostra o aviso padrão;
// - `/_astro/*`, CSS, fontes e imagens usam cache primeiro com atualização em
//   segundo plano, porque os nomes já vêm com hash do build;
// - `/api/*` nunca entra no cache: conta, amigos e progresso sempre vêm da rede.

const CACHE = 'lume-assets-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') return;

  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  const fresh = await network;
  return fresh || new Response('', { status: 504, statusText: 'Sem conexão' });
}
