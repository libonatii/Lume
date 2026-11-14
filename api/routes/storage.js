// Rotas de gerenciamento de armazenamento (usuário) e controle de cotas (criadora).

import { LIMITS } from '../config.js';
import { json } from '../http.js';
import {
  deleteStorageItem,
  listCreatorStorageAccounts,
  setAccountStorageTier,
  storageOverview,
} from '../domain/storage.js';

const ACCOUNT = { auth: 'Entre na sua conta para gerenciar seu armazenamento.', origin: true };

export function storageRoutes(router) {
  router.add('GET', '/api/storage', ACCOUNT, async (ctx) =>
    json(await storageOverview(ctx.db, ctx.media, ctx.user.id, ctx.config)));

  router.add('DELETE', '/api/storage/items/:kind/:itemId', ACCOUNT, async (ctx) =>
    json(await deleteStorageItem(ctx.db, ctx.media, ctx.user.id, ctx.params.kind, ctx.params.itemId, ctx.config)));

  router.add('GET', '/api/admin/storage', ACCOUNT, async (ctx) =>
    json(await listCreatorStorageAccounts(ctx.db, ctx.config, ctx.user, {
      q: ctx.url.searchParams.get('q') || '',
      filter: ctx.url.searchParams.get('filter') || 'all',
    })));

  router.add('PATCH', '/api/admin/storage/:userId', ACCOUNT, async (ctx) => {
    const body = await ctx.json(LIMITS.tiny);
    return json(await setAccountStorageTier(ctx.db, ctx.config, ctx.user, ctx.params.userId, body?.plan));
  });
}
