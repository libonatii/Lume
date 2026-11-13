// Feed entre amigos, com a mesma política de sessão e origem da API social.
import { BASE_HEADERS, json } from '../http.js';
import { SOCIAL_PDF_BYTES } from '../../public/social-domain.js';
import { createSocialPost, listSocialPosts, deleteSocialPost, readSocialAttachment, reactToSocialPost, listSocialComments, createSocialComment, deleteSocialComment, SocialError } from '../domain/social-feed.js';

const FEED = { auth: 'Entre na sua conta para ver o Social.', origin: true };
const write = { ...FEED, rateLimit: { key: ctx => `social|${ctx.user.id}`, limit: 60, message: 'Muitas publicações em pouco tempo. Aguarde um instante.', code: 'rate_limited' } };

export function socialFeedRoutes(router) {
  router.add('GET', '/api/social/feed', FEED, async ctx => json(await listSocialPosts(ctx.db, ctx.user.id, { cursor: ctx.url.searchParams.get('cursor') })));
  router.add('POST', '/api/social/posts', write, async ctx => {
    let input, file = null;
    const contentType = ctx.request.headers.get('Content-Type') || '';
    if (contentType.startsWith('multipart/form-data')) {
      const bytes = await ctx.bytes(SOCIAL_PDF_BYTES + 65536);
      let form;
      try { form = await new Response(bytes, { headers: { 'Content-Type': contentType } }).formData(); }
      catch { throw new SocialError('Não foi possível ler o anexo.', 'invalid_upload'); }
      input = Object.fromEntries(['id', 'body', 'kind', 'achievementId'].map(key => [key, form.get(key)]));
      const upload = form.get('attachment');
      if (upload && typeof upload.arrayBuffer === 'function') file = { name: upload.name, bytes: new Uint8Array(await upload.arrayBuffer()) };
    } else input = await ctx.json(16384);
    return json(await createSocialPost(ctx.db, ctx.media, ctx.user.id, input, file), 201);
  });
  router.add('DELETE', '/api/social/posts/:postId', FEED, async ctx => json(await deleteSocialPost(ctx.db, ctx.media, ctx.user.id, ctx.params.postId)));
  // Navegação, download e <img> enviam cookie; o acesso continua privado, sem cache público.
  router.add('GET', '/api/social/posts/:postId/attachment', { auth: FEED.auth }, async ctx => {
    const { object, name, type } = await readSocialAttachment(ctx.db, ctx.media, ctx.user.id, ctx.params.postId);
    return new Response(object.body, { headers: { ...BASE_HEADERS, 'Content-Type': type,
      'Content-Disposition': `${ctx.url.searchParams.has('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cross-Origin-Resource-Policy': 'same-origin' } });
  });
  router.add('PUT', '/api/social/posts/:postId/reaction', write, async ctx => json(await reactToSocialPost(ctx.db, ctx.user.id, ctx.params.postId, true)));
  router.add('DELETE', '/api/social/posts/:postId/reaction', FEED, async ctx => json(await reactToSocialPost(ctx.db, ctx.user.id, ctx.params.postId, false)));
  router.add('GET', '/api/social/posts/:postId/comments', FEED, async ctx => json(await listSocialComments(ctx.db, ctx.user.id, ctx.params.postId, { cursor: ctx.url.searchParams.get('cursor') })));
  router.add('POST', '/api/social/posts/:postId/comments', write, async ctx => json(await createSocialComment(ctx.db, ctx.user.id, ctx.params.postId, await ctx.json(8192)), 201));
  router.add('DELETE', '/api/social/posts/:postId/comments/:commentId', FEED, async ctx => json(await deleteSocialComment(ctx.db, ctx.user.id, ctx.params.postId, ctx.params.commentId)));
}
