// Alura.
//
// Ainda sem leitor dedicado: a grade pública passa pelo leitor de página
// compartilhado (dados schema.org e estrutura visível) e, logada, pela leitura
// de tela da extensão. As capacidades abaixo dizem só o que esse caminho
// entrega hoje.

function identify() {
  return null;
}

export default {
  id: 'alura',
  label: 'Alura',
  aliases: [],
  hosts: ['alura.com.br'],
  structure: 'cursos, módulos e aulas',
  art: 'code',
  syllabus: 'structured',
  note: 'Cursos avulsos e formações publicam parte da ementa na página. Trilhas fechadas podem aparecer incompletas.',
  capabilities: { syllabus: 'partial', progress: 'lesson-flags', resume: false, requiresLogin: false },
  identify,
  readers: {},
};
