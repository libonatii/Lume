// Estratégia Concursos.
//
// Ainda sem leitor dedicado: a grade pública passa pelo leitor de página
// compartilhado (dados schema.org e estrutura visível) e, logada, pela leitura
// de tela da extensão. As capacidades abaixo dizem só o que esse caminho
// entrega hoje.

function identify() {
  return null;
}

export default {
  id: 'estrategia',
  label: 'Estratégia Concursos',
  aliases: ['Estratégia', 'Estrategia'],
  hosts: ['estrategiaconcursos.com.br'],
  structure: 'disciplinas e assuntos',
  art: 'nature',
  syllabus: 'page',
  note: 'O Lume lê apenas a página pública do curso. A grade completa costuma exigir acesso à conta: abra o curso logado e use a extensão do Lume, ou copie a página e cole.',
  capabilities: { syllabus: 'partial', progress: 'lesson-flags', resume: false, requiresLogin: true },
  identify,
  readers: {},
};
