// Transporte dos PDFs da biblioteca e o motor de leitura (pdf.js). O arquivo
// vem sempre do servidor, com conexão: não há cópia em armazenamento do
// navegador nem fila offline. O pdf.js é carregado só quando um PDF é aberto.

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api, apiError } from '../../lib/api.js';
import { linesFromItems } from '../../../public/pdf-domain.js';

let engine = null;
async function pdfjs() {
  engine ||= import('pdfjs-dist').then((module) => {
    module.GlobalWorkerOptions.workerSrc = workerUrl;
    return module;
  });
  return engine;
}

export async function storageInfo() {
  const result = await api('/api/library/files');
  if (!result.ok) throw new Error(apiError(result));
  return result.data;
}

export async function uploadPdf(file, fileId) {
  const presign = await api(`/api/library/files/${fileId}/upload-url`, {
    method: 'POST',
    body: {
      name: file.name || 'documento.pdf',
      size: file.size,
      contentType: 'application/pdf',
    },
  });
  if (!presign.ok) throw new Error(apiError(presign));

  const { uploadUrl, method = 'PUT', direct = false, headers = {} } = presign.data;
  const putRes = await fetch(uploadUrl, {
    method,
    credentials: direct ? 'omit' : 'same-origin',
    headers,
    body: file,
  });
  if (!putRes.ok) {
    const data = await putRes.json().catch(() => null);
    throw new Error(apiError({ data }));
  }

  const confirmed = await api(`/api/library/files/${fileId}/confirm`, { method: 'POST' });
  if (!confirmed.ok) throw new Error(apiError(confirmed));

  // Pré-processamento assíncrono do Markdown para cache no banco (não bloqueia o anexo).
  extractAndSaveMarkdown(file, fileId).catch(() => {});
  return confirmed.data;
}

export async function extractDocumentMarkdown(doc, { maxPages = 200 } = {}) {
  const total = Math.min(doc.numPages || 0, maxPages);
  const parts = [];
  for (let p = 1; p <= total; p += 1) {
    const { text } = await readPageText(doc, p).catch(() => ({ text: '' }));
    if (text && text.trim()) parts.push(`## Página ${p}\n${text.trim()}`);
  }
  return parts.join('\n\n');
}

export async function savePdfMarkdown(fileId, markdown, source = 'pdfjs') {
  const result = await api(`/api/library/files/${fileId}/markdown`, {
    method: 'PUT',
    body: { markdown, source },
  });
  if (!result.ok) throw new Error(apiError(result));
  return result.data;
}

async function extractAndSaveMarkdown(file, fileId) {
  const { doc, close } = await openDocument(new Uint8Array(await file.arrayBuffer()));
  try {
    const markdown = await extractDocumentMarkdown(doc);
    await savePdfMarkdown(fileId, markdown, 'pdfjs');
  } finally {
    await close().catch(() => {});
  }
}

export async function getPdfInsights(fileId, signal) {
  const result = await api(`/api/library/files/${fileId}/insights`, { signal });
  if (!result.ok) throw new Error(apiError(result));
  return result.data;
}

export async function generatePdfInsights(fileId, { refresh = false, onStatus, onDelta, signal } = {}) {
  const response = await fetch(`/api/library/files/${fileId}/insights?stream=1`, {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ refresh }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(apiError({ data }));
  }
  if (!contentType.includes('text/event-stream') || !response.body) {
    return response.json();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let finalPayload = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (!line) {
          eventName = 'message';
          continue;
        }
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          let data = null;
          try { data = JSON.parse(raw); } catch { continue; }
          if (eventName === 'status' && typeof onStatus === 'function') onStatus(data);
          else if (eventName === 'delta' && typeof onDelta === 'function') onDelta(data.text || '');
          else if (eventName === 'done') finalPayload = data;
          else if (eventName === 'error') throw new Error(data?.error || 'Não foi possível gerar o resumo agora.');
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  if (!finalPayload) throw new Error('A geração do resumo foi interrompida antes de concluir.');
  return finalPayload;
}

export async function discardPdf(fileId) {
  await api(`/api/library/files/${fileId}`, { method: 'DELETE' }).catch(() => null);
}

export async function identifyWithAI(text, subjects) {
  const result = await api('/api/library/identify', { method: 'POST', body: { text, subjects } });
  if (!result.ok) throw new Error(apiError(result));
  return result.data;
}

// Devolve o documento e como fechá-lo: no pdf.js 6 quem libera o worker e a
// memória é a tarefa de carregamento, não o documento.
async function openDocument(data) {
  const lib = await pdfjs();
  // WebAssembly fica desligado: a CSP do site não libera wasm, e imagens JPEG
  // 2000 raras aparecem em branco em vez de quebrar a leitura.
  const task = lib.getDocument({ data, useWasm: false });
  return { doc: await task.promise, close: () => task.destroy() };
}

export async function downloadDocument(fileId, signal) {
  const response = await fetch(`/api/library/files/${fileId}`, { credentials: 'same-origin', signal });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(apiError({ data }));
  }
  return openDocument(new Uint8Array(await response.arrayBuffer()));
}

// Sumário achatado com a página de cada entrada (até 3 níveis).
async function readOutline(doc) {
  const outline = [];
  const walk = async (items, depth) => {
    for (const item of items || []) {
      if (outline.length >= 300) return;
      let page = null;
      try {
        const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
        if (Array.isArray(dest) && dest[0]) page = typeof dest[0] === 'object' ? await doc.getPageIndex(dest[0]) + 1 : Number.isInteger(dest[0]) ? dest[0] + 1 : null;
      } catch { page = null; }
      if (page && item.title?.trim()) outline.push({ title: item.title.trim(), page, depth });
      if (depth < 3) await walk(item.items, depth + 1);
    }
  };
  await walk(await doc.getOutline().catch(() => null), 0);
  return outline;
}

export async function readPageText(doc, number) {
  const page = await doc.getPage(number);
  const content = await page.getTextContent();
  const lines = linesFromItems(content.items);
  return { text: lines.map((line) => line.text).join('\n'), lines };
}

// Lido antes do envio: páginas, título dos metadados, sumário e o texto das
// primeiras páginas para sugerir a disciplina. Nada disso sai do navegador.
export async function inspectPdf(file) {
  const { doc, close } = await openDocument(new Uint8Array(await file.arrayBuffer()));
  try {
    const meta = await doc.getMetadata().catch(() => null);
    const outline = await readOutline(doc);
    let text = '';
    for (let number = 1; number <= Math.min(doc.numPages, 3); number += 1) text += `${(await readPageText(doc, number)).text}\n`;
    return { pages: doc.numPages, title: String(meta?.info?.Title || '').trim(), outline, text: text.slice(0, 8000) };
  } finally {
    close();
  }
}
