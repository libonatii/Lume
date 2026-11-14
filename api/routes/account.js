// Cadastro, entrada, saída, sessão atual e recuperação de senha.

import {
  RESET_TTL_MS, clearedSessionCookie, createSessionToken, hashPassword, hashSessionToken,
  normalizeEmail, sessionCookie, validateEmail, validateName, validatePassword, verifyPassword,
} from '../domain/auth.js';
import { sendPasswordResetEmail } from '../domain/email.js';
import { LIMITS } from '../config.js';
import { empty, json } from '../http.js';
import { publicUser, sessionTokenFrom, startSession } from '../session.js';
import { checkHandle, ensureHandle, normalizeHandle } from '../domain/friend-requests.js';
import { clearUserPresence, touchUserPresence } from '../domain/friends.js';

const ATTEMPTS = { key: (ctx) => `${ctx.clientIp}|${ctx.url.pathname}`, message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
const DUPLICATE = { error: 'Este e-mail já tem uma conta no Lume.', field: 'email' };

function cookieOptions(url) {
  return { secure: url.protocol === 'https:' };
}

export function accountRoutes(router) {
  router.add('GET', '/api/me', { auth: 'optional' }, async ({ db, user }) => {
    if (user) await touchUserPresence(db, user.id);
    // 200 com user nulo evita ruído de erro no console de quem não está logado.
    return json({ authenticated: Boolean(user), user: user ? publicUser(user) : null });
  });

  router.add('GET', '/api/handle/check', { auth: 'optional', rateLimit: { key: (ctx) => `handle-check|${ctx.clientIp}`, limit: 120, message: 'Muitas consultas. Aguarde um instante.', code: 'rate_limited' } },
    async (ctx) => json(await checkHandle(ctx.db, ctx.url.searchParams.get('handle'), ctx.user?.id || null)));

  router.add('POST', '/api/register', { origin: true, rateLimit: ATTEMPTS }, async (ctx) => {
    const body = await ctx.json(LIMITS.body);
    const name = validateName(body.name);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    if (await ctx.db.first('SELECT id FROM users WHERE email = ?', [email])) return json(DUPLICATE, 409);
    // O @usuário é escolhido no cadastro; clientes antigos que não o enviam recebem um gerado do nome.
    const wantsHandle = body.handle !== undefined && body.handle !== null && body.handle !== '';
    if (wantsHandle) {
      const check = await checkHandle(ctx.db, body.handle);
      if (!check.available) return json({ error: check.message, field: 'handle' }, check.reason === 'taken' ? 409 : 400);
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const passwordHash = await hashPassword(password, ctx.config.bcryptRounds);
    try {
      await ctx.db.run('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, name, email, passwordHash, createdAt]);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return json(DUPLICATE, 409);
      throw error;
    }
    try {
      if (wantsHandle) {
        await ctx.db.run('INSERT INTO user_handles (user_id, handle, created_at) VALUES (?, ?, ?)', [id, normalizeHandle(body.handle), createdAt]);
      } else {
        await ensureHandle(ctx.db, id);
      }
    } catch (error) {
      // Outra pessoa levou o @usuário no meio do caminho: desfaz a conta para tentar de novo.
      await ctx.db.run('DELETE FROM users WHERE id = ?', [id]);
      if (String(error.message).includes('UNIQUE')) return json({ error: 'Esse @usuário já está em uso.', field: 'handle' }, 409);
      throw error;
    }
    const token = await startSession(ctx.db, id);
    await touchUserPresence(ctx.db, id);
    ctx.log('account_registered', { userId: id });
    return json({ user: { id, name, email, createdAt } }, 201, { 'Set-Cookie': sessionCookie(token, cookieOptions(ctx.url)) });
  });

  router.add('POST', '/api/login', { origin: true, rateLimit: ATTEMPTS }, async (ctx) => {
    const body = await ctx.json(LIMITS.body);
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const row = email ? await ctx.db.first('SELECT * FROM users WHERE email = ?', [email]) : null;
    const valid = row ? await verifyPassword(password, row.password_hash) : false;
    if (!valid) {
      ctx.log('login_failed', {});
      return json({ error: 'E-mail ou senha não conferem.' }, 401);
    }
    const token = await startSession(ctx.db, row.id);
    await touchUserPresence(ctx.db, row.id);
    ctx.log('login_succeeded', { userId: row.id });
    return json({ user: publicUser(row) }, 200, { 'Set-Cookie': sessionCookie(token, cookieOptions(ctx.url)) });
  });

  router.add('POST', '/api/logout', { origin: true }, async (ctx) => {
    const token = sessionTokenFrom(ctx.request);
    if (token) {
      const tokenHash = await hashSessionToken(token);
      const session = await ctx.db.first('SELECT user_id FROM sessions WHERE token_hash = ?', [tokenHash]);
      await ctx.db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
      if (session?.user_id) await clearUserPresence(ctx.db, session.user_id);
    }
    return empty(204, { 'Set-Cookie': clearedSessionCookie(cookieOptions(ctx.url)) });
  });

  router.add('POST', '/api/password/request', { origin: true, rateLimit: ATTEMPTS }, async (ctx) => {
    const body = await ctx.json(LIMITS.body);
    const email = normalizeEmail(body.email);
    if (!email) return json({ error: 'Escreva o e-mail da sua conta.', field: 'email' }, 400);

    const answer = { message: 'Se este e-mail tiver uma conta no Lume, um link de recuperação foi gerado. Ele vale por 30 minutos.' };
    const row = await ctx.db.first('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (!row) return json(answer);

    const { token, tokenHash } = await createSessionToken();
    const now = Date.now();
    await ctx.db.batch([
      ['DELETE FROM password_resets WHERE user_id = ?', [row.id]],
      ['INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
        [tokenHash, row.id, new Date(now).toISOString(), new Date(now + RESET_TTL_MS).toISOString()]],
    ]);

    const link = `${ctx.url.origin}/#redefinir?token=${token}`;
    let emailResult = { sent: false, reason: 'not_configured' };
    try {
      emailResult = await sendPasswordResetEmail({ to: row.email, link, name: row.name }, { env: ctx.env });
    } catch (error) {
      ctx.log('password_reset_email_failed', { userId: row.id, error: error.message, detail: error.detail });
    }
    // Sem transporte de e-mail, o link vai para o log (visível só para quem
    // opera o servidor). Com e-mail configurado, ele não é gravado em lugar algum.
    if (!emailResult.sent) ctx.log('password_reset_link', { userId: row.id, link });
    ctx.log('password_reset_requested', { userId: row.id, emailSent: emailResult.sent });
    if (!emailResult.sent && ctx.config.showResetLink) answer.resetUrl = link;
    return json(answer);
  });

  router.add('POST', '/api/password/reset', { origin: true, rateLimit: ATTEMPTS }, async (ctx) => {
    const body = await ctx.json(LIMITS.body);
    const token = typeof body.token === 'string' ? body.token : '';
    const password = validatePassword(body.password);
    if (!token) return json({ error: 'Este link de recuperação está incompleto. Peça um novo.' }, 400);

    const tokenHash = await hashSessionToken(token);
    const reset = await ctx.db.first('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?', [tokenHash]);
    if (!reset || reset.used_at) return json({ error: 'Este link não é mais válido. Peça uma nova recuperação.' }, 400);
    if (Date.parse(reset.expires_at) <= Date.now()) return json({ error: 'Este link expirou. Peça uma nova recuperação.' }, 400);

    const passwordHash = await hashPassword(password, ctx.config.bcryptRounds);
    await ctx.db.batch([
      ['UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, reset.user_id]],
      ['UPDATE password_resets SET used_at = ? WHERE token_hash = ?', [new Date().toISOString(), tokenHash]],
      ['DELETE FROM sessions WHERE user_id = ?', [reset.user_id]],
    ]);
    ctx.log('password_reset_completed', { userId: reset.user_id });
    return json({ message: 'Senha alterada. Você já pode entrar com a nova senha.' });
  });
}
