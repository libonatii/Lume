// Documento de estado, importação de cursos e leitura de repositórios do GitHub.

import { analyzeRepository } from '../domain/github.js';
import { ImportError, analyzeSnapshot, analyzeText, analyzeUrl } from '../domain/import-server.js';
import { detectProvider, normalizePayload } from '../../public/import-domain.js';
import { parseStateBody, readState, writeState } from '../domain/state.js';
import { LIMITS } from '../config.js';
import { json } from '../http.js';
import { readLibrary } from '../domain/library-store.js';
import { applyLibraryActions } from '../domain/library-actions.js';
import { ensureXpSettings } from '../domain/xp.js';
import { claimReminders } from '../domain/agenda.js';

const IMPORT_BODY = {
  tooLarge: () => new ImportError('O conteúdo enviado é grande demais.', 'too_large', 413),
  invalid: () => new ImportError('JSON inválido.', 'invalid_json', 400),
};
const IMPORT_ATTEMPTS = {
  key: (ctx) => `import|${ctx.clientIp}|${ctx.url.pathname}`,
  limit: 30,
  message: 'Muitas análises em pouco tempo. Aguarde alguns minutos.',
  code: 'rate_limited',
};

export function libraryRoutes(router) {
  const account = { auth: 'Entre na sua conta para acessar sua biblioteca.', origin: true };
  router.add('GET', '/api/library', account, async (ctx) => {
    await ensureXpSettings(ctx.db, ctx.user.id);
    return json(await readLibrary(ctx.db, ctx.user.id));
  });
  router.add('POST', '/api/library/actions', account, async (ctx) => json(await applyLibraryActions(ctx.db, ctx.user.id, await ctx.json(3 * 1024 * 1024))));
  router.add('POST', '/api/agenda/reminders', account, async (ctx) => json({ reminders: await claimReminders(ctx.db, ctx.user.id) }));
  router.add('GET', '/api/state', { auth: 'Entre na sua conta para ver seu progresso.', origin: true }, async (ctx) =>
    json(await readState(ctx.db, ctx.user.id)));

  router.add('PUT', '/api/state', { auth: 'Entre na sua conta para salvar seu progresso.', origin: true }, async (ctx) => {
    const body = parseStateBody(await ctx.text(LIMITS.state));
    const result = await writeState(ctx.db, ctx.user.id, body);
    if (result.conflict) {
      return json({
        error: 'Outro dispositivo salvou uma versão mais nova. O Lume vai mesclar as duas cópias.',
        code: 'state_conflict',
        ...result.current,
      }, 409);
    }
    ctx.log('state_saved', { userId: ctx.user.id, bytes: body.text.length, revision: result.revision });
    return json({ saved: true, updatedAt: result.updatedAt, revision: result.revision });
  });

  router.add('POST', '/api/import/analyze', { origin: true, rateLimit: IMPORT_ATTEMPTS }, async (ctx) => {
    const body = await ctx.json(LIMITS.import, IMPORT_BODY);
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    // `html` é a página que a pessoa copiou já logada. Nesse caso não há busca
    // externa: o conteúdo dela é lido como dado e nada da sessão é enviado.
    const html = typeof body.html === 'string' ? body.html : '';
    if (!url && !html) return json({ error: 'Cole o link do curso para analisar.', code: 'missing_url' }, 400);
    const analysis = html ? analyzeSnapshot(html, url) : await analyzeUrl(url, { lookup: ctx.lookup });
    const payload = normalizePayload(analysis, { sourceUrl: analysis.sourceUrl || url });
    ctx.log('course_analyzed', { provider: payload.provider.id, lessons: payload.lessonCount });
    return json({ status: 'ok', payload, ai: { used: false, reason: 'not_requested' } });
  });

  router.add('POST', '/api/import/organize', { origin: true, rateLimit: IMPORT_ATTEMPTS }, async (ctx) => {
    const body = await ctx.json(LIMITS.import, IMPORT_BODY);
    const text = typeof body.text === 'string' ? body.text : '';
    const title = typeof body.title === 'string' ? body.title : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!text.trim()) return json({ error: 'Cole a grade do curso para organizar.', code: 'empty_text' }, 400);
    const { payload: raw, ai } = await analyzeText(text, { title, env: ctx.env });
    const payload = normalizePayload(
      { ...raw, provider: { id: url ? detectProvider(url).id : 'unknown' }, sourceUrl: url },
      { sourceUrl: url },
    );
    ctx.log('course_organized', { provider: payload.provider.id, lessons: payload.lessonCount, ai: ai.used });
    return json({ status: 'ok', payload, ai: { used: ai.used, reason: ai.reason || null } });
  });

  router.add('POST', '/api/github/analyze', {
    auth: 'Entre na sua conta para analisar um repositório.', origin: true, rateLimit: IMPORT_ATTEMPTS,
  }, async (ctx) => {
    const body = await ctx.json(LIMITS.small, IMPORT_BODY);
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return json({ error: 'Cole o link de um repositório público do GitHub.', code: 'missing_url' }, 400);
    const analysis = await analyzeRepository(url, { token: ctx.config.githubToken });
    ctx.log('github_analyzed', { userId: ctx.user.id, repository: analysis.repository?.fullName });
    return json(analysis);
  });
}

