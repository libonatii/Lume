// Udemy.
//
// Ainda sem leitor dedicado: a grade pública passa pelo leitor de página
// compartilhado (dados schema.org e estrutura visível) e, logada, pela leitura
// de tela da extensão. As capacidades abaixo dizem só o que esse caminho
// entrega hoje.

// O curso é o primeiro segmento depois de /course/: aulas abertas dentro dele
// apontam para o mesmo curso.
function identify(url) {
  const found = /^(\/course\/[^/]+)/i.exec(url.pathname);
  if (!found) return null;
  return { courseExternalId: found[1].split('/').pop(), canonicalUrl: `${url.origin}${found[1]}` };
}

export default {
  id: 'udemy',
  label: 'Udemy',
  aliases: [],
  hosts: ['udemy.com'],
  structure: 'seções e aulas',
  art: 'design',
  syllabus: 'structured',
  note: 'O catálogo publica título e parte do currículo em dados estruturados. Aulas pagas não são acessíveis ao Lume.',
  capabilities: { syllabus: 'partial', progress: 'lesson-flags', resume: false, requiresLogin: false },
  identify,
  readers: {},
};
