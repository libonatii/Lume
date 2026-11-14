// Worker da Cloudflare: estáticos pelo binding ASSETS e /api/* pelo mesmo app
// do servidor local (api/app.js), com D1 em env.DB e imagens em R2 (env.MEDIA).
// O Worker não tem resolvedor DNS: a validação de endereço da importação
// acontece na URL e em cada redirecionamento.

import { createApp } from './api/app.js';
import { d1Adapter } from './api/adapters/d1.js';
import { r2BucketAdapter } from './api/domain/media.js';
import { durableRealtime } from './api/adapters/realtime-do.js';

export { UserChannel } from './api/adapters/realtime-do.js';

let cached = null;

function appFor(env) {
  if (cached?.env !== env) {
    cached = { env, app: createApp({ db: d1Adapter(env.DB), media: r2BucketAdapter(env.MEDIA), env, realtime: env.CHANNEL ? durableRealtime(env.CHANNEL) : null }) };
  }
  return cached.app;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // /@usuario é uma rota do app (perfil): entrega o mesmo index.html.
    if (/^\/@[A-Za-z0-9._]{3,24}\/?$/.test(url.pathname) && ['GET', 'HEAD'].includes(request.method)) {
      return env.ASSETS.fetch(new Request(new URL('/', url), { method: request.method, headers: request.headers }));
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    return appFor(env).fetch(request, { clientIp: request.headers.get('CF-Connecting-IP') ?? 'desconhecido' });
  },
};
