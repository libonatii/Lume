// Registro único de provedores de curso. Cada plataforma tem um módulo próprio
// (public/providers/<id>.js) que declara capacidades, como reconhecer o curso
// pelo endereço e os leitores que existem para ela. Navegador, servidor e
// extensão leem daqui: não há outra lista de domínios no código.
//
// Contrato de um provedor:
//   id, label, aliases (nomes da plataforma em títulos), hosts, structure, art,
//   syllabus ('structured' | 'page' | 'manual'), note,
//   capabilities: { syllabus: 'full'|'partial'|'none', progress: 'none'|'lesson-flags',
//                   resume: boolean, requiresLogin: boolean },
//   identify(url) → { courseExternalId, canonicalUrl } | null,
//   readers: { page?(ctx), public?(ctx), snapshot?(ctx) }
// Um leitor devolve disciplinas → módulos → aulas; cada nível pode trazer
// `externalId`, a identidade da plataforma, que prevalece sobre o título.

import alura from './alura.js';
import coursera from './coursera.js';
import dio from './dio.js';
import estrategia from './estrategia.js';
import grancursos from './grancursos.js';
import hotmart from './hotmart.js';
import rocketseat from './rocketseat.js';
import udemy from './udemy.js';
import { hostMatches } from './kit.js';

export const PROVIDERS = Object.freeze([grancursos, estrategia, alura, rocketseat, udemy, coursera, dio, hotmart]);

// Fonte sem adaptador: o Lume lê o que der da página, sem ler conclusão.
export const UNKNOWN_PROVIDER = Object.freeze({
  id: 'unknown',
  label: 'Fonte não reconhecida',
  aliases: [],
  hosts: [],
  structure: 'conteúdo',
  art: 'nature',
  syllabus: 'page',
  note: 'Fonte sem adaptador próprio. O Lume tenta ler dados estruturados e a estrutura visível da página, sem ler o que já foi concluído; se não bastar, use texto ou arquivo.',
  capabilities: Object.freeze({ syllabus: 'partial', progress: 'none', resume: false, requiresLogin: false }),
  identify: () => null,
  readers: Object.freeze({}),
});

export function providerById(id) {
  return PROVIDERS.find((item) => item.id === id) || UNKNOWN_PROVIDER;
}

export function providerForHost(hostname) {
  return PROVIDERS.find((item) => hostMatches(hostname, item.hosts)) || UNKNOWN_PROVIDER;
}

export function providerForUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { return UNKNOWN_PROVIDER; }
  if (!['http:', 'https:'].includes(url.protocol)) return UNKNOWN_PROVIDER;
  return providerForHost(url.hostname);
}

// Nomes de plataforma que aparecem como sufixo de título ("Curso X | Udemy").
export function platformNames() {
  return PROVIDERS.flatMap((item) => [item.label, ...(item.aliases || [])]);
}

export function isPlatformName(text) {
  const value = String(text || '').trim().toLowerCase();
  return platformNames().some((name) => name.toLowerCase() === value);
}

// O provedor sabe ler o que a plataforma marca como concluído?
export function readsCompletion(provider) {
  return provider?.capabilities?.progress && provider.capabilities.progress !== 'none';
}
