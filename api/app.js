// App HTTP único do Lume. O Node (server.js) e o Worker (worker.js) só
// adaptam o ambiente: banco, armazenamento de imagens, variáveis e IP de quem
// chama. Uma rota nova é escrita uma vez, em api/routes/.

import { readConfig } from './config.js';
import { AppError, errorBody } from './errors.js';
import { json, methodNotAllowed, readBytes, readJson, readText, sameOrigin } from './http.js';
import { createRouter } from './router.js';
import { currentUser, tooManyAttempts } from './session.js';
import { accountRoutes } from './routes/account.js';
import { libraryRoutes } from './routes/library.js';
import { mediaRoutes } from './routes/media.js';
import { progressRoutes } from './routes/progress.js';
import { socialRoutes } from './routes/social.js';

export function buildRouter() {
  const router = createRouter();
  accountRoutes(router);
  libraryRoutes(router);
  socialRoutes(router);
  progressRoutes(router);
  mediaRoutes(router);
  return router;
}

function defaultLog(event, details = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

// ports: { db, media, env, log, lookup }
export function createApp({ db, media = null, env = {}, log = defaultLog, lookup = null }) {
  const config = readConfig(env);
  const router = buildRouter();

  async function handle(request, { clientIp = 'desconhecido' } = {}) {
    const url = new URL(request.url);
    const found = router.match(request.method, url.pathname);
    if (!found) return json({ error: 'Rota não encontrada.' }, 404);
    if (found.allowed) return methodNotAllowed(found.allowed);

    const { route, params } = found;
    const options = route.options;
    const ctx = {
      request, url, params, db, media, env, config, log, lookup, clientIp, user: null,
      json: (limit, errors) => readJson(request, limit, errors),
      text: (limit, tooLarge) => readText(request, limit, tooLarge),
      bytes: (limit, tooLarge) => readBytes(request, limit, tooLarge),
    };

    if (options.auth) {
      ctx.user = await currentUser(db, request);
      if (!ctx.user && options.auth !== 'optional') return json({ error: options.auth }, 401);
    }
    if (options.origin && !sameOrigin(request, url)) return json({ error: 'Origem não autorizada.' }, 403);
    if (options.rateLimit) {
      const { key, limit = config.attemptLimit, message, code } = options.rateLimit;
      if (await tooManyAttempts(db, key(ctx), limit)) return json({ error: message, ...(code ? { code } : {}) }, 429);
    }
    return route.handler(ctx);
  }

  return {
    config,
    router,
    async fetch(request, meta) {
      try {
        return await handle(request, meta);
      } catch (error) {
        if (error instanceof AppError) return json(errorBody(error), error.status);
        if (error?.status) return json({ error: error.message }, error.status);
        log('unhandled_error', {
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return json({ error: 'Não foi possível concluir a operação.' }, 500);
      }
    },
  };
}
