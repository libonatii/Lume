// Imagens de perfil e de slides. O armazenamento é uma porta: diretório local
// no Node, R2 no Worker; sem armazenamento configurado, as rotas respondem 503.

import {
  MediaError, deleteProfileObject, deleteSlideObject, parseMediaKeyFromPath, uploadProfileObject, uploadSlideObject,
} from '../../media.js';
import { LIMITS } from '../config.js';
import { BASE_HEADERS, isLocalHost, json } from '../http.js';

const TOO_LARGE = () => new MediaError('A imagem ultrapassa o limite de 2 MB.', 413, 'image_too_large');

// Sem conta, só a prévia local pode enviar imagens; elas ficam no dono "preview".
function ownerFor(ctx, message) {
  if (ctx.user) return ctx.user.id;
  if (isLocalHost(ctx.url)) return 'preview';
  throw new MediaError(message, 401, 'unauthenticated');
}

export function mediaRoutes(router) {
  router.add(['GET', 'HEAD'], '/api/media/*', { auth: 'optional' }, async (ctx) => {
    const parsed = parseMediaKeyFromPath(ctx.url.pathname);
    if (!parsed) return json({ error: 'Imagem não encontrada.' }, 404);
    if (parsed.kind === 'slide' && !isLocalHost(ctx.url)) {
      if (!ctx.user) return json({ error: 'Entre na sua conta para ver esta imagem.' }, 401);
      if (parsed.ownerId !== ctx.user.id) return json({ error: 'Esta imagem não está disponível para você.' }, 403);
    }
    if (!ctx.media) return json({ error: 'Armazenamento de mídia R2 não configurado.', code: 'r2_unavailable' }, 503);
    const object = await ctx.media.get(parsed.key);
    if (!object) return json({ error: 'Imagem não encontrada.' }, 404);
    return new Response(ctx.request.method === 'HEAD' ? null : object.body, {
      status: 200,
      headers: {
        ...BASE_HEADERS,
        'Content-Type': object.contentType || parsed.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...(object.etag ? { ETag: object.etag } : {}),
      },
    });
  });

  router.add('PUT', '/api/profile/media/:slot', { auth: 'optional', origin: true }, async (ctx) => {
    const ownerId = ownerFor(ctx, 'Entre na sua conta para enviar imagens do perfil.');
    const bytes = await ctx.bytes(LIMITS.media, TOO_LARGE);
    return json(await uploadProfileObject(ctx.media, { ownerId, slot: ctx.params.slot, bytes }), 201);
  });
  router.add('DELETE', '/api/profile/media/:slot', { auth: 'optional', origin: true }, async (ctx) => {
    const ownerId = ownerFor(ctx, 'Entre na sua conta para enviar imagens do perfil.');
    return json(await deleteProfileObject(ctx.media, { ownerId, slot: ctx.params.slot }));
  });

  router.add('PUT', '/api/slides/media/:courseId/:slideId', { auth: 'optional', origin: true }, async (ctx) => {
    const ownerId = ownerFor(ctx, 'Entre na sua conta para enviar imagens de slides.');
    const bytes = await ctx.bytes(LIMITS.media, TOO_LARGE);
    const { courseId, slideId } = ctx.params;
    return json(await uploadSlideObject(ctx.media, { ownerId, courseId, slideId, bytes }), 201);
  });
  router.add('DELETE', '/api/slides/media/:courseId/:slideId', { auth: 'optional', origin: true }, async (ctx) => {
    const ownerId = ownerFor(ctx, 'Entre na sua conta para enviar imagens de slides.');
    const { courseId, slideId } = ctx.params;
    return json(await deleteSlideObject(ctx.media, { ownerId, courseId, slideId }));
  });
}
