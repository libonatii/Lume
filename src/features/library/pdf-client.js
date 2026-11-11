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
  const response = await fetch(`/api/library/files/${fileId}`, {
    method: 'PUT', credentials: 'same-origin', body: file,
    headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name || 'documento.pdf') },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError({ data }));
  return data;
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
export async function openDocument(data) {
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
export async function readOutline(doc) {
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
