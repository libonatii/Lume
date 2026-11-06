// Coursera.
//
// Ainda sem leitor dedicado: a grade pública passa pelo leitor de página
// compartilhado (dados schema.org e estrutura visível) e, logada, pela leitura
// de tela da extensão. As capacidades abaixo dizem só o que esse caminho
// entrega hoje.

// O curso é o primeiro segmento depois de /learn/: aulas abertas dentro dele
// apontam para o mesmo curso.
function identify(url) {
  const found = /^(\/learn\/[^/]+)/i.exec(url.pathname);
  if (!found) return null;
  return { courseExternalId: found[1].split('/').pop(), canonicalUrl: `${url.origin}${found[1]}` };
}

export default {
  id: 'coursera',
  label: 'Coursera',
  aliases: [],
  hosts: ['coursera.org'],
  structure: 'semanas e aulas',
  art: 'language',
  syllabus: 'structured',
  note: 'Parte do programa é publicada na página do curso. A duração real pode variar por turma.',
  capabilities: { syllabus: 'partial', progress: 'lesson-flags', resume: false, requiresLogin: false },
  identify,
  readers: {},
};
