// XP validado no servidor, ranking e aplicativo de desktop.

import { adjustEvent, getRanking, getXpSnapshot, recordTimeSession, updateXpSettings } from '../domain/xp.js';
import { grantBonus, grantSlide, grantStep } from '../domain/rewards.js';
import { applyProgressCommands } from '../domain/commands.js';
import {
  authenticateDevice, clearPresence, companionSelf, createPairCode, listCompanion, redeemPairCode,
  reportPresence, revokeDevice, studySnapshot,
} from '../domain/companion.js';
import { LIMITS } from '../config.js';
import { bearerToken, empty, json } from '../http.js';
import { AppError } from '../errors.js';

const XP = { auth: 'Entre na sua conta para ver seu XP e o ranking.', origin: true };
const DESKTOP = { auth: 'Entre na sua conta para gerenciar o Companion.', origin: true };

async function legacyWrite(ctx, handler, limit) {
  if (await ctx.db.first('SELECT user_id FROM account_documents WHERE user_id=?', [ctx.user.id])) {
    throw new AppError('Atualize o Lume para registrar atividades na biblioteca.', 'client_outdated', 409);
  }
  return json(await handler(ctx.db, ctx.user.id, await ctx.json(limit)));
}

// Rotas do programa de desktop: a autoridade é o token do dispositivo, não o cookie.
function withDevice(handler) {
  return async (ctx) => {
    const device = await authenticateDevice(ctx.db, bearerToken(ctx.request));
    if (!device) {
      return json({ error: 'Este programa não está mais conectado. Gere um novo código no Lume.', code: 'device_unauthorized' }, 401);
    }
    return handler({ ...ctx, device });
  };
}

export function progressRoutes(router) {
  // Comandos de progresso: o servidor grava a conclusão com o próprio relógio e
  // devolve o XP concedido pelas regras na mesma resposta.
  router.add('POST', '/api/progress', { auth: 'Entre na sua conta para registrar seu progresso.', origin: true }, async (ctx) =>
    legacyWrite(ctx, applyProgressCommands, 64 * 1024));

  router
    .add('GET', '/api/xp', XP, async ({ db, user, url }) =>
      json(await getXpSnapshot(db, user.id, { timeZone: url.searchParams.get('timeZone') || '' })))
    .add('POST', '/api/xp/complete', XP, async (ctx) => legacyWrite(ctx, grantStep, LIMITS.small))
    .add('POST', '/api/xp/bonus', XP, async (ctx) => legacyWrite(ctx, grantBonus, LIMITS.small))
    .add('POST', '/api/xp/slides', XP, async (ctx) => legacyWrite(ctx, grantSlide, LIMITS.small))
    .add('POST', '/api/xp/adjust', XP, async (ctx) => json(await adjustEvent(ctx.db, ctx.user.id, await ctx.json(LIMITS.small))))
    .add('POST', '/api/xp/time', XP, async (ctx) => legacyWrite(ctx, recordTimeSession, LIMITS.small))
    .add(['PATCH', 'POST'], '/api/xp/settings', XP, async (ctx) =>
      json({ settings: await updateXpSettings(ctx.db, ctx.user.id, await ctx.json(LIMITS.tiny)) }))
    .add('GET', '/api/ranking', XP, async ({ db, user, url }) => json(await getRanking(db, user.id, {
      tab: url.searchParams.get('tab') || 'level',
      period: url.searchParams.get('period') || 'week',
      timeZone: url.searchParams.get('timeZone') || '',
    })));

  router
    .add('POST', '/api/companion/redeem', {
      rateLimit: { key: (ctx) => `companion-redeem|${ctx.clientIp}`, limit: 20, message: 'Muitas tentativas de conexão. Aguarde alguns minutos.', code: 'rate_limited' },
    }, async (ctx) => {
      const body = await ctx.json(LIMITS.small);
      return json(await redeemPairCode(ctx.db, { code: body.code, deviceName: body.deviceName }), 201);
    })
    .add('GET', '/api/companion/me', withDevice(async ({ db, device }) => json(await companionSelf(db, device))))
    .add('GET', '/api/companion/study', withDevice(async ({ db, device }) => json(await studySnapshot(db, device))))
    .add('PUT', '/api/companion/presence', withDevice(async (ctx) => {
      const body = await ctx.json(LIMITS.small);
      return json(await reportPresence(ctx.db, ctx.device, { app: body.app, category: body.category, since: body.since }));
    }))
    .add('DELETE', '/api/companion/presence', withDevice(async ({ db, device }) => {
      await clearPresence(db, device.id);
      return empty(204);
    }))
    .add('GET', '/api/companion', DESKTOP, async ({ db, user }) => json(await listCompanion(db, user.id)))
    .add('POST', '/api/companion/pair', DESKTOP, async ({ db, user }) => json(await createPairCode(db, user.id), 201))
    .add('DELETE', '/api/companion/devices/:deviceId', DESKTOP, async ({ db, user, params }) =>
      json(await revokeDevice(db, user.id, params.deviceId)));
}
