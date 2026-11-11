// Documento de estado, importação de cursos e leitura de repositórios do GitHub.

import { analyzeRepository } from '../domain/github.js';
import { ImportError, analyzeSnapshot, analyzeText, analyzeUrl } from '../domain/import-server.js';
import { detectProvider, normalizePayload } from '../../public/import-domain.js';
import { parseStateBody, readState, writeState } from '../domain/state.js';
import { LIMITS } from '../config.js';
import { BASE_HEADERS, json } from '../http.js';
import { readLibrary } from '../domain/library-store.js';
import { applyLibraryActions } from '../domain/library-actions.js';
import { ensureXpSettings } from '../domain/xp.js';
import { claimReminders } from '../domain/agenda.js';
import {
  AI_TEXT_LIMIT, FileError, aiAvailable, discardPdf, identifyWithAI, readPdf, storagePlan, storageUsage, uploadPdf, validateFileId,
} from '../domain/library-files.js';
import { formatBytes } from '../../public/pdf-domain.js';

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
const FILE_ATTEMPTS = {
  key: (ctx) => `pdf|${ctx.user?.id || ctx.clientIp}`,
  limit: 30,
  message: 'Muitos envios de PDF em pouco tempo. Aguarde alguns minutos.',
  code: 'rate_limited',
};

export function libraryRoutes(router) {
  const account = { auth: 'Entre na sua conta para acessar sua biblioteca.', origin: true };
  router.add('GET', '/api/library', account, async (ctx) => {
    await ensureXpSettings(ctx.db, ctx.user.id);
    return json(await readLibrary(ctx.db, ctx.user.id));
  });
  router.add('POST', '/api/library/actions', account, async (ctx) => json(await applyLibraryActions(ctx.db, ctx.user.id, await ctx.json(3 * 1024 * 1024), { media: ctx.media })));

  // PDFs da biblioteca: privados da conta, sem cópia local nem leitura pública.
  router.add('GET', '/api/library/files', account, async (ctx) => json({ ...await storageUsage(ctx.db, ctx.user.id), ai: aiAvailable(ctx.env), storage: Boolean(ctx.media) }));
  router.add('PUT', '/api/library/files/:fileId', { ...account, rateLimit: FILE_ATTEMPTS }, async (ctx) => {
    const fileId = validateFileId(ctx.params.fileId);
    const plan = await storagePlan(ctx.db, ctx.user.id);
    const tooLarge = () => new FileError(`O PDF ultrapassa o limite de ${formatBytes(plan.fileBytes)} por arquivo.`, 'file_too_large', 413);
    const declared = Number(ctx.request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > plan.fileBytes) throw tooLarge();
    const bytes = await ctx.bytes(plan.fileBytes, tooLarge);
    let name = '';
    try { name = decodeURIComponent(ctx.request.headers.get('x-file-name') || ''); } catch { name = ''; }
    const file = await uploadPdf(ctx.db, ctx.media, ctx.user.id, { fileId, name, bytes });
    ctx.log('pdf_uploaded', { userId: ctx.user.id, bytes: file.size });
    return json(file, 201);
  });
  router.add('GET', '/api/library/files/:fileId', account, async (ctx) => {
    const object = await readPdf(ctx.db, ctx.media, ctx.user.id, ctx.params.fileId);
    return new Response(object.body, {
      status: 200,
      headers: { ...BASE_HEADERS, 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' },
    });
  });
  router.add('DELETE', '/api/library/files/:fileId', account, async (ctx) => json(await discardPdf(ctx.db, ctx.media, ctx.user.id, ctx.params.fileId)));
  router.add('POST', '/api/library/identify', { ...account, rateLimit: { ...FILE_ATTEMPTS, key: (ctx) => `identify|${ctx.user?.id || ctx.clientIp}`, message: 'Muitas identificações em pouco tempo. Aguarde alguns minutos.' } }, async (ctx) => {
    const body = await ctx.json(AI_TEXT_LIMIT * 4 + 8 * 1024);
    return json(await identifyWithAI({ text: body.text, subjects: body.subjects }, { env: ctx.env }));
  });
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

