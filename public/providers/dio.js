// DIO.
//
// Ainda sem leitor dedicado: a grade pública passa pelo leitor de página
// compartilhado (dados schema.org e estrutura visível) e, logada, pela leitura
// de tela da extensão. As capacidades abaixo dizem só o que esse caminho
// entrega hoje.

function identify() {
  return null;
}

export default {
  id: 'dio',
  label: 'DIO',
  aliases: [],
  hosts: ['dio.me'],
  structure: 'bootcamps e módulos',
  art: 'code',
  syllabus: 'page',
  note: 'Bootcamps públicos listam módulos; o detalhe das aulas pode exigir cadastro.',
  capabilities: { syllabus: 'partial', progress: 'lesson-flags', resume: false, requiresLogin: false },
  identify,
  readers: {},
};
