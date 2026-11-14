// Amigos, perfil entre amigos, mensagens diretas, bloqueio e colaboração.

import {
  blockContact, getThread, listBlocks, listConversations, markThreadRead, messagePreferences,
  sendMessage, unblockContact, unreadSummary, updateMessagePreferences, MESSAGE_WINDOW_LIMIT,
} from '../domain/messages.js';
import { acceptInvite, createInvite, listFriends, readFriendProfile, removeFriend, touchUserPresence } from '../domain/friends.js';
import { cancelRequest, listRequests, respondRequest, searchByHandle, sendRequest, setHandle } from '../domain/friend-requests.js';
import {
  cancelCollaborationInvite, createCollaborationInvite, listCollaborationInvites, respondCollaborationInvite,
} from '../domain/collaboration.js';
import { listNotifications, markNotificationsSeen } from '../domain/notifications.js';
import { LIMITS } from '../config.js';
import { announce } from '../realtime.js';
import { json } from '../http.js';

const FRIENDS = { auth: 'Entre na sua conta para convidar amigos.', origin: true };
const MESSAGES = { auth: 'Entre na sua conta para conversar com amigos.', origin: true };
const NOTIFICATIONS = { auth: 'Entre na sua conta para ver suas notificações.', origin: true };
const COLLABORATION = { auth: 'Entre na sua conta para convidar alguém para colaborar.', origin: true };

export function socialRoutes(router) {
  router
    .add('GET', '/api/notifications', NOTIFICATIONS, async ({ db, user }) => json(await listNotifications(db, user.id)))
    .add('POST', '/api/notifications/seen', NOTIFICATIONS, async ({ db, user }) => json(await markNotificationsSeen(db, user.id)));
  router
    .add('GET', '/api/friends', FRIENDS, async ({ db, user }) => {
      await touchUserPresence(db, user.id);
      return json(await listFriends(db, user.id));
    })
    .add('POST', '/api/friends/invite', FRIENDS, async ({ db, user }) => json(await createInvite(db, user.id), 201))
    .add('POST', '/api/friends/accept', {
      ...FRIENDS,
      rateLimit: { key: (ctx) => `friends-accept|${ctx.user.id}`, limit: 20, message: 'Muitas tentativas de convite. Aguarde alguns minutos.', code: 'rate_limited' },
    }, async (ctx) => {
      const body = await ctx.json(LIMITS.tiny);
      return json(await acceptInvite(ctx.db, ctx.user.id, body.code));
    })
    .add('GET', '/api/friends/requests', FRIENDS, async ({ db, user }) => json(await listRequests(db, user.id)))
    .add('GET', '/api/friends/search', {
      ...FRIENDS,
      rateLimit: { key: (ctx) => `friends-search|${ctx.user.id}`, limit: 30, message: 'Muitas buscas em pouco tempo. Aguarde um instante.', code: 'rate_limited' },
    }, async (ctx) => json(await searchByHandle(ctx.db, ctx.user.id, ctx.url.searchParams.get('handle'))))
    .add('PUT', '/api/friends/handle', FRIENDS, async (ctx) =>
      json(await setHandle(ctx.db, ctx.user.id, (await ctx.json(LIMITS.tiny)).handle)))
    .add('POST', '/api/friends/requests', {
      ...FRIENDS,
      rateLimit: { key: (ctx) => `friends-request|${ctx.user.id}`, limit: 30, message: 'Muitas solicitações em pouco tempo. Aguarde um instante.', code: 'rate_limited' },
    }, async (ctx) => {
      const sent = await sendRequest(ctx.db, ctx.user.id, await ctx.json(LIMITS.tiny));
      if (sent.toId) await announce(ctx.realtime, sent.toId, { type: 'friend_request', from: ctx.user.id }, ctx.log);
      return json(sent, sent.status === 'sent' ? 201 : 200);
    })
    .add('POST', '/api/friends/requests/:requestId/respond', FRIENDS, async (ctx) =>
      json(await respondRequest(ctx.db, ctx.user.id, ctx.params.requestId, await ctx.json(LIMITS.tiny))))
    .add('DELETE', '/api/friends/requests/:requestId', FRIENDS, async ({ db, user, params }) =>
      json(await cancelRequest(db, user.id, params.requestId)))
    .add('DELETE', '/api/friends/:friendId', FRIENDS, async ({ db, user, params }) =>
      json(await removeFriend(db, user.id, params.friendId)));

  router.add('GET', '/api/profile/:friendId', { auth: 'Entre na sua conta para ver perfis.', origin: true }, async ({ db, user, params }) =>
    json({ profile: await readFriendProfile(db, user.id, params.friendId) }));

  router
    .add('GET', '/api/messages', MESSAGES, async ({ db, user }) => json(await listConversations(db, user.id)))
    .add('GET', '/api/messages/unread', MESSAGES, async ({ db, user }) => {
      await touchUserPresence(db, user.id);
      return json(await unreadSummary(db, user.id));
    })
    .add('GET', '/api/messages/settings', MESSAGES, async ({ db, user }) => json(await messagePreferences(db, user.id)))
    .add(['PATCH', 'POST'], '/api/messages/settings', MESSAGES, async (ctx) =>
      json(await updateMessagePreferences(ctx.db, ctx.user.id, await ctx.json(LIMITS.tiny))))
    .add('POST', '/api/messages/:friendId/read', MESSAGES, async ({ db, user, params }) =>
      json(await markThreadRead(db, user.id, params.friendId)))
    .add('GET', '/api/messages/:friendId', MESSAGES, async ({ db, user, params }) =>
      json(await getThread(db, user.id, params.friendId)))
    .add('POST', '/api/messages/:friendId', {
      ...MESSAGES,
      rateLimit: { key: (ctx) => `messages|${ctx.user.id}`, limit: MESSAGE_WINDOW_LIMIT, message: 'Muitas mensagens em pouco tempo. Aguarde um instante.', code: 'rate_limited' },
    }, async (ctx) => {
      const sent = await sendMessage(ctx.db, ctx.user.id, ctx.params.friendId, await ctx.json(LIMITS.small));
      await announce(ctx.realtime, ctx.params.friendId, { type: 'message', from: ctx.user.id }, ctx.log);
      return json(sent, 201);
    })
    .add('GET', '/api/blocks', MESSAGES, async ({ db, user }) => json(await listBlocks(db, user.id)))
    .add('POST', '/api/blocks/:targetId', MESSAGES, async ({ db, user, params }) => json(await blockContact(db, user.id, params.targetId)))
    .add('DELETE', '/api/blocks/:targetId', MESSAGES, async ({ db, user, params }) => json(await unblockContact(db, user.id, params.targetId)));

  router
    .add('GET', '/api/collaboration/invites', COLLABORATION, async ({ db, user }) => json(await listCollaborationInvites(db, user.id)))
    .add('POST', '/api/collaboration/invites', {
      ...COLLABORATION,
      rateLimit: { key: (ctx) => `collaboration|${ctx.user.id}`, limit: 30, message: 'Muitos convites em pouco tempo. Aguarde um instante.', code: 'rate_limited' },
    }, async (ctx) => json(await createCollaborationInvite(ctx.db, ctx.user.id, await ctx.json(LIMITS.small)), 201))
    .add('POST', '/api/collaboration/invites/:inviteId/respond', COLLABORATION, async (ctx) =>
      json(await respondCollaborationInvite(ctx.db, ctx.user.id, ctx.params.inviteId, await ctx.json(LIMITS.tiny))))
    .add('DELETE', '/api/collaboration/invites/:inviteId', COLLABORATION, async ({ db, user, params }) =>
      json(await cancelCollaborationInvite(db, user.id, params.inviteId)));
}
