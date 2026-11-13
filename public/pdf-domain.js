// PDFs anexados à biblioteca e o leitor inteligente determinístico.
//
// O arquivo fica guardado só no servidor (R2 no Worker, data/media no Node),
// privado da conta; o navegador e o aplicativo de desktop leem com conexão,
// sem cópia local nem fila offline (decisão de 10/11/2026). O material guarda
// apenas metadados (páginas, sumário) e o ponto de retomada.
//
// XP: abrir, rolar e virar página não geram XP. O PDF tem uma única etapa,
// "Ler o PDF até o fim"; concluí-la é a leitura delimitada (100 XP, uma vez,
// validada no servidor). Um material de uma etapa não recebe bônus de curso.

import { stepUnits } from './material-model.js';

const MB = 1024 * 1024;
// Plano gratuito: 50 MB por arquivo e 1 GB por conta. Ampliar para 100 MB e
// 2 GB exige assinatura, ainda não disponível (decisão de 10/11/2026).
export const PDF_PLANS = Object.freeze({
  free: Object.freeze({ id: 'free', label: 'Gratuito', fileBytes: 50 * MB, accountBytes: 1024 * MB }),
  plus: Object.freeze({ id: 'plus', label: 'Assinatura', fileBytes: 100 * MB, accountBytes: 2048 * MB }),
});
export const MAX_OUTLINE = 300;
export const MAX_PAGES = 20000;
export const PDF_STEP_TITLE = 'Ler o PDF até o fim';
export const FILE_ID = /^[A-Za-z0-9_-]{8,80}$/;

export function pdfPlan(id) {
  return PDF_PLANS[id] || PDF_PLANS.free;
}

export function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
  if (bytes >= MB) return `${(bytes / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isPage = (value, pages = MAX_PAGES) => Number.isInteger(value) && value >= 1 && value <= pages;

export function normalizeOutline(value, pages = MAX_PAGES) {
  if (!Array.isArray(value)) return [];
  const outline = [];
  for (const item of value) {
    const title = clean(item?.title, 200);
    if (!title || !isPage(item?.page, pages)) continue;
    outline.push({ title, page: item.page, depth: Number.isInteger(item.depth) ? Math.max(0, Math.min(item.depth, 3)) : 0 });
    if (outline.length >= MAX_OUTLINE) break;
  }
  return outline;
}

// Metadados do arquivo enviado. Inválido devolve null e a API recusa o material.
export function normalizePdfMeta(value) {
  if (!value || typeof value !== 'object' || !FILE_ID.test(value.fileId || '')) return null;
  if (!isPage(value.pages) || !Number.isInteger(value.size) || value.size <= 0) return null;
  return {
    fileId: value.fileId,
    name: clean(value.name, 200) || 'documento.pdf',
    size: value.size,
    pages: value.pages,
    outline: normalizeOutline(value.outline, value.pages),
    uploadedAt: Number.isFinite(Date.parse(value.uploadedAt)) ? value.uploadedAt : null,
  };
}

// Abrir o PDF na primeira página não é começar a leitura: o leitor abre sozinho
// logo depois de anexar. Só existe ponto de retomada depois de passar da p. 1;
// registros antigos parados na p. 1 voltam a "não iniciado".
export function normalizeReading(value, pages) {
  if (!value || typeof value !== 'object' || !isPage(value.page, pages)) return null;
  const maxPage = isPage(value.maxPage, pages) ? Math.max(value.maxPage, value.page) : value.page;
  if (maxPage <= 1) return null;
  return {
    page: value.page,
    maxPage,
    section: clean(value.section, 200),
    updatedAt: Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null,
  };
}

export function readingLabel(reading, pages) {
  if (!reading) return '';
  return [`p. ${reading.page}${pages ? ` de ${pages}` : ''}`, reading.section].filter(Boolean).join(' · ');
}

export function addPdfMaterial(state, { title, file, subjectId = '' }, id = crypto.randomUUID()) {
  const pdf = normalizePdfMeta(file);
  if (!pdf) throw new Error('O PDF enviado não pôde ser lido. Tente outro arquivo.');
  const cleanTitle = clean(title, 100) || clean(pdf.name.replace(/\.pdf$/i, ''), 100);
  if (!cleanTitle) throw new Error('Dê um nome ao material.');
  if (subjectId && !(state.subjects || []).some((item) => item.id === subjectId)) throw new Error('Disciplina não encontrada.');
  if ((state.courses || []).some((course) => course.pdf?.fileId === pdf.fileId)) throw new Error('Este arquivo já está na biblioteca.');
  const course = {
    id, title: cleanTitle, url: '', category: 'PDF', art: 'nature',
    example: false, paused: false, type: 'pdf', planning: false, resumeAt: '', position: null,
    origin: 'manual', subjectId: subjectId || '',
    slides: [], slideProgress: { seen: [], lastId: '', completedAt: null },
    pdf, reading: null, highlights: [],
    units: stepUnits([{ id: `${id}-0`, title: PDF_STEP_TITLE }]),
  };
  return { ...state, courses: [...state.courses, course], selectedCourseId: id };
}

// Ponto de retomada por página. Sem mudança devolve o mesmo estado, para não
// gravar de novo. A página mais adiante (maxPage) só cresce. Ficar na p. 1 sem
// ter avançado não cria retomada.
export function setReadingPage(state, materialId, { page, section = '' }, now = new Date().toISOString()) {
  const course = state.courses.find((item) => item.id === materialId);
  if (!course?.pdf) throw new Error('Este material não é um PDF.');
  const target = Math.max(1, Math.min(Math.round(Number(page) || 1), course.pdf.pages));
  const cleanSection = clean(section, 200);
  const previous = course.reading;
  if (!previous && target <= 1) return state;
  if (previous && previous.page === target && previous.section === cleanSection) return state;
  const reading = { page: target, maxPage: Math.max(previous?.maxPage || 0, target), section: cleanSection, updatedAt: now };
  const next = { ...course, reading, resumeAt: readingLabel(reading, course.pdf.pages).slice(0, 120) };
  return { ...state, courses: state.courses.map((item) => item.id === materialId ? next : item) };
}

// ---------------- Marca-texto ----------------
// Marcações ficam no material, por página, com retângulos em fração da página
// (0 a 1) para acompanhar qualquer zoom. Marcar texto não gera XP.

export const HIGHLIGHT_COLORS = Object.freeze([
  Object.freeze({ id: 'amarelo', label: 'Amarelo' }),
  Object.freeze({ id: 'verde', label: 'Verde' }),
  Object.freeze({ id: 'azul', label: 'Azul' }),
  Object.freeze({ id: 'rosa', label: 'Rosa' }),
  Object.freeze({ id: 'laranja', label: 'Laranja' }),
]);
export const MAX_HIGHLIGHTS = 500;
const MAX_RECTS = 40;
const COLOR_IDS = new Set(HIGHLIGHT_COLORS.map((item) => item.id));
const fraction = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
const round = (value) => Math.round(value * 10000) / 10000;

function normalizeRects(value) {
  if (!Array.isArray(value)) return [];
  const rects = [];
  for (const rect of value) {
    const { x, y, w, h } = rect || {};
    if (![x, y, w, h].every(fraction) || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) continue;
    rects.push({ x: round(x), y: round(y), w: round(w), h: round(h) });
    if (rects.length >= MAX_RECTS) break;
  }
  return rects;
}

export function normalizeHighlights(value, pages = MAX_PAGES) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const list = [];
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 80 || seen.has(item.id) || !isPage(item.page, pages)) continue;
    const rects = normalizeRects(item.rects);
    if (!rects.length) continue;
    seen.add(item.id);
    list.push({
      id: item.id,
      page: item.page,
      color: COLOR_IDS.has(item.color) ? item.color : HIGHLIGHT_COLORS[0].id,
      rects,
      text: clean(item.text, 300),
      createdAt: Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : null,
    });
    if (list.length >= MAX_HIGHLIGHTS) break;
  }
  return list;
}

// Recorta à página e junta retângulos da seleção que ficam na mesma linha e se
// tocam; o navegador devolve um por trecho de texto, muitas vezes sobrepostos.
export function mergeRects(rects) {
  const clipped = (rects || []).map((rect) => {
    const x = Math.max(0, Number(rect?.x)), y = Math.max(0, Number(rect?.y));
    return { x, y, w: Math.min(1, Number(rect?.x) + Number(rect?.w)) - x, h: Math.min(1, Number(rect?.y) + Number(rect?.h)) - y };
  });
  const sorted = normalizeRects(clipped).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const rect of sorted) {
    const line = lines.find((item) => Math.abs(item.y - rect.y) <= Math.min(item.h, rect.h) * 0.5
      && rect.x <= item.x + item.w + 0.01 && rect.x + rect.w >= item.x - 0.01);
    if (!line) { lines.push({ ...rect }); continue; }
    const right = Math.max(line.x + line.w, rect.x + rect.w);
    const bottom = Math.max(line.y + line.h, rect.y + rect.h);
    line.x = Math.min(line.x, rect.x);
    line.y = Math.min(line.y, rect.y);
    line.w = right - line.x;
    line.h = bottom - line.y;
  }
  return normalizeRects(lines);
}

function changeHighlights(state, materialId, update) {
  const course = state.courses.find((item) => item.id === materialId);
  if (!course?.pdf) throw new Error('Este material não é um PDF.');
  const current = course.highlights || [];
  const highlights = update(current, course);
  if (highlights === current) return state;
  return { ...state, courses: state.courses.map((item) => item.id === materialId ? { ...course, highlights } : item) };
}

export function addHighlight(state, materialId, { page, color, rects, text = '' }, id = crypto.randomUUID(), now = new Date().toISOString()) {
  return changeHighlights(state, materialId, (current, course) => {
    if (current.length >= MAX_HIGHLIGHTS) throw new Error(`Este PDF já tem ${MAX_HIGHLIGHTS} marcações. Remova algumas para marcar mais.`);
    const [highlight] = normalizeHighlights([{ id, page, color, rects: mergeRects(rects), text, createdAt: now }], course.pdf.pages);
    if (!highlight) throw new Error('Selecione um trecho de texto da página para marcar.');
    return [...current, highlight];
  });
}

export function recolorHighlight(state, materialId, highlightId, color) {
  if (!COLOR_IDS.has(color)) throw new Error('Cor de marca-texto desconhecida.');
  return changeHighlights(state, materialId, (current) => {
    const target = current.find((item) => item.id === highlightId);
    if (!target || target.color === color) return current;
    return current.map((item) => item === target ? { ...item, color } : item);
  });
}

export function removeHighlight(state, materialId, highlightId) {
  return changeHighlights(state, materialId, (current) => {
    const next = current.filter((item) => item.id !== highlightId);
    return next.length === current.length ? current : next;
  });
}

// Marcação sob um ponto da página (em frações), a mais recente primeiro.
export function highlightAt(highlights, page, point) {
  return [...(highlights || [])].reverse().find((item) => item.page === page
    && item.rects.some((rect) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h)) || null;
}

// ---------------- Leitor inteligente (determinístico) ----------------
// Tudo aqui roda sobre o texto que o próprio navegador extraiu do PDF; nada é
// enviado. O resultado é identificação de assunto, não prova de compreensão.

// Seção do sumário em que a página está: a entrada mais profunda entre as
// últimas que começam até a página atual.
export function sectionAt(outline, page) {
  let current = null;
  const path = [];
  for (const item of outline || []) {
    if (item.page > page) continue;
    if (!current || item.page >= current.page) {
      path.length = item.depth;
      path[item.depth] = item.title;
      current = { ...item, path: path.filter(Boolean) };
    }
  }
  return current;
}

// Seções do sumário que começam até a página mais adiante já aberta.
export function sectionsCovered(outline, reached) {
  return (outline || []).filter((item) => item.depth === 0 && item.page <= reached).map((item) => item.title);
}

// Agrupa os itens de texto do pdf.js em linhas (mesma altura na página).
export function linesFromItems(items) {
  const rows = [];
  for (const item of items || []) {
    const text = String(item?.str ?? '');
    if (!text.trim()) continue;
    const y = Math.round(Number(item.transform?.[5]) || 0);
    const size = Math.abs(Number(item.transform?.[3]) || Number(item.height) || 0);
    const row = rows.find((line) => Math.abs(line.y - y) <= 2);
    if (row) { row.text += (row.text.endsWith(' ') || text.startsWith(' ') ? '' : ' ') + text; row.size = Math.max(row.size, size); }
    else rows.push({ y, size, text });
  }
  return rows.sort((a, b) => b.y - a.y).map((line) => ({ ...line, text: clean(line.text, 300) }));
}

// Título visível da página: linha com fonte claramente maior que a do corpo.
export function pageHeading(lines) {
  const sizes = (lines || []).map((line) => line.size).filter((size) => size > 0).sort((a, b) => a - b);
  if (!sizes.length) return '';
  const body = sizes[Math.floor(sizes.length / 2)];
  const candidate = (lines || []).slice(0, 12)
    .filter((line) => line.size >= body * 1.2 && line.text.length >= 3 && line.text.length <= 140 && /\p{L}/u.test(line.text))
    .sort((a, b) => b.size - a.size)[0];
  return candidate ? candidate.text : '';
}

const STOPWORDS = new Set(`a o as os um uma uns umas de da do das dos em na no nas nos por pela pelo pelas pelos para com sem sob sobre entre ate até
e ou mas nem que se como quando onde qual quais quem cujo cuja porque pois portanto assim tambem também ainda ja já mais menos muito muita muitos
muitas pouco toda todo todas todos outra outro outras outros mesmo mesma ser sao são foi era sera será estar esta está estao estão estava ter tem
têm tinha havia haver pode podem deve devem isso isto esse essa esses essas este esta estes estas aquele aquela aqueles aquelas ele ela eles elas
seu sua seus suas lhe lhes nao não sim cada qualquer apenas sendo sido caso forma modo vez vezes artigo pagina página capitulo capítulo secao seção
item itens parte anexo figura tabela exemplo exemplos the and for with from that this are was were have has into your their`.split(/\s+/));

const fold = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');

function words(text) {
  return String(text ?? '').match(/\p{L}[\p{L}\p{M}-]*\p{L}/gu) || [];
}

// Termos mais frequentes da página, sem palavras vazias. A grafia exibida é a
// mais comum no texto; a contagem ignora acentos e maiúsculas.
export function pageKeywords(text, limit = 8) {
  const counts = new Map();
  for (const word of words(text)) {
    if (word.length < 4) continue;
    const key = fold(word);
    if (STOPWORDS.has(key) || STOPWORDS.has(word.toLocaleLowerCase('pt-BR'))) continue;
    const entry = counts.get(key) || { count: 0, forms: new Map() };
    entry.count += 1;
    entry.forms.set(word.toLocaleLowerCase('pt-BR'), (entry.forms.get(word.toLocaleLowerCase('pt-BR')) || 0) + 1);
    counts.set(key, entry);
  }
  return [...counts.values()]
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => [...entry.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}

// Pontua cada disciplina pelo nome e pelas palavras-chave que aparecem no
// texto. Termos do nome com menos de 4 letras ("de", "do") não contam.
export function scoreSubjects(subjects, text) {
  const haystack = ` ${words(text).map(fold).join(' ')} `;
  return (subjects || []).map((subject) => {
    const terms = [...new Set([subject.title, ...(subject.keywords || [])].flatMap((value) => {
      const all = words(value).map(fold).filter((word) => word.length >= 4 && !STOPWORDS.has(word));
      const phrase = words(value).map(fold).join(' ');
      return phrase.includes(' ') ? [phrase, ...all] : all;
    }))];
    const hits = terms.filter((term) => haystack.includes(` ${term} `));
    const score = hits.reduce((sum, term) => sum + (term.includes(' ') ? 3 : 1), 0);
    return { subject, score, hits };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
}

// Sugere a disciplina de um PDF novo pelo nome do arquivo, título, sumário e
// primeiras páginas. Sem nenhum termo em comum, não sugere.
export function suggestSubject(subjects, { title = '', name = '', outline = [], text = '' }) {
  const source = [title, name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), ...(outline || []).slice(0, 60).map((item) => item.title), String(text).slice(0, 8000)].join('\n');
  return scoreSubjects(subjects, source)[0] || null;
}

// O que o leitor mostra sobre a página aberta.
export function identifyPage({ subjects = [], subject = null, outline = [], page = 1, text = '', lines = [] }) {
  const section = sectionAt(outline, page);
  const heading = pageHeading(lines);
  const ranked = scoreSubjects(subjects, [heading, section?.path?.join(' '), text].join('\n'));
  const linkedMatch = subject ? ranked.find((item) => item.subject.id === subject.id) || null : null;
  const other = ranked.find((item) => item.subject.id !== subject?.id) || null;
  return {
    section: section ? { title: section.title, path: section.path, page: section.page, source: 'outline' } : heading ? { title: heading, path: [heading], page, source: 'heading' } : null,
    heading,
    keywords: pageKeywords(text),
    subject: subject ? { subject, source: 'link', hits: linkedMatch?.hits || [] } : other ? { subject: other.subject, source: 'text', hits: other.hits } : null,
    // A página fala mais de outra disciplina do que da vinculada.
    elsewhere: subject && other && other.score > (linkedMatch?.score || 0) ? { subject: other.subject, hits: other.hits } : null,
    empty: !String(text).trim(),
  };
}
