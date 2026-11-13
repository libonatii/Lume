import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { sqliteAdapter, applyMigrations } from '../../api/adapters/sqlite.js';
import { readLibrary } from '../../api/domain/library-store.js';
import { applyLibraryActions } from '../../api/domain/library-actions.js';
import { discardPdf, identifyWithAI, isPdf, readPdf, removeOrphans, storageUsage, uploadPdf } from '../../api/domain/library-files.js';
import { getXpSnapshot, ensureXpSettings } from '../../api/domain/xp.js';
import { libraryActions } from '../../public/library-actions.js';
import { addCourse, completeMission, createInitialState, deleteCourse, restoreState, materialType } from '../../public/domain.js';
import { materialSteps } from '../../public/material-model.js';
import {
  MAX_HIGHLIGHTS, PDF_PLANS, addHighlight, addPdfMaterial, highlightAt, identifyPage, linesFromItems, mergeRects, normalizePdfMeta,
  pageHeading, pageKeywords, readingLabel, recolorHighlight, removeHighlight, scoreSubjects, sectionAt, sectionsCovered, setReadingPage, suggestSubject,
} from '../../public/pdf-domain.js';
import { addSubject, deleteSubject, linkMaterialSubject, materialStanding, subjectOverview, updateSubject } from '../../public/subject-domain.js';
import { nextAction } from '../../public/study-plan.js';
import { completionKindForCourse } from '../../public/xp-policy.js';

const OUTLINE = [
  { title: 'Parte I — Inquérito', page: 1, depth: 0 },
  { title: 'Notitia criminis', page: 3, depth: 1 },
  { title: 'Parte II — Ação penal', page: 10, depth: 0 },
  { title: 'Ação penal pública', page: 12, depth: 1 },
];
const FILE = { fileId: 'arquivo-penal-1', name: 'apostila-penal.pdf', size: 2048, pages: 20, outline: OUTLINE, uploadedAt: '2026-11-10T10:00:00.000Z' };
const PDF_BYTES = new TextEncoder().encode(`%PDF-1.7\n${'x'.repeat(200)}\n%%EOF`);

function memoryBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, bytes, contentType) { objects.set(key, { body: bytes, contentType }); },
    async get(key) { return objects.get(key) || null; },
    async delete(key) { objects.delete(key); },
    async listKeys(prefix) { return [...objects.keys()].filter((key) => key.startsWith(prefix)); },
  };
}

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  applyMigrations(sqlite, fileURLToPath(new URL('../../migrations/', import.meta.url)));
  const db = sqliteAdapter(sqlite);
  sqlite.prepare('INSERT INTO users(id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)').run('u1', 'Teste', 'u1@example.test', 'x', '2026-01-01');
  return { db, sqlite, bucket: memoryBucket() };
}

async function save(db, current, next, id, media) {
  return applyLibraryActions(db, 'u1', { id, revision: current.revision, actions: libraryActions(current.state, next) }, { media });
}

test('PDF anexado vira material de uma etapa de leitura, com disciplina e retomada por página', () => {
  let state = addSubject(createInitialState(), { title: 'Direito Penal', keywords: 'inquérito, ação penal' }, 'penal');
  state = addPdfMaterial(state, { title: '', file: FILE, subjectId: 'penal' }, 'pdf1');
  const course = state.courses[0];
  assert.equal(course.type, 'pdf');
  assert.equal(course.title, 'apostila-penal');
  assert.equal(materialType(course.type).title, 'PDF');
  assert.equal(completionKindForCourse(course), 'reading');
  assert.equal(materialSteps(course).length, 1);
  assert.equal(course.subjectId, 'penal');
  assert.throws(() => addPdfMaterial(state, { file: FILE }), /já está na biblioteca/);
  assert.throws(() => addPdfMaterial(state, { file: { ...FILE, fileId: 'x' } }), /não pôde ser lido/);

  state = setReadingPage(state, 'pdf1', { page: 13, section: 'Ação penal pública' }, '2026-11-10T11:00:00.000Z');
  assert.deepEqual(state.courses[0].reading, { page: 13, maxPage: 13, section: 'Ação penal pública', updatedAt: '2026-11-10T11:00:00.000Z' });
  assert.equal(state.courses[0].resumeAt, 'p. 13 de 20 · Ação penal pública');
  const same = setReadingPage(state, 'pdf1', { page: 13, section: 'Ação penal pública' });
  assert.equal(same, state, 'mesma página não gera nova gravação');
  state = setReadingPage(state, 'pdf1', { page: 4, section: '' });
  assert.equal(state.courses[0].reading.maxPage, 13, 'voltar páginas não reduz o ponto mais adiante');
  assert.equal(setReadingPage(state, 'pdf1', { page: 99 }).courses[0].reading.page, 20);

  const restored = restoreState(JSON.stringify(state));
  assert.equal(restored.courses[0].reading.page, 4);
  assert.equal(restored.courses[0].pdf.outline.length, 4);
  assert.equal(restored.subjects[0].title, 'Direito Penal');
  assert.deepEqual(restored.subjects[0].keywords, ['inquérito', 'ação penal']);
});

test('restauração descarta vínculo com disciplina inexistente e PDF sem metadados válidos', () => {
  const state = addPdfMaterial(createInitialState(), { file: FILE }, 'pdf1');
  const broken = { ...state, courses: [{ ...state.courses[0], subjectId: 'sumiu', reading: { page: 999 } }] };
  const restored = restoreState(JSON.stringify(broken));
  assert.equal(restored.courses[0].subjectId, '');
  assert.equal(restored.courses[0].reading, null);
  assert.equal(normalizePdfMeta({ ...FILE, pages: 0 }), null);
  const invalid = restoreState(JSON.stringify({ ...state, courses: [{ ...state.courses[0], pdf: { fileId: '?' } }] }));
  assert.notEqual(invalid.courses[0].type, 'pdf');
});

test('abrir o PDF na primeira página não conta como leitura iniciada', () => {
  let state = addPdfMaterial(createInitialState(), { file: { ...FILE, pages: 3 } }, 'pdf1');
  assert.equal(setReadingPage(state, 'pdf1', { page: 1 }), state, 'o leitor abre sozinho depois de anexar e não grava a p. 1');
  const course = state.courses[0];
  assert.equal(materialStanding(state, course).percent, 0);
  assert.equal(materialStanding(state, course).label, '3 páginas · não iniciado');

  // Registro antigo gravado só por abrir o leitor volta a "não iniciado".
  const legacy = restoreState(JSON.stringify({ ...state, courses: [{ ...course, reading: { page: 1, maxPage: 1, section: '', updatedAt: '2026-11-11T10:00:00.000Z' } }] }));
  assert.equal(legacy.courses[0].reading, null);
  assert.equal(materialStanding(legacy, legacy.courses[0]).percent, 0);
  assert.equal(nextAction(legacy).pdf.started, false);

  state = setReadingPage(state, 'pdf1', { page: 2 }, '2026-11-12T10:00:00.000Z');
  state = setReadingPage(state, 'pdf1', { page: 1 }, '2026-11-12T10:05:00.000Z');
  assert.deepEqual(state.courses[0].reading, { page: 1, maxPage: 2, section: '', updatedAt: '2026-11-12T10:05:00.000Z' }, 'voltar à p. 1 depois de avançar mantém a retomada');
  assert.equal(restoreState(JSON.stringify(state)).courses[0].reading.maxPage, 2);
  assert.equal(materialStanding(state, state.courses[0]).percent, 67);
});

test('marca-texto: marcações por página, várias cores, troca de cor e remoção', () => {
  let state = addPdfMaterial(createInitialState(), { file: FILE }, 'pdf1');
  assert.deepEqual(state.courses[0].highlights, []);
  const rects = [{ x: 0.1, y: 0.2, w: 0.2, h: 0.02 }, { x: 0.29, y: 0.2, w: 0.3, h: 0.021 }, { x: 0.1, y: 0.23, w: 0.4, h: 0.02 }];
  state = addHighlight(state, 'pdf1', { page: 3, color: 'verde', rects, text: '  Notitia   criminis ' }, 'h1', '2026-11-12T10:00:00.000Z');
  const [mark] = state.courses[0].highlights;
  assert.equal(mark.color, 'verde');
  assert.equal(mark.text, 'Notitia criminis');
  assert.equal(mark.rects.length, 2, 'trechos da mesma linha viram um retângulo');
  assert.deepEqual(mark.rects[0], { x: 0.1, y: 0.2, w: 0.49, h: 0.021 });
  assert.equal(highlightAt(state.courses[0].highlights, 3, { x: 0.3, y: 0.21 })?.id, 'h1');
  assert.equal(highlightAt(state.courses[0].highlights, 4, { x: 0.3, y: 0.21 }), null);

  state = addHighlight(state, 'pdf1', { page: 3, color: 'cor-inventada', rects: [{ x: 0.5, y: 0.5, w: 0.1, h: 0.02 }] }, 'h2');
  assert.equal(state.courses[0].highlights[1].color, 'amarelo', 'cor desconhecida usa a primeira');
  assert.throws(() => addHighlight(state, 'pdf1', { page: 3, color: 'azul', rects: [] }), /Selecione um trecho/);
  assert.throws(() => addHighlight(state, 'pdf1', { page: 99, color: 'azul', rects }), /Selecione um trecho/);
  assert.deepEqual(mergeRects([{ x: -0.1, y: 0.9, w: 0.3, h: 0.2 }]), [{ x: 0, y: 0.9, w: 0.2, h: 0.1 }], 'recorta à página');

  state = recolorHighlight(state, 'pdf1', 'h1', 'rosa');
  assert.equal(state.courses[0].highlights[0].color, 'rosa');
  assert.equal(recolorHighlight(state, 'pdf1', 'h1', 'rosa'), state, 'mesma cor não grava');
  assert.throws(() => recolorHighlight(state, 'pdf1', 'h1', 'roxo'), /desconhecida/);
  state = removeHighlight(state, 'pdf1', 'h2');
  assert.deepEqual(state.courses[0].highlights.map((item) => item.id), ['h1']);
  assert.equal(removeHighlight(state, 'pdf1', 'nao-existe'), state);

  const restored = restoreState(JSON.stringify({ ...state, courses: [{ ...state.courses[0], highlights: [...state.courses[0].highlights, { id: 'ruim', page: 3, rects: [{ x: 2, y: 0, w: 1, h: 1 }] }] }] }));
  assert.deepEqual(restored.courses[0].highlights.map((item) => item.id), ['h1'], 'marcação inválida é descartada');
  const full = { ...state, courses: [{ ...state.courses[0], highlights: Array.from({ length: MAX_HIGHLIGHTS }, (_, index) => ({ ...mark, id: `m${index}` })) }] };
  assert.throws(() => addHighlight(full, 'pdf1', { page: 3, color: 'azul', rects }), /marcações/);
});

test('disciplinas: nome único, exclusão só desfaz vínculos e visão mostra retomada e seções', () => {
  let state = addSubject(createInitialState(), { title: 'Direito Penal' }, 'penal');
  assert.throws(() => addSubject(state, { title: 'direito penal' }), /Já existe/);
  state = addCourse(state, { title: 'Videoaulas', steps: ['Aula 1', 'Aula 2'] }, 'videos');
  state = addPdfMaterial(state, { file: FILE, subjectId: 'penal' }, 'pdf1');
  state = addPdfMaterial(state, { file: { ...FILE, fileId: 'arquivo-penal-2', name: 'resumo.pdf' }, subjectId: 'penal' }, 'pdf2');
  state = linkMaterialSubject(state, 'videos', 'penal');
  assert.throws(() => linkMaterialSubject(state, 'videos', 'nao-existe'), /não encontrada/);
  state = setReadingPage(state, 'pdf1', { page: 11, section: 'Parte II — Ação penal' }, '2026-11-10T09:00:00.000Z');
  state = setReadingPage(state, 'pdf2', { page: 2 }, '2026-11-10T12:00:00.000Z');
  state = completeMission(state, 'videos', 'videos-0', { now: '2026-11-10T08:00:00.000Z' }).state;

  let overview = subjectOverview(state, 'penal');
  assert.equal(overview.total, 3);
  assert.equal(overview.resume.course.id, 'pdf2', 'retoma o material tocado por último');
  assert.equal(overview.pagesTotal, 40);
  assert.equal(overview.pagesReached, 13);
  assert.deepEqual(overview.materials.find((item) => item.course.id === 'pdf1').sections, ['Parte I — Inquérito', 'Parte II — Ação penal']);
  assert.equal(materialStanding(state, state.courses.find((item) => item.id === 'videos')).label, '1 de 2 etapas');

  state = completeMission(state, 'pdf2', 'pdf2-0').state;
  overview = subjectOverview(state, 'penal');
  assert.equal(overview.done, 1);
  assert.equal(overview.resume.course.id, 'pdf1');

  state = updateSubject(state, 'penal', { title: 'Processo Penal', keywords: 'inquérito' });
  assert.equal(state.subjects[0].title, 'Processo Penal');
  state = deleteSubject(state, 'penal');
  assert.equal(state.subjects.length, 0);
  assert.equal(state.courses.length, 3, 'materiais continuam na biblioteca');
  assert.ok(state.courses.every((course) => course.subjectId === ''));
  assert.equal(state.progress.length, 2, 'progresso preservado');
});

test('leitor inteligente: seção pelo sumário, título da página, termos e disciplina pelo texto', () => {
  assert.deepEqual(sectionAt(OUTLINE, 13).path, ['Parte II — Ação penal', 'Ação penal pública']);
  assert.equal(sectionAt(OUTLINE, 5).title, 'Notitia criminis');
  assert.equal(sectionAt([], 5), null);
  assert.deepEqual(sectionsCovered(OUTLINE, 9), ['Parte I — Inquérito']);

  const lines = linesFromItems([
    { str: 'Prisão preventiva', transform: [18, 0, 0, 18, 72, 700] },
    { str: 'A prisão preventiva exige', transform: [11, 0, 0, 11, 72, 650] },
    { str: 'fundamentação concreta.', transform: [11, 0, 0, 11, 220, 650] },
    { str: 'O juiz decreta a prisão preventiva', transform: [11, 0, 0, 11, 72, 630] },
    { str: 'quando há risco à instrução.', transform: [11, 0, 0, 11, 72, 610] },
  ]);
  assert.equal(lines.length, 4);
  assert.equal(lines[1].text, 'A prisão preventiva exige fundamentação concreta.');
  assert.equal(pageHeading(lines), 'Prisão preventiva');
  const text = lines.map((line) => line.text).join('\n');
  assert.deepEqual(pageKeywords(text).slice(0, 2), ['prisão', 'preventiva']);

  const subjects = [
    { id: 'penal', title: 'Processo Penal', keywords: ['prisão preventiva', 'inquérito'] },
    { id: 'civil', title: 'Direito Civil', keywords: ['contrato'] },
  ];
  assert.equal(scoreSubjects(subjects, text)[0].subject.id, 'penal');
  assert.equal(scoreSubjects(subjects, 'contrato de compra e venda').length, 1);
  assert.equal(suggestSubject(subjects, { name: 'Direito_Civil_contratos.pdf' }).subject.id, 'civil');
  assert.equal(suggestSubject(subjects, { name: 'receitas.pdf', text: 'bolo de cenoura' }), null);

  const linked = identifyPage({ subjects, subject: subjects[1], outline: OUTLINE, page: 13, text, lines });
  assert.equal(linked.subject.source, 'link');
  assert.equal(linked.section.source, 'outline');
  assert.equal(linked.elsewhere.subject.id, 'penal', 'avisa quando a página fala de outra disciplina');
  const guessed = identifyPage({ subjects, subject: null, outline: [], page: 1, text, lines });
  assert.equal(guessed.subject.source, 'text');
  assert.equal(guessed.section.title, 'Prisão preventiva');
  assert.equal(identifyPage({ subjects, page: 1, text: '' }).empty, true);
});

test('Hoje sugere continuar o PDF na página salva', () => {
  let state = addPdfMaterial({ ...createInitialState(), onboarded: true }, { file: FILE }, 'pdf1');
  state = setReadingPage(state, 'pdf1', { page: 7, section: 'Notitia criminis' }, new Date().toISOString());
  const action = nextAction(state);
  assert.equal(action.courseId, 'pdf1');
  assert.deepEqual(action.pdf, { page: 7, pages: 20, section: 'Notitia criminis', started: true });
  assert.equal(action.reason.id, 'continuity');
  assert.equal(readingLabel(state.courses[0].reading, 20), 'p. 7 de 20 · Notitia criminis');
});

test('envio de PDF: cabeçalho, limite por arquivo, cota reservada e órfãos', async (t) => {
  const { db, sqlite, bucket } = fixture(t);
  assert.equal(isPdf(PDF_BYTES), true);
  assert.equal(isPdf(new TextEncoder().encode('não é pdf'.repeat(20))), false);
  await assert.rejects(uploadPdf(db, bucket, 'u1', { fileId: 'arquivo-1234', bytes: new TextEncoder().encode('x'.repeat(100)) }), { code: 'not_pdf' });
  await assert.rejects(uploadPdf(db, null, 'u1', { fileId: 'arquivo-1234', bytes: PDF_BYTES }), { code: 'storage_unavailable' });

  const sent = await uploadPdf(db, bucket, 'u1', { fileId: 'arquivo-1234', name: 'a.pdf', bytes: PDF_BYTES });
  assert.equal(sent.size, PDF_BYTES.byteLength);
  assert.ok(bucket.objects.has('pdfs/u1/arquivo-1234.pdf'));
  await assert.rejects(uploadPdf(db, bucket, 'u1', { fileId: 'arquivo-1234', bytes: PDF_BYTES }), { code: 'file_exists' });
  assert.equal((await readPdf(db, bucket, 'u1', 'arquivo-1234')).contentType, 'application/pdf');
  await assert.rejects(readPdf(db, bucket, 'u1', 'arquivo-9999'), { code: 'file_not_found' });

  let usage = await storageUsage(db, 'u1');
  assert.equal(usage.plan, 'free');
  assert.equal(usage.fileBytes, PDF_PLANS.free.fileBytes);
  assert.equal(usage.accountBytes, PDF_PLANS.free.accountBytes);
  assert.equal(usage.used, PDF_BYTES.byteLength);

  // Cota cheia: simula o restante do gigabyte ocupado por outro arquivo.
  sqlite.prepare('INSERT INTO library_files (user_id,id,size,name,created_at) VALUES (?,?,?,?,?)').run('u1', 'ocupado-1234', PDF_PLANS.free.accountBytes - PDF_BYTES.byteLength, 'grande.pdf', new Date().toISOString());
  await assert.rejects(uploadPdf(db, bucket, 'u1', { fileId: 'arquivo-5678', bytes: PDF_BYTES }), { code: 'storage_full' });
  sqlite.prepare("INSERT INTO storage_plans (user_id,plan,updated_at) VALUES ('u1','plus',?)").run(new Date().toISOString());
  usage = await storageUsage(db, 'u1');
  assert.equal(usage.accountBytes, PDF_PLANS.plus.accountBytes);
  await uploadPdf(db, bucket, 'u1', { fileId: 'arquivo-5678', bytes: PDF_BYTES });

  // Sem material vinculado, o envio vira órfão: sai na hora quando a interface
  // desiste e, nos demais, depois de uma hora.
  assert.deepEqual(await discardPdf(db, bucket, 'u1', 'arquivo-5678'), { deleted: true });
  assert.equal(bucket.objects.has('pdfs/u1/arquivo-5678.pdf'), false);
  const removed = await removeOrphans(db, bucket, 'u1', { now: Date.now() + 2 * 60 * 60 * 1000 });
  assert.deepEqual(removed.sort(), ['arquivo-1234', 'ocupado-1234']);
  assert.equal((await storageUsage(db, 'u1')).used, 0);
});

test('biblioteca aceita PDF enviado, concede 100 XP de leitura uma vez e libera o arquivo ao excluir', async (t) => {
  const { db, bucket } = fixture(t);
  await ensureXpSettings(db, 'u1', { now: Date.now() - 1000 });
  let current = await readLibrary(db, 'u1');
  const subjectState = addSubject(current.state, { title: 'Direito Penal' }, 'penal');
  const missing = addPdfMaterial(subjectState, { file: FILE, subjectId: 'penal' }, 'pdf1');
  await assert.rejects(save(db, current, missing, 'sem-arquivo', bucket), /PDF não foi encontrado/);

  await uploadPdf(db, bucket, 'u1', { fileId: FILE.fileId, name: FILE.name, bytes: PDF_BYTES });
  current = await save(db, current, missing, 'com-arquivo', bucket);
  assert.equal(current.state.subjects[0].title, 'Direito Penal');
  assert.equal(current.state.courses[0].pdf.fileId, FILE.fileId);

  // Virar página só grava a retomada; não há XP.
  current = await save(db, current, setReadingPage(current.state, 'pdf1', { page: 12, section: 'Ação penal pública' }), 'pagina', bucket);
  assert.equal(current.state.courses[0].reading.page, 12);
  current = await save(db, current, addHighlight(current.state, 'pdf1', { page: 12, color: 'azul', rects: [{ x: 0.1, y: 0.1, w: 0.5, h: 0.02 }], text: 'Ação penal' }, 'h1'), 'marca', bucket);
  assert.deepEqual((await readLibrary(db, 'u1')).state.courses[0].highlights.map((item) => [item.id, item.color, item.page]), [['h1', 'azul', 12]]);
  assert.equal((await getXpSnapshot(db, 'u1')).summary.totalXP, 0, 'virar páginas e marcar texto não geram XP');

  // Trocar o arquivo ou apontar para disciplina inexistente é recusado.
  const swapped = { ...current.state, courses: [{ ...current.state.courses[0], pdf: { ...current.state.courses[0].pdf, fileId: 'outro-arquivo' } }] };
  await assert.rejects(save(db, current, swapped, 'troca', bucket), /não pode ser trocado/);
  const orphanLink = { ...current.state, courses: [{ ...current.state.courses[0], subjectId: 'nao-existe' }] };
  await assert.rejects(save(db, current, orphanLink, 'vinculo', bucket), /disciplina vinculada não existe/);

  current = await save(db, current, completeMission(current.state, 'pdf1', 'pdf1-0').state, 'concluir', bucket);
  let snapshot = await getXpSnapshot(db, 'u1');
  assert.equal(snapshot.summary.totalXP, 100);
  assert.deepEqual(snapshot.events.map((event) => event.kind), ['reading']);
  assert.equal(snapshot.achievements[0].criterion, 'Leitura delimitada concluída');

  current = await save(db, current, deleteCourse(current.state, 'pdf1'), 'excluir', bucket);
  assert.equal(current.state.courses.length, 0);
  assert.equal(current.state.subjects.length, 1, 'a disciplina continua');
  assert.equal(bucket.objects.size, 0);
  assert.equal((await storageUsage(db, 'u1')).used, 0);
  snapshot = await getXpSnapshot(db, 'u1');
  assert.equal(snapshot.summary.totalXP, 100, 'excluir não apaga o livro de XP');
});

test('identificação por IA só existe com chave e envia apenas o trecho da página', async () => {
  await assert.rejects(identifyWithAI({ text: 'texto', subjects: [] }, { env: {} }), { code: 'ai_unavailable' });
  let sent = null;
  const fetchImpl = async (url, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ subject: 'Direito Penal', topic: 'Prisão preventiva', keywords: ['prisão', 'cautelar', 7] }) } }] }) };
  };
  const result = await identifyWithAI({ text: 'a'.repeat(9000), subjects: ['Direito Penal', 'Direito Civil'] }, { env: { LUME_AI_API_KEY: 'chave-de-teste' }, fetchImpl });
  assert.deepEqual(result, { subject: 'Direito Penal', topic: 'Prisão preventiva', keywords: ['prisão', 'cautelar'], source: 'ai' });
  const user = sent.messages[1].content;
  assert.ok(user.length < 4200, 'trecho limitado a 4.000 caracteres');
  assert.match(user, /Direito Civil/);
  const unknown = await identifyWithAI({ text: 'texto', subjects: ['Direito Civil'] }, { env: { LUME_AI_API_KEY: 'chave' }, fetchImpl });
  assert.equal(unknown.subject, '', 'disciplina que a pessoa não tem não é sugerida');
  await assert.rejects(identifyWithAI({ text: '   ', subjects: [] }, { env: { LUME_AI_API_KEY: 'chave' }, fetchImpl }), { code: 'empty_text' });
});
