// Hotmart.
//
// Ainda sem leitor dedicado: a grade pública passa pelo leitor de página
// compartilhado (dados schema.org e estrutura visível) e, logada, pela leitura
// de tela da extensão. As capacidades abaixo dizem só o que esse caminho
// entrega hoje.

function identify() {
  return null;
}

export default {
  id: 'hotmart',
  label: 'Hotmart',
  aliases: [],
  hosts: ['hotmart.com'],
  structure: 'módulos e aulas',
  art: 'design',
  syllabus: 'manual',
  note: 'Páginas de produto raramente publicam a grade. Prefira colar a ementa ou enviar um arquivo.',
  capabilities: { syllabus: 'none', progress: 'lesson-flags', resume: false, requiresLogin: true },
  identify,
  readers: {},
};
