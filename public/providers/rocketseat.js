// Rocketseat.
//
// Ainda sem leitor dedicado: a grade pública passa pelo leitor de página
// compartilhado (dados schema.org e estrutura visível) e, logada, pela leitura
// de tela da extensão. As capacidades abaixo dizem só o que esse caminho
// entrega hoje.

function identify() {
  return null;
}

export default {
  id: 'rocketseat',
  label: 'Rocketseat',
  aliases: [],
  hosts: ['rocketseat.com.br'],
  structure: 'trilhas, módulos e projetos',
  art: 'code',
  syllabus: 'page',
  note: 'A trilha pública lista módulos e aulas; o conteúdo em vídeo exige acesso próprio.',
  capabilities: { syllabus: 'partial', progress: 'lesson-flags', resume: false, requiresLogin: false },
  identify,
  readers: {},
};
